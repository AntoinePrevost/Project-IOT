<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import TrackMap from './TrackMap.vue'
import SpeedChart from './SpeedChart.vue'
import { calculateTrackStats } from '../services/trackingService'

const props = defineProps({
  track: {
    type: Object,
    required: true,
  },
})

// Points du tracé pour la carte
const trackPoints = computed(() => {
  if (!props.track || !props.track.points) return []
  return props.track.points
})

// Statistiques du trajet
const trackStats = computed(() => {
  return calculateTrackStats(props.track)
})

// Données du graphique de vitesse
const speedChartData = computed(() => {
  const hasSpeedData = trackStats.value.speedHistory && trackStats.value.speedHistory.length > 0

  if (!hasSpeedData) {
    // Extraire les vitesses des points du trajet si disponibles
    const speedData = props.track.points
      .filter((p) => p.speed !== null && p.speed !== undefined)
      .map((p) => p.speed * 3.6)

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

    if (speedData.length === 0) {
      return {
        labels: [],
        datasets: [],
      }
    }

    // Calculer la vitesse moyenne
    const avgSpeed = speedData.reduce((a, b) => a + b, 0) / speedData.length

    return {
      labels: times,
      datasets: [
        {
          label: 'Vitesse (km/h)',
          data: speedData,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Vitesse moyenne (km/h)',
          data: Array(speedData.length).fill(avgSpeed),
          borderColor: '#2196F3',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        },
      ],
    }
  }

  // Utiliser les données de vitesse stockées dans le trajet
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
})

// Vérifier si nous avons des données de vitesse à afficher
const hasSpeedData = computed(() => {
  if (trackStats.value.speedHistory && trackStats.value.speedHistory.length > 0) {
    return true
  }

  return props.track.points.some((p) => p.speed !== null && p.speed !== undefined)
})

// Initialisation au montage du composant
onMounted(() => {
  // Initialisation si nécessaire
})
</script>

<template>
  <div class="track-visualizer">
    <!-- Carte -->
    <TrackMap :points="trackPoints" height="400px" />

    <!-- Graphique de vitesse si disponible -->
    <div v-if="hasSpeedData" class="chart-container">
      <h3>Analyse de la vitesse</h3>
      <SpeedChart :chartData="speedChartData" height="300" />
    </div>

    <div v-else class="chart-placeholder">
      <p>
        <span class="info-icon">ℹ️</span>
        Aucune donnée de vitesse disponible pour ce trajet
      </p>
    </div>
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
</style>
