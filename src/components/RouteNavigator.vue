<script setup>
import { ref, onMounted } from 'vue'
import { getRoute, searchPlaces } from '../services/routeService'

// Références principales
const mapElement = ref(null)
const startInput = ref('')
const endInput = ref('')
const loading = ref(false)
const error = ref('')
const routeInfo = ref(null)
const selectedTransportMode = ref('driving-car')

// Variables pour les suggestions d'adresses
const startResults = ref([])
const endResults = ref([])
const showStartResults = ref(false)
const showEndResults = ref(false)
let searchTimeout = null

// Variables Leaflet
let map = null
let routeLayer = null
let startMarker = null
let endMarker = null

// Options de transport
const transportModes = [
  { id: 'driving-car', name: 'Voiture', icon: '🚗' },
  { id: 'foot-walking', name: 'À pied', icon: '🚶' },
  { id: 'cycling-regular', name: 'Vélo', icon: '🚲' },
]

// Fonctions pour afficher/masquer les résultats de recherche
function showStartResultsPanel() {
  if (startResults.value.length > 0) {
    showStartResults.value = true
  }
}

function showEndResultsPanel() {
  if (endResults.value.length > 0) {
    showEndResults.value = true
  }
}

// Recherche d'adresses
async function searchStartAddress() {
  clearTimeout(searchTimeout)
  if (startInput.value.length < 3) {
    startResults.value = []
    showStartResults.value = false
    return
  }

  searchTimeout = setTimeout(async () => {
    try {
      loading.value = true
      const results = await searchPlaces(startInput.value)
      startResults.value = results || []
      showStartResults.value = results.length > 0
    } catch (error) {
      error.value = "Erreur lors de la recherche d'adresses"
    } finally {
      loading.value = false
    }
  }, 500)
}

async function searchEndAddress() {
  clearTimeout(searchTimeout)
  if (endInput.value.length < 3) {
    endResults.value = []
    showEndResults.value = false
    return
  }

  searchTimeout = setTimeout(async () => {
    try {
      loading.value = true
      const results = await searchPlaces(endInput.value)
      endResults.value = results || []
      showEndResults.value = results.length > 0
    } catch (error) {
      error.value = "Erreur lors de la recherche d'adresses"
    } finally {
      loading.value = false
    }
  }, 500)
}

// Sélection d'adresses
function selectStartPlace(place) {
  startInput.value = place.display_name
  showStartResults.value = false
  setMarker(place, true)
}

function selectEndPlace(place) {
  endInput.value = place.display_name
  showEndResults.value = false
  setMarker(place, false)
}

// Gestion des marqueurs sur la carte
function setMarker(place, isStartPoint = true) {
  if (!map || !window.L) return

  try {
    const lat = parseFloat(place.lat)
    const lon = parseFloat(place.lon)

    if (isNaN(lat) || isNaN(lon)) return

    const markerIcon = window.L.divIcon({
      html: isStartPoint ? '🟢' : '🔴',
      className: 'custom-marker',
      iconSize: [30, 30],
    })

    // Supprimer l'ancien marqueur s'il existe
    if (isStartPoint && startMarker) {
      map.removeLayer(startMarker)
    } else if (!isStartPoint && endMarker) {
      map.removeLayer(endMarker)
    }

    // Créer le nouveau marqueur
    const marker = window.L.marker([lat, lon], { icon: markerIcon })
      .addTo(map)
      .bindPopup(isStartPoint ? 'Départ' : 'Arrivée')
      .openPopup()

    // Stocker la référence
    if (isStartPoint) {
      startMarker = marker
    } else {
      endMarker = marker
    }

    // Centrer la carte
    map.setView([lat, lon], 13)
  } catch (error) {
    error.value = 'Impossible de placer le marqueur sur la carte'
  }
}

// Calcul d'itinéraire
async function calculateRoute() {
  if (!startMarker || !endMarker) {
    error.value = 'Veuillez sélectionner un point de départ et une destination'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // Récupérer les coordonnées
    const startPos = startMarker.getLatLng()
    const endPos = endMarker.getLatLng()
    const startCoords = [startPos.lng, startPos.lat]
    const endCoords = [endPos.lng, endPos.lat]

    // Appeler l'API
    const result = await getRoute(startCoords, endCoords, selectedTransportMode.value)

    // Nettoyer l'ancien tracé
    if (routeLayer) {
      map.removeLayer(routeLayer)
    }

    // Tracer le nouvel itinéraire
    const routeCoords = result.features[0].geometry.coordinates.map((coord) => [coord[1], coord[0]])

    routeLayer = window.L.polyline(routeCoords, {
      color: '#4CAF50',
      weight: 5,
      opacity: 0.7,
    }).addTo(map)

    // Ajuster la vue
    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] })

    // Afficher les informations
    const summary = result.features[0].properties.summary
    routeInfo.value = {
      distance: (summary.distance / 1000).toFixed(2),
      duration: Math.round(summary.duration / 60),
    }
  } catch (err) {
    error.value = `Erreur: ${err.message}`
  } finally {
    loading.value = false
  }
}

// Géolocalisation
function useCurrentLocation(isStartPoint = true) {
  if (!navigator.geolocation) {
    error.value = 'Géolocalisation non supportée'
    return
  }

  loading.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const currentPlace = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        display_name: 'Ma position actuelle',
      }

      if (isStartPoint) {
        startInput.value = 'Ma position actuelle'
      } else {
        endInput.value = 'Ma position actuelle'
      }

      setMarker(currentPlace, isStartPoint)
      loading.value = false
    },
    () => {
      error.value = "Impossible d'obtenir votre position"
      loading.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

// Initialisation de la carte
function initializeMap() {
  if (mapElement.value && window.L) {
    map = window.L.map(mapElement.value).setView([48.856614, 2.3522219], 11)

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
  }
}

// Fermeture des listes de suggestions
function handleClickOutside(event) {
  const startContainer = document.getElementById('start-results-container')
  const endContainer = document.getElementById('end-results-container')

  if (startContainer && !startContainer.contains(event.target)) {
    showStartResults.value = false
  }

  if (endContainer && !endContainer.contains(event.target)) {
    showEndResults.value = false
  }
}

onMounted(() => {
  // Charger Leaflet
  if (!window.L) {
    // CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    // JS
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = initializeMap
    document.head.appendChild(script)
  } else {
    initializeMap()
  }

  // Gestionnaire pour fermer les suggestions
  document.addEventListener('click', handleClickOutside)

  // Nettoyage
  return () => {
    document.removeEventListener('click', handleClickOutside)
  }
})
</script>

<template>
  <div class="route-navigator">
    <h2>Calculateur d'itinéraires</h2>

    <!-- Formulaire avec suggestions d'adresses -->
    <div class="search-form">
      <!-- Point de départ -->
      <div class="input-group" id="start-results-container">
        <div class="input-label">
          <span class="marker-icon">🟢</span>
          <span>Départ</span>
        </div>
        <div class="input-row">
          <input
            type="text"
            v-model="startInput"
            placeholder="Entrez un lieu de départ"
            @input="searchStartAddress"
            @focus="showStartResultsPanel"
          />
          <button
            @click="useCurrentLocation(true)"
            class="current-btn"
            title="Utiliser ma position"
          >
            📍
          </button>
        </div>

        <!-- Suggestions -->
        <div v-if="showStartResults" class="search-results">
          <div v-if="startResults.length === 0" class="no-results">
            {{ loading ? 'Recherche...' : 'Aucun résultat' }}
          </div>
          <div
            v-for="place in startResults"
            :key="`start-${place.place_id}`"
            class="result-item"
            @click="selectStartPlace(place)"
          >
            {{ place.display_name }}
          </div>
        </div>
      </div>

      <!-- Destination -->
      <div class="input-group" id="end-results-container">
        <div class="input-label">
          <span class="marker-icon">🔴</span>
          <span>Destination</span>
        </div>
        <div class="input-row">
          <input
            type="text"
            v-model="endInput"
            placeholder="Entrez une destination"
            @input="searchEndAddress"
            @focus="showEndResultsPanel"
          />
          <button
            @click="useCurrentLocation(false)"
            class="current-btn"
            title="Utiliser ma position"
          >
            📍
          </button>
        </div>

        <!-- Suggestions -->
        <div v-if="showEndResults" class="search-results">
          <div v-if="endResults.length === 0" class="no-results">
            {{ loading ? 'Recherche...' : 'Aucun résultat' }}
          </div>
          <div
            v-for="place in endResults"
            :key="`end-${place.place_id}`"
            class="result-item"
            @click="selectEndPlace(place)"
          >
            {{ place.display_name }}
          </div>
        </div>
      </div>

      <!-- Modes de transport -->
      <div class="transport-modes">
        <button
          v-for="mode in transportModes"
          :key="mode.id"
          @click="selectedTransportMode = mode.id"
          :class="['mode-btn', { active: selectedTransportMode === mode.id }]"
        >
          <span class="mode-icon">{{ mode.icon }}</span>
          <span>{{ mode.name }}</span>
        </button>
      </div>

      <!-- Bouton de calcul -->
      <button @click="calculateRoute" class="calculate-btn" :disabled="loading">
        <span v-if="loading" class="loading-spinner"></span>
        <span>{{ loading ? 'Calcul...' : "Calculer l'itinéraire" }}</span>
      </button>

      <!-- Message d'erreur -->
      <div v-if="error" class="error-message">{{ error }}</div>

      <!-- Résumé de l'itinéraire -->
      <div v-if="routeInfo" class="route-summary">
        <div class="summary-item"><strong>Distance:</strong> {{ routeInfo.distance }} km</div>
        <div class="summary-item"><strong>Durée:</strong> {{ routeInfo.duration }} min</div>
      </div>
    </div>

    <!-- Carte -->
    <div class="map-container" ref="mapElement"></div>
  </div>
</template>

<style scoped>
.route-navigator {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
  gap: 1rem;
}

h2 {
  text-align: center;
  color: var(--text-color);
  margin-bottom: 1rem;
}

.search-form {
  background-color: var(--card-background);
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.input-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.marker-icon {
  font-size: 1.2rem;
}

.input-row {
  display: flex;
  position: relative;
}

input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  font-size: 1rem;
  color: var(--text-color);
}

.current-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0.6;
}

.current-btn:hover {
  opacity: 1;
}

/* Suggestions */
.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: var(--card-background);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 0 0 8px 8px;
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}

.result-item {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color, #eee);
  font-size: 0.9rem;
}

.result-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.no-results {
  padding: 10px;
  text-align: center;
  color: #999;
  font-style: italic;
  font-size: 0.9rem;
}

/* Transport modes */
.transport-modes {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  background: none;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn.active {
  border-color: var(--primary-color);
  background-color: rgba(76, 175, 80, 0.1);
}

.mode-icon {
  font-size: 1.5rem;
}

/* Buttons */
.calculate-btn {
  width: 100%;
  padding: 0.75rem;
  background: var(--primary-color, #4caf50);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.calculate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.loading-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  padding: 0.75rem;
  background-color: var(--error-light, #ffebee);
  color: var(--error, #f44336);
  border-radius: 8px;
  text-align: center;
}

/* Route summary */
.route-summary {
  display: flex;
  justify-content: space-around;
  padding: 0.75rem;
  background-color: var(--primary-color-light, #e8f5e9);
  border-radius: 8px;
}

/* Map */
.map-container {
  height: 400px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-color, #ddd);
}

/* Responsive */
@media (min-width: 768px) {
  .map-container {
    height: 500px;
  }
}

@media (max-width: 600px) {
  .route-summary {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>
