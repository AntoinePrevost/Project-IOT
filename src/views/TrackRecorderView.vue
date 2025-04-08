<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { startTrack, addPointToTrack, stopTrack } from '../services/trackingService'
import { formatDuration } from '../utils/formatters'
import TrackMap from '../components/TrackMap.vue'
import TrackStatsCard from '../components/TrackStatsCard.vue'
import RecordingControls from '../components/RecordingControls.vue'
import ErrorMessage from '../components/ErrorMessage.vue'
import SpeedChart from '../components/SpeedChart.vue'

const router = useRouter()
const trackName = ref(`Trajet du ${new Date().toLocaleDateString()}`)

// État du suivi
const isRecording = ref(false)
const isPaused = ref(false)
const currentTrack = ref(null)
const trackStartTime = ref(null)
const currentPosition = ref(null)
const errorMsg = ref('')
const loading = ref(false)

// Variables pour l'affichage
const elapsedTime = ref('00:00:00')
const distance = ref(0)
const currentSpeed = ref(0)
const maxSpeed = ref(0)
const averageSpeed = ref(0)

// Variables pour le suivi
let watchId = null
let positionIntervalId = null // Nouvel identifiant pour l'intervalle de mise à jour de position
const speedHistory = ref([])
const timeLabels = ref([])

// Limite de points d'historique à afficher sur le graphique
const MAX_HISTORY_POINTS = 100 // Augmenter cette valeur pour stocker plus de points

// Dernière position connue
const lastKnownPosition = ref(null)

// Points du tracé pour la carte
const trackPoints = computed(() => {
  if (!currentTrack.value || !currentTrack.value.points) return []
  return currentTrack.value.points
})

// Données du graphique de vitesse
const speedChartData = computed(() => {
  return {
    labels: timeLabels.value,
    datasets: [
      {
        label: 'Vitesse (km/h)',
        data: speedHistory.value,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Vitesse moyenne (km/h)',
        data: Array(speedHistory.value.length).fill(averageSpeed.value),
        borderColor: '#2196F3',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
      },
    ],
  }
})

// Démarrer l'enregistrement d'un trajet
function startRecording() {
  if (!navigator.geolocation) {
    errorMsg.value = "La géolocalisation n'est pas supportée par votre navigateur"
    return
  }

  // Réinitialiser les données d'historique
  speedHistory.value = []
  timeLabels.value = []

  // Créer un nouveau trajet avec le nom fourni
  currentTrack.value = startTrack(trackName.value)
  trackStartTime.value = Date.now()
  isRecording.value = true
  isPaused.value = false

  // Réinitialiser les données
  maxSpeed.value = 0
  averageSpeed.value = 0

  // Démarrer la capture de position
  startPositionTracking()

  // Démarrer le compteur de temps
  updateElapsedTime()
}

// Mettre en pause l'enregistrement
function pauseRecording() {
  isPaused.value = true

  // Arrêter le suivi par watchPosition
  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  // Arrêter l'intervalle de récupération de position
  if (positionIntervalId) {
    clearInterval(positionIntervalId)
    positionIntervalId = null
  }
}

// Reprendre l'enregistrement
function resumeRecording() {
  isPaused.value = false
  startPositionTracking()
}

// Arrêter l'enregistrement
function stopRecording() {
  if (!confirm("Êtes-vous sûr de vouloir arrêter l'enregistrement du trajet ?")) {
    return
  }

  // Arrêter le suivi de position
  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  // Arrêter l'intervalle de récupération de position
  if (positionIntervalId) {
    clearInterval(positionIntervalId)
    positionIntervalId = null
  }

  // Enregistrer les données de vitesse dans le track
  if (currentTrack.value) {
    // S'assurer que chaque point de l'historique speedHistory est associé à tous les points du trajet
    // Afin d'avoir un enregistrement complet des vitesses

    // Vérifier et compléter l'historique de vitesse si nécessaire
    if (speedHistory.value.length < currentTrack.value.points.length) {
      console.log(
        `Historique de vitesse incomplet: ${speedHistory.value.length} vs ${currentTrack.value.points.length} points`,
      )

      // Pour chaque point du trajet, s'assurer qu'il existe une entrée correspondante dans l'historique
      currentTrack.value.points.forEach((point, index) => {
        if (index >= speedHistory.value.length) {
          // Calculer la vitesse pour ce point si possible
          if (index > 0) {
            const prevPoint = currentTrack.value.points[index - 1]
            if (prevPoint && point.timestamp && prevPoint.timestamp) {
              const timeDiff = (new Date(point.timestamp) - new Date(prevPoint.timestamp)) / 1000 // en secondes

              if (timeDiff > 0) {
                const distance = calculateDistance(
                  prevPoint.latitude,
                  prevPoint.longitude,
                  point.latitude,
                  point.longitude,
                )

                const speedMps = distance / timeDiff
                const speedKmh = speedMps * 3.6

                // Ajouter à l'historique
                speedHistory.value.push(speedKmh)

                // Ajouter le label de temps
                const date = new Date(point.timestamp)
                timeLabels.value.push(
                  date.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                )

                console.log(`Vitesse calculée pour point ${index}: ${speedKmh.toFixed(2)} km/h`)
              }
            }
          } else {
            // Pour le premier point, utiliser 0 comme vitesse
            speedHistory.value.push(0)
            timeLabels.value.push(
              new Date(point.timestamp).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
            )
          }
        }
      })

      // Recalculer la vitesse moyenne
      if (speedHistory.value.length > 0) {
        const sum = speedHistory.value.reduce((a, b) => a + b, 0)
        averageSpeed.value = sum / speedHistory.value.length
      }

      console.log(`Historique complété: ${speedHistory.value.length} points`)
    }

    // S'assurer que currentTrack est mis à jour avec l'historique complet
    const speedData = {
      history: [...speedHistory.value],
      timeLabels: [...timeLabels.value],
      maxSpeed: maxSpeed.value.toFixed(1),
      averageSpeed: averageSpeed.value.toFixed(1),
    }

    console.log(`Sauvegarde de ${speedHistory.value.length} points de vitesse`)

    // Finaliser le trajet en passant les données de vitesse
    const finishedTrack = stopTrack({ speedData })
    isRecording.value = false
    isPaused.value = false

    // Rediriger vers le détail du trajet
    if (finishedTrack && finishedTrack.id) {
      router.push({
        name: 'track-detail',
        params: { id: finishedTrack.id },
      })
    } else {
      router.push({ name: 'tracks' })
    }
  } else {
    // Si pour une raison quelconque currentTrack est null
    stopTrack()
    isRecording.value = false
    isPaused.value = false
    router.push({ name: 'tracks' })
  }
}

// Calculer la distance entre deux points
function calculateDistance(lat1, lon1, lat2, lon2) {
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

// Démarrer le suivi de position
function startPositionTracking() {
  const options = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }

  // Utilisons watchPosition pour les mises à jour initiales
  watchId = navigator.geolocation.watchPosition(handlePositionUpdate, handlePositionError, options)

  // Mais aussi ajoutons un interval pour demander activement la position chaque seconde
  positionIntervalId = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionUpdate(position)
      },
      (error) => {
        // Si erreur lors de l'intervalle, on ne l'affiche pas à l'utilisateur
        // mais on la log pour debug
        console.warn('Erreur lors de la mise à jour de position par intervalle:', error)
      },
      options,
    )
  }, 1000) // Toutes les secondes

  console.log("Démarrage du suivi de position avec un interval d'1 seconde")
}

// Gérer la mise à jour de position
function handlePositionUpdate(position) {
  try {
    loading.value = false
    const latitude = parseFloat(position.coords.latitude)
    const longitude = parseFloat(position.coords.longitude)
    const accuracy = parseFloat(position.coords.accuracy) || 5
    const altitude = position.coords.altitude !== null ? parseFloat(position.coords.altitude) : null

    // Ne JAMAIS utiliser la vitesse du navigateur, même si disponible
    // Toujours à null pour forcer le calcul basé sur les positions
    const speed = null;

    if (isNaN(latitude) || isNaN(longitude)) {
      errorMsg.value = 'Coordonnées GPS invalides'
      return
    }

    // Vérifier si cette position est significativement différente de la dernière
    // pour éviter d'enregistrer des positions identiques
    const isNewPosition =
      !lastKnownPosition.value ||
      lastKnownPosition.value.latitude !== latitude ||
      lastKnownPosition.value.longitude !== longitude

    // Si c'est une nouvelle position ou si la position a changé, on l'enregistre
    if (isNewPosition) {
      // Créer le nouveau point avec timestamp précis
      const now = new Date()
      currentPosition.value = {
        latitude,
        longitude,
        accuracy,
        altitude,
        speed: null, // Toujours null pour être recalculé par le service
        timestamp: now.toISOString(),
      }

      // Mettre à jour la dernière position connue
      lastKnownPosition.value = { ...currentPosition.value }

      // Ajouter le point au trajet si l'enregistrement est actif
      if (isRecording.value && !isPaused.value) {
        // Garder une trace du nombre de points avant l'ajout
        const pointsCountBefore = currentTrack.value?.points?.length || 0

        // Ajouter le point - la vitesse sera calculée dans le service
        currentTrack.value = addPointToTrack(currentPosition.value)

        // Vérifier si le point a réellement été ajouté
        const pointsCountAfter = currentTrack.value?.points?.length || 0
        const pointAdded = pointsCountAfter > pointsCountBefore

        if (pointAdded) {
          // Le point a été ajouté, récupérer la vitesse calculée par le service de tracking
          const lastPoint = currentTrack.value.points[currentTrack.value.points.length - 1]

          // Si la vitesse a été calculée dans le service
          if (lastPoint && lastPoint.speed !== null && lastPoint.speed !== undefined) {
            // Convertir m/s en km/h pour l'affichage
            currentSpeed.value = lastPoint.speed * 3.6

            // Mettre à jour la vitesse maximale
            if (currentSpeed.value > maxSpeed.value) {
              maxSpeed.value = currentSpeed.value
            }

            // Ajouter à l'historique de vitesse pour le graphique
            const currentTime = now
            timeLabels.value.push(
              currentTime.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            )
            speedHistory.value.push(currentSpeed.value)

            console.log(`Point ajouté #${pointsCountAfter}: position (${latitude.toFixed(6)}, ${longitude.toFixed(6)}), vitesse calculée: ${currentSpeed.value.toFixed(2)} km/h`)
          } else {
            console.warn("Point ajouté mais sans vitesse calculée!")
          }

          // Mettre à jour la distance
          if (currentTrack.value) {
            distance.value = currentTrack.value.distance / 1000
          }

          // Si nous voulons limiter la taille de l'historique AFFICHÉ sur le graphique, mais
          // conserver toutes les données
          let displayHistory = [...speedHistory.value]
          let displayLabels = [...timeLabels.value]

          if (displayHistory.length > MAX_HISTORY_POINTS) {
            // Ne limiter que l'affichage, pas les données stockées
            displayHistory = displayHistory.slice(-MAX_HISTORY_POINTS)
            displayLabels = displayLabels.slice(-MAX_HISTORY_POINTS)
          }

          // Mettre à jour le graphique avec les données limitées
          speedChartData.value = {
            labels: displayLabels,
            datasets: [
              {
                label: 'Vitesse (km/h)',
                data: displayHistory,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
              },
              {
                label: 'Vitesse moyenne (km/h)',
                data: Array(displayHistory.length).fill(averageSpeed.value),
                borderColor: '#2196F3',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0,
              },
            ],
          }

          // Calculer la vitesse moyenne
          if (speedHistory.value.length > 0) {
            const sum = speedHistory.value.reduce((a, b) => a + b, 0)
            averageSpeed.value = sum / speedHistory.value.length
          }

          // Log pour débogage
          if (speedHistory.value.length % 10 === 0 || speedHistory.value.length <= 5) {
            console.log(
              `Historique de vitesse mis à jour: ${speedHistory.value.length} points, dernier point: ${currentSpeed.value.toFixed(2)} km/h, moyenne: ${averageSpeed.value.toFixed(1)} km/h`
            )
          }
        } else {
          console.log(`Position ignorée car trop proche ou timestamp trop proche (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`)
        }
      }
    } else {
      console.log(`Position identique à la précédente, ignorée: (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`)
    }
  } catch (error) {
    console.error('Erreur de traitement des données GPS:', error)
    errorMsg.value = 'Erreur lors du traitement des données de géolocalisation'
  }
}

// Gérer les erreurs de position
function handlePositionError(error) {
  loading.value = false
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMsg.value = "L'utilisateur a refusé la demande de géolocalisation"
      break
    case error.POSITION_UNAVAILABLE:
      errorMsg.value = "L'information de localisation n'est pas disponible"
      break
    case error.TIMEOUT:
      errorMsg.value = 'La demande de localisation a expiré'
      break
    default:
      errorMsg.value = "Une erreur inconnue s'est produite"
  }

  if (isRecording.value) {
    pauseRecording()
  }
}

// Mettre à jour le compteur de temps
function updateElapsedTime() {
  if (!isRecording.value) return

  const elapsed = isPaused.value
    ? currentTrack.value?.duration || 0
    : Math.floor((Date.now() - trackStartTime.value) / 1000)

  elapsedTime.value = formatDuration(elapsed)

  setTimeout(updateElapsedTime, 1000)
}

// Annuler l'enregistrement et revenir à la liste
function cancelRecording() {
  if (
    isRecording.value &&
    !confirm("Êtes-vous sûr de vouloir annuler l'enregistrement ? Les données seront perdues.")
  ) {
    return
  }

  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  if (positionIntervalId) {
    clearInterval(positionIntervalId)
    positionIntervalId = null
  }

  if (isRecording.value) {
    stopTrack() // Arrêter le trajet sans le sauvegarder complètement
  }

  router.push({ name: 'tracks' })
}

// Effacer le message d'erreur
function dismissError() {
  errorMsg.value = ''
}

// Cycle de vie du composant
onMounted(() => {
  // Vérifier les autorisations de géolocalisation
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'denied') {
        errorMsg.value =
          "L'accès à la géolocalisation est désactivé. Veuillez l'activer dans les paramètres."
      }
    })
  }
})

onUnmounted(() => {
  // Nettoyer les observateurs et timers
  if (watchId) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  if (positionIntervalId) {
    clearInterval(positionIntervalId)
    positionIntervalId = null
  }
})
</script>

<template>
  <div class="track-recorder">
    <h2>Enregistrement de trajet</h2>

    <ErrorMessage v-if="errorMsg" :message="errorMsg" @dismiss="dismissError" />

    <!-- Contrôles d'enregistrement -->
    <RecordingControls
      v-model:trackName="trackName"
      :isRecording="isRecording"
      :isPaused="isPaused"
      @start-recording="startRecording"
      @pause-recording="pauseRecording"
      @resume-recording="resumeRecording"
      @stop-recording="stopRecording"
      @cancel-recording="cancelRecording"
    />

    <!-- Statistiques temps réel -->
    <TrackStatsCard
      :elapsedTime="elapsedTime"
      :distance="distance"
      :currentSpeed="currentSpeed"
      :maxSpeed="maxSpeed"
      :averageSpeed="averageSpeed"
    />

    <div class="split-view">
      <!-- Carte pour le suivi en temps réel -->
      <div class="map-container">
        <TrackMap :points="trackPoints" :currentPoint="currentPosition" height="350px" />
      </div>

      <!-- Graphique de vitesse en temps réel -->
      <div class="chart-container" v-if="isRecording && speedHistory.length > 1">
        <div class="chart-header">
          <h3>Vitesse en temps réel</h3>
        </div>
        <SpeedChart :chartData="speedChartData" :height="350" />
      </div>
      <div v-else class="chart-placeholder">
        <div class="placeholder-content">
          <span class="placeholder-icon">📊</span>
          <p>Le graphique de vitesse s'affichera ici pendant l'enregistrement</p>
        </div>
      </div>
    </div>

    <!-- Note informative pour l'utilisateur -->
    <div class="info-note">
      <p>
        <span class="info-icon">ℹ️</span>
        Des analyses détaillées seront disponibles après avoir terminé l'enregistrement.
      </p>
    </div>
  </div>
</template>

<style scoped>
.track-recorder {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h2 {
  text-align: center;
  margin: 0;
  color: var(--text-color);
}

.split-view {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 960px) {
  .split-view {
    grid-template-columns: 1fr 1fr;
  }
}

.map-container,
.chart-container {
  background-color: var(--card-background);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-container {
  padding: 1rem;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.chart-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-color);
}

.chart-placeholder {
  background-color: var(--card-background);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 350px;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.placeholder-content {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: var(--text-secondary, #666);
}

.placeholder-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.info-note {
  background-color: var(--info-light, #e3f2fd);
  color: var(--info, #2196f3);
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
}

.info-note p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.info-icon {
  font-size: 1.2rem;
}
</style>
