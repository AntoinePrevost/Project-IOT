/**
 * Service for sending location data to the server
 */

// Default API configuration
const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || 'https://api-example.com/locations',
  headers: {
    'Content-Type': 'application/json',
  },
  // API key can be stored in environment variable for security
  apiKey: import.meta.env.VITE_API_KEY || '',
}

/**
 * Send location data to the server
 * @param {Object} locationData - The location data to send
 * @returns {Promise} - The fetch promise
 */
export async function sendLocationData(locationData) {
  try {
    // Add a timestamp if not provided
    const dataToSend = {
      ...locationData,
      timestamp: locationData.timestamp || new Date().toISOString(),
    }

    // Add API key to headers if available
    const headers = { ...API_CONFIG.headers }
    if (API_CONFIG.apiKey) {
      headers['Authorization'] = `Bearer ${API_CONFIG.apiKey}`
    }

    const response = await fetch(API_CONFIG.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(dataToSend),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to send location data:', error)
    throw error
  }
}

/**
 * Get historical location data from the server
 * @param {Object} params - Query parameters
 * @returns {Promise} - The fetch promise
 */
export async function getLocationHistory(params = {}) {
  try {
    // Build query string from params
    const queryParams = new URLSearchParams(params).toString()
    const url = `${API_CONFIG.baseUrl}/history?${queryParams}`

    // Add API key to headers if available
    const headers = { ...API_CONFIG.headers }
    if (API_CONFIG.apiKey) {
      headers['Authorization'] = `Bearer ${API_CONFIG.apiKey}`
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get location history:', error)
    throw error
  }
}

/**
 * Update the API configuration
 * @param {Object} newConfig - The new configuration
 */
export function updateApiConfig(newConfig) {
  Object.assign(API_CONFIG, newConfig)
}
