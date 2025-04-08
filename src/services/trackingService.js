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

  // Créer le point en ignorant complètement la vitesse d'entrée
  const point = {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: position.accuracy,
    altitude: position.altitude || null,
    timestamp: position.timestamp || new Date().toISOString(),
    speed: null, // Toujours la définir à null initialement
    battery: batteryLevel,
  }

  // Calcul de la vitesse basée sur la distance et le temps écoulé depuis le dernier point
  if (currentTrack.points.length > 0) {
    const lastPoint = currentTrack.points[currentTrack.points.length - 1]
    const distance = calculateDistance(
      lastPoint.latitude,
      lastPoint.longitude,
      point.latitude,
      point.longitude,
    )

    // Calcul de la différence de temps en millisecondes
    const timeDiff = new Date(point.timestamp) - new Date(lastPoint.timestamp)
    const timeDiffSeconds = timeDiff / 1000 // Convertir en secondes

    // Afficher des logs détaillés pour comprendre le comportement du système
    console.log(`Distance au dernier point: ${distance.toFixed(2)}m`)
    console.log(`Temps écoulé depuis dernier point: ${timeDiffSeconds.toFixed(2)}s`)

    // Si trop proche ET temps écoulé trop court, on ignore ce point
    if (distance < MINIMUM_DISTANCE && timeDiffSeconds < 1) {
      console.log(
        `Point ignoré: distance(${distance.toFixed(2)}m) < ${MINIMUM_DISTANCE}m et temps(${timeDiffSeconds.toFixed(2)}s) < 1s`,
      )
      return currentTrack
    }

    // Calculer la vitesse en m/s basée sur la distance et le temps
    if (timeDiffSeconds > 0) {
      // Vitesse en m/s = distance (m) / temps (s)
      const speedMps = distance / timeDiffSeconds
      point.speed = speedMps

      console.log(
        `Vitesse calculée: ${speedMps.toFixed(2)} m/s (${(speedMps * 3.6).toFixed(2)} km/h) [distance: ${distance.toFixed(2)}m, temps: ${timeDiffSeconds.toFixed(2)}s]`,
      )
    } else {
      console.warn('Impossible de calculer la vitesse: différence de temps nulle ou négative')
      // Définir une vitesse par défaut de 0 pour éviter des problèmes plus tard
      point.speed = 0
    }

    // Mettre à jour la distance totale
    currentTrack.distance += distance
    console.log(
      `Point ajouté: distance parcourue +${distance.toFixed(2)}m, total: ${currentTrack.distance.toFixed(2)}m`,
    )
  } else {
    console.log('Premier point du trajet ajouté - pas de vitesse calculable')
    point.speed = 0 // Vitesse nulle pour le premier point
  }

  // Ajouter le point au trajet
  currentTrack.points.push(point)

  // Mettre à jour la durée
  if (currentTrack.points.length > 1) {
    const firstPoint = currentTrack.points[0]
    const lastPoint = currentTrack.points[currentTrack.points.length - 1]
    const currentDuration = (new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp)) / 1000

    // Log pour déboguer le problème de durée
    if (currentDuration <= 0) {
      console.warn('ATTENTION: Durée calculée nulle ou négative!')
      console.warn('Premier point timestamp:', firstPoint.timestamp)
      console.warn('Dernier point timestamp:', lastPoint.timestamp)
      console.warn(
        'Différence de temps:',
        new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp),
      )
    } else {
      currentTrack.duration = currentDuration
    }
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

  // Vérifier la durée finale du trajet une dernière fois
  if (currentTrack.points.length >= 2) {
    const firstPoint = currentTrack.points[0]
    const lastPoint = currentTrack.points[currentTrack.points.length - 1]
    const calculatedDuration =
      (new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp)) / 1000

    if (calculatedDuration > 0) {
      currentTrack.duration = calculatedDuration
      console.log(`Durée finale du trajet: ${calculatedDuration}s`)
    } else {
      console.error('Erreur critique: La durée finale calculée est nulle ou négative!')
    }
  }

  // S'assurer que tous les points ont des données de vitesse
  if (currentTrack.points && currentTrack.points.length > 0) {
    console.log(
      `Traitement final de ${currentTrack.points.length} points pour vérification des vitesses`,
    )

    // Tableau pour conserver les vitesses en km/h pour le calcul de moyenne et max
    const speedsKmh = []
    const timeLabels = []

    // Recalculer toutes les vitesses pour être sûr
    for (let i = 0; i < currentTrack.points.length; i++) {
      let point = currentTrack.points[i]
      let speedKmh = 0

      if (i > 0) {
        // Calculer la vitesse par rapport au point précédent
        const prevPoint = currentTrack.points[i - 1]
        const distance = calculateDistance(
          prevPoint.latitude,
          prevPoint.longitude,
          point.latitude,
          point.longitude,
        )

        const timeDiff = (new Date(point.timestamp) - new Date(prevPoint.timestamp)) / 1000

        if (timeDiff > 0) {
          // Vitesse en m/s
          const speedMps = distance / timeDiff
          // Stocker la vitesse calculée dans le point
          point.speed = speedMps
          // Convertir en km/h pour l'historique
          speedKmh = speedMps * 3.6
        } else {
          console.warn(`Point ${i}: Différence de temps nulle ou négative, vitesse mise à 0`)
          point.speed = 0
          speedKmh = 0
        }
      } else {
        // Premier point: vitesse = 0
        point.speed = 0
        speedKmh = 0
      }

      // Ajouter à l'historique
      speedsKmh.push(speedKmh)

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

    // Afficher des informations sur les vitesses calculées
    if (speedsKmh.length > 0) {
      const avgSpeed = speedsKmh.reduce((sum, speed) => sum + speed, 0) / speedsKmh.length
      const maxSpeed = Math.max(...speedsKmh)

      console.log(`Vitesses recalculées: ${speedsKmh.length} points`)
      console.log(`Vitesse moyenne: ${avgSpeed.toFixed(2)} km/h`)
      console.log(`Vitesse maximale: ${maxSpeed.toFixed(2)} km/h`)

      // Créer ou remplacer les données de vitesse
      currentTrack.speedData = {
        history: speedsKmh,
        timeLabels: timeLabels,
        averageSpeed: avgSpeed.toFixed(1),
        maxSpeed: maxSpeed.toFixed(1),
      }
    }
  }

  // Ajouter des données supplémentaires si fournies (mais ne pas écraser speedData)
  if (extraData) {
    // Fusionner sans écraser les speedData qu'on vient de calculer
    const { speedData, ...otherData } = extraData
    Object.assign(currentTrack, otherData)
  }

  // Enregistrer le trajet dans l'historique
  saveTrackToHistory(currentTrack)

  // Effacer le trajet actif
  localStorage.removeItem(CURRENT_TRACK_KEY)

  console.log(`Trajet ${currentTrack.id} terminé avec ${currentTrack.points.length} points`)
  if (currentTrack.speedData) {
    console.log(`Données de vitesse: ${currentTrack.speedData.history.length} points`)
  }

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

  console.log(`Calcul des statistiques pour ${track.points.length} points`)

  // Calculer la vitesse moyenne et maximale
  let maxSpeed = 0
  const speeds = []
  const speedHistory = []
  const timeLabels = []

  // Extraire les données de vitesse des points
  track.points.forEach((point, index) => {
    if (point.speed !== null && point.speed !== undefined && !isNaN(point.speed)) {
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

  console.log(`Points avec vitesse valide: ${speeds.length} sur ${track.points.length}`)

  // Utiliser les données speedData si elles existent, sinon utiliser celles calculées
  const finalSpeedHistory = track.speedData?.history || speedHistory
  const finalTimeLabels = track.speedData?.timeLabels || timeLabels
  const finalMaxSpeed = track.speedData?.maxSpeed || maxSpeed

  console.log(`Historique final: ${finalSpeedHistory.length} points`)

  // Calculer la vitesse moyenne
  let averageSpeed = 0
  if (speeds.length > 0) {
    // Moyenne des vitesses instantanées
    averageSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length
  } else if (track.distance > 0 && track.duration > 0) {
    // Vitesse moyenne basée sur la distance totale et la durée
    averageSpeed = track.distance / 1000 / (track.duration / 3600)
  }

  // Calculer l'élévation (dénivelé)
  let elevationGain = 0
  let elevationLoss = 0

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
        elevationGain += diff
      } else {
        elevationLoss += Math.abs(diff)
      }
    }
  }

  return {
    distance: track.distance,
    duration: track.duration,
    averageSpeed: averageSpeed,
    maxSpeed: finalMaxSpeed,
    elevationGain,
    elevationLoss,
    speedHistory: finalSpeedHistory,
    timeLabels: finalTimeLabels,
  }
}
