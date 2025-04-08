<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  track: {
    type: Object,
    required: true,
  },
})

const selectedView = ref('summary')
const selectedPointIndex = ref(0)
const searchQuery = ref('')

// Vues disponibles
const views = [
  { id: 'summary', name: 'Résumé' },
  { id: 'points', name: 'Points' },
  { id: 'speedData', name: 'Données de vitesse' },
  { id: 'json', name: 'JSON brut' },
]

// Points filtrés selon la recherche
const filteredPoints = computed(() => {
  if (!searchQuery.value) return props.track.points

  const query = searchQuery.value.toLowerCase()
  return props.track.points.filter((point, index) => {
    const pointStr = JSON.stringify(point).toLowerCase()
    return pointStr.includes(query) || index.toString().includes(query)
  })
})

// Données formatées pour affichage
const formattedJSON = computed(() => {
  return JSON.stringify(props.track, null, 2)
})

// Statistiques des points
const pointsStats = computed(() => {
  if (!props.track || !props.track.points) return null

  const totalPoints = props.track.points.length
  const pointsWithSpeed = props.track.points.filter(
    (p) => p.speed !== null && p.speed !== undefined,
  ).length
  const pointsWithAltitude = props.track.points.filter(
    (p) => p.altitude !== null && p.altitude !== undefined,
  ).length
  const pointsWithTimestamp = props.track.points.filter((p) => p.timestamp).length

  // Analyse des valeurs minimales et maximales
  let minLat = Infinity,
    maxLat = -Infinity
  let minLng = Infinity,
    maxLng = -Infinity
  let minAlt = Infinity,
    maxAlt = -Infinity
  let minSpeed = Infinity,
    maxSpeed = -Infinity

  props.track.points.forEach((point) => {
    if (point.latitude !== undefined) {
      minLat = Math.min(minLat, point.latitude)
      maxLat = Math.max(maxLat, point.latitude)
    }

    if (point.longitude !== undefined) {
      minLng = Math.min(minLng, point.longitude)
      maxLng = Math.max(maxLng, point.longitude)
    }

    if (point.altitude !== undefined && point.altitude !== null) {
      minAlt = Math.min(minAlt, point.altitude)
      maxAlt = Math.max(maxAlt, point.altitude)
    }

    if (point.speed !== undefined && point.speed !== null) {
      minSpeed = Math.min(minSpeed, point.speed)
      maxSpeed = Math.max(maxSpeed, point.speed)
    }
  })

  // Vérifier si des timestamps sont dupliqués
  const timestamps = props.track.points.map((p) => p.timestamp)
  const uniqueTimestamps = new Set(timestamps)
  const duplicatedTimestamps = timestamps.length - uniqueTimestamps.size

  return {
    totalPoints,
    pointsWithSpeed,
    pointsWithAltitude,
    pointsWithTimestamp,
    duplicatedTimestamps,
    bounds: {
      latitude: {
        min: minLat === Infinity ? 'N/A' : minLat.toFixed(6),
        max: maxLat === -Infinity ? 'N/A' : maxLat.toFixed(6),
      },
      longitude: {
        min: minLng === Infinity ? 'N/A' : minLng.toFixed(6),
        max: maxLng === -Infinity ? 'N/A' : maxLng.toFixed(6),
      },
      altitude: {
        min: minAlt === Infinity ? 'N/A' : minAlt.toFixed(1),
        max: maxAlt === -Infinity ? 'N/A' : maxAlt.toFixed(1),
      },
      speed: {
        min: minSpeed === Infinity ? 'N/A' : (minSpeed * 3.6).toFixed(1),
        max: maxSpeed === -Infinity ? 'N/A' : (maxSpeed * 3.6).toFixed(1),
      },
    },
  }
})

// Statistiques des speedData
const speedDataStats = computed(() => {
  if (!props.track || !props.track.speedData) return null

  const { history, timeLabels, maxSpeed, averageSpeed } = props.track.speedData

  return {
    historyLength: history?.length || 0,
    timeLabelsLength: timeLabels?.length || 0,
    maxSpeed: maxSpeed || 'N/A',
    averageSpeed: averageSpeed || 'N/A',
    minSpeedValue: history && history.length > 0 ? Math.min(...history).toFixed(1) : 'N/A',
    maxSpeedValue: history && history.length > 0 ? Math.max(...history).toFixed(1) : 'N/A',
  }
})

// Sélectionner un point par son index
const selectPoint = (index) => {
  if (index >= 0 && index < props.track.points.length) {
    selectedPointIndex.value = index
  }
}

// Naviguer aux points précédent/suivant
const previousPoint = () => {
  if (selectedPointIndex.value > 0) {
    selectedPointIndex.value--
  }
}

const nextPoint = () => {
  if (selectedPointIndex.value < props.track.points.length - 1) {
    selectedPointIndex.value++
  }
}

// Télécharger les données brutes en JSON
const downloadJSON = () => {
  const dataStr = JSON.stringify(props.track, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.track.id}_raw_data.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Calculer la distance entre deux points consécutifs
const calculatePointDistance = (index) => {
  if (index === 0 || index >= props.track.points.length) return null

  const prev = props.track.points[index - 1]
  const current = props.track.points[index]

  if (!prev || !current) return null

  // Formule de Haversine pour calculer la distance
  const R = 6371e3 // Rayon de la Terre en mètres
  const φ1 = (prev.latitude * Math.PI) / 180
  const φ2 = (current.latitude * Math.PI) / 180
  const Δφ = ((current.latitude - prev.latitude) * Math.PI) / 180
  const Δλ = ((current.longitude - prev.longitude) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance en mètres
}

// Calculer le temps écoulé entre deux points consécutifs
const calculateTimeDifference = (index) => {
  if (index === 0 || index >= props.track.points.length) return null

  const prev = props.track.points[index - 1]
  const current = props.track.points[index]

  if (!prev || !current || !prev.timestamp || !current.timestamp) return null

  const prevTime = new Date(prev.timestamp).getTime()
  const currTime = new Date(current.timestamp).getTime()

  return (currTime - prevTime) / 1000 // en secondes
}

// Formater le timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A'

  try {
    const date = new Date(timestamp)
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  // eslint-disable-next-line no-unused-vars
  } catch (e) {
    return timestamp
  }
}

onMounted(() => {
  console.log('Débogeur de données initialisé', props.track.id)
})
</script>

<template>
  <div class="track-data-debugger">
    <div class="debugger-header">
      <h3>Débogage des données</h3>
      <div class="view-selector">
        <button
          v-for="view in views"
          :key="view.id"
          class="view-button"
          :class="{ active: selectedView === view.id }"
          @click="selectedView = view.id"
        >
          {{ view.name }}
        </button>
      </div>

      <button @click="downloadJSON" class="download-button">Télécharger JSON</button>
    </div>

    <!-- Vue Résumé -->
    <div v-if="selectedView === 'summary'" class="debugger-content">
      <div class="summary-section">
        <h4>Structure du trajet</h4>
        <div class="data-grid">
          <div class="data-row">
            <div class="data-label">ID:</div>
            <div class="data-value">{{ track.id }}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Nombre de points:</div>
            <div class="data-value">{{ track.points.length }}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Distance:</div>
            <div class="data-value">{{ (track.distance / 1000).toFixed(2) }} km</div>
          </div>
          <div class="data-row">
            <div class="data-label">Durée:</div>
            <div class="data-value">{{ track.duration }} secondes</div>
          </div>
          <div class="data-row">
            <div class="data-label">Horodatage début:</div>
            <div class="data-value">{{ formatTimestamp(track.startTime) }}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Horodatage fin:</div>
            <div class="data-value">{{ formatTimestamp(track.endTime) }}</div>
          </div>
          <div class="data-row">
            <div class="data-label">SpeedData présent:</div>
            <div class="data-value">{{ track.speedData ? 'Oui' : 'Non' }}</div>
          </div>
        </div>
      </div>

      <div class="summary-section" v-if="pointsStats">
        <h4>Statistiques des points</h4>
        <div class="data-grid">
          <div class="data-row">
            <div class="data-label">Points avec vitesse:</div>
            <div class="data-value">
              {{ pointsStats.pointsWithSpeed }} / {{ pointsStats.totalPoints }} ({{
                Math.round((pointsStats.pointsWithSpeed / pointsStats.totalPoints) * 100)
              }}%)
            </div>
          </div>
          <div class="data-row">
            <div class="data-label">Points avec altitude:</div>
            <div class="data-value">
              {{ pointsStats.pointsWithAltitude }} / {{ pointsStats.totalPoints }} ({{
                Math.round((pointsStats.pointsWithAltitude / pointsStats.totalPoints) * 100)
              }}%)
            </div>
          </div>
          <div class="data-row">
            <div class="data-label">Points avec timestamp:</div>
            <div class="data-value">
              {{ pointsStats.pointsWithTimestamp }} / {{ pointsStats.totalPoints }} ({{
                Math.round((pointsStats.pointsWithTimestamp / pointsStats.totalPoints) * 100)
              }}%)
            </div>
          </div>
          <div class="data-row">
            <div class="data-label">Timestamps dupliqués:</div>
            <div class="data-value">{{ pointsStats.duplicatedTimestamps }}</div>
          </div>
        </div>

        <h5>Plages de valeurs</h5>
        <div class="data-grid">
          <div class="data-row">
            <div class="data-label">Latitude:</div>
            <div class="data-value">
              {{ pointsStats.bounds.latitude.min }} - {{ pointsStats.bounds.latitude.max }}
            </div>
          </div>
          <div class="data-row">
            <div class="data-label">Longitude:</div>
            <div class="data-value">
              {{ pointsStats.bounds.longitude.min }} - {{ pointsStats.bounds.longitude.max }}
            </div>
          </div>
          <div class="data-row">
            <div class="data-label">Altitude:</div>
            <div class="data-value">
              {{ pointsStats.bounds.altitude.min }} - {{ pointsStats.bounds.altitude.max }} m
            </div>
          </div>
          <div class="data-row">
            <div class="data-label">Vitesse:</div>
            <div class="data-value">
              {{ pointsStats.bounds.speed.min }} - {{ pointsStats.bounds.speed.max }} km/h
            </div>
          </div>
        </div>
      </div>

      <div class="summary-section" v-if="speedDataStats">
        <h4>Statistiques des données de vitesse</h4>
        <div class="data-grid">
          <div class="data-row">
            <div class="data-label">Points d'historique:</div>
            <div class="data-value">{{ speedDataStats.historyLength }}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Étiquettes de temps:</div>
            <div class="data-value">{{ speedDataStats.timeLabelsLength }}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Vitesse maximale:</div>
            <div class="data-value">{{ speedDataStats.maxSpeed }} km/h</div>
          </div>
          <div class="data-row">
            <div class="data-label">Vitesse moyenne:</div>
            <div class="data-value">{{ speedDataStats.averageSpeed }} km/h</div>
          </div>
          <div class="data-row">
            <div class="data-label">Plage de vitesse:</div>
            <div class="data-value">
              {{ speedDataStats.minSpeedValue }} - {{ speedDataStats.maxSpeedValue }} km/h
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Vue Points -->
    <div v-else-if="selectedView === 'points'" class="debugger-content">
      <div class="points-controls">
        <div class="search-bar">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Rechercher dans les points..."
            class="search-input"
          />
        </div>

        <div class="navigation-controls">
          <button @click="previousPoint" :disabled="selectedPointIndex === 0">
            &lt; Précédent
          </button>
          <span class="point-counter">
            Point {{ selectedPointIndex + 1 }} / {{ filteredPoints.length }}
          </span>
          <button @click="nextPoint" :disabled="selectedPointIndex >= filteredPoints.length - 1">
            Suivant &gt;
          </button>
        </div>
      </div>

      <div class="points-display">
        <div class="points-list">
          <div
            v-for="(point, index) in filteredPoints.slice(0, 200)"
            :key="index"
            class="point-item"
            :class="{ selected: index === selectedPointIndex }"
            @click="selectPoint(index)"
          >
            <div class="point-index">{{ index }}</div>
            <div class="point-preview">
              {{ point.latitude?.toFixed(4) }}, {{ point.longitude?.toFixed(4) }}
            </div>
          </div>
          <div v-if="filteredPoints.length > 200" class="point-limit-notice">
            Affichage limité aux 200 premiers points sur {{ filteredPoints.length }}
          </div>
        </div>

        <div class="point-details" v-if="filteredPoints[selectedPointIndex]">
          <h4>Détails du point {{ selectedPointIndex }}</h4>

          <div class="data-grid">
            <div class="data-row">
              <div class="data-label">Latitude:</div>
              <div class="data-value">
                {{ filteredPoints[selectedPointIndex].latitude }}
              </div>
            </div>
            <div class="data-row">
              <div class="data-label">Longitude:</div>
              <div class="data-value">
                {{ filteredPoints[selectedPointIndex].longitude }}
              </div>
            </div>
            <div class="data-row">
              <div class="data-label">Altitude:</div>
              <div class="data-value">
                {{
                  filteredPoints[selectedPointIndex].altitude !== null
                    ? filteredPoints[selectedPointIndex].altitude + ' m'
                    : 'Non disponible'
                }}
              </div>
            </div>
            <div class="data-row">
              <div class="data-label">Vitesse:</div>
              <div class="data-value">
                {{
                  filteredPoints[selectedPointIndex].speed !== null
                    ? (filteredPoints[selectedPointIndex].speed * 3.6).toFixed(2) + ' km/h'
                    : 'Non disponible'
                }}
              </div>
            </div>
            <div class="data-row">
              <div class="data-label">Précision:</div>
              <div class="data-value">
                {{
                  filteredPoints[selectedPointIndex].accuracy !== null
                    ? filteredPoints[selectedPointIndex].accuracy + ' m'
                    : 'Non disponible'
                }}
              </div>
            </div>
            <div class="data-row">
              <div class="data-label">Horodatage:</div>
              <div class="data-value">
                {{ formatTimestamp(filteredPoints[selectedPointIndex].timestamp) }}
              </div>
            </div>
            <div class="data-row" v-if="selectedPointIndex > 0">
              <div class="data-label">Distance du point précédent:</div>
              <div class="data-value">
                {{ calculatePointDistance(selectedPointIndex)?.toFixed(2) }} m
              </div>
            </div>
            <div class="data-row" v-if="selectedPointIndex > 0">
              <div class="data-label">Temps depuis point précédent:</div>
              <div class="data-value">
                {{ calculateTimeDifference(selectedPointIndex)?.toFixed(1) }} s
              </div>
            </div>
          </div>

          <div class="point-raw-data">
            <h5>Données brutes</h5>
            <pre>{{ JSON.stringify(filteredPoints[selectedPointIndex], null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Vue SpeedData -->
    <div v-else-if="selectedView === 'speedData'" class="debugger-content">
      <div v-if="track.speedData" class="speed-data-container">
        <div class="speed-data-summary">
          <h4>Aperçu des données de vitesse</h4>
          <div class="data-grid">
            <div class="data-row">
              <div class="data-label">Nombre de points:</div>
              <div class="data-value">{{ track.speedData.history?.length || 0 }}</div>
            </div>
            <div class="data-row">
              <div class="data-label">Vitesse moyenne:</div>
              <div class="data-value">{{ track.speedData.averageSpeed }} km/h</div>
            </div>
            <div class="data-row">
              <div class="data-label">Vitesse maximale:</div>
              <div class="data-value">{{ track.speedData.maxSpeed }} km/h</div>
            </div>
          </div>
        </div>

        <div class="speed-data-list">
          <h4>Données d'historique</h4>
          <div class="speed-data-table-container">
            <table class="speed-data-table">
              <thead>
                <tr>
                  <th>Index</th>
                  <th>Heure</th>
                  <th>Vitesse (km/h)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(speed, index) in track.speedData.history.slice(0, 100)" :key="index">
                  <td>{{ index }}</td>
                  <td>{{ track.speedData.timeLabels[index] || 'N/A' }}</td>
                  <td>{{ speed.toFixed(1) }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="track.speedData.history.length > 100" class="data-limit-notice">
              Affichage limité aux 100 premiers points sur {{ track.speedData.history.length }}
            </div>
          </div>
        </div>
      </div>
      <div v-else class="no-speed-data">
        <p>Aucune donnée de vitesse (speedData) n'est disponible pour ce trajet.</p>
      </div>
    </div>

    <!-- Vue JSON brut -->
    <div v-else-if="selectedView === 'json'" class="debugger-content">
      <div class="json-container">
        <pre>{{ formattedJSON }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track-data-debugger {
  width: 100%;
}

.debugger-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

h3,
h4,
h5 {
  margin: 0;
  color: var(--text-color);
}

h3 {
  font-size: 1.2rem;
}

h4 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

h5 {
  font-size: 0.95rem;
  margin: 1rem 0 0.5rem 0;
}

.view-selector {
  display: flex;
  gap: 0.25rem;
}

.view-button {
  background-color: var(--card-background);
  color: var(--text-color);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.view-button.active {
  background-color: var(--primary-color, #4caf50);
  color: white;
  border-color: var(--primary-color, #4caf50);
}

.download-button {
  background-color: var(--secondary-color-light, #e3f2fd);
  color: var(--secondary-color, #2196f3);
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.debugger-content {
  background-color: var(--card-background);
  border-radius: 6px;
  border: 1px solid var(--border-color, #ddd);
  overflow: hidden;
}

.summary-section {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color, #ddd);
}

.summary-section:last-child {
  border-bottom: none;
}

.data-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
}

.data-row {
  display: flex;
  gap: 0.5rem;
}

.data-label {
  font-weight: 500;
  min-width: 180px;
  color: var(--text-secondary, #666);
}

.data-value {
  flex: 1;
}

.points-controls {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color, #ddd);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.search-bar {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
}

.navigation-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.navigation-controls button {
  background-color: var(--secondary-color-light, #e3f2fd);
  color: var(--secondary-color, #2196f3);
  border: none;
  border-radius: 4px;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
}

.navigation-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.point-counter {
  font-size: 0.9rem;
  color: var(--text-secondary, #666);
}

.points-display {
  display: flex;
  min-height: 400px;
}

.points-list {
  width: 200px;
  border-right: 1px solid var(--border-color, #ddd);
  overflow-y: auto;
  max-height: 600px;
}

.point-item {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border-color, #eee);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.point-item:hover {
  background-color: var(--secondary-color-light, #e3f2fd);
}

.point-item.selected {
  background-color: var(--primary-color-light, #e8f5e9);
}

.point-index {
  background-color: var(--text-secondary, #666);
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.point-details {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  max-height: 600px;
}

.point-raw-data {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow-x: auto;
}

pre {
  margin: 0;
  font-family: monospace;
  font-size: 0.9rem;
  white-space: pre-wrap;
}

.point-limit-notice,
.data-limit-notice {
  padding: 0.75rem;
  text-align: center;
  color: var(--warning, #ff9800);
  font-size: 0.85rem;
  background-color: var(--warning-light, #fff8e1);
}

.speed-data-container {
  padding: 1rem;
}

.speed-data-table-container {
  overflow-x: auto;
}

.speed-data-table {
  width: 100%;
  border-collapse: collapse;
}

.speed-data-table th,
.speed-data-table td {
  padding: 0.5rem;
  border: 1px solid var(--border-color, #ddd);
  text-align: left;
}

.speed-data-table th {
  background-color: var(--primary-color-light, #e8f5e9);
  font-weight: 600;
}

.no-speed-data {
  padding: 2rem;
  text-align: center;
  color: var(--warning, #ff9800);
}

.json-container {
  padding: 1rem;
  overflow-x: auto;
  max-height: 600px;
}

@media (max-width: 768px) {
  .points-display {
    flex-direction: column;
  }

  .points-list {
    width: 100%;
    max-height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--border-color, #ddd);
  }

  .data-grid {
    grid-template-columns: 1fr;
  }

  .data-row {
    flex-direction: column;
    gap: 0.25rem;
  }

  .data-label {
    min-width: auto;
  }
}
</style>
