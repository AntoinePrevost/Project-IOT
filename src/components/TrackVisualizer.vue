<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { formatDuration } from '../utils/formatters'

const props = defineProps({
  track: {
    type: Object,
    required: true,
  },
  autoPlay: {
    type: Boolean,
    default: false,
  },
})

// Références DOM
const mapElement = ref(null)
const speedChartElement = ref(null)
const progressSlider = ref(null)

// Variables d'état
const currentPointIndex = ref(0)
const playbackActive = ref(false)
const playbackSpeed = ref(1)
const elapsedTime = ref('00:00:00')
const currentSpeed = ref(0)
const speedData = ref([])
const maxSpeed = ref(0)

// Dimensions du graphique de vitesse
const chartWidth = 720
const chartHeight = 200
const chartPadding = { top: 20, right: 30, bottom: 30, left: 50 }

// Variables Leaflet et SVG
let map = null
let trackPolyline = null
let positionMarker = null
let playbackTimer = null
let speedChart = null
let speedPath = null
let cursorPoint = null

// Calculer la durée totale du trajet en ms
const totalDuration = computed(() => {
  if (!props.track || !props.track.points || props.track.points.length < 2) return 0

  const firstPoint = props.track.points[0]
  const lastPoint = props.track.points[props.track.points.length - 1]

  return new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp)
})

// Preprocessing des données du trajet
const processTrackData = () => {
  if (!props.track || !props.track.points || props.track.points.length === 0) return

  const startTime = new Date(props.track.points[0].timestamp).getTime()

  speedData.value = props.track.points.map((point, index) => {
    const time = new Date(point.timestamp).getTime() - startTime
    const speed =
      point.speed !== undefined && point.speed !== null
        ? point.speed * 3.6 // m/s -> km/h
        : calculateSpeed(index)

    // Mettre à jour la vitesse maximale
    if (speed > maxSpeed.value) {
      maxSpeed.value = speed
    }

    return { time, speed }
  })

  // Mettre à jour l'affichage initial
  syncDisplayWithCurrentPoint()
}

// Calculer la vitesse si elle n'est pas disponible dans les données
const calculateSpeed = (index) => {
  if (index === 0 || index >= props.track.points.length - 1) return 0

  const prevPoint = props.track.points[index - 1]
  const currentPoint = props.track.points[index]

  const distance = calculateDistance(
    prevPoint.latitude,
    prevPoint.longitude,
    currentPoint.latitude,
    currentPoint.longitude,
  )

  const timeSeconds = (new Date(currentPoint.timestamp) - new Date(prevPoint.timestamp)) / 1000

  if (timeSeconds <= 0) return 0

  // Vitesse en km/h
  return distance / 1000 / (timeSeconds / 3600)
}

// Calculer la distance entre deux points en mètres
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3 // Rayon de la Terre en mètres
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance en mètres
}

// Initialiser la carte
const initializeMap = () => {
  if (!mapElement.value || !window.L) return

  map = window.L.map(mapElement.value)

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  // Afficher le tracé sur la carte
  if (props.track && props.track.points && props.track.points.length > 0) {
    const points = props.track.points.map((point) => [point.latitude, point.longitude])

    trackPolyline = window.L.polyline(points, {
      color: '#4CAF50',
      weight: 5,
      opacity: 0.7,
      lineJoin: 'round',
    }).addTo(map)

    // Ajouter le marqueur de position
    const initialPos = [props.track.points[0].latitude, props.track.points[0].longitude]
    positionMarker = window.L.marker(initialPos, {
      icon: window.L.divIcon({
        html: '<div class="current-position-marker"></div>',
        className: 'current-position-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    }).addTo(map)

    // Ajuster le zoom pour voir tout le tracé
    map.fitBounds(trackPolyline.getBounds(), { padding: [50, 50] })
  }
}

// Initialiser le graphique de vitesse avec SVG
const initializeSpeedChart = () => {
  if (!speedChartElement.value || speedData.value.length === 0) return

  // Obtenir le conteneur
  const container = speedChartElement.value

  // Nettoyer tout SVG existant
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }

  // Créer le SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', chartWidth)
  svg.setAttribute('height', chartHeight)
  svg.setAttribute('viewBox', `0 0 ${chartWidth} ${chartHeight}`)
  svg.setAttribute('class', 'speed-chart-svg')
  container.appendChild(svg)

  // Calculer l'échelle de temps (axe X)
  const maxTime = Math.max(...speedData.value.map((d) => d.time))
  const xScale = (time) => {
    return (
      chartPadding.left + (time / maxTime) * (chartWidth - chartPadding.left - chartPadding.right)
    )
  }

  // Calculer l'échelle de vitesse (axe Y)
  const roundedMaxSpeed = Math.ceil(maxSpeed.value / 5) * 5 // Arrondir à un multiple de 5 supérieur
  const minSpeed = 0
  const yScale = (speed) => {
    return (
      chartHeight -
      chartPadding.bottom -
      ((speed - minSpeed) / (roundedMaxSpeed - minSpeed)) *
        (chartHeight - chartPadding.top - chartPadding.bottom)
    )
  }

  // Dessiner les axes
  const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  xAxis.setAttribute(
    'd',
    `M${chartPadding.left},${chartHeight - chartPadding.bottom} H${chartWidth - chartPadding.right}`,
  )
  xAxis.setAttribute('stroke', '#333')
  xAxis.setAttribute('stroke-width', '1')
  svg.appendChild(xAxis)

  const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  yAxis.setAttribute(
    'd',
    `M${chartPadding.left},${chartPadding.top} V${chartHeight - chartPadding.bottom}`,
  )
  yAxis.setAttribute('stroke', '#333')
  yAxis.setAttribute('stroke-width', '1')
  svg.appendChild(yAxis)

  // Ajouter graduations et libellés de l'axe Y (vitesse)
  const speedStep = roundedMaxSpeed > 15 ? 5 : 2
  for (let speed = 0; speed <= roundedMaxSpeed; speed += speedStep) {
    const y = yScale(speed)

    // Ligne horizontale
    const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    tickLine.setAttribute('d', `M${chartPadding.left - 5},${y} H${chartPadding.left}`)
    tickLine.setAttribute('stroke', '#333')
    tickLine.setAttribute('stroke-width', '1')
    svg.appendChild(tickLine)

    // Ligne de grille
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    gridLine.setAttribute('d', `M${chartPadding.left},${y} H${chartWidth - chartPadding.right}`)
    gridLine.setAttribute('stroke', '#ddd')
    gridLine.setAttribute('stroke-width', '1')
    gridLine.setAttribute('stroke-dasharray', '3,3')
    svg.appendChild(gridLine)

    // Libellé
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    label.setAttribute('x', chartPadding.left - 10)
    label.setAttribute('y', y + 4) // ajustement pour alignement vertical
    label.setAttribute('text-anchor', 'end')
    label.setAttribute('font-size', '10')
    label.setAttribute('fill', '#333')
    label.textContent = `${speed}`
    svg.appendChild(label)
  }

  // Ajouter le titre de l'axe Y
  const yAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  yAxisLabel.setAttribute('x', 15)
  yAxisLabel.setAttribute('y', chartHeight / 2)
  yAxisLabel.setAttribute('fill', '#333')
  yAxisLabel.setAttribute('font-size', '12')
  yAxisLabel.setAttribute('transform', `rotate(-90, 15, ${chartHeight / 2})`)
  yAxisLabel.setAttribute('text-anchor', 'middle')
  yAxisLabel.textContent = 'Vitesse (km/h)'
  svg.appendChild(yAxisLabel)

  // Ajouter graduations et libellés de l'axe X (temps)
  const timeStep = Math.max(Math.floor(maxTime / 1000 / 60 / 5), 1) * 60 * 1000 // Pas de 5 minutes ou plus
  const maxTimeMinutes = maxTime / 1000 / 60
  for (let minutes = 0; minutes <= maxTimeMinutes; minutes += timeStep / 60 / 1000) {
    const time = minutes * 60 * 1000
    if (time > maxTime) break

    const x = xScale(time)

    // Ligne verticale
    const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    tickLine.setAttribute(
      'd',
      `M${x},${chartHeight - chartPadding.bottom} V${chartHeight - chartPadding.bottom + 5}`,
    )
    tickLine.setAttribute('stroke', '#333')
    tickLine.setAttribute('stroke-width', '1')
    svg.appendChild(tickLine)

    // Ligne de grille
    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    gridLine.setAttribute('d', `M${x},${chartPadding.top} V${chartHeight - chartPadding.bottom}`)
    gridLine.setAttribute('stroke', '#ddd')
    gridLine.setAttribute('stroke-width', '1')
    gridLine.setAttribute('stroke-dasharray', '3,3')
    svg.appendChild(gridLine)

    // Libellé
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    label.setAttribute('x', x)
    label.setAttribute('y', chartHeight - chartPadding.bottom + 15)
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('font-size', '10')
    label.setAttribute('fill', '#333')
    label.textContent = `${Math.floor(minutes)}min`
    svg.appendChild(label)
  }

  // Ajouter le titre de l'axe X
  const xAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  xAxisLabel.setAttribute('x', chartWidth / 2)
  xAxisLabel.setAttribute('y', chartHeight - 5)
  xAxisLabel.setAttribute('fill', '#333')
  xAxisLabel.setAttribute('font-size', '12')
  xAxisLabel.setAttribute('text-anchor', 'middle')
  xAxisLabel.textContent = 'Temps écoulé'
  svg.appendChild(xAxisLabel)

  // Créer la ligne de vitesse
  let pathData = ''
  speedData.value.forEach((point, index) => {
    const x = xScale(point.time)
    const y = yScale(point.speed)

    if (index === 0) {
      pathData = `M${x},${y}`
    } else {
      pathData += ` L${x},${y}`
    }
  })

  // Dessiner la ligne de vitesse
  speedPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  speedPath.setAttribute('d', pathData)
  speedPath.setAttribute('stroke', '#4CAF50')
  speedPath.setAttribute('stroke-width', '2')
  speedPath.setAttribute('fill', 'none')
  svg.appendChild(speedPath)

  // Créer le point de curseur
  cursorPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  cursorPoint.setAttribute('r', '6')
  cursorPoint.setAttribute('fill', 'red')
  cursorPoint.setAttribute('stroke', 'white')
  cursorPoint.setAttribute('stroke-width', '2')
  svg.appendChild(cursorPoint)

  // Ajouter la ligne verticale du curseur
  const cursorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  cursorLine.setAttribute('stroke', 'red')
  cursorLine.setAttribute('stroke-width', '1')
  cursorLine.setAttribute('stroke-dasharray', '5,3')
  cursorLine.setAttribute('y1', chartPadding.top)
  cursorLine.setAttribute('y2', chartHeight - chartPadding.bottom)
  cursorLine.setAttribute('id', 'cursor-line')
  svg.appendChild(cursorLine)

  // Créer étiquette de vitesse
  const speedLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  speedLabel.setAttribute('fill', 'white')
  speedLabel.setAttribute('stroke', 'none')
  speedLabel.setAttribute('font-size', '10')
  speedLabel.setAttribute('text-anchor', 'middle')
  speedLabel.setAttribute('id', 'speed-label')
  svg.appendChild(speedLabel)

  // Créer fond pour l'étiquette
  const speedLabelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  speedLabelBg.setAttribute('fill', 'rgba(255, 0, 0, 0.8)')
  speedLabelBg.setAttribute('rx', '3')
  speedLabelBg.setAttribute('ry', '3')
  speedLabelBg.setAttribute('id', 'speed-label-bg')
  svg.insertBefore(speedLabelBg, speedLabel)

  // Enregistrer les fonctions d'échelle pour une utilisation ultérieure
  speedChart = {
    svg,
    xScale,
    yScale,
    cursorPoint,
    cursorLine,
    speedLabel,
    speedLabelBg,
  }

  // Positionner le curseur au début
  updateSpeedChartCursor()
}

// Mise à jour de la position du curseur sur le graphique
const updateSpeedChartCursor = () => {
  if (!speedChart || !speedData.value.length || currentPointIndex.value >= speedData.value.length)
    return

  const point = speedData.value[currentPointIndex.value]
  const x = speedChart.xScale(point.time)
  const y = speedChart.yScale(point.speed)

  // Mettre à jour la position du point
  speedChart.cursorPoint.setAttribute('cx', x)
  speedChart.cursorPoint.setAttribute('cy', y)

  // Mettre à jour la ligne verticale
  speedChart.cursorLine.setAttribute('x1', x)
  speedChart.cursorLine.setAttribute('x2', x)

  // Mettre à jour le libellé de vitesse
  speedChart.speedLabel.textContent = `${point.speed.toFixed(1)} km/h`
  speedChart.speedLabel.setAttribute('x', x)

  // Position intelligente du libellé (dessus/dessous selon la position)
  const yPosition = y < 50 ? y + 25 : y - 15
  speedChart.speedLabel.setAttribute('y', yPosition)

  // Ajuster la taille du fond
  const textBox = speedChart.speedLabel.getBBox()
  speedChart.speedLabelBg.setAttribute('x', textBox.x - 3)
  speedChart.speedLabelBg.setAttribute('y', textBox.y - 3)
  speedChart.speedLabelBg.setAttribute('width', textBox.width + 6)
  speedChart.speedLabelBg.setAttribute('height', textBox.height + 6)
}

// Synchroniser l'affichage avec le point actuel
const syncDisplayWithCurrentPoint = () => {
  if (!props.track || !props.track.points || currentPointIndex.value >= props.track.points.length)
    return

  const point = props.track.points[currentPointIndex.value]
  const speedItem = speedData.value[currentPointIndex.value] || { speed: 0 }

  // Mettre à jour les données affichées
  currentSpeed.value = speedItem.speed.toFixed(1)

  // Calculer le temps écoulé depuis le début du trajet
  const startTime = new Date(props.track.points[0].timestamp)
  const currentTime = new Date(point.timestamp)
  const elapsedSeconds = Math.floor((currentTime - startTime) / 1000)
  elapsedTime.value = formatDuration(elapsedSeconds)

  // Mettre à jour la position sur la carte
  if (map && positionMarker) {
    positionMarker.setLatLng([point.latitude, point.longitude])
    map.setView([point.latitude, point.longitude], map.getZoom() || 15)
  }

  // Mettre à jour le slider
  if (progressSlider.value) {
    progressSlider.value.value = speedItem.time
  }

  // Mettre à jour le graphique
  updateSpeedChartCursor()
}

// Gérer le changement du slider
const handleSliderChange = (event) => {
  const time = parseInt(event.target.value)
  if (!props.track || !props.track.points || !props.track.points.length) return

  // Trouver le point le plus proche du temps sélectionné
  let closestPointIndex = 0
  let minTimeDiff = Infinity

  speedData.value.forEach((data, index) => {
    const timeDiff = Math.abs(data.time - time)
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff
      closestPointIndex = index
    }
  })

  // Mettre à jour l'index actuel et synchroniser l'affichage
  currentPointIndex.value = closestPointIndex
  syncDisplayWithCurrentPoint()
}

// Démarrer la lecture du trajet
const startPlayback = () => {
  if (playbackActive.value || !props.track || !props.track.points.length) return

  playbackActive.value = true

  // Fonction pour avancer la lecture
  const advancePlayback = () => {
    if (!playbackActive.value) return

    currentPointIndex.value++

    if (currentPointIndex.value >= props.track.points.length) {
      currentPointIndex.value = props.track.points.length - 1
      playbackActive.value = false
      return
    }

    syncDisplayWithCurrentPoint()

    // Calculer le délai entre ce point et le suivant
    if (currentPointIndex.value < props.track.points.length - 1) {
      const currentPoint = props.track.points[currentPointIndex.value]
      const nextPoint = props.track.points[currentPointIndex.value + 1]

      let delay = new Date(nextPoint.timestamp) - new Date(currentPoint.timestamp)
      delay = Math.max(50, delay / playbackSpeed.value) // Minimum 50ms pour éviter les problèmes d'affichage

      playbackTimer = setTimeout(advancePlayback, delay)
    }
  }

  advancePlayback()
}

// Mettre en pause la lecture
const pausePlayback = () => {
  playbackActive.value = false
  if (playbackTimer) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
}

// Arrêter la lecture et revenir au début
const stopPlayback = () => {
  playbackActive.value = false
  if (playbackTimer) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
  currentPointIndex.value = 0
  syncDisplayWithCurrentPoint()
}

// Chargement dynamique des bibliothèques nécessaires
const loadDependencies = () => {
  // Vérifier uniquement si Leaflet est chargé, car nous n'utilisons plus Chart.js
  let leafletLoaded = false

  const initialize = () => {
    if (leafletLoaded) {
      processTrackData()
      initializeMap()
      initializeSpeedChart()

      if (props.autoPlay) {
        nextTick(() => {
          startPlayback()
        })
      }
    }
  }

  // Charger Leaflet
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
      leafletLoaded = true
      initialize()
    }
    document.head.appendChild(script)
  } else {
    leafletLoaded = true
    initialize()
  }
}

// Redimensionner le graphique SVG quand la fenêtre change de taille
const resizeSpeedChart = () => {
  if (!speedChartElement.value || !speedChart) return

  const containerWidth = speedChartElement.value.clientWidth
  if (containerWidth > 0) {
    const svg = speedChart.svg
    svg.setAttribute('width', containerWidth)
    svg.setAttribute('viewBox', `0 0 ${containerWidth} ${chartHeight}`)

    // Recalculer et mettre à jour les échelles
    // Note: cela nécessiterait de redessiner complètement le graphique
    // Pour cette version simplifiée, nous gardons juste l'échelle d'origine en ajustant la largeur
  }
}

// Cycle de vie du composant
onMounted(() => {
  loadDependencies()

  // Ajouter un listener pour le redimensionnement
  window.addEventListener('resize', resizeSpeedChart)
})

onUnmounted(() => {
  if (playbackTimer) {
    clearTimeout(playbackTimer)
  }

  if (map) {
    map.remove()
    map = null
  }

  // Retirer le listener de redimensionnement
  window.removeEventListener('resize', resizeSpeedChart)
})

// Surveiller les changements d'index de point
watch(currentPointIndex, () => {
  syncDisplayWithCurrentPoint()
})

// Exposer des méthodes pour contrôler le composant depuis l'extérieur
defineExpose({
  startPlayback,
  pausePlayback,
  stopPlayback,
  currentPointIndex,
})
</script>

<template>
  <div class="track-visualizer">
    <!-- Carte pour visualiser le trajet -->
    <div class="map-container" ref="mapElement"></div>

    <!-- Curseur de progression et contrôles -->
    <div class="track-controls">
      <!-- Curseur de progression temporel -->
      <div class="progress-container">
        <input
          ref="progressSlider"
          type="range"
          min="0"
          :max="totalDuration || 100"
          value="0"
          class="progress-slider"
          @input="handleSliderChange"
          :disabled="!track || track.points?.length < 2"
        />
        <div class="progress-info">
          <div class="progress-time">{{ elapsedTime }}</div>
          <div class="current-speed">{{ currentSpeed }} km/h</div>
        </div>
      </div>

      <!-- Contrôles de lecture -->
      <div class="playback-controls" v-if="track && track.points?.length > 1">
        <button @click="startPlayback" :disabled="playbackActive" class="playback-button">
          <span class="icon">▶️</span>
        </button>

        <button @click="pausePlayback" :disabled="!playbackActive" class="playback-button">
          <span class="icon">⏸️</span>
        </button>

        <button @click="stopPlayback" class="playback-button">
          <span class="icon">⏹️</span>
        </button>

        <div class="playback-speed">
          <span>Vitesse:</span>
          <select v-model="playbackSpeed">
            <option :value="0.5">0.5×</option>
            <option :value="1">1×</option>
            <option :value="2">2×</option>
            <option :value="4">4×</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Graphique SVG de vitesse avec géométrie fixe -->
    <div class="chart-container">
      <h3>Évolution de la vitesse</h3>
      <div class="speed-chart-container" ref="speedChartElement"></div>
    </div>
  </div>
</template>

<style scoped>
.track-visualizer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  margin-bottom: 1.5rem;
}

.map-container {
  width: 100%;
  height: 400px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color, #ddd);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.track-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.progress-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background-color: var(--card-background, #fff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.progress-slider {
  width: 100%;
  height: 20px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--primary-color-light, #e8f5e9);
  border-radius: 10px;
  cursor: pointer;
}

.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color, #4caf50);
  cursor: pointer;
}

.progress-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color, #4caf50);
  cursor: pointer;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-time,
.current-speed {
  font-weight: 600;
  font-family: monospace;
  font-size: 1.1rem;
}

.current-speed {
  color: var(--primary-color, #4caf50);
}

.playback-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background-color: var(--card-background, #fff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  justify-content: center;
}

.playback-button {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background-color: var(--primary-color-light, #e8f5e9);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.playback-button:hover:not(:disabled) {
  background-color: var(--primary-color, #4caf50);
}

.playback-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.playback-speed {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.playback-speed select {
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border-color, #ddd);
}

.chart-container {
  width: 100%;
  padding: 1rem;
  background-color: var(--card-background, #fff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.speed-chart-container {
  width: 100%;
  height: 240px;
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1.2rem;
  color: var(--text-color, #333);
}

.current-position-marker {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #2196f3;
  border: 3px solid white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

@media (max-width: 768px) {
  .map-container {
    height: 300px;
  }

  .playback-controls {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .speed-chart-container {
    height: 220px;
  }
}

@media (max-width: 480px) {
  .progress-time,
  .current-speed {
    font-size: 0.9rem;
  }

  .playback-button {
    width: 40px;
    height: 40px;
  }

  .speed-chart-container {
    height: 200px;
  }
}
</style>
