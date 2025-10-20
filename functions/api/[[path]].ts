// functions/api/[[path]].ts

import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
// 更改1: 引入 hono 内置的 jwt 工具
import { sign, verify } from 'hono/jwt';

// 定义 Cloudflare 绑定的环境变量和 Secrets
type Bindings = {
  SECRET_KEY: string;
  ZHIXUE_TGT: string;
  ZHIXUE_DEVICE_ID: string;
  SCHOOL_ID: string;
  PINNED_CLASSES: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// --- 状态与工具函数 ---
let zhixueToken: string | null = null;
const getPinnedClasses = (c: any): string[] => {
  return (c.env.PINNED_CLASSES || '').split(',').filter(Boolean);
};

// --- 智学网 API 封装 (这部分代码保持不变) ---
const zhixueLogin = async (c: any): Promise<boolean> => {
  const { ZHIXUE_TGT, ZHIXUE_DEVICE_ID } = c.env;
  if (!ZHIXUE_TGT || !ZHIXUE_DEVICE_ID) {
    console.error("TGT or Device ID not configured in Cloudflare secrets.");
    return false;
  }
  try {
    const extendRes = await fetch("https://open.changyan.com/sso/v1/api", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        tgt: ZHIXUE_TGT, method: 'sso.extend.tgt', ncetAppId: 'E3KzZvjVkC8kQXWBlR5521GztpApNn99',
        appId: 'zhixue_teacher', deviceId: ZHIXUE_DEVICE_ID,
      }),
    });
    const extendData = await extendRes.json() as any;
    const at = extendData.data.at;
    const userId = extendData.data.userId;

    const uniteRes = await fetch("https://app.zhixue.com/appteacher/home/uniteLogin?", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        appId: "zhixue_teacher", at, autologin: 'true', ncetAppId: 'E3KzZvjVkC8kQXWBlR5521GztpApNn99', userId,
      }),
    });
    const uniteData = await uniteRes.json() as any;

    zhixueToken = uniteData.result.user.token;
    console.log("Successfully logged into Zhixue and got token.");
    return true;
  } catch (error) {
    console.error("Zhixue login failed:", error);
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

// --- 应用认证中间件 ---

// 更改2: 使用 hono/jwt 的 verify 方法来创建中间件
const authMiddleware = bearerAuth({
  verify: async (token, c) => {
    try {
      await verify(token, c.env.SECRET_KEY);
      return true; // 验证成功
    } catch (e) {
      return false; // 验证失败
    }
  },
});

// --- API 路由 ---

// 1. 登录
app.post('/api/login', async (c) => {
  if (await zhixueLogin(c)) {
    // 更改3: 使用 hono/jwt 的 sign 方法来创建 token
    const payload = { 
        user: 'admin', 
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days expiration
    };
    const appToken = await sign(payload, c.env.SECRET_KEY);
    return c.json({ token: appToken, role: 'superadmin' });
  }
  return c.json({ message: '智学网登录失败' }, 401);
});

// --- 所有其他 API 路由保持不变 ---

// 2. 考试列表
app.get('/api/exams', authMiddleware, async (c) => {
  const res = await makeZhixueRequest(c, "https://www.zhixue.com/exam/examcenter/schoolManager/examiner/list", {
    method: "POST",
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ pageIndex: "1" })
  });
  const data = await res.json() as any;
  return c.json(JSON.parse(data.message));
});

// 3. 科目列表
app.get('/api/exams/:examId/subjects', authMiddleware, async (c) => {
  const { examId } = c.req.param();
  const res = await makeZhixueRequest(c, "https://pt-ali-bj.zhixue.com/exam/examcenter/getExaminerPaperList", {
    method: "POST",
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ examId })
  });
  const data = await res.json() as any;
  return c.json(JSON.parse(data.message));
});

// 4. 成绩核查 - 初始化
app.post('/api/subjects/:markingPaperId/score_check/initiate', authMiddleware, async (c) => {
    const { markingPaperId } = c.req.param();
    const baseUrl = "https://pt-ali-bj.zhixue.com/markingtools/markingtools/scoreCheck";
    const ts = Date.now();
    
    const hasDataRes = await makeZhixueRequest(c, `${baseUrl}/hasData?markingPaperId=${markingPaperId}&t=${ts}`);
    const hasData = await hasDataRes.json() as any;
    if(JSON.parse(hasData.message).hasData) {
        return c.json({ result: "success", message: "数据已存在" });
    }

    const startCheckRes = await makeZhixueRequest(c, `${baseUrl}/startArchiveCheck?markingPaperId=${markingPaperId}&t=${ts}`);
    return startCheckRes;
});

// 5. 成绩核查 - 获取班级
app.get('/api/subjects/:markingPaperId/classes', authMiddleware, async (c) => {
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

// 6. 成绩核查 - 获取班级分数
app.get('/api/subjects/:markingPaperId/classes/:classId/scores', authMiddleware, async (c) => {
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

// 7. 成绩核查 - 获取学生详情
app.get('/api/students/detail', authMiddleware, async (c) => {
    const { userId, userCode, markingPaperId } = c.req.query();
    const url = "https://pt-ali-bj.zhixue.com/markingtools/markingtools/getMarkingArchiveRecordDetailByUserId/";
    const res = await makeZhixueRequest(c, url, {
        method: "POST",
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ userId, userCode, markingPaperId, topicNum: '' })
    });
    const data = await res.json() as any;
    return c.json(JSON.parse(data.message));
});


// 导出 Hono app
export const onRequest: PagesFunction<Bindings> = (context) => {
  return app.fetch(context.request, context.env, context);
};

