<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>智学网第三方客户端登录</span>
        </div>
      </template>
      <p>后台已配置管理员TGT和DeviceID。</p>
      <p>请点击下方按钮进行登录。</p>
      <el-button type="primary" @click="handleLogin" :loading="loading" style="width: 100%;">
        登 录
      </el-button>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const loading = ref(false);

const handleLogin = async () => {
  loading.value = true;
  await authStore.login();
  loading.value = false;
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-color: #f0f2f5;
}
.login-card {
  width: 400px;
}
.card-header {
  text-align: center;
  font-size: 20px;
}
p {
  color: #888;
  text-align: center;
  margin-bottom: 20px;
}
</style>
