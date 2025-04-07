import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import NavigationView from '../views/NavigationView.vue'
import TracksView from '../views/TracksView.vue'
import TrackDetailView from '../views/TrackDetailView.vue'
import TrackRecorderView from '../views/TrackRecorderView.vue'
import UserPreferencesView from '../views/UserPreferencesView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/navigation',
      name: 'navigation',
      component: NavigationView,
    },
    {
      path: '/tracks',
      name: 'tracks',
      component: TracksView,
    },
    {
      path: '/track/:id',
      name: 'track-detail',
      component: TrackDetailView,
      props: true,
    },
    {
      path: '/track-recorder',
      name: 'track-recorder',
      component: TrackRecorderView,
    },
    {
      path: '/preferences',
      name: 'preferences',
      component: UserPreferencesView,
    },
  ],
})

export default router
