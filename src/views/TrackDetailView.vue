<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { getTrackById, calculateTrackStats, exportTrackToGPX } from '../services/trackingService'

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
})

const router = useRouter()
const track = ref(null)
const loading = ref(true)
const mapElement = ref(null)
let map = null
let trackLine = null
let startMarker = null
let endMarker = null

// Récupérer les données du trajet
const loadTrackData = () => {
  loading.value = true
  track.value = getTrackById(props.id)

  if (!track.value) {
    // Trajet non trouvé, rediriger vers la liste
    router.push({ name: 'tracks' })
    return
  }

  loading.value = false
}

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

// Calculer les statistiques du trajet
const stats = computed(() => {
  if (!track.value) {
    return {
      distance: 0,
      duration: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      elevationGain: 0,
      elevationLoss: 0,
    }
  }

  const trackStats = calculateTrackStats(track.value)
  return trackStats
})

// Initialiser la carte
const initializeMap = () => {
  if (!mapElement.value || !window.L || !track.value || track.value.points.length === 0) {
    return
  }

  // Créer la carte
  map = window.L.map(mapElement.value, {
    zoomControl: true,
    attributionControl: true,
  })

  // Ajouter les tuiles OpenStreetMap
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  // Créer le tracé du parcours
  const points = track.value.points.map((point) => [point.latitude, point.longitude])

  // Ajouter le tracé
  trackLine = window.L.polyline(points, {
    color: '#4CAF50',
    weight: 5,
    opacity: 0.7,
    lineJoin: 'round',
  }).addTo(map)

  // Ajouter les marqueurs de début et de fin
  if (points.length > 0) {
    // Marqueur de départ
    startMarker = window.L.marker(points[0], {
      icon: window.L.divIcon({
        html: '<div class="custom-marker start-marker">D</div>',
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(map)

    // Marqueur d'arrivée
    endMarker = window.L.marker(points[points.length - 1], {
      icon: window.L.divIcon({
        html: '<div class="custom-marker end-marker">A</div>',
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    }).addTo(map)
  }

  // Ajuster la vue
  map.fitBounds(trackLine.getBounds(), { padding: [30, 30] })

  // Ajouter des marqueurs pour visualiser l'altitude (si disponible)
  addElevationMarkers()
}

// Ajouter des marqueurs pour visualiser l'altitude
const addElevationMarkers = () => {
  if (!map || !track.value) return

  const points = track.value.points

  // Vérifier si des points ont des données d'altitude
  const hasElevation = points.some((point) => point.altitude !== null)
  if (!hasElevation) return

  // Trouver l'altitude min et max
  let minAlt = Infinity
  let maxAlt = -Infinity

  points.forEach((point) => {
    if (point.altitude !== null) {
      minAlt = Math.min(minAlt, point.altitude)
      maxAlt = Math.max(maxAlt, point.altitude)
    }
  })

  // Ajouter un marqueur tous les X points (pour ne pas surcharger la carte)
  const step = Math.max(1, Math.floor(points.length / 10))

  for (let i = 0; i < points.length; i += step) {
    const point = points[i]
    if (point.altitude === null) continue

    // Normaliser l'altitude pour obtenir une couleur
    const normalizedAlt = (point.altitude - minAlt) / (maxAlt - minAlt)

    // Calculer la couleur (du vert au rouge)
    const r = Math.floor(normalizedAlt * 255)
    const g = Math.floor((1 - normalizedAlt) * 255)
    const b = 0
    const color = `rgb(${r}, ${g}, ${b})`

    // Ajouter un cercle coloré
    window.L.circleMarker([point.latitude, point.longitude], {
      radius: 5,
      color: color,
      fillColor: color,
      fillOpacity: 0.7,
      weight: 1,
    })
      .bindTooltip(`${point.altitude.toFixed(1)}m`)
      .addTo(map)
  }
}

// Revenir à la liste des trajets
const goBack = () => {
  router.push({ name: 'tracks' })
}

// Exporter le trajet en GPX
const exportGPX = () => {
  const gpxContent = exportTrackToGPX(props.id)
  if (!gpxContent) return

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `track_${props.id}.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(() => {
  // Charger les données du trajet
  loadTrackData()

  // Chargement de Leaflet si nécessaire
  if (!window.L) {
    // CSS
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // JavaScript
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      initializeMap()
    }
    document.head.appendChild(script)
  } else {
    // Si Leaflet est déjà chargé
    setTimeout(initializeMap, 100)
  }
})

onBeforeUnmount(() => {
  // Nettoyer les marqueurs et la carte
  if (startMarker) {
    startMarker.remove()
  }
  if (endMarker) {
    endMarker.remove()
  }
  if (map) {
    map.remove()
  }
})
</script>

<template>
  <div class="track-detail-view">
    <div class="header">
      <button @click="goBack" class="back-button">← Retour</button>

      <h2 v-if="track">{{ track.name }}</h2>

      <button @click="exportGPX" class="export-button" title="Exporter en GPX">📥 GPX</button>
    </div>

    <div v-if="loading" class="loading">Chargement du trajet...</div>

    <div v-else-if="!track" class="not-found">Trajet non trouvé</div>

    <div v-else class="track-content">
      <div class="track-meta">
        <div class="meta-date">
          <span class="meta-icon">📅</span>
          <span>{{ formatDate(track.startTime) }}</span>
        </div>

        <div class="meta-points">
          <span class="meta-icon">📌</span>
          <span>{{ track.points.length }} points</span>
        </div>
      </div>

      <!-- Carte du trajet -->
      <div class="map-container" ref="mapElement"></div>

      <!-- Statistiques du trajet -->
      <div class="stats-section">
        <h3>Statistiques du trajet</h3>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📏</div>
            <div class="stat-name">Distance</div>
            <div class="stat-value">{{ (stats.distance / 1000).toFixed(2) }} km</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-name">Durée</div>
            <div class="stat-value">{{ formatDuration(stats.duration) }}</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">⚡</div>
            <div class="stat-name">Vitesse moyenne</div>
            <div class="stat-value">{{ (stats.averageSpeed * 3.6).toFixed(1) }} km/h</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">🚀</div>
            <div class="stat-name">Vitesse max</div>
            <div class="stat-value">{{ (stats.maxSpeed * 3.6).toFixed(1) }} km/h</div>
          </div>

          <div v-if="stats.elevationGain > 0" class="stat-card">
            <div class="stat-icon">⬆️</div>
            <div class="stat-name">Dénivelé positif</div>
            <div class="stat-value">{{ stats.elevationGain.toFixed(0) }} m</div>
          </div>

          <div v-if="stats.elevationLoss > 0" class="stat-card">
            <div class="stat-icon">⬇️</div>
            <div class="stat-name">Dénivelé négatif</div>
            <div class="stat-value">{{ stats.elevationLoss.toFixed(0) }} m</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track-detail-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

h2 {
  margin: 0;
  text-align: center;
  color: var(--text-color);
  flex: 1;
}

.back-button,
.export-button {
  padding: 0.5rem 1rem;
  background-color: var(--card-background);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.back-button:hover,
.export-button:hover {
  background-color: var(--primary-color-light, #e8f5e9);
}

.loading,
.not-found {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary, #666);
  background-color: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.track-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.meta-date,
.meta-points {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary, #666);
  font-size: 0.9rem;
}

.meta-icon {
  font-size: 1.1rem;
}

.map-container {
  width: 100%;
  height: 400px;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #ddd);
}

.stats-section {
  background-color: var(--card-background);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--text-color);
  text-align: center;
  font-size: 1.2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
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

@media (max-width: 600px) {
  .header {
    flex-direction: column;
    gap: 1rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .map-container {
    height: 300px;
  }
}

/* Styles des marqueurs personnalisés */
:global(.custom-marker) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: white;
  font-weight: bold;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
}

:global(.start-marker) {
  background-color: #4caf50;
}

:global(.end-marker) {
  background-color: #f44336;
}
</style>
