<script setup>
import { ref } from 'vue'

const props = defineProps({
  isRecording: {
    type: Boolean,
    default: false,
  },
  isPaused: {
    type: Boolean,
    default: false,
  },
  trackName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'start-recording',
  'pause-recording',
  'resume-recording',
  'stop-recording',
  'cancel-recording',
  'update:trackName',
])

const localTrackName = ref(props.trackName)

// Surveiller les changements locaux et émettre les mises à jour
const updateTrackName = (event) => {
  localTrackName.value = event.target.value
  emit('update:trackName', localTrackName.value)
}
</script>

<template>
  <div class="recording-controls">
    <input
      v-if="!isRecording"
      v-model="localTrackName"
      type="text"
      placeholder="Nom du trajet"
      class="track-name-input"
      @input="updateTrackName"
    />

    <div class="button-group">
      <template v-if="!isRecording">
        <button @click="$emit('start-recording')" class="start-button">
          <span class="icon">▶️</span>
          <span class="label">Démarrer l'enregistrement</span>
        </button>
      </template>

      <template v-else>
        <button v-if="!isPaused" @click="$emit('pause-recording')" class="pause-button">
          <span class="icon">⏸️</span>
          <span class="label">Pause</span>
        </button>

        <button v-else @click="$emit('resume-recording')" class="resume-button">
          <span class="icon">▶️</span>
          <span class="label">Reprendre</span>
        </button>

        <button @click="$emit('stop-recording')" class="stop-button">
          <span class="icon">⏹️</span>
          <span class="label">Terminer</span>
        </button>
      </template>

      <button @click="$emit('cancel-recording')" class="cancel-button">
        <span class="icon">✖️</span>
        <span class="label">Annuler</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.recording-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: var(--card-background);
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.track-name-input {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  font-size: 1rem;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
}

.start-button,
.pause-button,
.resume-button,
.stop-button,
.cancel-button {
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.start-button {
  background-color: var(--primary-color, #4caf50);
  color: white;
}

.pause-button {
  background-color: var(--accent-color, #ff9800);
  color: white;
}

.resume-button {
  background-color: var(--primary-color, #4caf50);
  color: white;
}

.stop-button {
  background-color: var(--secondary-color, #2196f3);
  color: white;
}

.cancel-button {
  background-color: var(--error, #f44336);
  color: white;
}

.icon {
  font-size: 1.2rem;
}

@media (max-width: 768px) {
  .button-group {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .label {
    display: none; /* Masquer le texte des boutons sur petit écran */
  }

  .button-group {
    flex-direction: row;
  }

  .start-button,
  .pause-button,
  .resume-button,
  .stop-button,
  .cancel-button {
    padding: 0.8rem;
    flex: 1;
    justify-content: center;
  }
}
</style>
