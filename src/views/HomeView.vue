<script setup>
import LocationTracker from '../components/LocationTracker.vue'

</script>

<template>
  <div class="home-view">
    <h2>Localisation</h2>
    <LocationTracker :disableContinuousTracking="true" />
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h2 {
  text-align: center;
  margin: 0;
  color: var(--text-color);
}

.info-panel {
  display: flex;
  background-color: var(--info-light, #e3f2fd);
  color: var(--info, #2196f3);
  padding: 1rem;
  border-radius: 8px;
  gap: 1rem;
  align-items: center;
}

.info-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.info-content {
  flex: 1;
}

.info-content p {
  margin: 0 0 0.5rem 0;
}

.record-button {
  margin-top: 0.5rem;
  background-color: var(--primary-color, #4caf50);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.record-button:hover {
  background-color: var(--primary-color-dark, #388e3c);
}

.button-icon {
  font-size: 1.1rem;
}

@media (max-width: 480px) {
  .info-panel {
    flex-direction: column;
    text-align: center;
  }

  .record-button {
    width: 100%;
    justify-content: center;
  }
}
</style>
