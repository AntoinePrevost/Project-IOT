/**
 * Formate la durée en secondes au format HH:MM:SS
 * @param {number} seconds - Durée en secondes
 * @returns {string} - Durée formatée
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
 * Formate une date ISO en format lisible
 * @param {string} isoDate - Date au format ISO
 * @returns {string} - Date formatée
 */
export function formatDate(isoDate) {
  if (!isoDate) return ''
  try {
    const date = new Date(isoDate)
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date)
  } catch (e) {
    console.error('Erreur de formatage de date:', e)
    return isoDate
  }
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
 * Formate la vitesse en km/h avec 1 décimale
 * @param {number} speed - Vitesse en km/h
 * @returns {string} - Vitesse formatée
 */
export function formatSpeed(speed) {
  if (speed === null || speed === undefined || isNaN(speed)) {
    return '0.0 km/h'
  }
  return `${parseFloat(speed).toFixed(1)} km/h`
}

/**
 * Formate les coordonnées GPS pour affichage
 * @param {number} coord - Coordonnée (latitude ou longitude)
 * @param {number} decimals - Nombre de décimales à afficher
 * @returns {string} - Coordonnée formatée
 */
export function formatCoordinate(coord, decimals = 6) {
  if (coord === null || coord === undefined || isNaN(coord)) {
    return '0'
  }
  return parseFloat(coord).toFixed(decimals)
}
