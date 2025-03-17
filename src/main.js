import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

// Check for dark mode preference
const prefersDarkMode =
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
if (prefersDarkMode) {
  document.body.classList.add('dark-mode')
}

createApp(App).mount('#app')
