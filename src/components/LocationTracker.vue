<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { sendLocationData } from '../services/locationService'

const location = ref(null)
const errorMsg = ref('')
const loading = ref(false)
const mapElement = ref(null)
const watchId = ref(null)
const isWatching = ref(false)
const isSending = ref(false)
const apiStatus = ref({ success: false, message: '', lastSent: null })
let map = null
let marker = null
let accuracyCircle = null
const autoSend = ref(false)

function getLocation() {
  loading.value = true
  errorMsg.value = ''

  if (!navigator.geolocation) {
    errorMsg.value = "La géolocalisation n'est pas supportée par votre navigateur"
    loading.value = false
    return
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('Position GPS brute:', position.coords)
      loading.value = false
      location.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString(),
      }

      // Auto send if enabled
      if (autoSend.value) {
        sendToServer()
      }
    },
    (error) => {
      loading.value = false
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMsg.value = "L'utilisateur a refusé la demande de géolocalisation"
          break
        case error.POSITION_UNAVAILABLE:
          errorMsg.value = "L'information de localisation n'est pas disponible"
          break
        case error.TIMEOUT:
          errorMsg.value = 'La demande de localisation a expiré'
          break
        default:
          errorMsg.value = "Une erreur inconnue s'est produite"
      }
    },
    options,
  )
}

async function sendToServer() {
  if (!location.value || isSending.value) return

  try {
    isSending.value = true
    apiStatus.value.message = 'Envoi des données en cours...'

    const result = await sendLocationData({
      latitude: location.value.latitude,
      longitude: location.value.longitude,
      accuracy: location.value.accuracy,
      timestamp: location.value.timestamp,
    })

    apiStatus.value = {
      success: true,
      message: 'Données envoyées avec succès',
      lastSent: new Date().toLocaleTimeString(),
    }
    console.log('Données envoyées au serveur:', result)
  } catch (error) {
    apiStatus.value = {
      success: false,
      message: `Erreur: ${error.message}`,
      lastSent: apiStatus.value.lastSent,
    }
    console.error("Erreur lors de l'envoi des données:", error)
  } finally {
    isSending.value = false
  }
}

function toggleAutoSend() {
  autoSend.value = !autoSend.value
  if (autoSend.value && location.value && !isSending.value) {
    sendToServer()
  }
}

function toggleWatchPosition() {
  if (isWatching.value) {
    stopWatchPosition()
  } else {
    startWatchPosition()
  }
}

function startWatchPosition() {
  if (!navigator.geolocation) {
    errorMsg.value = "La géolocalisation n'est pas supportée par votre navigateur"
    return
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }

  watchId.value = navigator.geolocation.watchPosition(
    (position) => {
      loading.value = false
      errorMsg.value = ''
      location.value = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString(),
      }

      // Auto send if enabled
      if (autoSend.value) {
        sendToServer()
      }
    },
    (error) => {
      loading.value = false
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMsg.value = "L'utilisateur a refusé la demande de géolocalisation"
          break
        case error.POSITION_UNAVAILABLE:
          errorMsg.value = "L'information de localisation n'est pas disponible"
          break
        case error.TIMEOUT:
          errorMsg.value = 'La demande de localisation a expiré'
          break
        default:
          errorMsg.value = "Une erreur inconnue s'est produite"
      }
      stopWatchPosition()
    },
    options,
  )

  isWatching.value = true
}

function stopWatchPosition() {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    watchId.value = null
  }
  isWatching.value = false
}

function initializeMap() {
  if (!map && mapElement.value && window.L) {
    // Initialize the Leaflet map
    map = window.L.map(mapElement.value).setView([48.712533, 2.201178], 13) // Default: Paris

    // Add OpenStreetMap tiles
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
  }
}

function updateMapWithLocation() {
  if (!map || !location.value) return

  const pos = [location.value.latitude, location.value.longitude]

  // Update map view
  map.setView(pos, 15)

  // Add or update marker
  if (marker) {
    marker.setLatLng(pos)
  } else {
    marker = window.L.marker(pos).addTo(map).bindPopup('Vous êtes ici').openPopup()
  }

  // Remove previous accuracy circle
  if (accuracyCircle) {
    map.removeLayer(accuracyCircle)
  }

  // Add accuracy circle
  accuracyCircle = window.L.circle(pos, {
    radius: location.value.accuracy / 10,
    color: '#4CAF50',
    fillColor: '#4CAF50',
    fillOpacity: 0.15,
  }).addTo(map)
}

onMounted(() => {
  // Load Leaflet CSS
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
  link.crossOrigin = ''
  document.head.appendChild(link)

  // Load Leaflet JS
  const script = document.createElement('script')
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
  script.crossOrigin = ''
  script.onload = () => {
    initializeMap()
    // Only try to update map if we already have location
    if (location.value) {
      updateMapWithLocation()
    }
  }
  document.head.appendChild(script)

  // Automatically request location on component mount
  getLocation()
})

// Clean up on component unmount
onUnmounted(() => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
  }
})

watch(location, () => {
  // When location changes, update the map
  if (window.L && map) {
    updateMapWithLocation()
  }
})
</script>

<template>
  <div class="location-tracker">
    <h2>Localisation en temps réel</h2>

    <div class="map-container" ref="mapElement"></div>

    <div v-if="loading" class="status-box loading">
      <div class="loading-indicator"></div>
      <p>Recherche de votre position...</p>
    </div>

    <div v-else-if="errorMsg" class="status-box error">
      <p>{{ errorMsg }}</p>
      <button @click="getLocation" class="retry-button">Réessayer</button>
    </div>

    <div v-else-if="location" class="location-info">
      <div class="location-data">
        <div class="data-item">
          <span class="label">Latitude:</span>
          <span class="value">{{ location.latitude.toFixed(6) }}</span>
        </div>
        <div class="data-item">
          <span class="label">Longitude:</span>
          <span class="value">{{ location.longitude.toFixed(6) }}</span>
        </div>
        <div class="data-item">
          <span class="label">Précision:</span>
          <span class="value">{{ Math.round(location.accuracy) }} mètres</span>
        </div>
      </div>

      <div
        class="api-status"
        :class="{ success: apiStatus.success === true, error: apiStatus.success === false }"
      >
        <span v-if="apiStatus.message">{{ apiStatus.message }}</span>
        <span v-if="apiStatus.lastSent" class="last-sent">
          Dernier envoi: {{ apiStatus.lastSent }}
        </span>
      </div>

      <div class="location-actions">
        <div class="action-row">
          <button @click="getLocation" class="update-button" :disabled="isSending">
            <span class="button-text">Actualiser</span>
          </button>
          <button
            @click="toggleWatchPosition"
            class="watch-button"
            :class="{ watching: isWatching }"
          >
            <span class="button-text">{{
              isWatching ? 'Arrêter suivi' : 'Suivre en continu'
            }}</span>
          </button>
        </div>

        <div class="action-row server-actions">
          <button @click="sendToServer" class="server-button" :disabled="isSending || !location">
            <span v-if="isSending" class="button-loading"></span>
            <span class="button-text">Envoyer au serveur</span>
          </button>

          <label class="auto-send-toggle">
            <input type="checkbox" :checked="autoSend" @change="toggleAutoSend" />
            <span class="toggle-label">Envoi automatique</span>
          </label>
        </div>
      </div>
    </div>

    <div v-else class="status-box no-data">
      <p>Aucune donnée de localisation disponible</p>
      <button @click="getLocation" class="retry-button">Obtenir ma position</button>
    </div>
  </div>
</template>

<style scoped>
.location-tracker {
  width: 100%;
  margin: 0 auto;
  padding: clamp(10px, 5%, 20px);
  background-color: var(--card-background, #fff);
  border-radius: 12px;
  box-shadow: 0 4px 20px var(--shadow-color, rgba(0, 0, 0, 0.1));
  transition:
    background-color 0.3s,
    box-shadow 0.3s;
}

h2 {
  color: var(--text-color, #2c3e50);
  margin-bottom: 20px;
  text-align: center;
  font-size: clamp(1.2rem, 4vw, 1.5rem);
}

.map-container {
  width: 100%;
  height: clamp(200px, 40vh, 400px);
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #ddd);
  transition: border-color 0.3s;
}

.status-box {
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading {
  background-color: var(--secondary-color-light, #e8f4fd);
  color: var(--secondary-color, #0366d6);
}

.loading-indicator {
  width: 24px;
  height: 24px;
  border: 3px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  background-color: var(--error-light, #ffebee);
  color: var(--error, #d32f2f);
}

.location-info {
  padding: 15px;
  background-color: var(--primary-color-light, #e8f5e9);
  color: var(--primary-color-dark, #2e7d32);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.location-data {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  width: 100%;
  margin-bottom: 15px;
}

.data-item {
  display: flex;
  flex-direction: column;
  padding: 8px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.5);
}

.label {
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.value {
  font-family: monospace;
  font-size: 1rem;
}

.location-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.no-data {
  background-color: var(--warning-light, #fff8e1);
  color: var(--warning, #ff8f00);
}

button {
  padding: 10px 15px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition:
    transform 0.1s,
    opacity 0.2s;
}

button:active {
  transform: scale(0.97);
}

.button-icon {
  font-size: 1.1rem;
}

.retry-button {
  background-color: var(--secondary-color, #2196f3);
  color: white;
}

.update-button {
  background-color: var(--primary-color, #4caf50);
  color: white;
}

.watch-button {
  background-color: var(--accent-color, #ff9800);
  color: white;
}

.watch-button.watching {
  background-color: var(--error, #f44336);
}

button:hover {
  opacity: 0.9;
}

@media (min-width: 640px) {
  .location-info {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .location-data {
    margin-bottom: 0;
  }

  .location-actions {
    margin-top: 0;
    margin-left: 15px;
  }
}

@media (max-width: 480px) {
  .map-container {
    height: clamp(180px, 30vh, 300px);
  }

  .button-text {
    font-size: 0.9rem;
  }

  .location-actions {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 380px) {
  .location-actions {
    flex-direction: column;
  }

  button {
    width: 100%;
  }
}

.action-row {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-bottom: 10px;
}

.action-row:last-child {
  margin-bottom: 0;
}

.server-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color, rgba(0, 0, 0, 0.1));
}

.server-button {
  background-color: var(--secondary-color-dark, #0366d6);
  color: white;
  position: relative;
}

.server-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-loading {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
  display: inline-block;
}

.api-status {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  margin: 10px 0;
  background-color: #f5f5f5;
  color: #666;
  text-align: center;
}

.api-status.success {
  background-color: var(--primary-color-light, #e8f5e9);
  color: var(--primary-color-dark, #2e7d32);
}

.api-status.error {
  background-color: var(--error-light, #ffebee);
  color: var(--error, #d32f2f);
}

.last-sent {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  opacity: 0.8;
}

.auto-send-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: #f5f5f5;
  color: #333;
  transition: background-color 0.2s;
}

.auto-send-toggle:hover {
  background-color: #e0e0e0;
}

.auto-send-toggle input {
  margin-right: 8px;
}

.toggle-label {
  font-size: 0.9rem;
}

.location-actions {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 10px;
}

@media (min-width: 640px) {
  /* ...existing media queries... */
}

@media (max-width: 480px) {
  /* ...existing media queries... */

  .action-row {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
