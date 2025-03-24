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
    console.log('Début de la requête getRoute avec les paramètres:', {
      startCoords,
      endCoords,
      profile,
    })

    // Vérification des coordonnées
    if (
      !Array.isArray(startCoords) ||
      startCoords.length !== 2 ||
      !Array.isArray(endCoords) ||
      endCoords.length !== 2
    ) {
      throw new Error('Format de coordonnées invalide')
    }

    if (startCoords.some(isNaN) || endCoords.some(isNaN)) {
      throw new Error('Les coordonnées contiennent des valeurs non numériques')
    }

    // Construction de l'URL correcte pour l'API
    const url = `${BASE_URL}/directions/${profile}/geojson`

    console.log('URL de requête:', url)

    // Construction de l'objet de données pour le corps de la requête avec des coordonnées normalisées
    const requestData = {
      coordinates: [
        [parseFloat(startCoords[0]), parseFloat(startCoords[1])],
        [parseFloat(endCoords[0]), parseFloat(endCoords[1])],
      ],
    }

    console.log('Corps de la requête:', JSON.stringify(requestData))

    // Effectuer la requête POST avec le corps JSON
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json, application/geo+json',
        'Content-Type': 'application/json',
        Authorization: API_KEY,
      },
      body: JSON.stringify(requestData),
    })

    console.log('Statut de la réponse:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Texte d'erreur de l'API:", errorText)
      throw new Error(`Erreur API ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log('Réponse API reçue avec succès')

    // Validation du format de la réponse
    if (!data.features || !Array.isArray(data.features) || data.features.length === 0) {
      throw new Error("Format de réponse de l'API invalide")
    }

    return data
  } catch (error) {
    console.error("Erreur détaillée lors de la récupération de l'itinéraire:", error)
    throw error
  }
}

/**
 * Recherche de lieux avec Nominatim (OpenStreetMap)
 * @param {String} query - Texte de recherche
 * @returns {Promise} - Résultat de l'API
 */
export async function searchPlaces(query) {
  if (!query || query.length < 3) {
    console.log('Requête de recherche trop courte')
    return []
  }

  try {
    console.log('Recherche de lieux pour:', query)
    const encodedQuery = encodeURIComponent(query.trim())
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=5&addressdetails=1`

    console.log('URL de recherche:', url)

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'fr',
        'User-Agent': 'GeoLocator App',
      },
    })

    if (!response.ok) {
      console.error(`Erreur de recherche: ${response.status}`)
      throw new Error(`Erreur de recherche: ${response.status}`)
    }

    const data = await response.json()
    console.log(`${data.length} résultats trouvés pour "${query}"`)
    return data
  } catch (error) {
    console.error('Erreur lors de la recherche de lieux:', error)
    throw error
  }
}
