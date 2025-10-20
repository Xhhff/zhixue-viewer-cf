// functions/api/[[path]].ts

import { Hono } from 'hono';
import jwt from '@tsndr/cloudflare-worker-jwt';

// 定义 Cloudflare 绑定的环境变量和 Secrets
type Bindings = {
  SECRET_KEY: string;
  ZHIXUE_TGT: string;
  ZHIXUE_DEVICE_ID: string;
  SCHOOL_ID: string;
  PINNED_CLASSES: string;
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// --- 状态与工具函数 ---
let zhixueToken: string | null = null;
const getPinnedClasses = (c: any): string[] => (c.env.PINNED_CLASSES || '').split(',').filter(Boolean);

// --- 智学网 API 封装 (这部分代码保持不变) ---

const zhixueLogin = async (c: any): Promise<boolean> => {
    const { ZHIXUE_TGT, ZHIXUE_DEVICE_ID } = c.env;
    if (!ZHIXUE_TGT || !ZHIXUE_DEVICE_ID) {
        console.error("Secrets not found: TGT or Device ID is missing in Cloudflare environment variables.");
        return false;
    }
    
    try {
        console.log("Attempting to extend TGT...");
        const extendRes = await fetch("https://open.changyan.com/sso/v1/api", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new    URLSearchParams({
                tgt: ZHIXUE_TGT, method: 'sso.extend.tgt', ncetAppId: 'E3KzZvjVkC8kQXWBlR5521GztpApNn99',
                appId: 'zhixue_teacher', deviceId: ZHIXUE_DEVICE_ID,
            }),
        });

        const extendDataText = await extendRes.text(); // 先获取文本，防止json解析失败
        console.log("Response from TGT extend:", extendDataText); // **关键日志**
        const extendData = JSON.parse(extendDataText) as any;

        if (!extendData.data || !extendData.data.at) {
            console.error("Failed to get 'at' from TGT extend response. Response data:", extendData);
            return false;
        }

        const at = extendData.data.at;
        const userId = extendData.data.userId;
        
        console.log("Attempting uniteLogin with 'at' token...");
        const uniteRes = await fetch("https://app.zhixue.com/appteacher/home/uniteLogin?", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                appId: "zhixue_teacher", at, autologin: 'true', ncetAppId: 'E3KzZvjVkC8kQXWBlR5521GztpApNn99', userId,
            }),
        });

        const uniteDataText = await uniteRes.text();
        console.log("Response from uniteLogin:", uniteDataText); // **关键日志**
        const uniteData = JSON.parse(uniteDataText) as any;

        if (!uniteData.result || !uniteData.result.user || !uniteData.result.user.token) {
            console.error("Failed to get final token from uniteLogin response. Response data:", uniteData);
            return false;
        }

        zhixueToken = uniteData.result.user.token;
        console.log("Successfully logged into Zhixue and got final token.");
        return true;

    } catch (error) {
        console.error("An exception occurred during Zhixue login process:", error);
        zhixueToken = null;
        return false;
    }
};

const makeZhixueRequest = async (c: any, url: string, options: RequestInit = {}): Promise<Response> => {
    if (!zhixueToken) {
        if (!(await zhixueLogin(c))) {
        return c.json({ message: "智学网登录失败，请检查后台配置" }, 500);
        }
    }
    const defaultHeaders = {
        "token": zhixueToken!,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0"
    };
    options.headers = { ...defaultHeaders, ...options.headers };
    let response = await fetch(url, options);
    if (response.status === 401 || response.status === 403) {
        console.log("Token might be expired, re-logging in...");
        if (await zhixueLogin(c)) {
        options.headers = { ...options.headers, token: zhixueToken! };
        response = await fetch(url, options);
        }
    }
    return response;
};

// --- 【重要修改】自定义认证中间件 ---
const authMiddleware = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ message: 'Authorization header is missing or invalid' }, 401);
    }
    const token = authHeader.substring(7);
    const isValid = await jwt.verify(token, c.env.SECRET_KEY);
    if (!isValid) {
        return c.json({ message: 'Invalid token' }, 401);
    }
    await next();
};


// --- API 路由 ---

// 登录接口 (无需认证)
app.post('/login', async (c) => {
    if (await zhixueLogin(c)) {
        const appToken = await jwt.sign({ user: 'admin', exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) }, c.env.SECRET_KEY);
        return c.json({ token: appToken, role: 'superadmin' });
    }
    return c.json({ message: '智学网登录失败' }, 401);
});

// --- 【重要修改】应用全局认证中间件 ---
// 除了登录接口，所有其他 /api/* 的请求都需要经过我们的认证中间件
app.use('/*', authMiddleware);

// 考试列表
app.get('/exams', async (c) => {
    const res = await makeZhixueRequest(c, "https://www.zhixue.com/exam/examcenter/schoolManager/examiner/list", {
        method: "POST", headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ pageIndex: "1" })
    });
    const data = await res.json() as any;
    return c.json(JSON.parse(data.message));
});

// 科目列表
app.get('/exams/:examId/subjects', async (c) => {
    const { examId } = c.req.param();
    const res = await makeZhixueRequest(c, "https://pt-ali-bj.zhixue.com/exam/examcenter/getExaminerPaperList", {
        method: "POST", headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ examId })
    });
    const data = await res.json() as any;
    return c.json(JSON.parse(data.message));
});

// 成绩核查 - 初始化
app.post('/subjects/:markingPaperId/score_check/initiate', async (c) => {
    const { markingPaperId } = c.req.param();
    const baseUrl = "https://pt-ali-bj.zhixue.com/markingtools/markingtools/scoreCheck";
    const ts = Date.now();
    
    const hasDataRes = await makeZhixueRequest(c, `${baseUrl}/hasData?markingPaperId=${markingPaperId}&t=${ts}`);
    const hasData = await hasDataRes.json() as any;
    if(JSON.parse(hasData.message).hasData) {
        return c.json({ result: "success", message: "数据已存在" });
    }

    return await makeZhixueRequest(c, `${baseUrl}/startArchiveCheck?markingPaperId=${markingPaperId}&t=${ts}`);
});

// 成绩核查 - 获取班级
app.get('/subjects/:markingPaperId/classes', async (c) => {
    const { markingPaperId } = c.req.param();
    const url = `https://pt-ali-bj.zhixue.com/exam/marking/schoolClass?schoolId=${c.env.SCHOOL_ID}&markingPaperId=${markingPaperId}&t=${Date.now()}`;
    const res = await makeZhixueRequest(c, url);
    const data = await res.json() as any[];

    const pinnedNames = getPinnedClasses(c);
    const pinnedClasses = data.filter(cls => pinnedNames.includes(cls.className));
    const otherClasses = data.filter(cls => !pinnedNames.includes(cls.className));
    
    const sorted = [
        ...pinnedClasses.sort((a, b) => pinnedNames.indexOf(a.className) - pinnedNames.indexOf(b.className)),
        ...otherClasses.sort((a, b) => a.className.localeCompare(b.className))
    ];
    
    return c.json(sorted);
});

// 成绩核查 - 获取班级分数
app.get('/subjects/:markingPaperId/classes/:classId/scores', async (c) => {
    const { markingPaperId, classId } = c.req.param();
    const dataParam = JSON.stringify({
        score: "", isCheck: "", markingPaperId, objectiveScore: "", subjectiveScore: "",
        pageIndex: 1, pageSize: 200, schoolId: c.env.SCHOOL_ID, classId,
        userInfo: "", searchType: 0, offsetCode: ""
    });
    const url = `https://pt-ali-bj.zhixue.com/markingtools/checkRecord/getDetailByClass?data=${encodeURIComponent(dataParam)}&markingPaperId=${markingPaperId}&t=${Date.now()}`;
    const res = await makeZhixueRequest(c, url);
    const data = await res.json() as any;
    return c.json(JSON.parse(data.message));
});

// 成绩核查 - 获取学生详情
app.get('/students/detail', async (c) => {
    const { userId, userCode, markingPaperId } = c.req.query();
    const url = "https://pt-ali-bj.zhixue.com/markingtools/markingtools/getMarkingArchiveRecordDetailByUserId/";
    const res = await makeZhixueRequest(c, url, {
        method: "POST", headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ userId, userCode, markingPaperId, topicNum: '' })
    });
    const data = await res.json() as any;
    return c.json(JSON.parse(data.message));
});

// 导出 Hono app
export const onRequest: PagesFunction<Bindings> = (context) => {
  // 通过 context.functionPath 我们可以移除 /functions 前缀, 但 Hono 的 basePath 更好
  return app.fetch(context.request, context.env, context);
};
