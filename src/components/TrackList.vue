<script setup>
import { defineProps, defineEmits } from 'vue'

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  tracks: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  searchTerm: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['view-track', 'delete-track', 'export-track'])

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
</script>

<template>
  <div class="tracks-list">
    <div v-if="loading" class="loading">Chargement des trajets...</div>

    <div v-else-if="tracks.length === 0 && !searchTerm" class="no-tracks">
      <p>Aucun trajet enregistré</p>
      <p class="hint">Utilisez le bouton "Enregistrer un nouveau trajet" pour commencer</p>
    </div>

    <div v-else-if="tracks.length === 0 && searchTerm" class="no-results">
      Aucun résultat pour "{{ searchTerm }}"
    </div>

    <div v-else class="track-items">
      <div
        v-for="track in tracks"
        :key="track.id"
        class="track-item"
        @click="emit('view-track', track.id)"
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
              <span class="stat-value">
                {{ (track.distance / 1000 / (track.duration / 3600)).toFixed(1) }} km/h
              </span>
            </div>
          </div>
        </div>

        <div class="track-actions" @click.stop>
          <button
            @click="emit('export-track', track.id)"
            class="action-button export-button"
            title="Exporter en GPX"
          >
            📥
          </button>

          <button
            @click="emit('delete-track', track.id)"
            class="action-button delete-button"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
