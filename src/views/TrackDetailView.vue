<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { getTrackById, deleteTrack, exportTrackToGPX } from '../services/trackingService'
import { calculateTrackStatistics, prepareTrackData } from '../services/trackService'
import TrackStats from '../components/TrackStats.vue'
import TrackVisualizer from '../components/TrackVisualizer.vue'
import TrackDataDebugger from '../components/TrackDataDebugger.vue'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const track = ref(null)
const isLoading = ref(true)
const error = ref(null)
const showDebugger = ref(false)
const debugMode = ref(localStorage.getItem('debugMode') === 'true')

// Tabs pour la navigation dans les détails du trajet
const activeTab = ref('overview')
const tabs = [
  { id: 'overview', name: 'Aperçu', icon: '📊' },
  { id: 'analysis', name: 'Analyse', icon: '📈' },
  { id: 'map', name: 'Carte', icon: '🗺️' },
  { id: 'data', name: 'Données', icon: '📋' },
]

// Calculer les statistiques à partir du track
const statistics = computed(() => {
  if (!track.value)
    return {
      distance: 0,
      duration: '00:00:00',
      avgSpeed: 0,
      maxSpeed: 0,
      elevGain: 0,
      elevLoss: 0,
    }

  // Vérifier et corriger la durée si nécessaire
  if (track.value.duration === 0 && track.value.points && track.value.points.length >= 2) {
    const firstPoint = track.value.points[0]
    const lastPoint = track.value.points[track.value.points.length - 1]

    if (firstPoint.timestamp && lastPoint.timestamp) {
      const startTime = new Date(firstPoint.timestamp)
      const endTime = new Date(lastPoint.timestamp)
      const calculatedDuration = (endTime - startTime) / 1000

      console.log(`Durée incorrecte détectée (0). Recalculée à: ${calculatedDuration}s`)
      track.value.duration = calculatedDuration
    }
  }

  // Vérifier également les vitesses avant de calculer les statistiques
  if (track.value.points && track.value.points.length > 1) {
    let pointsWithoutSpeed = 0

    // Recalculer les vitesses manquantes
    track.value.points.forEach((point, index) => {
      if ((point.speed === null || point.speed === undefined || point.speed === 0) && index > 0) {
        pointsWithoutSpeed++

        const prevPoint = track.value.points[index - 1]
        if (prevPoint) {
          // Calculer la distance entre les points
          const lat1 = prevPoint.latitude
          const lon1 = prevPoint.longitude
          const lat2 = point.latitude
          const lon2 = point.longitude

          const R = 6371e3 // Rayon de la Terre en mètres
          const φ1 = (lat1 * Math.PI) / 180
          const φ2 = (lat2 * Math.PI) / 180
          const Δφ = ((lat2 - lat1) * Math.PI) / 180
          const Δλ = ((lon2 - lon1) * Math.PI) / 180

          const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
          const distance = R * c // Distance en mètres

          const timeDiff = new Date(point.timestamp) - new Date(prevPoint.timestamp)
          if (timeDiff > 0) {
            // Calculer la vitesse en m/s
            point.speed = distance / (timeDiff / 1000)
            console.log(`Vitesse recalculée pour point ${index}: ${point.speed.toFixed(2)} m/s`)
          }
        }
      }
    })

    if (pointsWithoutSpeed > 0) {
      console.log(
        `${pointsWithoutSpeed} points sans vitesse ont été recalculés dans le détail du trajet`,
      )
    }
  }

  return calculateTrackStatistics(track.value)
})

// Formater la date
const formatDate = (isoDate) => {
  if (!isoDate) return ''
  const date = new Date(isoDate)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

// Supprimer le trajet
const handleDelete = async () => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce trajet ?')) {
    return
  }

  try {
    const success = deleteTrack(route.params.id)
    if (success) {
      toast.success('Trajet supprimé avec succès')
      router.push({ name: 'tracks' })
    } else {
      toast.error('Impossible de supprimer le trajet')
    }
  } catch (error) {
    console.error('Erreur lors de la suppression du trajet:', error)
    toast.error('Une erreur est survenue lors de la suppression')
  }
}

// Exporter le trajet en GPX
const handleExport = () => {
  try {
    const gpxContent = exportTrackToGPX(route.params.id)
    if (!gpxContent) {
      toast.error('Impossible de générer le fichier GPX')
      return
    }

    // Créer un blob et un lien de téléchargement
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${track.value.name.replace(/[^\w\s-]/g, '')}_${route.params.id}.gpx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Fichier GPX téléchargé')
  } catch (error) {
    console.error("Erreur lors de l'export GPX:", error)
    toast.error("Une erreur est survenue lors de l'export")
  }
}

// Toggle le mode débug
const toggleDebugMode = () => {
  debugMode.value = !debugMode.value
  localStorage.setItem('debugMode', debugMode.value)

  if (debugMode.value) {
    showDebugger.value = true
  }
}

// Analyser les points pour détecter les anomalies
const analyzeTrackData = () => {
  if (!track.value || !track.value.points) return null

  const totalPoints = track.value.points.length
  const pointsWithSpeed = track.value.points.filter(
    (p) => p.speed !== null && p.speed !== undefined,
  ).length
  const pointsWithAltitude = track.value.points.filter(
    (p) => p.altitude !== null && p.altitude !== undefined,
  ).length
  const speedDataPoints = track.value.speedData?.history?.length || 0

  const duplicateTimestamps = new Set()
  const timestamps = new Set()

  track.value.points.forEach((point) => {
    if (timestamps.has(point.timestamp)) {
      duplicateTimestamps.add(point.timestamp)
    } else {
      timestamps.add(point.timestamp)
    }
  })

  // Vérifier si les points sont correctement ordonnés dans le temps
  let outOfOrderCount = 0
  for (let i = 1; i < track.value.points.length; i++) {
    const prevTime = new Date(track.value.points[i - 1].timestamp).getTime()
    const currentTime = new Date(track.value.points[i].timestamp).getTime()

    if (currentTime < prevTime) {
      outOfOrderCount++
    }
  }

  // Vérifier les écarts dans la temporalité
  const timeGaps = []
  for (let i = 1; i < track.value.points.length; i++) {
    const prevTime = new Date(track.value.points[i - 1].timestamp).getTime()
    const currentTime = new Date(track.value.points[i].timestamp).getTime()
    const gap = (currentTime - prevTime) / 1000 // en secondes

    if (gap > 60) {
      // Écart de plus d'une minute
      timeGaps.push({
        index: i,
        gap,
        prevTimestamp: track.value.points[i - 1].timestamp,
        currentTimestamp: track.value.points[i].timestamp,
      })
    }
  }

  return {
    totalPoints,
    pointsWithSpeed,
    pointsWithAltitude,
    speedDataPoints,
    duplicateTimestamps: duplicateTimestamps.size,
    outOfOrderPoints: outOfOrderCount,
    timeGaps,
    hasSpeedData: !!track.value.speedData,
    trackDuration: track.value.duration,
    calculatedDuration: statistics.value.duration,
  }
}

// Données d'analyse
const analysisData = computed(() => {
  return analyzeTrackData()
})

onMounted(async () => {
  try {
    isLoading.value = true
    const trackId = route.params.id
    console.log('Chargement du trajet ID:', trackId)

    const rawTrack = getTrackById(trackId)
    if (!rawTrack) {
      error.value = 'Trajet introuvable'
      isLoading.value = false
      return
    }

    // S'assurer que les propriétés requises existent
    if (!rawTrack.points) rawTrack.points = []
    if (!rawTrack.distance) rawTrack.distance = 0

    console.log(`Trajet brut récupéré: ${rawTrack.name} (${trackId})`)
    console.log(
      `Points: ${rawTrack.points.length}, Distance: ${rawTrack.distance}m, Durée: ${rawTrack.duration}s`,
    )

    if (rawTrack.duration === 0 && rawTrack.points.length >= 2) {
      console.warn('La durée du trajet est 0, elle sera recalculée')
    }

    // Préparer les données proprement pour affichage
    const cleanedTrack = prepareTrackData(rawTrack)
    track.value = cleanedTrack

    // Vérifier les speedData si elles existent
    if (track.value.speedData) {
      console.log(
        'SpeedData trouvées dans le trajet:',
        `${track.value.speedData.history.length} points, ` +
          `Vitesse max: ${track.value.speedData.maxSpeed}, ` +
          `Vitesse moyenne: ${track.value.speedData.averageSpeed}`,
      )
    } else {
      console.log('Pas de speedData dans le trajet')
    }

    isLoading.value = false
  } catch (e) {
    console.error('Erreur lors du chargement du trajet:', e)
    error.value = 'Impossible de charger les données du trajet'
    isLoading.value = false
  }
})

// Surveiller les changements de l'ID du trajet dans l'URL
watch(
  () => route.params.id,
  (newId) => {
    if (newId && (!track.value || track.value.id !== newId)) {
      onMounted() // Recharger les données si l'ID change
    }
  },
)
</script>

<template>
  <div class="track-detail-view">
    <!-- Bouton de retour et titre -->
    <div class="track-header">
      <button @click="$router.push({ name: 'tracks' })" class="back-button">
        <span class="icon">←</span>
        <span>Retour</span>
      </button>

      <div v-if="track" class="track-meta">
        <h2 class="track-name">{{ track.name }}</h2>
        <p class="track-date">{{ formatDate(track.startTime) }}</p>
      </div>

      <div class="track-actions">
        <button @click="toggleDebugMode" class="debug-button" title="Mode debug">🐞</button>
        <button @click="handleExport" class="export-button" title="Exporter en GPX">📤 GPX</button>
        <button @click="handleDelete" class="delete-button" title="Supprimer">🗑️</button>
      </div>
    </div>

    <!-- Contenu principal -->
    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Chargement du trajet...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <button @click="$router.push({ name: 'tracks' })" class="return-button">
        Retour à la liste des trajets
      </button>
    </div>

    <div v-else-if="track" class="track-content">
      <!-- Système de navigation par onglets -->
      <div class="tabs-container">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-button"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-name">{{ tab.name }}</span>
        </button>
      </div>

      <!-- Conteneur principal des onglets -->
      <div class="tab-content-container">
        <!-- Onglet Aperçu -->
        <div v-if="activeTab === 'overview'" class="tab-content">
          <TrackStats :statistics="statistics" />

          <div class="track-visualizer-container">
            <TrackVisualizer :track="track" />
          </div>
        </div>

        <!-- Onglet Analyse -->
        <div v-else-if="activeTab === 'analysis'" class="tab-content">
          <h3>Analyse détaillée</h3>

          <div class="analysis-section">
            <h4>Vitesse</h4>
            <div class="chart-container">
              <!-- Graphique de vitesse détaillé -->
              <TrackVisualizer :track="track" chartOnly />
            </div>

            <div class="stats-detail">
              <div class="stat-group">
                <div class="stat">
                  <div class="stat-label">Vitesse moyenne</div>
                  <div class="stat-value">{{ statistics.avgSpeed }} km/h</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Vitesse maximale</div>
                  <div class="stat-value">{{ statistics.maxSpeed }} km/h</div>
                </div>
              </div>

              <!-- Détails supplémentaires sur la vitesse -->
              <div class="stat-details" v-if="analysisData">
                <p>
                  <strong>Points avec vitesse:</strong> {{ analysisData.pointsWithSpeed }} /
                  {{ analysisData.totalPoints }} ({{
                    Math.round((analysisData.pointsWithSpeed / analysisData.totalPoints) * 100)
                  }}%)
                </p>
                <p v-if="analysisData.hasSpeedData">
                  <strong>Données de vitesse enregistrées:</strong>
                  {{ analysisData.speedDataPoints }} points
                </p>
              </div>
            </div>
          </div>

          <div class="analysis-section">
            <h4>Durée et Distances</h4>
            <div class="stats-detail">
              <div class="stat-group">
                <div class="stat">
                  <div class="stat-label">Distance totale</div>
                  <div class="stat-value">{{ statistics.distance }} km</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Durée totale</div>
                  <div class="stat-value">{{ statistics.duration }}</div>
                </div>
              </div>

              <div class="stat-details" v-if="analysisData && analysisData.timeGaps.length > 0">
                <p>
                  <strong>Gaps détectés:</strong> {{ analysisData.timeGaps.length }}
                  (périodes sans données)
                </p>
                <ul class="gap-list">
                  <li v-for="(gap, index) in analysisData.timeGaps.slice(0, 3)" :key="index">
                    Écart de {{ Math.round(gap.gap / 60) }} min entre les points
                    {{ gap.index - 1 }} et {{ gap.index }}
                  </li>
                  <li v-if="analysisData.timeGaps.length > 3">...</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="analysis-section" v-if="statistics.elevGain > 0 || statistics.elevLoss > 0">
            <h4>Dénivelé</h4>
            <div class="stats-detail">
              <div class="stat-group">
                <div class="stat">
                  <div class="stat-label">Dénivelé positif</div>
                  <div class="stat-value">{{ statistics.elevGain }} m</div>
                </div>
                <div class="stat">
                  <div class="stat-label">Dénivelé négatif</div>
                  <div class="stat-value">{{ statistics.elevLoss }} m</div>
                </div>
              </div>

              <div class="stat-details" v-if="analysisData">
                <p>
                  <strong>Points avec altitude:</strong> {{ analysisData.pointsWithAltitude }} /
                  {{ analysisData.totalPoints }} ({{
                    Math.round((analysisData.pointsWithAltitude / analysisData.totalPoints) * 100)
                  }}%)
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Onglet Carte -->
        <div v-else-if="activeTab === 'map'" class="tab-content">
          <h3>Carte détaillée</h3>
          <div class="map-fullsize">
            <TrackVisualizer :track="track" mapOnly height="600px" />
          </div>
        </div>

        <!-- Onglet Données -->
        <div v-else-if="activeTab === 'data'" class="tab-content">
          <h3>Données brutes</h3>

          <div class="data-summary">
            <div class="data-card">
              <h4>Informations générales</h4>
              <table class="data-table">
                <tr>
                  <td>ID:</td>
                  <td>{{ track.id }}</td>
                </tr>
                <tr>
                  <td>Nom:</td>
                  <td>{{ track.name }}</td>
                </tr>
                <tr>
                  <td>Date début:</td>
                  <td>{{ formatDate(track.startTime) }}</td>
                </tr>
                <tr>
                  <td>Date fin:</td>
                  <td>{{ formatDate(track.endTime) }}</td>
                </tr>
                <tr>
                  <td>Points:</td>
                  <td>{{ track.points.length }}</td>
                </tr>
                <tr>
                  <td>Distance:</td>
                  <td>{{ (track.distance / 1000).toFixed(2) }} km</td>
                </tr>
                <tr>
                  <td>Durée:</td>
                  <td>{{ statistics.duration }}</td>
                </tr>
              </table>
            </div>

            <div class="data-card" v-if="analysisData">
              <h4>Diagnostic des données</h4>
              <table class="data-table">
                <tr>
                  <td>Points totaux:</td>
                  <td>{{ analysisData.totalPoints }}</td>
                </tr>
                <tr>
                  <td>Points avec vitesse:</td>
                  <td>{{ analysisData.pointsWithSpeed }}</td>
                </tr>
                <tr>
                  <td>Points avec altitude:</td>
                  <td>{{ analysisData.pointsWithAltitude }}</td>
                </tr>
                <tr>
                  <td>Données de vitesse stockées:</td>
                  <td>{{ analysisData.speedDataPoints }}</td>
                </tr>
                <tr>
                  <td>Timestamps dupliqués:</td>
                  <td>{{ analysisData.duplicateTimestamps }}</td>
                </tr>
                <tr>
                  <td>Points non-chronologiques:</td>
                  <td>{{ analysisData.outOfOrderPoints }}</td>
                </tr>
                <tr>
                  <td>Écarts temporels:</td>
                  <td>{{ analysisData.timeGaps.length }}</td>
                </tr>
              </table>

              <button @click="showDebugger = !showDebugger" class="toggle-debugger-btn">
                {{ showDebugger ? 'Masquer' : 'Afficher' }} les données détaillées
              </button>
            </div>
          </div>

          <div v-if="showDebugger" class="data-debugger">
            <TrackDataDebugger :track="track" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track-detail-view {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.track-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.back-button,
.export-button,
.delete-button,
.debug-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button {
  background-color: var(--secondary-color-light, #e3f2fd);
  color: var(--secondary-color, #2196f3);
}

.export-button {
  background-color: var(--success-light, #e8f5e9);
  color: var(--success, #4caf50);
}

.delete-button {
  background-color: var(--error-light, #ffebee);
  color: var(--error, #f44336);
}

.debug-button {
  background-color: var(--warning-light, #fff8e1);
  color: var(--warning, #ff9800);
}

.track-meta {
  flex: 1;
  text-align: center;
}

.track-name {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-color);
}

.track-date {
  margin: 0.25rem 0 0;
  color: var(--text-secondary, #666);
  font-size: 0.9rem;
}

.track-actions {
  display: flex;
  gap: 0.5rem;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  background-color: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--primary-color, #4caf50);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  color: var(--error, #f44336);
  font-weight: 500;
  margin-bottom: 1rem;
}

.return-button {
  background-color: var(--secondary-color-light, #e3f2fd);
  color: var(--secondary-color, #2196f3);
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
}

.track-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.tabs-container {
  display: flex;
  overflow-x: auto;
  gap: 0.5rem;
  background-color: var(--card-background);
  padding: 0.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-color);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.tab-button.active {
  background-color: var(--primary-color-light, #e8f5e9);
  color: var(--primary-color, #4caf50);
}

.tab-icon {
  font-size: 1.2rem;
}

.tab-content-container {
  background-color: var(--card-background);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--text-color);
  font-size: 1.3rem;
}

h4 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  color: var(--text-color);
  font-size: 1.1rem;
}

.track-visualizer-container {
  width: 100%;
}

.map-fullsize {
  width: 100%;
  height: 600px;
}

.analysis-section {
  border-radius: 8px;
  background-color: var(--card-background-secondary, #f9f9f9);
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.chart-container {
  margin-bottom: 1.5rem;
}

.stats-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stat-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.stat {
  flex: 1;
  min-width: 130px;
  background-color: var(--card-background);
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--primary-color, #4caf50);
}

.stat-details {
  background-color: var(--info-light, #e3f2fd);
  color: var(--text-color);
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.stat-details p {
  margin-top: 0;
  margin-bottom: 0.75rem;
}

.stat-details p:last-child {
  margin-bottom: 0;
}

.gap-list {
  margin-top: 0.5rem;
  margin-bottom: 0;
  padding-left: 1.5rem;
}

.data-summary {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .data-summary {
    grid-template-columns: 1fr 1fr;
  }
}

.data-card {
  background-color: var(--card-background-secondary, #f9f9f9);
  padding: 1.25rem;
  border-radius: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color, #eee);
}

.data-table td:first-child {
  font-weight: 500;
  width: 40%;
}

.toggle-debugger-btn {
  margin-top: 1rem;
  background-color: var(--secondary-color-light, #e3f2fd);
  color: var(--secondary-color, #2196f3);
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.data-debugger {
  margin-top: 1.5rem;
  padding: 1.25rem;
  background-color: var(--card-background-secondary, #f9f9f9);
  border-radius: 8px;
  overflow: hidden;
}

@media (max-width: 640px) {
  .track-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .track-meta {
    text-align: left;
    margin: 0.5rem 0;
  }

  .track-actions {
    align-self: flex-end;
  }

  .tab-name {
    display: none;
  }

  .tab-button {
    padding: 0.75rem;
    justify-content: center;
    flex: 1;
  }

  .tab-icon {
    font-size: 1.4rem;
    margin: 0;
  }
}
</style>
