<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import {
  getUserPreferences,
  saveUserPreferences,
  resetUserPreferences,
} from '../services/userPreferencesService'

const router = useRouter()
const toast = useToast()
const preferences = ref(null)
const loading = ref(true)
const activeTab = ref('general')
const isModified = ref(false)
const isSaving = ref(false)

// Liste des onglets
const tabs = [
  { id: 'general', name: 'Général', icon: '⚙️' },
  { id: 'travel', name: 'Transport', icon: '🚗' },
  { id: 'profile', name: 'Profil', icon: '👤' },
  { id: 'environmental', name: 'Environnement', icon: '🌿' },
  { id: 'timings', name: 'Horaires', icon: '🕒' },
  { id: 'frequentPlaces', name: 'Lieux fréquents', icon: '📍' },
  { id: 'safety', name: 'Sécurité', icon: '🛡️' },
  { id: 'weather', name: 'Météo', icon: '☀️' },
]

// Options pour les sélecteurs
const transportModes = [
  { value: 'driving-car', label: 'Voiture' },
  { value: 'foot-walking', label: 'Marche à pied' },
  { value: 'cycling-regular', label: 'Vélo' },
]

const speedLevels = [
  { value: 'slow', label: 'Lent' },
  { value: 'average', label: 'Moyen' },
  { value: 'fast', label: 'Rapide' },
]

const fitnessLevels = [
  { value: 'low', label: 'Faible' },
  { value: 'average', label: 'Moyen' },
  { value: 'high', label: 'Élevé' },
]

const weekdays = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
]

// Charger les préférences
const loadPreferences = () => {
  loading.value = true
  try {
    preferences.value = getUserPreferences()
    isModified.value = false
  } catch (error) {
    toast.error('Erreur lors du chargement des préférences')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// Sauvegarder les préférences
const savePreferences = async () => {
  if (!preferences.value) return

  isSaving.value = true
  try {
    const success = saveUserPreferences(preferences.value)
    if (success) {
      isModified.value = false // Ceci est correct, mais vérifions que ça fonctionne bien
      toast.success('Préférences sauvegardées avec succès')
    } else {
      toast.error('Erreur lors de la sauvegarde des préférences')
    }
  } catch (error) {
    toast.error('Erreur lors de la sauvegarde des préférences')
    console.error(error)
  } finally {
    isSaving.value = false
  }
}

// Réinitialiser les préférences
const resetPreferences = () => {
  if (confirm('Êtes-vous sûr de vouloir réinitialiser toutes les préférences ?')) {
    try {
      resetUserPreferences()
      loadPreferences() // Recharger les préférences par défaut
      toast.success('Préférences réinitialisées avec succès')
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation des préférences')
      console.error(error)
    }
  }
}

// Gérer le changement d'onglet
const changeTab = (tabId) => {
  activeTab.value = tabId
}

// Ajouter un nouveau lieu fréquent
const addFrequentPlace = () => {
  if (!preferences.value) return

  preferences.value.frequentPlaces.push({
    name: 'Nouveau lieu',
    latitude: null,
    longitude: null,
  })

  isModified.value = true
}

// Supprimer un lieu fréquent
const removeFrequentPlace = (index) => {
  if (!preferences.value) return

  preferences.value.frequentPlaces.splice(index, 1)
  isModified.value = true
}

// Utiliser la position actuelle pour un lieu fréquent
const useCurrentLocationForPlace = (index) => {
  if (!navigator.geolocation) {
    toast.error("La géolocalisation n'est pas supportée par votre navigateur")
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      preferences.value.frequentPlaces[index].latitude = position.coords.latitude
      preferences.value.frequentPlaces[index].longitude = position.coords.longitude
      isModified.value = true
      toast.success('Position actuelle utilisée')
    },
    (error) => {
      toast.error("Impossible d'obtenir votre position")
      console.error(error)
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  )
}

// Observer les changements dans les préférences
const handleInputChange = () => {
  isModified.value = true
}

// Quitter sans sauvegarder
const goBack = () => {
  if (isModified.value) {
    if (confirm('Vous avez des modifications non sauvegardées. Quitter sans sauvegarder ?')) {
      router.back()
    }
  } else {
    router.back()
  }
}

onMounted(() => {
  loadPreferences()
})
</script>

<template>
  <div class="preferences-view">
    <div class="preferences-header">
      <button @click="goBack" class="back-button">
        <span class="icon">←</span>
        <span>Retour</span>
      </button>
      <h2>Préférences utilisateur</h2>
      <div class="action-buttons">
        <button @click="resetPreferences" class="reset-button" :disabled="loading || isSaving">
          Réinitialiser
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Chargement des préférences...</p>
    </div>

    <div v-else class="preferences-container">
      <!-- Onglets de navigation -->
      <div class="tabs-container">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: activeTab === tab.id }"
          @click="changeTab(tab.id)"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-name">{{ tab.name }}</span>
        </div>
      </div>

      <!-- Contenu des onglets -->
      <div class="tab-content">
        <!-- Général -->
        <div v-if="activeTab === 'general'" class="tab-pane">
          <h3>Préférences générales</h3>
          <div class="form-group">
            <label class="switch-label">
              <span>Mode sombre</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.general.darkMode"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label>Langue</label>
            <select v-model="preferences.general.language" @change="handleInputChange">
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>

          <div class="form-group">
            <label>Unités de distance</label>
            <select v-model="preferences.general.distanceUnit" @change="handleInputChange">
              <option value="km">Kilomètres</option>
              <option value="miles">Miles</option>
            </select>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Sauvegarder l'historique des trajets</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.general.saveHistory"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>
        </div>

        <!-- Transport -->
        <div v-if="activeTab === 'travel'" class="tab-pane">
          <h3>Préférences de transport</h3>
          <div class="form-group">
            <label>Mode de transport préféré</label>
            <select v-model="preferences.travel.preferredTransportMode" @change="handleInputChange">
              <option v-for="mode in transportModes" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Éviter les autoroutes</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.travel.avoidHighways"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Éviter les péages</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.travel.avoidTolls"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Privilégier les routes pittoresques</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.travel.preferScenicRoutes"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label>Distance maximale à pied (km)</label>
            <input
              type="number"
              v-model.number="preferences.travel.maxWalkingDistance"
              min="0.5"
              max="10"
              step="0.5"
              @change="handleInputChange"
            />
          </div>

          <div class="form-group">
            <label>Distance maximale à vélo (km)</label>
            <input
              type="number"
              v-model.number="preferences.travel.maxCyclingDistance"
              min="1"
              max="30"
              step="1"
              @change="handleInputChange"
            />
          </div>
        </div>

        <!-- Profil -->
        <div v-if="activeTab === 'profile'" class="tab-pane">
          <h3>Profil personnel</h3>
          <div class="form-group">
            <label>Niveau de forme physique</label>
            <select v-model="preferences.profile.fitnessLevel" @change="handleInputChange">
              <option v-for="level in fitnessLevels" :key="level.value" :value="level.value">
                {{ level.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Vitesse de marche</label>
            <select v-model="preferences.profile.walkingSpeed" @change="handleInputChange">
              <option v-for="speed in speedLevels" :key="speed.value" :value="speed.value">
                {{ speed.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Vitesse à vélo</label>
            <select v-model="preferences.profile.cyclingSpeed" @change="handleInputChange">
              <option v-for="speed in speedLevels" :key="speed.value" :value="speed.value">
                {{ speed.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Restrictions de mobilité</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.profile.mobilityRestrictions"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>
        </div>

        <!-- Environnement -->
        <div v-if="activeTab === 'environmental'" class="tab-pane">
          <h3>Préférences environnementales</h3>
          <div class="form-group">
            <label class="switch-label">
              <span>Privilégier les espaces verts</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.environmental.preferGreenSpaces"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Éviter les zones polluées</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.environmental.avoidPollutedAreas"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Privilégier les zones à faible trafic</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.environmental.preferLowTrafficAreas"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>
        </div>

        <!-- Horaires -->
        <div v-if="activeTab === 'timings'" class="tab-pane">
          <h3>Préférences d'horaires</h3>
          <div class="form-group">
            <label>Heure de départ habituelle</label>
            <input
              type="time"
              v-model="preferences.timings.preferredDepartureTime"
              @change="handleInputChange"
            />
          </div>

          <div class="form-group">
            <label>Heure de retour habituelle</label>
            <input
              type="time"
              v-model="preferences.timings.preferredReturnTime"
              @change="handleInputChange"
            />
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Éviter les heures de pointe</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.timings.avoidRushHours"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label>Jours de travail</label>
            <div class="checkbox-group">
              <label v-for="day in weekdays" :key="day.value" class="checkbox-label">
                <input
                  type="checkbox"
                  :value="day.value"
                  v-model="preferences.timings.workdays"
                  @change="handleInputChange"
                />
                <span>{{ day.label }}</span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>Temps de trajet maximum (minutes)</label>
            <input
              type="number"
              v-model.number="preferences.timings.maximumCommuteTime"
              min="5"
              max="180"
              step="5"
              @change="handleInputChange"
            />
          </div>
        </div>

        <!-- Lieux fréquents -->
        <div v-if="activeTab === 'frequentPlaces'" class="tab-pane">
          <h3>Lieux fréquents</h3>
          <p class="info-text">
            Enregistrez vos lieux fréquents pour accélérer la planification des itinéraires.
          </p>

          <div v-if="preferences.frequentPlaces.length === 0" class="empty-state">
            <p>Aucun lieu fréquent enregistré</p>
          </div>

          <div v-else class="frequent-places-list">
            <div
              v-for="(place, index) in preferences.frequentPlaces"
              :key="index"
              class="place-item"
            >
              <div class="place-details">
                <div class="form-group">
                  <label>Nom</label>
                  <input
                    type="text"
                    v-model="place.name"
                    placeholder="Ex: Maison, Travail..."
                    @change="handleInputChange"
                  />
                </div>

                <div class="coordinates">
                  <div class="form-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      v-model.number="place.latitude"
                      step="0.000001"
                      @change="handleInputChange"
                    />
                  </div>

                  <div class="form-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      v-model.number="place.longitude"
                      step="0.000001"
                      @change="handleInputChange"
                    />
                  </div>
                </div>

                <div class="place-actions">
                  <button @click="useCurrentLocationForPlace(index)" class="location-button">
                    📍 Utiliser ma position
                  </button>
                  <button @click="removeFrequentPlace(index)" class="delete-button">
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button @click="addFrequentPlace" class="add-button">+ Ajouter un lieu fréquent</button>
        </div>

        <!-- Sécurité -->
        <div v-if="activeTab === 'safety'" class="tab-pane">
          <h3>Préférences de sécurité</h3>
          <div class="form-group">
            <label class="switch-label">
              <span>Privilégier les quartiers sûrs</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.safety.preferSafeNeighborhoods"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Éviter les intersections dangereuses</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.safety.avoidDangerousIntersections"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Privilégier les zones bien éclairées</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.safety.preferWellLitAreas"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>
        </div>

        <!-- Météo -->
        <div v-if="activeTab === 'weather'" class="tab-pane">
          <h3>Préférences météorologiques</h3>
          <div class="form-group">
            <label class="switch-label">
              <span>Éviter les itinéraires sous la pluie</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.weather.avoidRainRoutes"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Privilégier les itinéraires ombragés</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.weather.preferShadedRoutes"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>

          <div class="form-group">
            <label class="switch-label">
              <span>Privilégier les itinéraires protégés du vent</span>
              <div class="toggle-switch">
                <input
                  type="checkbox"
                  v-model="preferences.weather.preferWindProtectedRoutes"
                  @change="handleInputChange"
                />
                <span class="slider"></span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="save-bar" :class="{ visible: isModified }">
      <div class="save-message">Modifications non sauvegardées</div>
      <button @click="savePreferences" class="save-button" :disabled="isSaving">
        <span v-if="isSaving" class="loading-spinner small"></span>
        <span>{{ isSaving ? 'Sauvegarde...' : 'Sauvegarder' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.preferences-view {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 60px; /* Espace pour la barre de sauvegarde */
}

.preferences-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.back-button,
.reset-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button {
  background-color: var(--secondary-color-light, #e3f2fd);
  color: var(--secondary-color, #2196f3);
}

.reset-button {
  background-color: var(--warning-light, #fff8e1);
  color: var(--warning, #ff8f00);
}

h2 {
  font-size: 1.5rem;
  margin: 0;
  color: var(--text-color);
}

h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: var(--text-color);
  border-bottom: 1px solid var(--border-color, #ddd);
  padding-bottom: 0.5rem;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
  background-color: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--primary-color, #4caf50);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.loading-spinner.small {
  width: 16px;
  height: 16px;
  border-width: 2px;
  margin-bottom: 0;
  margin-right: 0.5rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.preferences-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .preferences-container {
    flex-direction: row;
  }
}

.tabs-container {
  display: flex;
  overflow-x: auto;
  scrollbar-width: thin;
  background-color: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  padding: 0.5rem;
}

@media (min-width: 768px) {
  .tabs-container {
    flex-direction: column;
    width: 220px;
    overflow-x: visible;
    overflow-y: auto;
    padding: 1rem;
    max-height: 600px;
  }
}

.tab {
  padding: 0.75rem 1rem;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 6px;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tab.active {
  background-color: var(--primary-color-light, #e8f5e9);
  color: var(--primary-color, #4caf50);
  font-weight: 500;
}

.tab:hover:not(.active) {
  background-color: rgba(0, 0, 0, 0.05);
}

.tab-icon {
  font-size: 1.2rem;
}

.tab-content {
  flex: 1;
  background-color: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}

.tab-pane {
  max-width: 600px;
}

.form-group {
  margin-bottom: 1.25rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-color);
}

input[type='text'],
input[type='number'],
input[type='time'],
input[type='email'],
select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  font-size: 1rem;
  background-color: var(--card-background);
  color: var(--text-color);
  transition: border-color 0.2s;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--primary-color, #4caf50);
}

/* Interrupteurs toggle */
.switch-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary-color, #4caf50);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--primary-color, #4caf50);
}

input:checked + .slider:before {
  transform: translateX(24px);
}

/* Groupe de cases à cocher */
.checkbox-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
  cursor: pointer;
}

.checkbox-label:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Lieux fréquents */
.empty-state {
  text-align: center;
  padding: 2rem;
  background-color: var(--card-background);
  border-radius: 8px;
  border: 1px dashed var(--border-color, #ddd);
  color: var(--text-secondary, #666);
}

.place-item {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.02);
  border: 1px solid var(--border-color, #ddd);
}

.coordinates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.place-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.location-button,
.delete-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.location-button {
  background-color: var(--secondary-color-light, #e3f2fd);
  color: var(--secondary-color, #2196f3);
}

.delete-button {
  background-color: var(--error-light, #ffebee);
  color: var(--error, #f44336);
}

.add-button {
  display: block;
  width: 100%;
  padding: 0.75rem;
  background-color: var(--primary-color-light, #e8f5e9);
  color: var(--primary-color, #4caf50);
  border: 1px dashed var(--primary-color, #4caf50);
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  text-align: center;
}

.add-button:hover {
  background-color: var(--primary-color-light, #c8e6c9);
}

/* Barre de sauvegarde */
.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--card-background);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transform: translateY(100%);
  transition: transform 0.3s;
  z-index: 100;
}

.save-bar.visible {
  transform: translateY(0);
}

.save-message {
  font-weight: 500;
  color: var(--warning, #ff8f00);
}

.save-button {
  background-color: var(--primary-color, #4caf50);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.save-button:hover:not(:disabled) {
  background-color: var(--primary-color-dark, #388e3c);
}

.save-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Texte d'info */
.info-text {
  margin-bottom: 1rem;
  color: var(--text-secondary, #666);
  font-size: 0.9rem;
}

@media (max-width: 600px) {
  .preferences-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .action-buttons {
    align-self: flex-end;
  }

  .place-actions {
    flex-direction: column;
  }

  .coordinates {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}
</style>
