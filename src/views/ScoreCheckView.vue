<template>
  <el-page-header @back="$router.back()" content="成绩核查" />
  <el-divider />
  <el-container style="height: calc(100vh - 100px);" v-loading="pageLoading" element-loading-text="正在准备数据，请稍候...">
    <el-aside width="250px" style="border-right: 1px solid #eee; padding-right: 10px;">
        <el-scrollbar>
            <el-menu :default-active="selectedClassId" @select="handleClassSelect">
                <el-menu-item v-for="c in classes" :key="c.classId" :index="c.classId">
                    {{ c.className }}
                </el-menu-item>
            </el-menu>
        </el-scrollbar>
    </el-aside>
    <el-main>
      <el-table :data="students" v-loading="tableLoading" height="100%">
        <el-table-column prop="userName" label="姓名" width="120" />
        <el-table-column prop="userCode" label="准考证号" />
        <el-table-column prop="score" label="总分" sortable />
        <el-table-column prop="objectiveScore" label="客观题分" sortable />
        <el-table-column prop="subjectiveScore" label="主观题分" sortable />
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="viewDetails(row)">查看答题卡</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-main>
  </el-container>

  <StudentDetailModal 
    v-model:visible="isModalVisible"
    :student-info="selectedStudent"
    :marking-paper-id="markingPaperId"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';
import StudentDetailModal from '../components/StudentDetailModal.vue';

const props = defineProps<{ examId: string; markingPaperId: string }>();

const pageLoading = ref(true);
const tableLoading = ref(false);
const classes = ref<any[]>([]);
const students = ref<any[]>([]);
const selectedClassId = ref<string | null>(null);

const isModalVisible = ref(false);
const selectedStudent = ref<any>(null);

const initData = async () => {
    try {
        await axios.post(`/subjects/${props.markingPaperId}/score_check/initiate`);
        const { data } = await axios.get(`/subjects/${props.markingPaperId}/classes`);
        classes.value = data;
        if (data.length > 0) {
            selectedClassId.value = data[0].classId;
        }
    } catch (error) {
        console.error(error);
        alert('数据初始化或班级列表获取失败');
    } finally {
        pageLoading.value = false;
    }
};

const fetchScores = async (classId: string) => {
    if (!classId) return;
    tableLoading.value = true;
    try {
        const { data } = await axios.get(`/subjects/${props.markingPaperId}/classes/${classId}/scores`);
        students.value = data.list || [];
    } catch (error) {
        console.error(error);
    } finally {
        tableLoading.value = false;
    }
};

onMounted(initData);

watch(selectedClassId, (newVal) => {
    if (newVal) fetchScores(newVal);
});

const handleClassSelect = (index: string) => {
    selectedClassId.value = index;
};

const viewDetails = (student: any) => {
  selectedStudent.value = student;
  isModalVisible.value = true;
};
</script>
