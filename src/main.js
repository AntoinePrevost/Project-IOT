import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'

// Check for dark mode preference
const prefersDarkMode =
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
if (prefersDarkMode) {
  document.body.classList.add('dark-mode')
}

const app = createApp(App)

// Configuration pour vue-toastification
const toastOptions = {
  position: 'top-right',
  timeout: 3000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false,
}

app.use(router)
app.use(Toast, toastOptions)
app.mount('#app')
