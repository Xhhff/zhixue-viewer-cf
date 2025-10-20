<template>
  <el-page-header @back="authStore.logout" title="退出登录" content="考试列表"></el-page-header>
  <el-divider />
  <el-space wrap :size="20" v-loading="loading">
    <el-card v-for="exam in exams" :key="exam.examId" class="exam-card" shadow="hover">
       <template #header>
        <div class="card-header">
          <span>{{ exam.examName }}</span>
        </div>
      </template>
      <p>创建时间: {{ new Date(exam.createDate).toLocaleDateString() }}</p>
      <template #footer>
        <router-link :to="{ name: 'exam-subjects', params: { examId: exam.examId } }">
            <el-button type="primary" plain>查看科目</el-button>
        </router-link>
      </template>
    </el-card>
  </el-space>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const exams = ref<any[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const { data } = await axios.get('/exams');
    exams.value = data.examList || [];
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.exam-card {
  width: 350px;
}
.card-header {
    font-weight: bold;
}
</style>
