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
let markers = []

// Debug: Afficher les points reçus
watch(
  () => props.points,
  (newPoints) => {
    console.log('Points reçus dans TrackMap:', newPoints.length)
    if (newPoints.length > 0) {
      console.log('Premier point:', newPoints[0])
      console.log('Dernier point:', newPoints[newPoints.length - 1])
    }
  },
  { immediate: true },
)

// Initialiser la carte
const initializeMap = () => {
  if (!mapElement.value || !window.L) return

  console.log('Initialisation de la carte Leaflet')

  try {
    // Créer la carte avec des options de débogage
    map = window.L.map(mapElement.value, {
      attributionControl: true,
      zoomControl: true,
    })

    // Ajouter les tuiles OpenStreetMap
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Afficher les points s'il y en a
    updateMapDisplay()

    // Émettre un événement pour indiquer que la carte est chargée
    emit('map-loaded', map)
  } catch (error) {
    console.error("Erreur lors de l'initialisation de la carte:", error)
  }
}

// Nettoyer la carte
const clearMap = () => {
  if (!map) return

  if (trackPolyline) {
    map.removeLayer(trackPolyline)
    trackPolyline = null
  }

  if (positionMarker) {
    map.removeLayer(positionMarker)
    positionMarker = null
  }

  // Supprimer tous les marqueurs existants
  markers.forEach((marker) => {
    if (map.hasLayer(marker)) {
      map.removeLayer(marker)
    }
  })
  markers = []
}

// Ajouter des marqueurs de début et de fin
const addStartEndMarkers = (points) => {
  if (!map || points.length < 2) return

  try {
    // Marqueur de départ
    const startPoint = points[0]
    const startMarker = window.L.marker([startPoint.latitude, startPoint.longitude], {
      icon: window.L.divIcon({
        html: '<div class="start-marker">D</div>',
        className: 'start-marker-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map)
    markers.push(startMarker)

    // Marqueur d'arrivée
    const endPoint = points[points.length - 1]
    const endMarker = window.L.marker([endPoint.latitude, endPoint.longitude], {
      icon: window.L.divIcon({
        html: '<div class="end-marker">A</div>',
        className: 'end-marker-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map)
    markers.push(endMarker)
  } catch (error) {
    console.error("Erreur lors de l'ajout des marqueurs:", error)
  }
}

// Mettre à jour l'affichage de la carte
const updateMapDisplay = () => {
  if (!map) return

  console.log("Mise à jour de l'affichage de la carte")

  try {
    // Nettoyer d'abord la carte
    clearMap()

    if (!props.points || props.points.length === 0) {
      console.log('Pas de points à afficher')
      // Centrer sur une position par défaut si pas de points
      map.setView([48.8566, 2.3522], 13) // Paris par défaut
      return
    }

    console.log(`Affichage de ${props.points.length} points sur la carte`)

    // Convertir les points en format pour Leaflet
    const points = props.points.map((point) => [point.latitude, point.longitude])

    // Créer le tracé
    trackPolyline = window.L.polyline(points, {
      color: '#4CAF50',
      weight: 5,
      opacity: 0.7,
      lineJoin: 'round',
    }).addTo(map)

    // Ajouter des marqueurs pour le début et la fin
    if (props.points.length > 1) {
      addStartEndMarkers(props.points)
    }

    // Ajouter le marqueur de position actuelle si disponible
    if (props.currentPoint) {
      const currentPos = [props.currentPoint.latitude, props.currentPoint.longitude]
      positionMarker = window.L.marker(currentPos, {
        icon: window.L.divIcon({
          html: '<div class="current-position-marker"></div>',
          className: 'current-position-icon',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).addTo(map)
    }

    // Ajuster la vue pour voir tout le tracé
    if (trackPolyline) {
      try {
        map.fitBounds(trackPolyline.getBounds(), { padding: [50, 50] })
      } catch (error) {
        console.error("Erreur lors de l'ajustement de la vue:", error)

        // Fallback: centrer sur le premier point
        if (props.points.length > 0) {
          const firstPoint = props.points[0]
          map.setView([firstPoint.latitude, firstPoint.longitude], 13)
        }
      }
    }

    // Ajouter des marqueurs intermédiaires pour mieux visualiser la progression
    if (props.points.length > 10) {
      // Ajouter des marqueurs tous les ~10% du trajet
      const step = Math.max(1, Math.floor(props.points.length / 10))
      for (let i = 1; i < props.points.length - 1; i += step) {
        if (i !== 0 && i !== props.points.length - 1) {
          const point = props.points[i]
          const marker = window.L.marker([point.latitude, point.longitude], {
            icon: window.L.divIcon({
              html: `<div class="intermediate-marker">${Math.round((i / props.points.length) * 100)}%</div>`,
              className: 'intermediate-marker-icon',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          }).addTo(map)
          markers.push(marker)
        }
      }
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'affichage:", error)
  }
}

// Charger dynamiquement les bibliothèques nécessaires
const loadDependencies = () => {
  // Ne charger Leaflet que s'il n'est pas déjà chargé
  if (!window.L) {
    console.log('Chargement de Leaflet')

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
      console.log('Leaflet chargé avec succès')
      initializeMap()
    }
    script.onerror = (error) => {
      console.error('Erreur lors du chargement de Leaflet:', error)
    }
    document.head.appendChild(script)
  } else {
    console.log('Leaflet déjà chargé')
    initializeMap()
  }
}

// Surveiller les changements de points
watch(
  () => props.points,
  (newPoints) => {
    console.log('Points mis à jour dans TrackMap, nouveau nombre:', newPoints.length)
    if (map) {
      updateMapDisplay()
    }
  },
  { deep: true },
)

// Surveiller le point actuel
watch(
  () => props.currentPoint,
  (newPoint) => {
    if (map && newPoint) {
      const currentPos = [newPoint.latitude, newPoint.longitude]

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
  console.log('TrackMap monté, points:', props.points.length)
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

:global(.start-marker),
:global(.end-marker) {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 12px;
  color: white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

:global(.start-marker) {
  background-color: #4caf50;
}

:global(.end-marker) {
  background-color: #f44336;
}

:global(.start-marker-icon),
:global(.end-marker-icon) {
  background: none !important;
}

:global(.intermediate-marker) {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 10px;
  color: white;
  background-color: #ff9800;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
}

:global(.intermediate-marker-icon) {
  background: none !important;
}
</style>
