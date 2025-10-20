// src/services/axios.ts
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

// 确保 baseURL 是 /api，这样请求会被 Cloudflare Pages Functions 捕获
axios.defaults.baseURL = '/api'; 

axios.interceptors.request.use(config => {
    const authStore = useAuthStore();
    const token = authStore.token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
