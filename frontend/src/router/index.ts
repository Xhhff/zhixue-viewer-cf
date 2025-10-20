import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/exam/:examId/subjects',
      name: 'exam-subjects',
      component: () => import('../views/ExamSubjectsView.vue'),
      props: true,
    },
    {
        path: '/exam/:examId/subject/:markingPaperId/check',
        name: 'score-check',
        component: () => import('../views/ScoreCheckView.vue'),
        props: true,
    }
  ]
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  if (to.name !== 'login' && !authStore.isLoggedIn) {
    next({ name: 'login' });
  } else {
    next();
  }
});

export default router
