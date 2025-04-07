<script setup>
import { defineProps } from 'vue'

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  elapsedTime: {
    type: String,
    default: '00:00:00',
  },
  distance: {
    type: [Number, String],
    default: 0,
  },
  currentSpeed: {
    type: [Number, String],
    default: 0,
  },
  maxSpeed: {
    type: [Number, String],
    default: 0,
  },
  averageSpeed: {
    type: [Number, String],
    default: 0,
  },
})
</script>

<template>
  <div class="stats-panel">
    <div class="stat-card">
      <div class="stat-icon">⏱️</div>
      <div class="stat-name">Durée</div>
      <div class="stat-value">{{ elapsedTime }}</div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">📏</div>
      <div class="stat-name">Distance</div>
      <div class="stat-value">
        {{ typeof distance === 'number' ? distance.toFixed(2) : distance }} km
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">⚡</div>
      <div class="stat-name">Vitesse</div>
      <div class="stat-value">
        {{ typeof currentSpeed === 'number' ? currentSpeed.toFixed(1) : currentSpeed }} km/h
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">📊</div>
      <div class="stat-name">Vit. moyenne</div>
      <div class="stat-value">
        {{ typeof averageSpeed === 'number' ? averageSpeed.toFixed(1) : averageSpeed }} km/h
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">🚀</div>
      <div class="stat-name">Vitesse max</div>
      <div class="stat-value">
        {{ typeof maxSpeed === 'number' ? maxSpeed.toFixed(1) : maxSpeed }} km/h
      </div>
    </div>
  </div>
</template>

<style scoped>
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

@media (max-width: 768px) {
  .stats-panel {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
