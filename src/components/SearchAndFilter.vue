<script setup>
import { computed } from 'vue'

const props = defineProps({
  searchTerm: {
    type: String,
    default: '',
  },
  sortBy: {
    type: String,
    default: 'date',
  },
  sortOrder: {
    type: String,
    default: 'desc',
  },
})

const emit = defineEmits([
  'update:searchTerm',
  'update:sortBy',
  'update:sortOrder',
  'toggle-sort-order',
])

// Utiliser v-model avec les props
const searchInput = computed({
  get: () => props.searchTerm,
  set: (value) => emit('update:searchTerm', value),
})

const sortBySelect = computed({
  get: () => props.sortBy,
  set: (value) => emit('update:sortBy', value),
})

// Basculer l'ordre de tri
const toggleSortOrder = () => {
  emit('toggle-sort-order')
}
</script>

<template>
  <div class="search-and-sort">
    <div class="search-box">
      <input
        type="text"
        v-model="searchInput"
        placeholder="Rechercher un trajet..."
        class="search-input"
      />
    </div>

    <div class="sort-options">
      <span>Trier par:</span>
      <select v-model="sortBySelect" class="sort-select">
        <option value="date">Date</option>
        <option value="distance">Distance</option>
        <option value="duration">Durée</option>
      </select>

      <button @click="toggleSortOrder" class="sort-button">
        {{ props.sortOrder === 'asc' ? '↑' : '↓' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
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

@media (max-width: 600px) {
  .search-and-sort {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
