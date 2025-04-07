<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { startTrack, addPointToTrack, stopTrack } from '../services/trackingService'
import { formatDuration, formatSpeed } from '../utils/formatters'
import TrackMap from '../components/TrackMap.vue'
import TrackStatsCard from '../components/TrackStatsCard.vue'
import RecordingControls from '../components/RecordingControls.vue'
import ErrorMessage from '../components/ErrorMessage.vue'
import SpeedChart from '../components/SpeedChart.vue'

const router = useRouter()
const trackName = ref(`Trajet du ${new Date().toLocaleDateString()}`)

// État du suivi
const isRecording = ref(false)
const isPaused = ref(false)
const currentTrack = ref(null)
const trackStartTime = ref(null)
const currentPosition = ref(null)
const errorMsg = ref('')
const loading = ref(false)

// Variables pour l'affichage
const elapsedTime = ref('00:00:00')
const distance = ref(0)
const currentSpeed = ref(0)
const maxSpeed = ref(0)
const averageSpeed = ref(0)

// Variables pour le suivi
let watchId = null
const speedHistory = ref([])
const timeLabels = ref([])

// Limite de points d'historique à afficher sur le graphique
const MAX_HISTORY_POINTS = 30

// Points du tracé pour la carte
const trackPoints = computed(() => {
  if (!currentTrack.value || !currentTrack.value.points) return []
  return currentTrack.value.points
})

// Données du graphique de vitesse
const speedChartData = computed(() => {
  return {
    labels: timeLabels.value,
    datasets: [
      {
        label: 'Vitesse (km/h)',
        data: speedHistory.value,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Vitesse moyenne (km/h)',
        data: Array(speedHistory.value.length).fill(averageSpeed.value),
        borderColor: '#2196F3',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
      },
    ],
  }
})

// Démarrer l'enregistrement d'un trajet
function startRecording() {
  if (!navigator.geolocation) {
    errorMsg.value = "La géolocalisation n'est pas supportée par votre navigateur"
    return
  }

  // Réinitialiser les données d'historique
  speedHistory.value = []
  timeLabels.value = []

  // Créer un nouveau trajet avec le nom fourni
  currentTrack.value = startTrack(trackName.value)
  trackStartTime.value = Date.now()
  isRecording.value = true
  isPaused.value = false

  // Réinitialiser les données
  maxSpeed.value = 0
  averageSpeed.value = 0

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

  // Enregistrer les données de vitesse dans le track
  if (currentTrack.value) {
    // Stocker l'historique de vitesse dans le trajet pour analyse ultérieure
    currentTrack.value.speedData = {
      history: [...speedHistory.value],
      timeLabels: [...timeLabels.value],
      maxSpeed: maxSpeed.value,
      averageSpeed: averageSpeed.value,
    }
  }

  // Finaliser le trajet
  const finishedTrack = stopTrack()
  isRecording.value = false
  isPaused.value = false

  // Rediriger vers le détail du trajet
  if (finishedTrack && finishedTrack.id) {
    router.push({
      name: 'track-detail',
      params: { id: finishedTrack.id },
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
    currentSpeed.value = speed * 3.6

    // Mettre à jour la vitesse maximale
    if (currentSpeed.value > maxSpeed.value) {
      maxSpeed.value = currentSpeed.value
    }

    // Ajouter le point au trajet si l'enregistrement est actif
    if (isRecording.value && !isPaused.value) {
      currentTrack.value = addPointToTrack(currentPosition.value)

      // Mettre à jour la distance
      if (currentTrack.value) {
        distance.value = currentTrack.value.distance / 1000
      }

      // Ajouter à l'historique de vitesse pour le graphique
      const currentTime = new Date()
      timeLabels.value.push(
        currentTime.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
      speedHistory.value.push(currentSpeed.value)

      // Limiter la taille de l'historique pour le graphique
      if (speedHistory.value.length > MAX_HISTORY_POINTS) {
        speedHistory.value = speedHistory.value.slice(-MAX_HISTORY_POINTS)
        timeLabels.value = timeLabels.value.slice(-MAX_HISTORY_POINTS)
      }

      // Calculer la vitesse moyenne
      if (speedHistory.value.length > 0) {
        const sum = speedHistory.value.reduce((a, b) => a + b, 0)
        averageSpeed.value = sum / speedHistory.value.length
      }
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

// Mettre à jour le compteur de temps
function updateElapsedTime() {
  if (!isRecording.value) return

  const elapsed = isPaused.value
    ? currentTrack.value?.duration || 0
    : Math.floor((Date.now() - trackStartTime.value) / 1000)

  elapsedTime.value = formatDuration(elapsed)

  setTimeout(updateElapsedTime, 1000)
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
    stopTrack() // Arrêter le trajet sans le sauvegarder complètement
  }

  router.push({ name: 'tracks' })
}

// Effacer le message d'erreur
function dismissError() {
  errorMsg.value = ''
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
})

onUnmounted(() => {
  // Nettoyer les observateurs et timers
  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
})
</script>

<template>
  <div class="track-recorder">
    <h2>Enregistrement de trajet</h2>

    <ErrorMessage v-if="errorMsg" :message="errorMsg" @dismiss="dismissError" />

    <!-- Contrôles d'enregistrement -->
    <RecordingControls
      v-model:trackName="trackName"
      :isRecording="isRecording"
      :isPaused="isPaused"
      @start-recording="startRecording"
      @pause-recording="pauseRecording"
      @resume-recording="resumeRecording"
      @stop-recording="stopRecording"
      @cancel-recording="cancelRecording"
    />

    <!-- Statistiques temps réel -->
    <TrackStatsCard
      :elapsedTime="elapsedTime"
      :distance="distance"
      :currentSpeed="currentSpeed"
      :maxSpeed="maxSpeed"
      :averageSpeed="averageSpeed"
    />

    <div class="split-view">
      <!-- Carte pour le suivi en temps réel -->
      <div class="map-container">
        <TrackMap :points="trackPoints" :currentPoint="currentPosition" height="350px" />
      </div>

      <!-- Graphique de vitesse en temps réel -->
      <div class="chart-container" v-if="isRecording && speedHistory.length > 1">
        <div class="chart-header">
          <h3>Vitesse en temps réel</h3>
        </div>
        <SpeedChart :chartData="speedChartData" :height="350" />
      </div>
      <div v-else class="chart-placeholder">
        <div class="placeholder-content">
          <span class="placeholder-icon">📊</span>
          <p>Le graphique de vitesse s'affichera ici pendant l'enregistrement</p>
        </div>
      </div>
    </div>

    <!-- Note informative pour l'utilisateur -->
    <div class="info-note">
      <p>
        <span class="info-icon">ℹ️</span>
        Des analyses détaillées seront disponibles après avoir terminé l'enregistrement.
      </p>
    </div>
  </div>
</template>

<style scoped>
.track-recorder {
  max-width: 1200px;
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

.split-view {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .split-view {
    grid-template-columns: 1fr 1fr;
  }
}

.map-container,
.chart-container {
  background-color: var(--card-background);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-container {
  padding: 1rem;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.chart-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-color);
}

.chart-placeholder {
  background-color: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 350px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.placeholder-content {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: var(--text-secondary, #666);
}

.placeholder-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.info-note {
  background-color: var(--info-light, #e3f2fd);
  color: var(--info, #2196f3);
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
}

.info-note p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.info-icon {
  font-size: 1.2rem;
}
</style>
