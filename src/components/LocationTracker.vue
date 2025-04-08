<script setup>
import { ref, onMounted, onUnmounted, watch, defineProps } from 'vue'
import { sendLocationData } from '../services/locationService'
import { useRouter } from 'vue-router'

const router = useRouter()
const location = ref(null)
const errorMsg = ref('')
const loading = ref(false)
const mapElement = ref(null)
const watchId = ref(null)
const isWatching = ref(false)
const isSending = ref(false)
const apiStatus = ref({ success: false, message: '', lastSent: null })
const autoSend = ref(false)

const props = defineProps({
  disableContinuousTracking: {
    type: Boolean,
    default: false,
  },
})

let map = null
let marker = null
let accuracyCircle = null

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

      try {
        // Ensure the coordinates are valid numbers
        const latitude = parseFloat(position.coords.latitude)
        const longitude = parseFloat(position.coords.longitude)
        const accuracy = parseFloat(position.coords.accuracy) || 1
        const altitude =
          parseFloat(position.coords.altitude) !== null
            ? parseFloat(position.coords.altitude)
            : null
        // Ne pas utiliser la vitesse du navigateur, elle est souvent imprécise
        // Nous la calculerons nous-mêmes si nécessaire
        const speed = null

        if (!isNaN(latitude) && !isNaN(longitude)) {
          location.value = {
            latitude,
            longitude,
            accuracy,
            altitude,
            speed,
            timestamp: new Date().toISOString(),
          }

          // Auto send if enabled
          if (autoSend.value) {
            sendToServer()
          }
        } else {
          errorMsg.value = 'Les coordonnées reçues sont invalides'
        }
      } catch (error) {
        console.error('Error processing geolocation data:', error)
        errorMsg.value = 'Erreur lors du traitement des données de géolocalisation'
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
      altitude: location.value.altitude,
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

      try {
        // Ensure the coordinates are valid numbers
        const latitude = parseFloat(position.coords.latitude)
        const longitude = parseFloat(position.coords.longitude)
        const accuracy = parseFloat(position.coords.accuracy) || 1
        const altitude =
          position.coords.altitude !== null ? parseFloat(position.coords.altitude) : null
        // Ne pas utiliser la vitesse du navigateur, nous la calculerons nous-mêmes
        const speed = null

        if (!isNaN(latitude) && !isNaN(longitude)) {
          // Conserver l'ancienne position pour calculer la vitesse
          const oldLocation = location.value

          location.value = {
            latitude,
            longitude,
            accuracy,
            altitude,
            speed,
            timestamp: new Date().toISOString(),
          }

          // Calculer la vitesse si nous avons une position précédente
          if (oldLocation && oldLocation.latitude && oldLocation.longitude) {
            // Utiliser la formule Haversine pour calculer la distance
            const distance = calculateDistance(
              oldLocation.latitude,
              oldLocation.longitude,
              latitude,
              longitude,
            )

            const timeDiff = new Date(location.value.timestamp) - new Date(oldLocation.timestamp)
            if (timeDiff > 0) {
              // Calculer la vitesse en m/s
              const speedMps = distance / (timeDiff / 1000)
              // Convertir en km/h pour l'affichage
              location.value.calculatedSpeed = speedMps * 3.6
            }
          }

          // Auto send if enabled
          if (autoSend.value) {
            sendToServer()
          }
        } else {
          errorMsg.value = 'Les coordonnées reçues sont invalides'
        }
      } catch (error) {
        console.error('Error processing geolocation data:', error)
        errorMsg.value = 'Erreur lors du traitement des données de géolocalisation'
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

// Fonction auxiliaire pour calculer la distance entre deux points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3 // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance en mètres
}

function stopWatchPosition() {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    watchId.value = null
  }
  isWatching.value = false
}

// Rediriger vers la page d'enregistrement de trajet
function startTrackRecording() {
  router.push({ name: 'track-recorder' })
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

  // Validate coordinates
  if (!Number.isFinite(location.value.latitude) || !Number.isFinite(location.value.longitude)) {
    console.error('Invalid coordinates:', location.value)
    return
  }

  try {
    const pos = [location.value.latitude, location.value.longitude]

    // Update map view with a small delay to ensure map is ready
    setTimeout(() => {
      map.setView(pos, 15)

      // Add or update marker
      if (marker) {
        marker.setLatLng(pos)
      } else {
        marker = window.L.marker(pos).addTo(map).bindPopup('Vous êtes ici').openPopup()
      }

      // Remove previous accuracy circle
      if (accuracyCircle) {
        try {
          map.removeLayer(accuracyCircle)
        } catch (error) {
          console.error('Error removing accuracy circle:', error)
        }
        accuracyCircle = null
      }

      // Add accuracy circle with proper validation
      const accuracyRadius = Math.max(1, location.value.accuracy || 1) // Ensure minimum radius of 1

      if (Number.isFinite(accuracyRadius)) {
        accuracyCircle = window.L.circle(pos, {
          radius: accuracyRadius,
          color: '#4CAF50',
          fillColor: '#4CAF50',
          fillOpacity: 0.15,
        })
        // Add the circle to map after a small delay to ensure map is ready
        setTimeout(() => {
          try {
            accuracyCircle.addTo(map)
          } catch (error) {
            console.error('Error adding accuracy circle to map:', error)
            accuracyCircle = null
          }
        }, 100)
      }
    }, 50)
  } catch (error) {
    console.error('Error updating map with location:', error)
  }
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
        <div class="data-item" v-if="location.altitude !== null">
          <span class="label">Altitude:</span>
          <span class="value">{{ location.altitude.toFixed(2) }} mètres</span>
        </div>
        <div class="data-item" v-if="location.speed !== null">
          <span class="label">Vitesse:</span>
          <span class="value">{{ (location.speed * 3.6).toFixed(1) }} km/h</span>
        </div>
      </div>

      <div class="location-actions">
        <button @click="getLocation" class="action-button update-button" :disabled="isSending">
          <span class="button-icon">🔄</span>
          <span class="button-text">Actualiser position</span>
        </button>

        <!-- Afficher le bouton de suivi continu seulement si non désactivé -->
        <button
          v-if="!props.disableContinuousTracking"
          @click="toggleWatchPosition"
          class="action-button watch-button"
          :class="{ watching: isWatching }"
        >
          <span class="button-icon">{{ isWatching ? '⏹️' : '▶️' }}</span>
          <span class="button-text">{{
            isWatching ? 'Arrêter le suivi' : 'Suivre en continu'
          }}</span>
        </button>

        <!-- Bouton pour démarrer l'enregistrement d'un trajet -->
        <button @click="startTrackRecording" class="action-button track-button">
          <span class="button-icon">📝</span>
          <span class="button-text">Enregistrer un trajet</span>
        </button>
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
  border-radius: 12px;
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
  margin-bottom: 20px;
}

.data-item {
  display: flex;
  flex-direction: column;
  padding: 10px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.data-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.label {
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 4px;
  color: var(--primary-color-dark, #2e7d32);
}

.value {
  font-family: monospace;
  font-size: 1.1rem;
  letter-spacing: 0.5px;
}

/* Updated location actions and buttons */
.location-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.action-button {
  position: relative;
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.3s;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  overflow: hidden;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.action-button::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.button-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.update-button {
  background: linear-gradient(135deg, #43a047, #2e7d32);
  color: white;
}

.watch-button {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: white;
}

.watch-button.watching {
  background: linear-gradient(135deg, #f44336, #d32f2f);
}

.track-button {
  background: linear-gradient(135deg, #2196f3, #1565c0);
  color: white;
  margin-top: 8px;
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
}

.action-button:active {
  transform: translateY(0px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Responsive styles */
@media (min-width: 640px) {
  .location-info {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .location-data {
    flex: 2;
    min-width: 300px;
    margin-bottom: 0;
  }

  .location-actions {
    flex: 1;
    min-width: 200px;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .action-button {
    padding: 12px 16px;
    font-size: 0.9rem;
  }

  .button-icon {
    font-size: 1.1rem;
  }

  .data-item {
    padding: 8px;
  }

  .value {
    font-size: 1rem;
  }
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
