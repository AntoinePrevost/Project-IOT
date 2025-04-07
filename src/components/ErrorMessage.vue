<script setup>
import { defineProps, defineEmits } from 'vue'

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  message: {
    type: String,
    required: true,
  },
  dismissible: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['dismiss'])

const dismiss = () => {
  emit('dismiss')
}
</script>

<template>
  <div class="error-message">
    {{ message }}
    <button v-if="dismissible" @click="dismiss" class="dismiss-button">×</button>
  </div>
</template>

<style scoped>
.error-message {
  background-color: var(--error-light, #ffebee);
  color: var(--error, #f44336);
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.dismiss-button {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  margin-left: 0.5rem;
  line-height: 1;
}
</style>
