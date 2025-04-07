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
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Rayon de la Terre en mètres
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

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
 * Nettoie et prépare les données d'un trajet
 * @param {Object} track - Les données du trajet à nettoyer
 * @returns {Object} - Les données nettoyées
 */
export function prepareTrackData(track) {
  if (!track || !track.points || track.points.length === 0) {
    return track
  }

  // Clone l'objet pour éviter de modifier l'original
  const cleanedTrack = JSON.parse(JSON.stringify(track))

  // S'assurer que les points sont triés par timestamp
  cleanedTrack.points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  // Filtrer les points invalides
  cleanedTrack.points = cleanedTrack.points.filter(
    (point) =>
      point.latitude !== undefined &&
      point.longitude !== undefined &&
      !isNaN(point.latitude) &&
      !isNaN(point.longitude),
  )

  // Calculer la vitesse pour chaque point si elle n'est pas présente
  for (let i = 1; i < cleanedTrack.points.length; i++) {
    const prevPoint = cleanedTrack.points[i - 1]
    const currentPoint = cleanedTrack.points[i]

    if (!currentPoint.speed || currentPoint.speed === 0) {
      const distance = calculateDistance(
        prevPoint.latitude,
        prevPoint.longitude,
        currentPoint.latitude,
        currentPoint.longitude,
      )

      const timeDiffMs = new Date(currentPoint.timestamp) - new Date(prevPoint.timestamp)
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60)

      // Vitesse en km/h
      if (timeDiffHours > 0) {
        currentPoint.speed = distance / 1000 / timeDiffHours
      } else {
        currentPoint.speed = 0
      }
    }
  }

  return cleanedTrack
}

/**
 * Calcule les statistiques d'un trajet
 * @param {Object} track - Les données du trajet
 * @returns {Object} - Les statistiques calculées
 */
export function calculateTrackStatistics(track) {
  if (!track || !track.points || track.points.length === 0) {
    return {
      distance: 0,
      duration: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      elevGain: 0,
      elevLoss: 0,
    }
  }

  // Traitement des statistiques de base
  const startTime = new Date(track.points[0].timestamp)
  const endTime = new Date(track.points[track.points.length - 1].timestamp)
  const durationMs = endTime - startTime
  const durationMinutes = durationMs / (1000 * 60)

  // Vérifier que les points ont des coordonnées valides avant calcul
  const validPoints = track.points.filter(
    (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number',
  )

  // Calcul de la distance totale
  let totalDistance = 0
  let maxSpeed = 0
  let elevGain = 0
  let elevLoss = 0
  let lastElevation = null

  for (let i = 1; i < validPoints.length; i++) {
    const prevPoint = validPoints[i - 1]
    const currentPoint = validPoints[i]

    // Calcul de la distance entre 2 points
    totalDistance += calculateDistance(
      prevPoint.latitude,
      prevPoint.longitude,
      currentPoint.latitude,
      currentPoint.longitude,
    )

    // Mise à jour de la vitesse max (si disponible)
    if (currentPoint.speed && currentPoint.speed > maxSpeed) {
      maxSpeed = currentPoint.speed
    }

    // Calcul du dénivelé (si l'altitude est disponible)
    if (prevPoint.altitude !== undefined && currentPoint.altitude !== undefined) {
      const elevDiff = currentPoint.altitude - prevPoint.altitude
      if (elevDiff > 0) {
        elevGain += elevDiff
      } else {
        elevLoss += Math.abs(elevDiff)
      }
    }
  }

  // Convertir en km
  totalDistance = totalDistance / 1000

  // Calculer la vitesse moyenne (km/h)
  const avgSpeed = durationMinutes > 0 ? (totalDistance / durationMinutes) * 60 : 0

  return {
    distance: totalDistance.toFixed(2),
    duration: formatDuration(durationMs / 1000),
    avgSpeed: avgSpeed.toFixed(1),
    maxSpeed: maxSpeed.toFixed(1),
    elevGain: elevGain.toFixed(0),
    elevLoss: elevLoss.toFixed(0),
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
