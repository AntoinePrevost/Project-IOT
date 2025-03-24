<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getRoute, searchPlaces } from '../services/routeService'

// Références
const mapElement = ref(null)
const startInput = ref('')
const endInput = ref('')
const loading = ref(false)
const error = ref('')
const startResults = ref([])
const endResults = ref([])
const showStartResults = ref(false)
const showEndResults = ref(false)
const routeInfo = ref(null)
const selectedTransportMode = ref('driving-car')

let map = null
let routeLayer = null
let startMarker = null
let endMarker = null
let debounceTimeout = null

const transportModes = [
  { id: 'driving-car', name: 'Voiture', icon: '🚗' },
  { id: 'foot-walking', name: 'À pied', icon: '🚶' },
  { id: 'cycling-regular', name: 'Vélo', icon: '🚲' },
]

// Recherche de lieux avec debounce
async function searchStartPlaces() {
  clearTimeout(debounceTimeout)
  if (!startInput.value) {
    startResults.value = []
    showStartResults.value = false
    return
  }

  debounceTimeout = setTimeout(async () => {
    try {
      startResults.value = await searchPlaces(startInput.value)
      showStartResults.value = true
    } catch (error) {
      error.value = 'Erreur lors de la recherche'
    }
  }, 300)
}

async function searchEndPlaces() {
  clearTimeout(debounceTimeout)
  if (!endInput.value) {
    endResults.value = []
    showEndResults.value = false
    return
  }

  debounceTimeout = setTimeout(async () => {
    try {
      endResults.value = await searchPlaces(endInput.value)
      showEndResults.value = true
    } catch (error) {
      error.value = 'Erreur lors de la recherche'
    }
  }, 300)
}

// Sélection des lieux
function selectStartPlace(place) {
  startInput.value = place.display_name
  showStartResults.value = false

  if (map) {
    const coords = [parseFloat(place.lon), parseFloat(place.lat)]

    if (startMarker) {
      startMarker.setLatLng(coords)
    } else {
      startMarker = L.marker([place.lat, place.lon], {
        icon: L.divIcon({
          html: '🟢',
          className: 'custom-marker start-marker',
          iconSize: [30, 30],
        }),
      }).addTo(map)
    }

    map.setView([place.lat, place.lon], 13)
  }
}

function selectEndPlace(place) {
  endInput.value = place.display_name
  showEndResults.value = false

  if (map) {
    const coords = [parseFloat(place.lon), parseFloat(place.lat)]

    if (endMarker) {
      endMarker.setLatLng(coords)
    } else {
      endMarker = L.marker([place.lat, place.lon], {
        icon: L.divIcon({
          html: '🔴',
          className: 'custom-marker end-marker',
          iconSize: [30, 30],
        }),
      }).addTo(map)
    }

    map.setView([place.lat, place.lon], 13)
  }
}

// Calculer l'itinéraire
async function calculateRoute() {
  if (!startInput.value || !endInput.value || !startMarker || !endMarker) {
    error.value = 'Veuillez sélectionner un point de départ et une destination'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const startCoords = [startMarker.getLatLng().lng, startMarker.getLatLng().lat]
    const endCoords = [endMarker.getLatLng().lng, endMarker.getLatLng().lat]

    const result = await getRoute(startCoords, endCoords, selectedTransportMode.value)

    // Clear previous route
    if (routeLayer) {
      map.removeLayer(routeLayer)
    }

    // Extract route coordinates and reverse lat/lng
    const routeCoords = result.features[0].geometry.coordinates.map((coord) => [coord[1], coord[0]])

    // Draw route on map
    routeLayer = L.polyline(routeCoords, {
      color: '#4CAF50',
      weight: 6,
      opacity: 0.7,
    }).addTo(map)

    // Fit map to route bounds
    map.fitBounds(routeLayer.getBounds(), {
      padding: [50, 50],
    })

    // Extract and save route information
    const steps = result.features[0].properties.segments[0].steps
    const distance = result.features[0].properties.segments[0].distance // in meters
    const duration = result.features[0].properties.segments[0].duration // in seconds

    routeInfo.value = {
      distance: (distance / 1000).toFixed(2), // in km
      duration: Math.round(duration / 60), // in minutes
      steps: steps.map((step) => ({
        instruction: step.instruction,
        distance: (step.distance / 1000).toFixed(2),
        duration: Math.round(step.duration / 60),
      })),
    }
  } catch (err) {
    error.value = "Erreur lors du calcul de l'itinéraire"
    console.error(err)
  } finally {
    loading.value = false
  }
}

// Initialisation de la carte
function initializeMap() {
  if (!map && mapElement.value && window.L) {
    map = L.map(mapElement.value).setView([48.856614, 2.3522219], 11)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
  }
}

// Gérer la position actuelle
function useCurrentLocation(forStart = true) {
  if (!navigator.geolocation) {
    error.value = "La géolocalisation n'est pas supportée par votre navigateur"
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords

      if (forStart) {
        if (startMarker) {
          map.removeLayer(startMarker)
        }
        startMarker = L.marker([latitude, longitude], {
          icon: L.divIcon({
            html: '🟢',
            className: 'custom-marker start-marker',
            iconSize: [30, 30],
          }),
        }).addTo(map)
        startInput.value = 'Ma position actuelle'
        map.setView([latitude, longitude], 13)
      } else {
        if (endMarker) {
          map.removeLayer(endMarker)
        }
        endMarker = L.marker([latitude, longitude], {
          icon: L.divIcon({
            html: '🔴',
            className: 'custom-marker end-marker',
            iconSize: [30, 30],
          }),
        }).addTo(map)
        endInput.value = 'Ma position actuelle'
        map.setView([latitude, longitude], 13)
      }
    },
    (err) => {
      error.value = 'Erreur lors de la récupération de votre position'
    },
  )
}

// Initialisation
onMounted(() => {
  // Load Leaflet CSS if not already loaded
  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }

  // Load Leaflet JS if not already loaded
  if (!window.L) {
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = initializeMap
    document.head.appendChild(script)
  } else {
    initializeMap()
  }

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      showStartResults.value = false
      showEndResults.value = false
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('click', () => {})
})
</script>

<template>
  <div class="route-navigator">
    <div class="route-controls">
      <div class="search-section">
        <h2>Rechercher un itinéraire</h2>

        <div class="search-container">
          <div class="input-group">
            <div class="input-with-icon">
              <div class="icon">🟢</div>
              <input
                type="text"
                placeholder="Point de départ"
                v-model="startInput"
                @input="searchStartPlaces"
                @focus="showStartResults = !!startResults.length"
              />
              <button @click="useCurrentLocation(true)" class="location-btn">📍</button>
            </div>
            <div v-show="showStartResults" class="search-results">
              <div
                v-for="place in startResults"
                :key="place.osm_id"
                class="result-item"
                @click="selectStartPlace(place)"
              >
                {{ place.display_name }}
              </div>
              <div v-if="startResults.length === 0" class="no-results">Aucun résultat trouvé</div>
            </div>
          </div>

          <div class="input-group">
            <div class="input-with-icon">
              <div class="icon">🔴</div>
              <input
                type="text"
                placeholder="Destination"
                v-model="endInput"
                @input="searchEndPlaces"
                @focus="showEndResults = !!endResults.length"
              />
              <button @click="useCurrentLocation(false)" class="location-btn">📍</button>
            </div>
            <div v-show="showEndResults" class="search-results">
              <div
                v-for="place in endResults"
                :key="place.osm_id"
                class="result-item"
                @click="selectEndPlace(place)"
              >
                {{ place.display_name }}
              </div>
              <div v-if="endResults.length === 0" class="no-results">Aucun résultat trouvé</div>
            </div>
          </div>
        </div>

        <div class="transport-modes">
          <button
            v-for="mode in transportModes"
            :key="mode.id"
            @click="selectedTransportMode = mode.id"
            :class="{ active: selectedTransportMode === mode.id }"
            class="transport-btn"
          >
            <span class="mode-icon">{{ mode.icon }}</span>
            <span class="mode-name">{{ mode.name }}</span>
          </button>
        </div>

        <button @click="calculateRoute" class="calculate-btn" :disabled="loading">
          {{ loading ? 'Calcul en cours...' : "Calculer l'itinéraire" }}
        </button>

        <div v-if="error" class="error-msg">
          {{ error }}
        </div>
      </div>

      <div v-if="routeInfo" class="route-info">
        <div class="route-summary">
          <h3>Résumé de l'itinéraire</h3>
          <div class="summary-details">
            <div class="summary-item">
              <span class="label">Distance:</span>
              <span class="value">{{ routeInfo.distance }} km</span>
            </div>
            <div class="summary-item">
              <span class="label">Durée estimée:</span>
              <span class="value">{{ routeInfo.duration }} min</span>
            </div>
          </div>
        </div>

        <div class="route-steps">
          <h3>Instructions</h3>
          <div class="steps-list">
            <div v-for="(step, index) in routeInfo.steps" :key="index" class="step-item">
              <div class="step-number">{{ index + 1 }}</div>
              <div class="step-details">
                <div class="step-instruction">{{ step.instruction }}</div>
                <div class="step-distance">{{ step.distance }} km</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="map-container" ref="mapElement"></div>
  </div>
</template>

<style scoped>
.route-navigator {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.route-controls {
  background-color: var(--card-background, #fff);
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-section h2 {
  font-size: 1.2rem;
  margin-bottom: 15px;
  color: var(--text-color, #2c3e50);
  text-align: center;
}

.search-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 15px;
}

.input-group {
  position: relative;
}

.input-with-icon {
  display: flex;
  align-items: center;
  position: relative;
}

.icon {
  position: absolute;
  left: 10px;
  font-size: 1.1rem;
}

input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  font-size: 1rem;
  background-color: var(--card-background, #fff);
  color: var(--text-color, #333);
}

.location-btn {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}

.search-results {
  position: absolute;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--card-background, #fff);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.result-item {
  padding: 10px 15px;
  border-bottom: 1px solid var(--border-color, #ddd);
  cursor: pointer;
}

.result-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.no-results {
  padding: 10px;
  text-align: center;
  color: #999;
}

.transport-modes {
  display: flex;
  justify-content: space-around;
  margin-bottom: 15px;
}

.transport-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background: none;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.transport-btn.active {
  border-color: var(--primary-color, #4caf50);
  background-color: rgba(76, 175, 80, 0.1);
}

.mode-icon {
  font-size: 1.5rem;
}

.mode-name {
  font-size: 0.8rem;
  font-weight: 500;
}

.calculate-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, var(--primary-color, #4caf50), #2e7d32);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.calculate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.calculate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.error-msg {
  margin-top: 10px;
  padding: 10px;
  background-color: var(--error-light, #ffebee);
  color: var(--error, #f44336);
  border-radius: 4px;
  text-align: center;
}

.route-info {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color, #ddd);
}

.route-summary {
  margin-bottom: 15px;
}

.route-summary h3,
.route-steps h3 {
  font-size: 1.1rem;
  margin-bottom: 10px;
  color: var(--text-color, #2c3e50);
}

.summary-details {
  display: flex;
  justify-content: space-between;
}

.summary-item {
  background-color: rgba(0, 0, 0, 0.03);
  padding: 8px 12px;
  border-radius: 6px;
}

.summary-item .label {
  font-weight: 500;
  margin-right: 5px;
}

.steps-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
}

.step-item {
  display: flex;
  padding: 10px;
  border-bottom: 1px solid var(--border-color, #ddd);
}

.step-item:last-child {
  border-bottom: none;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: var(--primary-color, #4caf50);
  color: white;
  border-radius: 50%;
  margin-right: 10px;
  flex-shrink: 0;
}

.step-details {
  flex: 1;
}

.step-instruction {
  margin-bottom: 5px;
}

.step-distance {
  font-size: 0.8rem;
  color: #666;
}

.map-container {
  flex-grow: 1;
  height: 300px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #ddd);
}

/* Custom markers */
:global(.custom-marker) {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: inherit;
  font-size: 20px;
  transform: translateZ(0);
  background: none;
  border: none;
}

@media (min-width: 768px) {
  .route-navigator {
    flex-direction: row;
    gap: 20px;
    height: 500px;
  }

  .route-controls {
    width: 350px;
    overflow-y: auto;
    margin-bottom: 0;
  }

  .map-container {
    flex: 1;
    height: auto;
  }
}

@media (max-width: 767px) {
  .transport-modes {
    overflow-x: auto;
    justify-content: flex-start;
    gap: 10px;
    padding-bottom: 5px;
  }

  .transport-btn {
    flex-shrink: 0;
  }

  .summary-details {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
