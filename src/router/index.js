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
    {
      path: '/tracks',
      name: 'tracks',
      component: () => import('../views/TracksView.vue'),
    },
    {
      path: '/track/:id',
      name: 'track-detail',
      component: () => import('../views/TrackDetailView.vue'),
      props: true,
    },
  ],
})

export default router
