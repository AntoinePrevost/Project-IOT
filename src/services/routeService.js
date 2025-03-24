/**
 * Service pour l'API OpenRoute
 */

// API Key from environment or Python file
const API_KEY =
  import.meta.env.VITE_ORS_API_KEY || '5b3ce3597851110001cf62480baf3084faec41329af28cf8afb2da04'
const BASE_URL = 'https://api.openrouteservice.org/v2'

/**
 * Récupère un itinéraire entre deux points
 * @param {Array} startCoords - Coordonnées de départ [lng, lat]
 * @param {Array} endCoords - Coordonnées d'arrivée [lng, lat]
 * @param {String} profile - Type de transport (driving-car, foot-walking, etc.)
 * @returns {Promise} - Résultat de l'API
 */
export async function getRoute(startCoords, endCoords, profile = 'driving-car') {
  try {
    const url = `${BASE_URL}/directions/${profile}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, application/geo+json, application/gpx+xml',
        Authorization: API_KEY,
      },
      params: {
        start: `${startCoords[0]},${startCoords[1]}`,
        end: `${endCoords[0]},${endCoords[1]}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Erreur lors de la récupération de l'itinéraire:", error)
    throw error
  }
}

/**
 * Recherche de lieux avec Nominatim (OpenStreetMap)
 * @param {String} query - Texte de recherche
 * @returns {Promise} - Résultat de l'API
 */
export async function searchPlaces(query) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
    )

    if (!response.ok) {
      throw new Error(`Erreur de recherche: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Erreur lors de la recherche de lieux:', error)
    throw error
  }
}
