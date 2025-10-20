<template>
    <el-page-header @back="$router.back()" :content="examName" />
    <el-divider />
    <el-table :data="subjects" v-loading="loading" style="width: 100%">
      <el-table-column prop="subjectName" label="科目名称" />
      <el-table-column label="阅卷进度">
        <template #default="{ row }">
            <el-progress :percentage="row.markingProcess?.markingProcess || 0" />
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="{ row }">
          <router-link :to="{ name: 'score-check', params: { examId: examId, markingPaperId: row.markingPaperId } }">
            <el-button type="success" size="small">成绩核查</el-button>
          </router-link>
        </template>
      </el-table-column>
    </el-table>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

const props = defineProps<{ examId: string }>();

const examData = ref<any>({});
const loading = ref(true);

const examName = computed(() => examData.value?.newAdminExamSubjectDTO?.[0]?.examName || '科目列表');
const subjects = computed(() => examData.value?.newAdminExamSubjectDTO || []);


onMounted(async () => {
    try {
        const { data } = await axios.get(`/exams/${props.examId}/subjects`);
        examData.value = data;
    } catch (error) {
        console.error(error);
    } finally {
        loading.value = false;
    }
});
</script>
