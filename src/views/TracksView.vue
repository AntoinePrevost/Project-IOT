<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getAllTracks, deleteTrack, exportTrackToGPX } from '../services/trackingService'
import SearchAndFilter from '../components/SearchAndFilter.vue'
import TrackList from '../components/TrackList.vue'

const router = useRouter()
const tracks = ref([])
const loading = ref(true)
const searchTerm = ref('')
const sortBy = ref('date') // 'date', 'distance', 'duration'
const sortOrder = ref('desc') // 'asc', 'desc'

// Récupérer tous les trajets
const loadTracks = () => {
  loading.value = true
  tracks.value = getAllTracks()
  loading.value = false
}

// Trier les trajets
const sortedTracks = computed(() => {
  // Filtrer selon la recherche
  let result = [...tracks.value]

  if (searchTerm.value.trim() !== '') {
    const term = searchTerm.value.toLowerCase()
    result = result.filter(
      (track) =>
        track.name.toLowerCase().includes(term) ||
        new Date(track.startTime).toLocaleDateString().toLowerCase().includes(term),
    )
  }

  // Trier selon le critère choisi
  result.sort((a, b) => {
    let comparison = 0

    if (sortBy.value === 'date') {
      comparison = new Date(a.startTime) - new Date(b.startTime)
    } else if (sortBy.value === 'distance') {
      comparison = a.distance - b.distance
    } else if (sortBy.value === 'duration') {
      comparison = a.duration - b.duration
    }

    return sortOrder.value === 'asc' ? comparison : -comparison
  })

  return result
})

// Supprimer un trajet
const handleDeleteTrack = (id) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce trajet?')) {
    deleteTrack(id)
    loadTracks()
  }
}

// Voir le détail d'un trajet
const viewTrackDetail = (id) => {
  router.push({ name: 'track-detail', params: { id } })
}

// Créer un nouveau trajet (redirection vers la page d'enregistrement)
const createNewTrack = () => {
  router.push({ name: 'track-recorder' })
}

// Exporter un trajet en GPX
const exportGPX = (id) => {
  const gpxContent = exportTrackToGPX(id)
  if (!gpxContent) return

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `track_${id}.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Changer l'ordre de tri
const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

onMounted(() => {
  loadTracks()
})
</script>

<template>
  <div class="tracks-view">
    <h2>Historique des trajets</h2>

    <!-- Bouton pour créer un nouveau trajet -->
    <div class="new-track-container">
      <button @click="createNewTrack" class="new-track-button">
        <span class="icon">➕</span> Enregistrer un nouveau trajet
      </button>
    </div>

    <!-- Composant de recherche et de tri -->
    <SearchAndFilter
      v-model:searchTerm="searchTerm"
      v-model:sortBy="sortBy"
      v-model:sortOrder="sortOrder"
      @toggle-sort-order="toggleSortOrder"
    />

    <!-- Composant de liste des trajets -->
    <TrackList
      :tracks="sortedTracks"
      :loading="loading"
      :searchTerm="searchTerm"
      @view-track="viewTrackDetail"
      @delete-track="handleDeleteTrack"
      @export-track="exportGPX"
    />
  </div>
</template>

<style scoped>
.tracks-view {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: var(--text-color);
}

.new-track-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.new-track-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1.5rem;
  background-color: var(--primary-color, #4caf50);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.2s,
    transform 0.1s;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.new-track-button:hover {
  background-color: var(--primary-color-dark, #388e3c);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.new-track-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.new-track-button .icon {
  font-size: 1.2rem;
}

/* Ajustement responsive pour le bouton */
@media (max-width: 480px) {
  .new-track-button {
    width: 100%;
    justify-content: center;
    padding: 0.7rem 1rem;
  }
}
</style>
