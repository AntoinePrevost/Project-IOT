<script setup>
// import LocationTracker from './components/LocationTracker.vue'
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

const appTitle = ref('GeoLocator')
const isDarkMode = ref(false)
const mapElement = ref(null)
const router = useRouter()
let map = null

function toggleDarkMode() {
  isDarkMode.value = !isDarkMode.value
  document.body.classList.toggle('dark-mode', isDarkMode.value)
}

function initializeBackgroundMap() {
  // Initialize a background map if Leaflet is loaded
  if (window.L && mapElement.value && !map) {
    map = window.L.map(mapElement.value, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    }).setView([20, 0], 2)

    // Add OpenStreetMap tiles
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // Apply dark/light mode
    applyMapTheme()
  }
}

function applyMapTheme() {
  if (!map) return

  // Apply styling to the map based on theme
  if (isDarkMode.value) {
    map.getContainer().classList.add('dark-map')
  } else {
    map.getContainer().classList.remove('dark-map')
  }
}

// Active page for navigation
const currentRoute = ref('home')

function navigateTo(route) {
  currentRoute.value = route
  router.push({ name: route })
}

onMounted(() => {
  // Load Leaflet CSS if not already loaded
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }

  // Load Leaflet JS if not already loaded
  if (!window.L) {
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      initializeBackgroundMap()
    }
    document.head.appendChild(script)
  } else {
    // If Leaflet already loaded
    initializeBackgroundMap()
  }

  // Set initial dark mode based on system preference
  isDarkMode.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  if (isDarkMode.value) {
    document.body.classList.add('dark-mode')
  }

  // Update current route based on URL
  const path = window.location.pathname
  if (path.includes('navigation')) {
    currentRoute.value = 'navigation'
  } else if (path.includes('tracks')) {
    currentRoute.value = 'tracks'
  } else if (path.includes('preferences')) {
    currentRoute.value = 'preferences'
  } else {
    currentRoute.value = 'home'
  }
})

watch(isDarkMode, () => {
  applyMapTheme()
})
</script>

<template>
  <div class="app-container" :class="{ 'dark-theme': isDarkMode }">
    <!-- Background Map -->
    <div class="background-map" ref="mapElement"></div>

    <!-- Overlay Content -->
    <div class="overlay-content">
      <header>
        <nav class="navbar">
          <div class="logo-container">
            <div class="logo">
              <span class="logo-icon">📍</span>
              <h1>{{ appTitle }}</h1>
            </div>
          </div>

          <!-- Navigation Menu -->
          <div class="nav-links">
            <button
              @click="navigateTo('home')"
              class="nav-link"
              :class="{ active: currentRoute === 'home' }"
            >
              <span class="nav-icon">🏠</span>
              <span class="nav-text">Localisation</span>
            </button>

            <button
              @click="navigateTo('navigation')"
              class="nav-link"
              :class="{ active: currentRoute === 'navigation' }"
            >
              <span class="nav-icon">🧭</span>
              <span class="nav-text">Itinéraires</span>
            </button>

            <button
              @click="navigateTo('tracks')"
              class="nav-link"
              :class="{ active: currentRoute === 'tracks' }"
            >
              <span class="nav-icon">📝</span>
              <span class="nav-text">Mes Trajets</span>
            </button>

            <button
              @click="navigateTo('preferences')"
              class="nav-link"
              :class="{ active: currentRoute === 'preferences' }"
            >
              <span class="nav-icon">👤</span>
              <span class="nav-text">Préférences</span>
            </button>
          </div>

          <div class="nav-controls">
            <button class="theme-toggle" @click="toggleDarkMode" aria-label="Toggle dark mode">
              <span v-if="isDarkMode">☀️</span>
              <span v-else>🌙</span>
            </button>
          </div>
        </nav>
      </header>

      <main>
        <div class="floating-panel">
          <router-view />
        </div>
      </main>

      <footer>
        <p>© {{ new Date().getFullYear() }} GeoLocator</p>
      </footer>
    </div>
  </div>
</template>

<style>
:root {
  --primary-color: #4caf50;
  --secondary-color: #2196f3;
  --accent-color: #ff9800;
  --text-color: #333333;
  --background-color: rgba(255, 255, 255, 0.85);
  --card-background: #ffffff;
  --card-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  --border-color: rgba(255, 255, 255, 0.3);
  --header-bg: rgba(255, 255, 255, 0.8);
  --footer-bg: rgba(255, 255, 255, 0.8);
  --panel-backdrop: rgba(255, 255, 255, 0.25);
}

.dark-theme {
  --primary-color: #66bb6a;
  --secondary-color: #42a5f5;
  --accent-color: #ffb74d;
  --text-color: #e0e0e0;
  --background-color: rgba(18, 18, 18, 0.85);
  --card-background: #1e1e1e;
  --card-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
  --border-color: rgba(255, 255, 255, 0.1);
  --header-bg: rgba(26, 26, 26, 0.8);
  --footer-bg: rgba(26, 26, 26, 0.8);
  --panel-backdrop: rgba(0, 0, 0, 0.25);
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  color: var(--text-color);
  transition: background-color 0.3s;
}

/* Full-screen layout */
.app-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* Background map styles */
.background-map {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

/* Dark mode for map */
.dark-map {
  filter: brightness(0.7) invert(0.9) hue-rotate(180deg);
}

.overlay-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  z-index: 1;
}

/* Header styles */
header {
  background-color: var(--header-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0.5rem 1rem;
  z-index: 100;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.logo-container {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
}

.logo-icon {
  font-size: 1.8rem;
  margin-right: 0.5rem;
}

h1 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  background: linear-gradient(to right, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.nav-links {
  display: flex;
  gap: 10px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-link.active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: 500;
}

.nav-icon {
  font-size: 1.2rem;
}

.nav-controls {
  display: flex;
  align-items: center;
}

.theme-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  transition: background-color 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle:hover {
  background-color: var(--border-color);
}

/* Main content styles */
main {
  flex: 1;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 1rem;
  overflow-y: auto;
}

.floating-panel {
  width: 100%;
  max-width: 600px;
  margin-top: 1rem;
  background-color: var(--panel-backdrop);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border-radius: 16px;
  padding: 8px;
  box-shadow: var(--card-shadow);
  border: 1px solid var(--border-color);
}

/* Footer styles */
footer {
  background-color: var(--footer-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 0.75rem;
  text-align: center;
  font-size: 0.8rem;
  border-top: 1px solid var(--border-color);
}

footer p {
  margin: 0;
}

/* Responsive styles */
@media (max-width: 768px) {
  .floating-panel {
    max-width: 100%;
    margin-top: 0.25rem;
    border-radius: 12px;
  }

  main {
    padding: 0.5rem;
    align-items: flex-start;
  }

  .nav-links {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: var(--header-bg);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    justify-content: space-around;
    padding: 8px 0;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
    z-index: 100;
  }

  .nav-link {
    flex-direction: column;
    gap: 4px;
    padding: 6px;
  }

  .nav-text {
    display: block;
    font-size: 0.7rem;
  }

  footer {
    padding: 0.5rem;
    margin-bottom: 56px; /* Espace pour la navigation en bas */
  }

  main {
    max-height: calc(100vh - 180px);
  }
}

@media (max-width: 480px) {
  h1 {
    font-size: 1.2rem;
  }

  .logo-icon {
    font-size: 1.4rem;
  }

  header {
    padding: 0.25rem;
  }

  .navbar {
    padding: 0.25rem;
  }

  .floating-panel {
    border-radius: 10px;
    padding: 6px;
  }
}

/* Styles pour orientation paysage sur mobile */
@media (max-height: 500px) and (orientation: landscape) {
  .floating-panel {
    max-height: calc(100vh - 100px);
  }

  header {
    padding: 0.25rem;
  }

  .nav-links {
    flex-direction: row;
  }

  .nav-link {
    flex-direction: row;
    padding: 4px 8px;
  }

  footer {
    display: none; /* Masquer le footer en mode paysage pour gagner de l'espace */
  }
}

@media (max-width: 768px) {
  .floating-panel {
    max-width: 100%;
  }

  main {
    padding: 0.5rem;
    align-items: center;
  }
}

@media (max-width: 480px) {
  h1 {
    font-size: 1.2rem;
  }

  .logo-icon {
    font-size: 1.4rem;
  }

  header {
    padding: 0.25rem 0.5rem;
  }

  .navbar {
    padding: 0.25rem;
  }
}

/* Responsive styles for navigation */
@media (max-width: 640px) {
  .nav-text {
    display: none;
  }

  .nav-icon {
    font-size: 1.4rem;
  }

  .nav-link {
    padding: 8px;
  }

  .logo h1 {
    font-size: 1.2rem;
  }
}
</style>
