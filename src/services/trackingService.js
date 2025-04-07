/**
 * Service de suivi et d'enregistrement des trajets IoT
 */

// Configuration
const STORAGE_KEY = 'geolocator_tracks'
const CURRENT_TRACK_KEY = 'geolocator_current_track'
const MINIMUM_DISTANCE = 10 // distance minimale en mètres entre deux points pour enregistrer

// Structure de données pour un trajet
/*
{
  id: string,
  name: string,
  startTime: ISO string,
  endTime: ISO string | null,
  points: [
    {
      latitude: number,
      longitude: number,
      accuracy: number,
      altitude: number | null,
      timestamp: ISO string,
      speed: number | null,
      battery: number | null
    }
  ],
  distance: number, // en mètres
  duration: number, // en secondes
  active: boolean
}
*/

/**
 * Démarrer un nouveau trajet
 * @param {string} name - Nom du trajet (optionnel)
 * @returns {Object} - Le trajet créé
 */
export function startTrack(name = '') {
  // Arrêter le trajet actif s'il existe
  const currentTrack = getCurrentTrack()
  if (currentTrack) {
    stopTrack()
  }

  // Créer un nouveau trajet
  const trackName = name || `Trajet du ${new Date().toLocaleString()}`
  const track = {
    id: generateId(),
    name: trackName,
    startTime: new Date().toISOString(),
    endTime: null,
    points: [],
    distance: 0,
    duration: 0,
    active: true,
  }

  // Enregistrer le trajet et le marquer comme actif
  localStorage.setItem(CURRENT_TRACK_KEY, JSON.stringify(track))

  return track
}

/**
 * Ajouter un point au trajet actif
 * @param {Object} position - Les données de position
 * @returns {Object|null} - Le trajet mis à jour ou null si aucun trajet actif
 */
export function addPointToTrack(position) {
  const currentTrack = getCurrentTrack()
  if (!currentTrack || !currentTrack.active) {
    return null
  }

  // Récupérer le niveau de batterie si disponible
  let batteryLevel = null
  if (navigator.getBattery) {
    navigator
      .getBattery()
      .then((battery) => {
        batteryLevel = battery.level * 100
      })
      .catch(() => {
        // Batterie non disponible
      })
  }

  // Créer le point
  const point = {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: position.accuracy,
    altitude: position.altitude || null,
    timestamp: position.timestamp || new Date().toISOString(),
    speed: position.speed || null,
    battery: batteryLevel,
  }

  // Vérifier si le point est suffisamment éloigné du dernier point
  if (currentTrack.points.length > 0) {
    const lastPoint = currentTrack.points[currentTrack.points.length - 1]
    const distance = calculateDistance(
      lastPoint.latitude,
      lastPoint.longitude,
      point.latitude,
      point.longitude,
    )

    // Seulement ajouter le point s'il est suffisamment éloigné ou si 1 minute s'est écoulée
    const timeDiff = new Date(point.timestamp) - new Date(lastPoint.timestamp)
    if (distance < MINIMUM_DISTANCE && timeDiff < 60000) {
      return currentTrack
    }

    // Mettre à jour la distance totale
    currentTrack.distance += distance
  }

  // Ajouter le point au trajet
  currentTrack.points.push(point)

  // Mettre à jour la durée
  if (currentTrack.points.length > 1) {
    const firstPoint = currentTrack.points[0]
    const lastPoint = currentTrack.points[currentTrack.points.length - 1]
    currentTrack.duration = (new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp)) / 1000
  }

  // Enregistrer le trajet mis à jour
  localStorage.setItem(CURRENT_TRACK_KEY, JSON.stringify(currentTrack))

  return currentTrack
}

/**
 * Arrêter le trajet actif
 * @param {Object} extraData - Données supplémentaires à stocker dans le trajet
 * @returns {Object|null} - Le trajet arrêté ou null si aucun trajet actif
 */
export function stopTrack(extraData = null) {
  const currentTrack = getCurrentTrack()
  if (!currentTrack || !currentTrack.active) {
    return null
  }

  // Marquer le trajet comme terminé
  currentTrack.active = false
  currentTrack.endTime = new Date().toISOString()

  // Ajouter des données supplémentaires si fournies
  if (extraData) {
    Object.assign(currentTrack, extraData)
  }

  // S'assurer que les points ont des données de vitesse
  if (currentTrack.points && currentTrack.points.length > 0) {
    currentTrack.points = currentTrack.points.map((point, index, points) => {
      // Si le point n'a pas de vitesse et qu'il y a un point précédent,
      // calculer la vitesse approximative
      if ((point.speed === null || point.speed === undefined) && index > 0) {
        const prevPoint = points[index - 1]
        const distance = calculateDistance(
          prevPoint.latitude,
          prevPoint.longitude,
          point.latitude,
          point.longitude,
        )

        const timeDiff = new Date(point.timestamp) - new Date(prevPoint.timestamp)
        const timeDiffHours = timeDiff / 1000 / 60 / 60 // en heures

        if (timeDiffHours > 0) {
          // Vitesse en m/s (conversion en m/s plutôt que km/h)
          point.speed = distance / 1000 / timeDiffHours / 3.6
        }
      }
      return point
    })
  }

  // Enregistrer le trajet dans l'historique
  saveTrackToHistory(currentTrack)

  // Effacer le trajet actif
  localStorage.removeItem(CURRENT_TRACK_KEY)

  return currentTrack
}

/**
 * Récupérer le trajet actif
 * @returns {Object|null} - Le trajet actif ou null
 */
export function getCurrentTrack() {
  const trackJson = localStorage.getItem(CURRENT_TRACK_KEY)
  return trackJson ? JSON.parse(trackJson) : null
}

/**
 * Enregistrer un trajet dans l'historique
 * @param {Object} track - Le trajet à enregistrer
 */
function saveTrackToHistory(track) {
  const tracks = getAllTracks()
  tracks.push(track)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks))
}

/**
 * Récupérer tous les trajets enregistrés
 * @returns {Array} - Liste des trajets
 */
export function getAllTracks() {
  const tracksJson = localStorage.getItem(STORAGE_KEY)
  return tracksJson ? JSON.parse(tracksJson) : []
}

/**
 * Récupérer un trajet par son ID
 * @param {string} id - ID du trajet
 * @returns {Object|null} - Le trajet ou null
 */
export function getTrackById(id) {
  const tracks = getAllTracks()
  return tracks.find((track) => track.id === id) || null
}

/**
 * Supprimer un trajet
 * @param {string} id - ID du trajet à supprimer
 * @returns {boolean} - Succès de la suppression
 */
export function deleteTrack(id) {
  const tracks = getAllTracks()
  const filteredTracks = tracks.filter((track) => track.id !== id)

  if (filteredTracks.length !== tracks.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTracks))
    return true
  }

  return false
}

/**
 * Calculer la distance entre deux coordonnées GPS
 * @param {number} lat1 - Latitude du point 1
 * @param {number} lon1 - Longitude du point 1
 * @param {number} lat2 - Latitude du point 2
 * @param {number} lon2 - Longitude du point 2
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

  return R * c
}

/**
 * Exporter un trajet au format GPX
 * @param {string} trackId - ID du trajet
 * @returns {string} - Contenu du fichier GPX
 */
export function exportTrackToGPX(trackId) {
  const track = getTrackById(trackId)
  if (!track) {
    return null
  }

  // Créer l'en-tête GPX
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GeoLocator IoT App" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(track.name)}</name>
    <time>${track.startTime}</time>
  </metadata>
  <trk>
    <name>${escapeXml(track.name)}</name>
    <trkseg>`

  // Ajouter les points
  track.points.forEach((point) => {
    gpx += `
      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        ${point.altitude !== null ? `<ele>${point.altitude}</ele>` : ''}
        <time>${point.timestamp}</time>
      </trkpt>`
  })

  // Fermer le GPX
  gpx += `
    </trkseg>
  </trk>
</gpx>`

  return gpx
}

/**
 * Générer un ID unique
 * @returns {string} - ID généré
 */
function generateId() {
  return 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

/**
 * Échapper les caractères spéciaux XML
 * @param {string} text - Texte à échapper
 * @returns {string} - Texte échappé
 */
function escapeXml(text) {
  return text.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      case '"':
        return '&quot;'
    }
  })
}

/**
 * Calculer les statistiques d'un trajet
 * @param {string} trackId - ID du trajet ou objet trajet
 * @returns {Object} - Statistiques du trajet
 */
export function calculateTrackStats(trackId) {
  const track = typeof trackId === 'string' ? getTrackById(trackId) : trackId

  if (!track || track.points.length < 2) {
    return {
      distance: 0,
      duration: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      elevationGain: 0,
      elevationLoss: 0,
      speedHistory: [],
      timeLabels: [],
    }
  }

  // Calculer la vitesse moyenne et maximale
  let maxSpeed = 0
  const speeds = []
  const speedHistory = []
  const timeLabels = []

  // Extraire les données de vitesse des points
  track.points.forEach((point, index) => {
    if (point.speed !== null && point.speed !== undefined) {
      const speedKmh = point.speed * 3.6 // Convertir en km/h
      speeds.push(speedKmh)
      maxSpeed = Math.max(maxSpeed, speedKmh)

      // Aussi collecter pour l'historique du graphique
      speedHistory.push(speedKmh)

      // Créer label de temps formaté
      const date = new Date(point.timestamp)
      timeLabels.push(
        date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      )
    }
  })

  // Utiliser les données speedData si elles existent, sinon utiliser celles calculées
  const finalSpeedHistory = track.speedData?.history || speedHistory
  const finalTimeLabels = track.speedData?.timeLabels || timeLabels
  const finalMaxSpeed = track.speedData?.maxSpeed || maxSpeed

  const averageSpeed =
    speeds.length > 0
      ? speeds.reduce((a, b) => a + b, 0) / speeds.length
      : track.distance / 1000 / (track.duration / 3600)

  // ... existing code for elevation calculation ...

  return {
    distance: track.distance,
    duration: track.duration,
    averageSpeed: averageSpeed,
    maxSpeed: finalMaxSpeed,
    elevationGain: 0, // Calculate if needed
    elevationLoss: 0, // Calculate if needed
    speedHistory: finalSpeedHistory,
    timeLabels: finalTimeLabels,
  }
}
