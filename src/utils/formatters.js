/**
 * Formate une durée en secondes au format HH:MM:SS
 * @param {number} seconds - Nombre de secondes à formater
 * @returns {string} Durée formatée
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':')
}

/**
 * Formate une date ISO en format local
 * @param {string} isoString - Date au format ISO
 * @returns {string} Date formatée
 */
export function formatDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

/**
 * Formate une distance en mètres vers un format lisible
 * @param {number} meters - Distance en mètres
 * @returns {string} Distance formatée
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  } else {
    return `${(meters / 1000).toFixed(2)} km`
  }
}

/**
 * Formate une vitesse en m/s vers km/h
 * @param {number} speedMps - Vitesse en mètres par seconde
 * @returns {string} Vitesse formatée en km/h
 */
export function formatSpeed(speedMps) {
  const kmh = speedMps * 3.6
  return `${kmh.toFixed(1)} km/h`
}
