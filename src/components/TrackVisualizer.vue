<script setup>
import { onMounted, computed } from 'vue'
import TrackMap from './TrackMap.vue'
import SpeedChart from './SpeedChart.vue'
import { calculateTrackStats } from '../services/trackingService'

const props = defineProps({
  track: {
    type: Object,
    required: true,
  },
  mapOnly: {
    type: Boolean,
    default: false,
  },
  chartOnly: {
    type: Boolean,
    default: false,
  },
  height: {
    type: String,
    default: '400px',
  },
})

// Points du tracé pour la carte
const trackPoints = computed(() => {
  if (!props.track || !props.track.points) return []

  // Vérifier que les points ont des coordonnées valides
  const validPoints = props.track.points.filter(
    (p) =>
      typeof p.latitude === 'number' &&
      typeof p.longitude === 'number' &&
      !isNaN(p.latitude) &&
      !isNaN(p.longitude),
  )

  console.log(
    `Points valides pour la carte: ${validPoints.length} sur ${props.track.points.length}`,
  )
  return validPoints
})

// Calculer les statistiques manuellement
const processTrackData = () => {
  // Extraire les données de vitesse directement des points
  const speedData = props.track.points
    .filter((p) => p.speed !== null && p.speed !== undefined)
    .map((p) => p.speed * 3.6) // Convertir en km/h

  console.log('Points avec vitesse:', speedData.length, 'sur', props.track.points.length)

  const times = props.track.points
    .filter((p) => p.speed !== null && p.speed !== undefined)
    .map((p) => {
      const date = new Date(p.timestamp)
      return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    })

  return {
    speedData,
    times,
  }
}

// Statistiques du trajet
const trackStats = computed(() => {
  return calculateTrackStats(props.track)
})

// Pour les grands trajets, échantillonner les données pour le graphique
const sampleDataForChart = (data, labels, maxPoints = 500) => {
  if (!data || data.length <= maxPoints) return { data, labels }

  const step = Math.ceil(data.length / maxPoints)
  const sampledData = []
  const sampledLabels = []

  for (let i = 0; i < data.length; i += step) {
    sampledData.push(data[i])
    if (labels && labels[i]) {
      sampledLabels.push(labels[i])
    }
  }

  console.log(`Échantillonnage des données: ${data.length} → ${sampledData.length} points`)
  return { data: sampledData, labels: sampledLabels }
}

// Données du graphique de vitesse
const speedChartData = computed(() => {
  // Vérifier d'abord les données dans speedData
  const hasStoredSpeedData =
    props.track.speedData &&
    props.track.speedData.history &&
    props.track.speedData.history.length > 0

  if (hasStoredSpeedData) {
    console.log(
      'Utilisation des données de vitesse stockées:',
      props.track.speedData.history.length,
      'points',
    )

    // Échantillonner les données si nécessaire
    const { data: sampledHistory, labels: sampledLabels } = sampleDataForChart(
      props.track.speedData.history,
      props.track.speedData.timeLabels,
    )

    return {
      labels: sampledLabels,
      datasets: [
        {
          label: 'Vitesse (km/h)',
          data: sampledHistory,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Vitesse moyenne (km/h)',
          data: Array(sampledHistory.length).fill(props.track.speedData.averageSpeed),
          borderColor: '#2196F3',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        },
      ],
    }
  }

  // Vérifier les données de vitesse dans trackStats
  const hasCalculatedSpeedData =
    trackStats.value.speedHistory && trackStats.value.speedHistory.length > 0

  if (hasCalculatedSpeedData) {
    console.log(
      'Utilisation des données de vitesse calculées:',
      trackStats.value.speedHistory.length,
      'points',
    )
    return {
      labels: trackStats.value.timeLabels,
      datasets: [
        {
          label: 'Vitesse (km/h)',
          data: trackStats.value.speedHistory,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Vitesse moyenne (km/h)',
          data: Array(trackStats.value.speedHistory.length).fill(trackStats.value.averageSpeed),
          borderColor: '#2196F3',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        },
      ],
    }
  }

  // En dernier recours, extraire directement des points
  const processedData = processTrackData()

  if (processedData.speedData.length === 0) {
    console.log('Aucune donnée de vitesse disponible dans les points')
    return {
      labels: [],
      datasets: [],
    }
  }

  console.log(
    'Utilisation des données de vitesse extraites des points:',
    processedData.speedData.length,
    'points',
  )

  // Calculer la vitesse moyenne
  const avgSpeed =
    processedData.speedData.reduce((a, b) => a + b, 0) / processedData.speedData.length

  return {
    labels: processedData.times,
    datasets: [
      {
        label: 'Vitesse (km/h)',
        data: processedData.speedData,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Vitesse moyenne (km/h)',
        data: Array(processedData.speedData.length).fill(avgSpeed),
        borderColor: '#2196F3',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
      },
    ],
  }
})

// Vérifier si nous avons des données de vitesse à afficher
const hasSpeedData = computed(() => {
  // 1. Les données stockées dans speedData
  if (
    props.track.speedData &&
    props.track.speedData.history &&
    props.track.speedData.history.length > 0
  ) {
    return true
  }

  // 2. Les données calculées par trackStats
  if (trackStats.value.speedHistory && trackStats.value.speedHistory.length > 0) {
    return true
  }

  // 3. Les points qui ont une propriété speed
  return props.track.points.some((p) => p.speed !== null && p.speed !== undefined)
})

// Initialisation au montage du composant
onMounted(() => {
  console.log('Trajet chargé:', props.track.id)
  console.log('speedData disponible:', !!props.track.speedData)
  console.log('Nombre total de points:', props.track.points?.length || 0)

  if (props.track.points && props.track.points.length > 0) {
    console.log('Premier point:', props.track.points[0])
    console.log('Dernier point:', props.track.points[props.track.points.length - 1])
  }

  // Vérifier si les points ont des coordonnées valides
  if (props.track && props.track.points && props.track.points.length > 0) {
    const validPointsCount = props.track.points.filter(
      (p) =>
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        !isNaN(p.latitude) &&
        !isNaN(p.longitude),
    ).length

    console.log(
      `Points avec coordonnées valides: ${validPointsCount} sur ${props.track.points.length}`,
    )
  }
})
</script>

<template>
  <div class="track-visualizer">
    <!-- Carte seulement si demandé -->
    <div v-if="!chartOnly" class="map-container">
      <h3 v-if="!mapOnly">Parcours</h3>
      <TrackMap
        :points="trackPoints"
        :height="height"
        @map-loaded="() => console.log('Carte chargée')"
      />
      <div v-if="trackPoints.length === 0" class="no-points-message">
        Aucun point de localisation valide disponible pour ce trajet.
      </div>
    </div>

    <!-- Graphique seulement si demandé ou les deux -->
    <template v-if="!mapOnly">
      <!-- Graphique de vitesse si disponible -->
      <div v-if="hasSpeedData" class="chart-container">
        <h3 v-if="!chartOnly">Analyse de la vitesse</h3>
        <SpeedChart :chartData="speedChartData" :height="chartOnly ? height : 300" />
      </div>

      <div v-else class="chart-placeholder">
        <p>
          <span class="info-icon">ℹ️</span>
          Aucune donnée de vitesse disponible pour ce trajet
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.track-visualizer {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  margin-bottom: 2rem;
}

.map-container,
.chart-container {
  background-color: var(--card-background);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.2rem;
  color: var(--text-color);
}

.chart-placeholder {
  background-color: var(--info-light, #e3f2fd);
  color: var(--info, #2196f3);
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
}

.info-icon {
  font-size: 1.2rem;
  margin-right: 0.5rem;
}

.no-points-message {
  margin-top: 1rem;
  padding: 0.5rem;
  text-align: center;
  color: var(--warning, #ff8f00);
  background-color: var(--warning-light, #fff8e1);
  border-radius: 4px;
}
</style>
