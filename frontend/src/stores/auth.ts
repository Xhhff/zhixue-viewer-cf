import { defineStore } from 'pinia';
import axios from 'axios';
import router from '../router';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('token') || null,
        role: localStorage.getItem('role') || null,
    }),
    getters: {
        isLoggedIn: (state) => !!state.token,
    },
    actions: {
        async login() {
            try {
                // 后端配置了TGT和DeviceID，前端无需再传
                const { data } = await axios.post('/login');
                this.token = data.token;
                this.role = data.role;
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role);
                router.push('/');
            } catch (error) {
                console.error('Login failed:', error);
                alert('登录失败，请检查后端配置和智学网TGT是否有效。');
            }
        },
        logout() {
            this.token = null;
            this.role = null;
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            router.push('/login');
        },
    },
});
