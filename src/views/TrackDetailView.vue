<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { getTrackById, deleteTrack, exportTrackToGPX } from '../services/trackingService'
import { calculateTrackStatistics, prepareTrackData } from '../services/trackService'
import TrackStats from '../components/TrackStats.vue'
import TrackVisualizer from '../components/TrackVisualizer.vue'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const track = ref(null)
const isLoading = ref(true)
const error = ref(null)

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
  return calculateTrackStatistics(track.value)
})

// Supprimer le trajet et retourner à la liste
const handleDeleteTrack = () => {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce trajet?')) {
    if (deleteTrack(route.params.id)) {
      toast.success('Trajet supprimé avec succès')
      router.push({ name: 'tracks' })
    } else {
      toast.error('Erreur lors de la suppression du trajet')
    }
  }
}

// Exporter le trajet en GPX
const exportToGPX = () => {
  const gpxContent = exportTrackToGPX(route.params.id)
  if (!gpxContent) {
    toast.error("Impossible d'exporter le trajet")
    return
  }

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${track.value.name || 'track'}.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.success('Trajet exporté avec succès')
}

// Retourner à la liste des trajets
const goBack = () => {
  router.push({ name: 'tracks' })
}

onMounted(async () => {
  try {
    isLoading.value = true
    console.log('Chargement du trajet ID:', route.params.id)

    // Utiliser getTrackById depuis trackingService
    const rawTrack = getTrackById(route.params.id)

    if (!rawTrack) {
      error.value = 'Trajet introuvable'
      isLoading.value = false
      return
    }

    console.log('Trajet brut récupéré:', rawTrack.id, 'Points:', rawTrack.points?.length || 0)

    // Préparer les données du trajet (nettoyer et valider)
    const cleanedTrack = prepareTrackData(rawTrack)
    track.value = cleanedTrack

    console.log('Trajet nettoyé:', track.value.id, 'Points:', track.value.points?.length || 0)

    // Vérifier la validité des points pour la carte
    if (track.value.points && track.value.points.length > 0) {
      const validCoords = track.value.points.filter(
        (p) =>
          typeof p.latitude === 'number' &&
          typeof p.longitude === 'number' &&
          !isNaN(p.latitude) &&
          !isNaN(p.longitude),
      )
      console.log(
        `Points avec coordonnées valides: ${validCoords.length} sur ${track.value.points.length}`,
      )
    }

    isLoading.value = false
  } catch (err) {
    console.error('Erreur lors du chargement du trajet:', err)
    error.value = 'Impossible de charger les données du trajet'
    isLoading.value = false
  }
})
</script>

<template>
  <div class="track-detail">
    <div class="header-actions">
      <button @click="goBack" class="back-button">
        <span class="icon">←</span>
        <span>Retour</span>
      </button>

      <div class="actions" v-if="track">
        <button @click="exportToGPX" class="action-button export-button">
          <span class="icon">📥</span>
          <span>Exporter en GPX</span>
        </button>

        <button @click="handleDeleteTrack" class="action-button delete-button">
          <span class="icon">🗑️</span>
          <span>Supprimer</span>
        </button>
      </div>
    </div>

    <h2 v-if="track">{{ track.name || 'Trajet' }}</h2>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Chargement des données...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <button @click="goBack" class="retry-button">Retour à la liste des trajets</button>
    </div>

    <div v-else-if="track" class="track-content">
      <!-- Statistiques du trajet -->
      <TrackStats :statistics="statistics" />

      <!-- Visualisation du trajet -->
      <TrackVisualizer v-if="track.points && track.points.length > 0" :track="track" />

      <div v-else class="no-data">Aucune donnée disponible pour ce trajet</div>
    </div>

    <div v-else class="no-data">Aucun trajet trouvé</div>
  </div>
</template>

<style scoped>
.track-detail {
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

.track-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.loading-container,
.error-container,
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
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
}
</style>
