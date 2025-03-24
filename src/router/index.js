import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/navigation',
      name: 'navigation',
      component: () => import('../views/NavigationView.vue'),
    },
  ],
})

export default router
