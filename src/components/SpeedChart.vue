<script setup>
import { ref, onMounted, watch, defineProps, computed } from 'vue'

const props = defineProps({
  chartData: {
    type: Object,
    required: true,
  },
  height: {
    type: [Number, String],
    default: 300,
  },
  width: {
    type: [Number, String],
    default: '100%',
  },
})

const chartContainer = ref(null)
let chart = null

const chartHeight = computed(() => {
  return typeof props.height === 'number' ? `${props.height}px` : props.height
})

const chartWidth = computed(() => {
  return typeof props.width === 'number' ? `${props.width}px` : props.width
})

function renderChart() {
  if (!chartContainer.value || !window.Chart) return

  // Vérifier si nous avons des données à afficher
  if (!props.chartData || !props.chartData.datasets || props.chartData.datasets.length === 0) {
    console.log('Pas de données pour le graphique')
    return
  }

  console.log('Rendu du graphique avec', props.chartData.labels?.length || 0, 'points')

  // Détruire le graphique existant s'il y en a un
  if (chart) {
    chart.destroy()
  }

  const ctx = chartContainer.value.getContext('2d')

  // Options du graphique
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 500,
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Vitesse (km/h)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Temps',
        },
      },
    },
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  }

  // Créer le graphique
  chart = new window.Chart(ctx, {
    type: 'line',
    data: props.chartData,
    options: options,
  })
}

// Observer les changements de données
watch(
  () => props.chartData,
  () => {
    renderChart()
  },
  { deep: true },
)

onMounted(() => {
  // Charger Chart.js si ce n'est pas déjà fait
  if (!window.Chart) {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js'
    script.onload = renderChart
    document.head.appendChild(script)
  } else {
    renderChart()
  }
})
</script>

<template>
  <div class="speed-chart" :style="{ height: chartHeight, width: chartWidth }">
    <canvas ref="chartContainer"></canvas>

    <!-- Afficher un message si pas de données -->
    <div
      v-if="!chartData || !chartData.datasets || chartData.datasets.length === 0"
      class="no-data-message"
    >
      Pas de données de vitesse disponibles pour ce trajet
    </div>
  </div>
</template>

<style scoped>
.speed-chart {
  position: relative;
}

.no-data-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #999;
  font-style: italic;
  text-align: center;
}
</style>
