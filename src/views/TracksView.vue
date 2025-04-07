<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  getAllTracks,
  deleteTrack,
  exportTrackToGPX,
} from '../services/trackingService'

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

// Formater la durée (secondes -> HH:MM:SS)
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':')
}

// Formater la date
const formatDate = (isoString) => {
  const date = new Date(isoString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
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
        formatDate(track.startTime).toLowerCase().includes(term),
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

    <!-- Barre de recherche et options de tri -->
    <div class="search-and-sort">
      <div class="search-box">
        <input
          type="text"
          v-model="searchTerm"
          placeholder="Rechercher un trajet..."
          class="search-input"
        />
      </div>

      <div class="sort-options">
        <span>Trier par:</span>
        <select v-model="sortBy" class="sort-select">
          <option value="date">Date</option>
          <option value="distance">Distance</option>
          <option value="duration">Durée</option>
        </select>

        <button @click="toggleSortOrder" class="sort-button">
          {{ sortOrder === 'asc' ? '↑' : '↓' }}
        </button>
      </div>
    </div>

    <!-- Liste des trajets -->
    <div class="tracks-list">
      <div v-if="loading" class="loading">Chargement des trajets...</div>

      <div v-else-if="tracks.length === 0" class="no-tracks">
        <p>Aucun trajet enregistré</p>
        <p class="hint">
          Utilisez l'option "Suivi d'activité" sur l'écran principal pour enregistrer vos
          déplacements
        </p>
      </div>

      <div v-else-if="sortedTracks.length === 0" class="no-results">
        Aucun résultat pour "{{ searchTerm }}"
      </div>

      <div v-else class="track-items">
        <div
          v-for="track in sortedTracks"
          :key="track.id"
          class="track-item"
          @click="viewTrackDetail(track.id)"
        >
          <div class="track-info">
            <h3 class="track-name">{{ track.name }}</h3>
            <div class="track-date">{{ formatDate(track.startTime) }}</div>

            <div class="track-stats">
              <div class="stat">
                <span class="stat-icon">📏</span>
                <span class="stat-value">{{ (track.distance / 1000).toFixed(2) }} km</span>
              </div>

              <div class="stat">
                <span class="stat-icon">⏱️</span>
                <span class="stat-value">{{ formatDuration(track.duration) }}</span>
              </div>

              <div class="stat">
                <span class="stat-icon">⚡</span>
                <span class="stat-value"
                  >{{ (track.distance / 1000 / (track.duration / 3600)).toFixed(1) }} km/h</span
                >
              </div>
            </div>
          </div>

          <div class="track-actions" @click.stop>
            <button
              @click="exportGPX(track.id)"
              class="action-button export-button"
              title="Exporter en GPX"
            >
              📥
            </button>

            <button
              @click="handleDeleteTrack(track.id)"
              class="action-button delete-button"
              title="Supprimer"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
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

.search-and-sort {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: center;
  justify-content: space-between;
}

.search-box {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  font-size: 1rem;
}

.sort-options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-select {
  padding: 0.5rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  background-color: var(--card-background);
  color: var(--text-color);
}

.sort-button {
  background-color: var(--primary-color-light, #e8f5e9);
  color: var(--primary-color, #4caf50);
  border: none;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  transition: background-color 0.2s;
}

.sort-button:hover {
  background-color: var(--primary-color, #4caf50);
  color: white;
}

.loading,
.no-tracks,
.no-results {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary, #666);
  background-color: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.hint {
  font-size: 0.9rem;
  color: var(--text-tertiary, #888);
  margin-top: 0.5rem;
}

.track-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.track-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.track-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

.track-info {
  flex: 1;
}

.track-name {
  margin: 0 0 0.25rem 0;
  font-size: 1.1rem;
  color: var(--text-color);
}

.track-date {
  color: var(--text-secondary, #666);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.track-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text-color);
}

.stat-icon {
  font-size: 1.1rem;
}

.track-actions {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.export-button {
  background-color: var(--secondary-color-light, #e3f2fd);
  color: var(--secondary-color, #2196f3);
}

.export-button:hover {
  background-color: var(--secondary-color, #2196f3);
  color: white;
}

.delete-button {
  background-color: var(--error-light, #ffebee);
  color: var(--error, #f44336);
}

.delete-button:hover {
  background-color: var(--error, #f44336);
  color: white;
}

@media (max-width: 600px) {
  .search-and-sort {
    flex-direction: column;
    align-items: stretch;
  }

  .track-item {
    flex-direction: column;
    align-items: stretch;
  }

  .track-actions {
    margin-top: 1rem;
    align-self: flex-end;
  }
}
</style>
