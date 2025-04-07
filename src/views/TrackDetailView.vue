<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTrackById, deleteTrack, exportTrackToGPX } from '../services/trackingService'
import { formatDuration, formatDate, formatDistance } from '../utils/formatters'
import TrackVisualizer from '../components/TrackVisualizer.vue'

const route = useRoute()
const router = useRouter()
const track = ref(null)
const loading = ref(true)
const error = ref(null)

const trackId = computed(() => route.params.id)

// Calculer quelques statistiques complémentaires
const avgSpeed = computed(() => {
  if (!track.value) return 0
  // Vitesse moyenne (km/h)
  return track.value.distance / 1000 / (track.value.duration / 3600)
})

// Charger les données du trajet
const loadTrack = () => {
  loading.value = true
  error.value = null

  try {
    const trackData = getTrackById(trackId.value)

    if (!trackData) {
      error.value = 'Trajet non trouvé'
      loading.value = false
      return
    }

    track.value = trackData
  } catch (err) {
    error.value = `Erreur lors du chargement du trajet: ${err.message}`
    console.error('Erreur lors du chargement du trajet:', err)
  } finally {
    loading.value = false
  }
}

// Supprimer le trajet
const handleDeleteTrack = () => {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce trajet?')) {
    deleteTrack(trackId.value)
    router.push({ name: 'tracks' })
  }
}

// Exporter le trajet en GPX
const exportGPX = () => {
  const gpxContent = exportTrackToGPX(trackId.value)
  if (!gpxContent) {
    alert("Erreur lors de l'exportation du trajet")
    return
  }

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `track_${trackId.value}.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadTrack()
})
</script>

<template>
  <div class="track-detail-view">
    <!-- En-tête et actions -->
    <div class="header-actions">
      <button @click="router.push({ name: 'tracks' })" class="back-button">
        <span class="icon">←</span>
        <span class="label">Retour à la liste</span>
      </button>

      <div class="actions">
        <button @click="exportGPX" class="action-button export-button">
          <span class="icon">📥</span>
          <span class="label">Exporter (GPX)</span>
        </button>

        <button @click="handleDeleteTrack" class="action-button delete-button">
          <span class="icon">🗑️</span>
          <span class="label">Supprimer</span>
        </button>
      </div>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Chargement du trajet...</p>
    </div>

    <!-- Erreur -->
    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <button @click="router.push({ name: 'tracks' })" class="retry-button">
        Retour à la liste des trajets
      </button>
    </div>

    <!-- Contenu du trajet -->
    <template v-else-if="track">
      <h2>{{ track.name }}</h2>

      <!-- Informations générales -->
      <div class="track-info-cards">
        <div class="info-card">
          <div class="info-icon">📅</div>
          <div class="info-label">Date</div>
          <div class="info-value">{{ formatDate(track.startTime) }}</div>
        </div>

        <div class="info-card">
          <div class="info-icon">⏱️</div>
          <div class="info-label">Durée</div>
          <div class="info-value">{{ formatDuration(track.duration) }}</div>
        </div>

        <div class="info-card">
          <div class="info-icon">📏</div>
          <div class="info-label">Distance</div>
          <div class="info-value">{{ formatDistance(track.distance) }}</div>
        </div>

        <div class="info-card">
          <div class="info-icon">⚡</div>
          <div class="info-label">Vitesse moyenne</div>
          <div class="info-value">{{ avgSpeed.toFixed(1) }} km/h</div>
        </div>
      </div>

      <!-- Visualisation interactive du trajet -->
      <div class="track-visualization">
        <TrackVisualizer :track="track" :auto-play="false" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.track-detail-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.back-button,
.action-button {
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

.actions {
  display: flex;
  gap: 0.75rem;
}

.export-button {
  background-color: var(--primary-color-light, #e8f5e9);
  color: var(--primary-color, #4caf50);
}

.delete-button {
  background-color: var(--error-light, #ffebee);
  color: var(--error, #f44336);
}

.back-button:hover,
.action-button:hover {
  filter: brightness(0.95);
  transform: translateY(-2px);
}

h2 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: var(--text-color);
  text-align: center;
}

.track-info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-card {
  background-color: var(--card-background, #fff);
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.info-icon {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

.info-label {
  font-size: 0.9rem;
  color: var(--text-secondary, #666);
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-color);
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--primary-color, #4caf50);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-container {
  color: var(--error, #f44336);
}

.retry-button {
  margin-top: 1rem;
  padding: 0.6rem 1rem;
  background-color: var(--primary-color, #4caf50);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background-color: var(--primary-color-dark, #388e3c);
}

.track-visualization {
  margin-top: 2rem;
}

@media (max-width: 600px) {
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .actions {
    justify-content: center;
  }

  .back-button,
  .action-button {
    justify-content: center;
  }

  .track-info-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
