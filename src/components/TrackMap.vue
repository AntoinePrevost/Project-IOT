<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  points: {
    type: Array,
    default: () => [],
  },
  currentPoint: {
    type: Object,
    default: null,
  },
  editable: {
    type: Boolean,
    default: false,
  },
  height: {
    type: String,
    default: '400px',
  },
})

const emit = defineEmits(['map-loaded', 'point-clicked'])

const mapElement = ref(null)
let map = null
let trackPolyline = null
let positionMarker = null

// Initialiser la carte
const initializeMap = () => {
  if (!mapElement.value || !window.L) return

  // Créer la carte
  map = window.L.map(mapElement.value)

  // Ajouter les tuiles OpenStreetMap
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  // Afficher les points s'il y en a
  updateMapDisplay()

  // Émettre un événement pour indiquer que la carte est chargée
  emit('map-loaded', map)
}

// Mettre à jour l'affichage de la carte
const updateMapDisplay = () => {
  if (!map || !props.points || props.points.length === 0) return

  // Convertir les points en format pour Leaflet
  const points = props.points.map((point) => [point.latitude, point.longitude])

  // Créer ou mettre à jour le tracé
  if (trackPolyline) {
    trackPolyline.setLatLngs(points)
  } else {
    trackPolyline = window.L.polyline(points, {
      color: '#4CAF50',
      weight: 5,
      opacity: 0.7,
      lineJoin: 'round',
    }).addTo(map)
  }

  // Ajouter le marqueur de position actuelle si disponible
  if (props.currentPoint) {
    const currentPos = [props.currentPoint.latitude, props.currentPoint.longitude]

    if (positionMarker) {
      positionMarker.setLatLng(currentPos)
    } else {
      positionMarker = window.L.marker(currentPos, {
        icon: window.L.divIcon({
          html: '<div class="current-position-marker"></div>',
          className: 'current-position-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map)
    }
  }

  // Ajuster la vue pour voir tout le tracé
  if (points.length > 0) {
    map.fitBounds(trackPolyline.getBounds(), { padding: [50, 50] })
  }
}

// Charger dynamiquement les bibliothèques nécessaires
const loadDependencies = () => {
  // Ne charger Leaflet que s'il n'est pas déjà chargé
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
    script.onload = initializeMap
    document.head.appendChild(script)
  } else {
    initializeMap()
  }
}

// Surveiller les changements de points
watch(
  () => props.points,
  () => {
    if (map) {
      updateMapDisplay()
    }
  },
  { deep: true },
)

// Surveiller le point actuel
watch(
  () => props.currentPoint,
  () => {
    if (map && props.currentPoint) {
      const currentPos = [props.currentPoint.latitude, props.currentPoint.longitude]

      if (positionMarker) {
        positionMarker.setLatLng(currentPos)
      } else {
        updateMapDisplay()
      }

      // Centrer la carte sur la position actuelle
      map.setView(currentPos, map.getZoom() || 15)
    }
  },
  { deep: true },
)

// Initialisation au montage du composant
onMounted(() => {
  loadDependencies()
})
</script>

<template>
  <div class="track-map">
    <div ref="mapElement" class="map-container" :style="{ height }"></div>
  </div>
</template>

<style scoped>
.track-map {
  width: 100%;
}

.map-container {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #ddd);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

:global(.current-position-marker) {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #2196f3;
  border: 3px solid white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

:global(.current-position-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none !important;
}
</style>
