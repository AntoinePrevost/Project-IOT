<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  startTrack,
  addPointToTrack,
  stopTrack,
} from '../services/trackingService'

const router = useRouter()
const mapElement = ref(null)
const speedChartElement = ref(null)
const progressSlider = ref(null)
const trackName = ref(`Trajet du ${new Date().toLocaleDateString()}`)

// État du suivi
const isRecording = ref(false)
const isPaused = ref(false)
const currentTrack = ref(null)
const trackStartTime = ref(null)
const currentPosition = ref(null)
const errorMsg = ref('')
const loading = ref(false)
const currentPointIndex = ref(0)
const playbackActive = ref(false)
const playbackSpeed = ref(1)

// Variables pour l'affichage
const elapsedTime = ref('00:00:00')
const distance = ref(0)
const currentSpeed = ref(0)
const speedData = ref([])
const maxSpeed = ref(0)
const altitudeData = ref([])

// Variables pour Leaflet
let map = null
let trackPolyline = null
let positionMarker = null
let watchId = null
let playbackTimer = null
let speedChart = null

// Formater la durée en HH:MM:SS
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':')
}

// Démarrer l'enregistrement d'un trajet
function startRecording() {
  if (!navigator.geolocation) {
    errorMsg.value = "La géolocalisation n'est pas supportée par votre navigateur"
    return
  }

  // Créer un nouveau trajet avec le nom fourni
  currentTrack.value = startTrack(trackName.value)
  trackStartTime.value = Date.now()
  isRecording.value = true
  isPaused.value = false

  // Réinitialiser les données
  speedData.value = []
  altitudeData.value = []
  maxSpeed.value = 0

  // Démarrer la capture de position
  startPositionTracking()

  // Démarrer le compteur de temps
  updateElapsedTime()
}

// Mettre en pause l'enregistrement
function pauseRecording() {
  isPaused.value = true
  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
}

// Reprendre l'enregistrement
function resumeRecording() {
  isPaused.value = false
  startPositionTracking()
}

// Arrêter l'enregistrement
function stopRecording() {
  if (!confirm("Êtes-vous sûr de vouloir arrêter l'enregistrement du trajet ?")) {
    return
  }

  // Arrêter le suivi de position
  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  // Finaliser le trajet
  stopTrack()
  isRecording.value = false
  isPaused.value = false

  // Rediriger vers le détail du trajet
  if (currentTrack.value && currentTrack.value.id) {
    router.push({
      name: 'track-detail',
      params: { id: currentTrack.value.id },
    })
  } else {
    router.push({ name: 'tracks' })
  }
}

// Démarrer le suivi de position
function startPositionTracking() {
  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }

  watchId = navigator.geolocation.watchPosition(handlePositionUpdate, handlePositionError, options)
}

// Gérer la mise à jour de position
function handlePositionUpdate(position) {
  try {
    loading.value = false
    const latitude = parseFloat(position.coords.latitude)
    const longitude = parseFloat(position.coords.longitude)
    const accuracy = parseFloat(position.coords.accuracy) || 5
    const altitude = position.coords.altitude !== null ? parseFloat(position.coords.altitude) : null
    const speed = position.coords.speed !== null ? position.coords.speed : 0

    if (isNaN(latitude) || isNaN(longitude)) {
      errorMsg.value = 'Coordonnées GPS invalides'
      return
    }

    currentPosition.value = {
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      timestamp: new Date().toISOString(),
    }

    // Mettre à jour la vitesse actuelle (km/h)
    currentSpeed.value = (speed * 3.6).toFixed(1)

    // Enregistrer les données pour le graphique
    speedData.value.push({
      time: Date.now() - trackStartTime.value,
      speed: speed * 3.6, // m/s -> km/h
    })

    // Mettre à jour la vitesse maximale
    if (speed * 3.6 > maxSpeed.value) {
      maxSpeed.value = speed * 3.6
    }

    // Enregistrer les données d'altitude
    if (altitude !== null) {
      altitudeData.value.push({
        time: Date.now() - trackStartTime.value,
        altitude,
      })
    }

    // Ajouter le point au trajet si l'enregistrement est actif
    if (isRecording.value && !isPaused.value) {
      currentTrack.value = addPointToTrack(currentPosition.value)

      // Mettre à jour la distance
      if (currentTrack.value) {
        distance.value = (currentTrack.value.distance / 1000).toFixed(2)
      }

      // Mettre à jour la carte
      updateMapDisplay()

      // Mettre à jour le graphique de vitesse
      updateSpeedChart()
    }
  } catch (error) {
    console.error('Erreur de traitement des données GPS:', error)
    errorMsg.value = 'Erreur lors du traitement des données de géolocalisation'
  }
}

// Gérer les erreurs de position
function handlePositionError(error) {
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

  if (isRecording.value) {
    pauseRecording()
  }
}

// Mettre à jour l'affichage de la carte
function updateMapDisplay() {
  if (!map || !currentTrack.value || !currentTrack.value.points.length) return

  const points = currentTrack.value.points.map((point) => [point.latitude, point.longitude])

  // Créer ou mettre à jour le tracé
  if (trackPolyline) {
    trackPolyline.setLatLngs(points)
  } else {
    trackPolyline = window.L.polyline(points, {
      color: '#4CAF50',
      weight: 5,
      opacity: 0.7,
      lineJoin: 'round',
    }).addTo(map)
  }

  // Mise à jour du marqueur de position
  const currentPos = [currentPosition.value.latitude, currentPosition.value.longitude]

  if (positionMarker) {
    positionMarker.setLatLng(currentPos)
  } else {
    positionMarker = window.L.marker(currentPos, {
      icon: window.L.divIcon({
        html: '<div class="current-position-marker"></div>',
        className: 'current-position-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(map)
  }

  // Centrer la carte si nécessaire
  map.setView(currentPos, map.getZoom() || 15)

  // Ajuster le zoom pour voir tout le tracé si nécessaire
  if (points.length > 2 && points.length % 5 === 0) {
    map.fitBounds(trackPolyline.getBounds(), { padding: [50, 50] })
  }
}

// Mettre à jour le compteur de temps
function updateElapsedTime() {
  if (!isRecording.value) return

  const elapsed = isPaused.value
    ? currentTrack.value?.duration || 0
    : Math.floor((Date.now() - trackStartTime.value) / 1000)

  elapsedTime.value = formatDuration(elapsed)

  setTimeout(updateElapsedTime, 1000)
}

// Initialiser la carte
function initializeMap() {
  if (!mapElement.value || !window.L) return

  map = window.L.map(mapElement.value).setView([48.856614, 2.3522219], 13)

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)
}

// Initialiser le graphique de vitesse
function initializeSpeedChart() {
  if (!speedChartElement.value || !window.Chart) return

  const ctx = speedChartElement.value.getContext('2d')

  speedChart = new window.Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Vitesse (km/h)',
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          data: [],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Temps (s)',
          },
          ticks: {
            callback: function (value) {
              return formatDuration(value / 1000)
            },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Vitesse (km/h)',
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: function (tooltipItems) {
              return formatDuration(tooltipItems[0].parsed.x / 1000)
            },
          },
        },
      },
    },
  })
}

// Mettre à jour le graphique de vitesse
function updateSpeedChart() {
  if (!speedChart || !speedData.value.length) return

  speedChart.data.datasets[0].data = speedData.value.map((item) => ({
    x: item.time,
    y: item.speed,
  }))

  speedChart.update()
}

// Chargement dynamique des bibliothèques nécessaires
function loadDependencies() {
  // Charger Chart.js si nécessaire
  if (!window.Chart) {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js'
    script.onload = initializeSpeedChart
    document.head.appendChild(script)
  } else {
    initializeSpeedChart()
  }

  // Charger Leaflet si nécessaire
  if (!window.L) {
    // CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // JavaScript
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = initializeMap
    document.head.appendChild(script)
  } else {
    initializeMap()
  }
}

// Fonctions de lecture/visualisation
const totalDuration = computed(() => {
  if (!currentTrack.value || !currentTrack.value.points.length) return 0
  return Math.max(...speedData.value.map((d) => d.time))
})

function updateProgressSlider() {
  if (!progressSlider.value || !totalDuration.value) return
  progressSlider.value.max = totalDuration.value
}

function handleSliderChange(event) {
  const time = parseInt(event.target.value)
  if (!currentTrack.value || !currentTrack.value.points.length) return

  // Trouver le point le plus proche du temps sélectionné
  let closestPointIndex = 0
  let minTimeDiff = Infinity

  speedData.value.forEach((data, index) => {
    const timeDiff = Math.abs(data.time - time)
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff
      closestPointIndex = index
    }
  })

  // Mettre à jour l'index actuel et synchroniser l'affichage
  currentPointIndex.value = closestPointIndex
  syncDisplayWithCurrentPoint()
}

function syncDisplayWithCurrentPoint() {
  if (
    !currentTrack.value ||
    !currentTrack.value.points.length ||
    currentPointIndex.value >= currentTrack.value.points.length
  )
    return

  const point = currentTrack.value.points[currentPointIndex.value]
  const speedItem = speedData.value[currentPointIndex.value] || { speed: 0 }

  // Mettre à jour les données affichées
  currentSpeed.value = speedItem.speed.toFixed(1)
  elapsedTime.value = formatDuration(speedItem.time / 1000)

  // Mettre à jour la position sur la carte
  if (map && positionMarker) {
    positionMarker.setLatLng([point.latitude, point.longitude])
    map.setView([point.latitude, point.longitude], map.getZoom() || 15)
  }

  // Mettre à jour le slider
  if (progressSlider.value) {
    progressSlider.value.value = speedItem.time
  }

  // Mettre à jour le graphique (afficher un marqueur à la position actuelle)
  if (speedChart) {
    // Implémenter la logique pour mettre en évidence le point actuel sur le graphique
    speedChart.update()
  }
}

function startPlayback() {
  if (playbackActive.value || !currentTrack.value || !currentTrack.value.points.length) return

  playbackActive.value = true

  // Commencer depuis le point actuel
  function advancePlayback() {
    if (!playbackActive.value) return

    currentPointIndex.value++

    if (currentPointIndex.value >= currentTrack.value.points.length) {
      currentPointIndex.value = currentTrack.value.points.length - 1
      playbackActive.value = false
      return
    }

    syncDisplayWithCurrentPoint()

    // Calculer le délai entre ce point et le suivant
    const currentTime = speedData.value[currentPointIndex.value]?.time || 0
    const nextTime = speedData.value[currentPointIndex.value + 1]?.time || 0
    const delay = Math.max(50, (nextTime - currentTime) / playbackSpeed.value)

    playbackTimer = setTimeout(advancePlayback, delay)
  }

  advancePlayback()
}

function pausePlayback() {
  playbackActive.value = false
  if (playbackTimer) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
}

function stopPlayback() {
  playbackActive.value = false
  if (playbackTimer) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
  currentPointIndex.value = 0
  syncDisplayWithCurrentPoint()
}

// Annuler l'enregistrement et revenir à la liste
function cancelRecording() {
  if (
    isRecording.value &&
    !confirm("Êtes-vous sûr de vouloir annuler l'enregistrement ? Les données seront perdues.")
  ) {
    return
  }

  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  if (isRecording.value) {
    stopTrack() // Arrêter le trajet sans le sauvegarder
  }

  router.push({ name: 'tracks' })
}

// Cycle de vie du composant
onMounted(() => {
  // Vérifier les autorisations de géolocalisation
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'denied') {
        errorMsg.value =
          "L'accès à la géolocalisation est désactivé. Veuillez l'activer dans les paramètres."
      }
    })
  }

  // Charger les dépendances
  loadDependencies()
})

onUnmounted(() => {
  // Nettoyer les observateurs et timers
  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  if (playbackTimer) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
})

// Mise à jour des composants UI quand les données changent
watch(
  speedData,
  () => {
    updateProgressSlider()
    updateSpeedChart()
  },
  { deep: true },
)

watch(currentPointIndex, () => {
  syncDisplayWithCurrentPoint()
})
</script>

<template>
  <div class="track-recorder">
    <h2>Enregistrement de trajet</h2>

    <div v-if="errorMsg" class="error-message">
      {{ errorMsg }}
      <button @click="errorMsg = ''" class="dismiss-button">×</button>
    </div>

    <!-- Contrôles d'enregistrement -->
    <div class="recording-controls">
      <input
        v-if="!isRecording"
        v-model="trackName"
        type="text"
        placeholder="Nom du trajet"
        class="track-name-input"
      />

      <div class="button-group">
        <template v-if="!isRecording">
          <button @click="startRecording" class="start-button">
            <span class="icon">▶️</span>
            <span class="label">Démarrer l'enregistrement</span>
          </button>
        </template>

        <template v-else>
          <button v-if="!isPaused" @click="pauseRecording" class="pause-button">
            <span class="icon">⏸️</span>
            <span class="label">Pause</span>
          </button>

          <button v-else @click="resumeRecording" class="resume-button">
            <span class="icon">▶️</span>
            <span class="label">Reprendre</span>
          </button>

          <button @click="stopRecording" class="stop-button">
            <span class="icon">⏹️</span>
            <span class="label">Terminer</span>
          </button>
        </template>

        <button @click="cancelRecording" class="cancel-button">
          <span class="icon">✖️</span>
          <span class="label">Annuler</span>
        </button>
      </div>
    </div>

    <!-- Statistiques temps réel -->
    <div class="stats-panel">
      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-name">Durée</div>
        <div class="stat-value">{{ elapsedTime }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📏</div>
        <div class="stat-name">Distance</div>
        <div class="stat-value">{{ distance }} km</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div class="stat-name">Vitesse</div>
        <div class="stat-value">{{ currentSpeed }} km/h</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🚀</div>
        <div class="stat-name">Vitesse max</div>
        <div class="stat-value">{{ maxSpeed.toFixed(1) }} km/h</div>
      </div>
    </div>

    <!-- Carte pour le suivi en temps réel -->
    <div class="map-container" ref="mapElement"></div>

    <!-- Curseur de progression temporel -->
    <div class="progress-container">
      <input
        ref="progressSlider"
        type="range"
        min="0"
        :max="totalDuration || 100"
        value="0"
        class="progress-slider"
        @input="handleSliderChange"
        :disabled="!currentTrack || currentTrack.points?.length < 2"
      />
      <div class="progress-time">{{ elapsedTime }}</div>
    </div>

    <!-- Contrôles de lecture pour visualisation -->
    <div class="playback-controls" v-if="currentTrack && currentTrack.points?.length > 1">
      <button @click="startPlayback" :disabled="playbackActive" class="playback-button">
        <span class="icon">▶️</span>
      </button>

      <button @click="pausePlayback" :disabled="!playbackActive" class="playback-button">
        <span class="icon">⏸️</span>
      </button>

      <button @click="stopPlayback" class="playback-button">
        <span class="icon">⏹️</span>
      </button>

      <div class="playback-speed">
        <span>Vitesse:</span>
        <select v-model="playbackSpeed">
          <option value="0.5">0.5×</option>
          <option value="1">1×</option>
          <option value="2">2×</option>
          <option value="4">4×</option>
        </select>
      </div>
    </div>

    <!-- Graphique de vitesse -->
    <div class="chart-container">
      <h3>Graphique de vitesse</h3>
      <canvas ref="speedChartElement" height="200"></canvas>
    </div>
  </div>
</template>

<style scoped>
.track-recorder {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h2 {
  text-align: center;
  margin: 0;
  color: var(--text-color);
}

h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  color: var(--text-color);
}

.error-message {
  background-color: var(--error-light, #ffebee);
  color: var(--error, #f44336);
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dismiss-button {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.5rem;
  cursor: pointer;
}

.recording-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: var(--card-background);
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.track-name-input {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  font-size: 1rem;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
}

.start-button,
.pause-button,
.resume-button,
.stop-button,
.cancel-button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.start-button {
  background-color: var(--primary-color, #4caf50);
  color: white;
}

.pause-button {
  background-color: var(--accent-color, #ff9800);
  color: white;
}

.resume-button {
  background-color: var(--primary-color, #4caf50);
  color: white;
}

.stop-button {
  background-color: var(--secondary-color, #2196f3);
  color: white;
}

.cancel-button {
  background-color: var(--error, #f44336);
  color: white;
}

.icon {
  font-size: 1.2rem;
}

.stats-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  background-color: var(--card-background);
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background-color: var(--primary-color-light, #e8f5e9);
  border-radius: 8px;
  text-align: center;
}

.stat-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.stat-name {
  font-size: 0.9rem;
  color: var(--text-secondary, #666);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-color);
}

.map-container {
  width: 100%;
  height: 400px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color, #ddd);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.progress-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem;
  background-color: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.progress-slider {
  width: 100%;
  height: 20px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--primary-color-light, #e8f5e9);
  border-radius: 10px;
  cursor: pointer;
}

.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color, #4caf50);
  cursor: pointer;
}

.progress-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color, #4caf50);
  cursor: pointer;
}

.progress-time {
  text-align: center;
  font-weight: 600;
  font-family: monospace;
  font-size: 1.1rem;
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  justify-content: center;
}

.playback-button {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background-color: var(--primary-color-light, #e8f5e9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.playback-button:hover:not(:disabled) {
  background-color: var(--primary-color, #4caf50);
}

.playback-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.playback-speed {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.playback-speed select {
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color, #ddd);
}

.chart-container {
  width: 100%;
  padding: 1rem;
  background-color: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.current-position-marker {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #2196f3;
  border: 3px solid white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

@media (max-width: 768px) {
  .button-group {
    flex-direction: column;
  }

  .stats-panel {
    grid-template-columns: repeat(2, 1fr);
  }

  .map-container {
    height: 300px;
  }
}

@media (max-width: 480px) {
  .track-recorder {
    padding: 0.5rem;
    gap: 1rem;
  }

  .label {
    display: none; /* Masquer le texte des boutons sur petit écran */
  }

  .button-group {
    flex-direction: row;
  }

  .start-button,
  .pause-button,
  .resume-button,
  .stop-button,
  .cancel-button {
    padding: 0.8rem;
    flex: 1;
    justify-content: center;
  }
}
</style>
