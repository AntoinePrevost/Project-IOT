// Composant pour afficher les statistiques du trajet
<script setup>
import { defineProps } from 'vue'

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  statistics: {
    type: Object,
    required: true,
  },
  // Ajout d'une prop pour personnaliser la présentation
  compact: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <div class="track-stats" :class="{ 'track-stats-compact': compact }">
    <div class="stat-item">
      <div class="stat-value">{{ statistics.distance }} km</div>
      <div class="stat-label">Distance</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">{{ statistics.duration }}</div>
      <div class="stat-label">Durée</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">{{ statistics.avgSpeed }} km/h</div>
      <div class="stat-label">Vitesse moyenne</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">{{ statistics.maxSpeed }} km/h</div>
      <div class="stat-label">Vitesse max</div>
    </div>
    <div class="stat-item" v-if="statistics.elevGain > 0">
      <div class="stat-value">{{ statistics.elevGain }} m</div>
      <div class="stat-label">Dénivelé +</div>
    </div>
    <div class="stat-item" v-if="statistics.elevLoss > 0">
      <div class="stat-value">{{ statistics.elevLoss }} m</div>
      <div class="stat-label">Dénivelé -</div>
    </div>
  </div>
</template>

<style scoped>
.track-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

.track-stats-compact {
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.stat-item {
  background-color: var(--card-background, #fff);
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.track-stats-compact .stat-item {
  padding: 0.5rem;
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--primary-color, #4caf50);
  margin-bottom: 0.25rem;
}

.track-stats-compact .stat-value {
  font-size: 1.1rem;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--text-secondary, #666);
}

.track-stats-compact .stat-label {
  font-size: 0.8rem;
}

@media (max-width: 600px) {
  .track-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .track-stats-compact {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
