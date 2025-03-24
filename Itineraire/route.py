import requests
import folium
import random
from geopy.distance import geodesic

# Clé API ORS
API_KEY = "5b3ce3597851110001cf62480baf3084faec41329af28cf8afb2da04"

# Points de départ et d'arrivée
start = (2.200487, 48.713367)  # (longitude, latitude)
end = (2.262018, 48.721695)  # (longitude, latitude)

# URL ORS Directions API
url = "https://api.openrouteservice.org/v2/directions/driving-car"

# Fonction pour récupérer l'itinéraire
def get_route(start, end):
    params = {
        "api_key": API_KEY,
        "start": f"{start[0]},{start[1]}",
        "end": f"{end[0]},{end[1]}"
    }
    response = requests.get(url, params=params)
    return response.json()

# Récupération du trajet
data = get_route(start, end)

# Extraction des coordonnées de l'itinéraire
route_coords = data["features"][0]["geometry"]["coordinates"]
route_coords = [(lat, lng) for lng, lat in route_coords]  # ORS donne long,lat -> on inverse

# Création de la carte centrée sur le point de départ
map_route = folium.Map(location=[start[1], start[0]], zoom_start=15)

# Tracé de l'itinéraire
folium.PolyLine(route_coords, color="blue", weight=5, opacity=0.7).add_to(map_route)

# Ajout du point de départ
folium.Marker(location=[start[1], start[0]], popup="Départ", icon=folium.Icon(color="green")).add_to(map_route)

# Ajout du point d'arrivée
folium.Marker(location=[end[1], end[0]], popup="Arrivée", icon=folium.Icon(color="red")).add_to(map_route)

# Ajout des instructions aux waypoints
steps = data["features"][0]["properties"]["segments"][0]["steps"]

for step in steps:
    # Récupération des coordonnées du waypoint d'instruction
    waypoint_index = step["way_points"][0]  # Prendre le premier point de l'instruction
    waypoint_coords = route_coords[waypoint_index]

    # Ajout de l'instruction sur la carte
    folium.Marker(
        location=[waypoint_coords[0], waypoint_coords[1]],
        popup=step["instruction"],
        icon=folium.Icon(color="blue", icon="info-sign")
    ).add_to(map_route)

# Simulation de la position utilisateur (avec possibilité de sortie du trajet)
user_positions = []
off_route = False  # Variable pour détecter la sortie

for i, point in enumerate(route_coords):
    # Simulation de petites variations normales de l'utilisateur
    lat_variation = random.uniform(-0.0001, 0.0001)
    lng_variation = random.uniform(-0.0001, 0.0001)
    user_pos = (point[0] + lat_variation, point[1] + lng_variation)
    
    # Ajout de la position simulée
    user_positions.append(user_pos)

    # Vérification si l'utilisateur sort du trajet (ex: plus de 50m d'écart)
    if geodesic(user_pos, point).meters > 50:
        off_route = True
        break  # Arrêt de la simulation en cas de sortie

# Ajout des positions utilisateur sur la carte
for pos in user_positions:
    folium.CircleMarker(location=[pos[0], pos[1]], radius=3, color="black", fill=True, fill_color="black").add_to(map_route)

# Gestion de la sortie de l'itinéraire
if off_route:
    folium.Marker(
        location=[user_positions[-1][1], user_positions[-1][0]],
        popup="⚠️ Sortie de l'itinéraire ! Recalcul en cours...",
        icon=folium.Icon(color="red", icon="exclamation-sign")
    ).add_to(map_route)

    # Recalcul de l'itinéraire à partir de la position actuelle
    new_route = get_route(user_positions[-1], end)
    new_route_coords = new_route["features"][0]["geometry"]["coordinates"]
    new_route_coords = [(lat, lng) for lng, lat in new_route_coords]

    # Ajout du nouvel itinéraire recalculé
    folium.PolyLine(new_route_coords, color="orange", weight=5, opacity=0.7).add_to(map_route)

# Sauvegarde de la carte en fichier HTML
map_route.save("itineraire.html")
print("Carte enregistrée sous 'itineraire.html'. Ouvrez ce fichier pour voir le trajet.")
