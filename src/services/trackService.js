// Service pour les calculs liés aux trajets
import { ref, computed } from 'vue'

/**
 * Calcule la distance entre deux points géographiques en utilisant la formule de Haversine
 * @param {number} lat1 - Latitude du premier point
 * @param {number} lon1 - Longitude du premier point
 * @param {number} lat2 - Latitude du deuxième point
 * @param {number} lon2 - Longitude du deuxième point
 * @returns {number} - Distance en mètres
 */
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

/**
 * Formate une durée en secondes au format HH:MM:SS
 * @param {number} seconds - Durée en secondes
 * @returns {string} - Durée formatée
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Prépare les données d'un trajet pour l'affichage et l'analyse
 * @param {Object} track - Le trajet à préparer
 * @returns {Object} - Le trajet préparé
 */
export function prepareTrackData(track) {
  if (!track) return null

  // Créer une copie du trajet pour éviter de modifier l'original
  const preparedTrack = JSON.parse(JSON.stringify(track))

  // Vérifier et corriger la durée si nécessaire
  if (preparedTrack.duration === 0 && preparedTrack.points && preparedTrack.points.length >= 2) {
    const firstPoint = preparedTrack.points[0]
    const lastPoint = preparedTrack.points[preparedTrack.points.length - 1]

    if (firstPoint.timestamp && lastPoint.timestamp) {
      const startTime = new Date(firstPoint.timestamp)
      const endTime = new Date(lastPoint.timestamp)
      const calculatedDuration = (endTime - startTime) / 1000

      console.log(`Durée corrigée: ${calculatedDuration}s (était: 0s)`)
      preparedTrack.duration = calculatedDuration
    }
  }

  // Vérifier et recalculer TOUTES les vitesses pour uniformité
  if (preparedTrack.points && preparedTrack.points.length > 0) {
    console.log(
      `Préparation du trajet: recalcul de toutes les vitesses pour ${preparedTrack.points.length} points`,
    )

    // Recalculer les vitesses pour tous les points
    for (let i = 0; i < preparedTrack.points.length; i++) {
      if (i > 0) {
        const point = preparedTrack.points[i]
        const prevPoint = preparedTrack.points[i - 1]

        // Calculer la distance
        const distance = calculateDistance(
          prevPoint.latitude,
          prevPoint.longitude,
          point.latitude,
          point.longitude,
        )

        const timeDiff = (new Date(point.timestamp) - new Date(prevPoint.timestamp)) / 1000

        if (timeDiff > 0) {
          // Calculer la vitesse en m/s
          const speedMps = distance / timeDiff
          preparedTrack.points[i].speed = speedMps
        } else {
          // Si le temps est négatif ou nul, mettre la vitesse à 0
          preparedTrack.points[i].speed = 0
        }
      } else {
        // Premier point: vitesse = 0
        preparedTrack.points[0].speed = 0
      }
    }

    // Recréer complètement les speedData à partir des points
    const speedsKmh = []
    const timeLabels = []

    preparedTrack.points.forEach((point) => {
      // Convertir de m/s à km/h
      const speedKmh = point.speed * 3.6
      speedsKmh.push(speedKmh)

      // Créer label de temps
      const date = new Date(point.timestamp)
      timeLabels.push(
        date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
    })

    if (speedsKmh.length > 0) {
      const avgSpeed = speedsKmh.reduce((sum, speed) => sum + speed, 0) / speedsKmh.length
      const maxSpeed = Math.max(...speedsKmh)

      // Toujours recréer les speedData pour être sûr
      preparedTrack.speedData = {
        history: speedsKmh,
        timeLabels: timeLabels,
        averageSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
      }

      console.log(
        `SpeedData recréées: ${speedsKmh.length} points, ` +
          `vitesse max: ${maxSpeed.toFixed(1)} km/h, ` +
          `vitesse moyenne: ${avgSpeed.toFixed(1)} km/h`,
      )
    }
  }

  return preparedTrack
}

/**
 * Calcule les statistiques d'un trajet pour l'affichage
 * @param {Object} track - Le trajet pour lequel calculer les statistiques
 * @returns {Object} - Les statistiques calculées
 */
export function calculateTrackStatistics(track) {
  if (!track || !track.points || track.points.length < 2) {
    return {
      distance: 0,
      duration: '00:00:00',
      avgSpeed: 0,
      maxSpeed: 0,
      elevGain: 0,
      elevLoss: 0,
    }
  }

  // Extraire et formater la durée
  const durationSec = track.duration || 0
  const hours = Math.floor(durationSec / 3600)
  const minutes = Math.floor((durationSec % 3600) / 60)
  const seconds = Math.floor(durationSec % 60)
  const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  // Calculer la distance en kilomètres
  const distanceKm = track.distance / 1000

  // Extraire les données de vitesse
  const speeds = []
  track.points.forEach((point) => {
    if (point.speed !== null && point.speed !== undefined && !isNaN(point.speed)) {
      const speedKmh = point.speed * 3.6 // m/s vers km/h
      speeds.push(speedKmh)
    }
  })

  // Calculer vitesse moyenne et maximale
  let avgSpeed = 0
  let maxSpeed = 0

  if (speeds.length > 0) {
    // Si on a des données de vitesse instantanée, on les utilise
    avgSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
    maxSpeed = Math.max(...speeds)
    console.log(`Statistiques calculées: ${speeds.length} points de vitesse utilisés`)
  } else if (durationSec > 0) {
    // Sinon, calcul basé sur distance et durée totale
    avgSpeed = distanceKm / (durationSec / 3600)
    console.log(
      `Statistiques basées uniquement sur distance totale et durée (pas de points de vitesse)`,
    )
  }

  // Utiliser les données de speedData si elles existent et semblent valides
  if (track.speedData && track.speedData.history && track.speedData.history.length > 0) {
    console.log(`Utilisation des speedData existantes: ${track.speedData.history.length} points`)
    if (track.speedData.averageSpeed !== undefined) {
      avgSpeed = parseFloat(track.speedData.averageSpeed)
    }
    if (track.speedData.maxSpeed !== undefined) {
      maxSpeed = parseFloat(track.speedData.maxSpeed)
    }
  }

  // Calculer l'élévation (dénivelé)
  let elevGain = 0
  let elevLoss = 0

  for (let i = 1; i < track.points.length; i++) {
    const current = track.points[i]
    const previous = track.points[i - 1]

    if (
      current.altitude !== null &&
      previous.altitude !== null &&
      current.altitude !== undefined &&
      previous.altitude !== undefined
    ) {
      const diff = current.altitude - previous.altitude
      if (diff > 0) {
        elevGain += diff
      } else if (diff < 0) {
        elevLoss += Math.abs(diff)
      }
    }
  }

  return {
    distance: distanceKm.toFixed(2),
    duration: formattedDuration,
    avgSpeed: avgSpeed.toFixed(1),
    maxSpeed: maxSpeed.toFixed(1),
    elevGain: Math.round(elevGain || 0),
    elevLoss: Math.round(elevLoss || 0),
  }
}

/**
 * Prépare les points d'un trajet pour l'affichage sur la carte
 * Filtre les points invalides et s'assure que les coordonnées sont des nombres
 * @param {Array} points - Les points du trajet
 * @returns {Array} - Les points validés et préparés pour la carte
 */
export function preparePointsForMap(points) {
  if (!points || !Array.isArray(points) || points.length === 0) {
    console.warn('Pas de points à préparer pour la carte')
    return []
  }

  console.log(`Préparation de ${points.length} points pour la carte`)

  // Filtrer les points valides (avec latitude et longitude numériques)
  const validPoints = points
    .filter((point) => {
      // Vérifier que les propriétés existent
      if (
        !point ||
        typeof point.latitude === 'undefined' ||
        typeof point.longitude === 'undefined'
      ) {
        return false
      }

      // Convertir en nombres si nécessaire
      const lat = typeof point.latitude === 'string' ? parseFloat(point.latitude) : point.latitude
      const lng =
        typeof point.longitude === 'string' ? parseFloat(point.longitude) : point.longitude

      // Vérifier que ce sont des nombres valides
      return !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)
    })
    .map((point) => {
      // S'assurer que latitude et longitude sont des nombres
      return {
        ...point,
        latitude: typeof point.latitude === 'string' ? parseFloat(point.latitude) : point.latitude,
        longitude:
          typeof point.longitude === 'string' ? parseFloat(point.longitude) : point.longitude,
      }
    })

  console.log(`${validPoints.length} points valides sur ${points.length}`)

  return validPoints
}

/**
 * Crée un hook réutilisable pour traiter les données d'un trajet
 * @param {Object} trackData - Les données brutes du trajet
 * @returns {Object} - Les données traitées et les statistiques
 */
export function useTrackProcessor(trackData) {
  const track = ref(null)

  // Met à jour les données du trajet
  const updateTrack = (data) => {
    if (data) {
      track.value = prepareTrackData(data)
    }
  }

  // Calcule les statistiques à partir des données du trajet
  const statistics = computed(() => {
    return calculateTrackStatistics(track.value)
  })

  // Initialisation si des données sont fournies
  if (trackData) {
    updateTrack(trackData)
  }

  return {
    track,
    statistics,
    updateTrack,
  }
}
