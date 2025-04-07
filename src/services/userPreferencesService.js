/**
 * Service pour gérer les préférences utilisateur
 */

const PREFERENCES_KEY = 'geolocator_user_preferences'

// Préférences par défaut
const defaultPreferences = {
  // Préférences générales
  general: {
    darkMode: false,
    language: 'fr',
    distanceUnit: 'km', // km ou miles
    saveHistory: true,
  },

  // Préférences de trajet
  travel: {
    preferredTransportMode: 'driving-car', // driving-car, foot-walking, cycling-regular
    avoidHighways: false,
    avoidTolls: false,
    avoidFerries: false,
    preferScenicRoutes: false,
    maxWalkingDistance: 2, // en km
    maxCyclingDistance: 10, // en km
  },

  // Profil utilisateur
  profile: {
    fitnessLevel: 'average', // low, average, high
    walkingSpeed: 'average', // slow, average, fast
    cyclingSpeed: 'average', // slow, average, fast
    mobilityRestrictions: false,
    hasMobilityAid: false,
  },

  // Préférences environnementales
  environmental: {
    preferGreenSpaces: false,
    avoidPollutedAreas: false,
    preferLowTrafficAreas: false,
    preferLitRoutes: false, // routes éclairées la nuit
  },

  // Préférences horaires
  timings: {
    preferredDepartureTime: '08:00',
    preferredReturnTime: '18:00',
    avoidRushHours: false,
    workdays: [1, 2, 3, 4, 5], // 0-6 pour dimanche-samedi
    weekendDays: [0, 6],
    maximumCommuteTime: 60, // minutes
  },

  // Points d'intérêt fréquents
  frequentPlaces: [
    // { name: 'Maison', latitude: 0, longitude: 0 },
    // { name: 'Travail', latitude: 0, longitude: 0 }
  ],

  // Préférences de sécurité
  safety: {
    preferSafeNeighborhoods: false,
    avoidDangerousIntersections: false,
    preferWellLitAreas: false,
  },

  // Préférences météorologiques
  weather: {
    avoidRainRoutes: false,
    preferShadedRoutes: false, // pour les journées chaudes
    preferWindProtectedRoutes: false,
  },
}

/**
 * Charger les préférences utilisateur depuis le stockage local
 * @returns {Object} Préférences utilisateur
 */
export function getUserPreferences() {
  try {
    const storedPrefs = localStorage.getItem(PREFERENCES_KEY)
    if (!storedPrefs) {
      return defaultPreferences
    }

    const parsedPrefs = JSON.parse(storedPrefs)
    // Fusionner avec les valeurs par défaut pour assurer la compatibilité future
    return mergeWithDefaults(parsedPrefs, defaultPreferences)
  } catch (error) {
    console.error('Erreur lors du chargement des préférences:', error)
    return defaultPreferences
  }
}

/**
 * Sauvegarder les préférences utilisateur
 * @param {Object} preferences - Préférences à sauvegarder
 * @returns {boolean} Succès de l'opération
 */
export function saveUserPreferences(preferences) {
  try {
    // Fusionner avec les valeurs par défaut pour éviter de perdre des propriétés
    const mergedPrefs = mergeWithDefaults(preferences, defaultPreferences)
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(mergedPrefs))
    return true
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des préférences:', error)
    return false
  }
}

/**
 * Réinitialiser les préférences utilisateur
 * @returns {boolean} Succès de l'opération
 */
export function resetUserPreferences() {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(defaultPreferences))
    return true
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des préférences:', error)
    return false
  }
}

/**
 * Fusionner les préférences avec les valeurs par défaut
 * @param {Object} preferences - Préférences à fusionner
 * @param {Object} defaults - Valeurs par défaut
 * @returns {Object} Préférences fusionnées
 */
function mergeWithDefaults(preferences, defaults) {
  const result = { ...defaults }

  // Parcourir les catégories
  for (const category in preferences) {
    if (Object.prototype.hasOwnProperty.call(defaults, category)) {
      if (Array.isArray(preferences[category])) {
        // Si c'est un tableau, remplacer le tableau entier
        result[category] = [...preferences[category]]
      } else if (typeof preferences[category] === 'object' && preferences[category] !== null) {
        // Pour les objets, fusionner récursivement
        result[category] = { ...defaults[category], ...preferences[category] }
      } else {
        // Pour les valeurs simples, remplacer
        result[category] = preferences[category]
      }
    } else {
      // Conserver les catégories qui n'existent pas dans les valeurs par défaut
      result[category] = preferences[category]
    }
  }

  return result
}

/**
 * Générer des suggestions de trajets en fonction des préférences
 * @param {Object} startLocation - Coordonnées de départ
 * @param {Object} endLocation - Coordonnées d'arrivée
 * @returns {Array} Suggestions de trajets
 */
export function generateRouteSuggestions(startLocation, endLocation) {
  const preferences = getUserPreferences()
  const currentHour = new Date().getHours()
  const currentDay = new Date().getDay()

  // Déterminer le mode de transport recommandé
  let recommendedMode = preferences.travel.preferredTransportMode

  // Calculer la distance approximative
  const distance = calculateApproximateDistance(
    startLocation.latitude,
    startLocation.longitude,
    endLocation.latitude,
    endLocation.longitude,
  )

  // Suggestions basées sur la distance
  if (distance <= preferences.travel.maxWalkingDistance) {
    // Si la distance est faible, suggérer la marche
    recommendedMode = 'foot-walking'
  } else if (distance <= preferences.travel.maxCyclingDistance) {
    // Si la distance est moyenne, suggérer le vélo
    recommendedMode = 'cycling-regular'
  }

  // Ajustements basés sur l'heure et le jour
  const isWorkday = preferences.timings.workdays.includes(currentDay)
  const isRushHour =
    (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)

  // Éviter les heures de pointe si configuré
  if (isWorkday && isRushHour && preferences.timings.avoidRushHours) {
    // Proposer des alternatives si c'est l'heure de pointe
    if (recommendedMode === 'driving-car') {
      recommendedMode = 'cycling-regular'
    }
  }

  // TODO: Intégration avec des données météo externes pour ajuster les suggestions

  return {
    recommendedMode,
    distance,
    estimatedDuration: estimateRouteDuration(distance, recommendedMode, preferences),
    alternatives: generateAlternatives(recommendedMode, distance, preferences),
  }
}

/**
 * Calculer la distance approximative entre deux points (formule de Haversine)
 * @param {number} lat1 - Latitude point 1
 * @param {number} lon1 - Longitude point 1
 * @param {number} lat2 - Latitude point 2
 * @param {number} lon2 - Longitude point 2
 * @returns {number} Distance en km
 */
function calculateApproximateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Rayon de la Terre en km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Convertir des degrés en radians
 */
function deg2rad(deg) {
  return deg * (Math.PI / 180)
}

/**
 * Estimer la durée d'un trajet en fonction de la distance et du mode
 * @param {number} distance - Distance en km
 * @param {string} mode - Mode de transport
 * @param {Object} preferences - Préférences utilisateur
 * @returns {number} Durée estimée en minutes
 */
function estimateRouteDuration(distance, mode, preferences) {
  // Vitesses moyennes en km/h
  const speeds = {
    'driving-car': 30, // Vitesse moyenne en ville
    'foot-walking': {
      slow: 3,
      average: 4.5,
      fast: 6,
    },
    'cycling-regular': {
      slow: 10,
      average: 15,
      fast: 20,
    },
  }

  let speed

  if (mode === 'foot-walking') {
    speed = speeds[mode][preferences.profile.walkingSpeed]
  } else if (mode === 'cycling-regular') {
    speed = speeds[mode][preferences.profile.cyclingSpeed]
  } else {
    speed = speeds[mode]
  }

  // Conversion en minutes
  return Math.round((distance / speed) * 60)
}

/**
 * Générer des alternatives de trajet
 * @param {string} primaryMode - Mode principal recommandé
 * @param {number} distance - Distance en km
 * @param {Object} preferences - Préférences utilisateur
 * @returns {Array} Alternatives de trajet
 */
function generateAlternatives(primaryMode, distance, preferences) {
  const alternatives = []

  // Générer des alternatives en fonction de la distance et des préférences
  if (primaryMode !== 'foot-walking' && distance <= preferences.travel.maxWalkingDistance) {
    alternatives.push({
      mode: 'foot-walking',
      reason: "Bon pour la santé et l'environnement",
      duration: estimateRouteDuration(distance, 'foot-walking', preferences),
    })
  }

  if (primaryMode !== 'cycling-regular' && distance <= preferences.travel.maxCyclingDistance) {
    alternatives.push({
      mode: 'cycling-regular',
      reason: 'Plus rapide que la marche, bon pour la santé',
      duration: estimateRouteDuration(distance, 'cycling-regular', preferences),
    })
  }

  if (primaryMode !== 'driving-car' && distance > preferences.travel.maxWalkingDistance) {
    alternatives.push({
      mode: 'driving-car',
      reason: 'Option la plus rapide pour cette distance',
      duration: estimateRouteDuration(distance, 'driving-car', preferences),
    })
  }

  return alternatives
}
