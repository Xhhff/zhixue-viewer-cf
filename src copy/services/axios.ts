import axios from 'axios';
import { useAuthStore } from '../stores/auth';

axios.defaults.baseURL = '/api'; // nginx会代理到后端

axios.interceptors.request.use(config => {
    const authStore = useAuthStore();
    const token = authStore.token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
