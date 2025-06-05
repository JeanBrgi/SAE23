// Configuration et éléments DOM
const API_TOKEN = "30d71a74ad1c665d279168dca98378581270be4587da3ab13c51ffde8de4cbae";
const MAPBOX_TOKEN = "pk.eyJ1IjoiamVhbmJyZ2kiLCJhIjoiY21iajY4ZXl1MGNseDJrcW5hZXp2M25lZyJ9.dpIjsW_tSsd9Spy7OzOeFg";
const OPENWEATHER_API_KEY = "1866e365d13f50c5a36c079b8219f505";
const postalInput = document.getElementById("postal-input");
const cityDropdown = document.getElementById("cityDropdown");
const submitBtn = document.getElementById("submitBtn");
const daysSelector = document.getElementById("days-selector");
const darkModeToggle = document.getElementById("darkModeToggle");

// Variables globales
let selectedDays = 1;
let selectedCity = null;
let currentCityData = null;
let weatherMap = null;

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  initializeDarkMode();
  initializeDaysSelector();
  initializeEventListeners();
});

// Gestion du mode sombre
function initializeDarkMode() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateDarkModeIcon(savedTheme);
}

function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateDarkModeIcon(newTheme);
}

function updateDarkModeIcon(theme) {
  const icon = darkModeToggle.querySelector(".material-icons");
  icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
}

// Gestion du sélecteur de jours
function initializeDaysSelector() {
  const dayButtons = document.querySelectorAll(".day-btn");
  
  dayButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // Désactiver tous les boutons
      dayButtons.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      
      // Activer le bouton sélectionné
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      selectedDays = parseInt(btn.getAttribute("data-days"));
    });
  });
}

// Initialisation des écouteurs d'événements
function initializeEventListeners() {
  darkModeToggle.addEventListener("click", toggleDarkMode);
  
  postalInput.addEventListener("input", handlePostalInput);
  submitBtn.addEventListener("click", handleSubmit);
}

// Gestion de la saisie du code postal
async function handlePostalInput() {
  const zip = postalInput.value;
  if (/^\d{5}$/.test(zip)) {
    const cities = await getCitiesFromZip(zip);
    populateCityOptions(cities);
  } else {
    cityDropdown.style.display = "none";
    submitBtn.style.display = "none";
  }
}

// Récupération des villes par code postal
async function getCitiesFromZip(zip) {
  try {
    const res = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${zip}&fields=nom,code,centre,codesPostaux`);
    const cities = await res.json();
    return cities;
  } catch (err) {
    console.error("Erreur API Geo :", err);
    return [];
  }
}

// Remplissage du dropdown des villes
function populateCityOptions(cities) {
  cityDropdown.innerHTML = "";
  if (cities.length > 0) {
    cities.forEach(city => {
      const opt = document.createElement("option");
      opt.value = city.code;
      opt.textContent = city.nom;
      opt.dataset.lat = city.centre?.coordinates[1] || "";
      opt.dataset.lon = city.centre?.coordinates[0] || "";
      cityDropdown.appendChild(opt);
    });
    cityDropdown.style.display = "block";
    submitBtn.style.display = "inline-block";
  } else {
    alert("Aucune commune trouvée pour ce code postal.");
    cityDropdown.style.display = "none";
    submitBtn.style.display = "none";
  }
}

// Gestion de la soumission du formulaire
async function handleSubmit() {
  const cityCode = cityDropdown.value;
  if (!cityCode) return;

  // Récupération des informations de la ville sélectionnée
  const selectedOption = cityDropdown.options[cityDropdown.selectedIndex];
  currentCityData = {
    code: cityCode,
    name: selectedOption.textContent,
    lat: parseFloat(selectedOption.dataset.lat),
    lon: parseFloat(selectedOption.dataset.lon)
  };

  try {
    // Affichage d'un indicateur de chargement
    showLoadingIndicator();
    
    // Récupération des données météo pour tous les jours sélectionnés
    const weatherData = await getWeatherData(cityCode, selectedDays);
    
    // Affichage des résultats
    renderWeatherResults(weatherData, currentCityData);
    
    // Changement du background selon la météo du premier jour
    if (weatherData.length > 0) {
      changeBackground(weatherData[0].weather);
    }
    
  } catch (err) {
    console.error("Erreur lors de la récupération des données météo :", err);
    alert("Erreur lors de la récupération des données météo. Veuillez réessayer.");
  } finally {
    hideLoadingIndicator();
  }
}

// Récupération des données météo
async function getWeatherData(cityCode, days) {
  const weatherPromises = [];
  
  for (let i = 0; i < days; i++) {
    const promise = fetch(
      `https://api.meteo-concept.com/api/forecast/daily/${i}?token=${API_TOKEN}&insee=${cityCode}`
    ).then(res => res.json());
    weatherPromises.push(promise);
  }
  
  const results = await Promise.all(weatherPromises);
  return results.map(result => result.forecast);
}

// Affichage des résultats météo
function renderWeatherResults(weatherData, cityData) {
  const section = document.getElementById("weatherResult");
  section.innerHTML = "";

  // Titre
  const title = document.createElement("h2");
  title.textContent = `Prévisions météo pour ${cityData.name}`;
  title.style.marginBottom = "2rem";
  title.style.textAlign = "center";
  section.appendChild(title);

  // Affichage des coordonnées si demandé
  if (document.getElementById("show-coords").checked) {
    renderCoordinatesCard(cityData, weatherData, section);
  }

  // Conteneur pour les cartes météo
  const cardsContainer = document.createElement("div");
  cardsContainer.className = "weather-cards";
  section.appendChild(cardsContainer);

  // Création des cartes pour chaque jour
  weatherData.forEach((dayData, index) => {
    const card = createWeatherCard(dayData, index);
    cardsContainer.appendChild(card);
  });

  // Déclencher les animations en cascade après un délai
  setTimeout(() => {
    animateWeatherCards();
  }, 200);

  // Bouton de nouvelle recherche
  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Nouvelle recherche";
  retryBtn.className = "reloadButton";
  retryBtn.onclick = () => {
    cleanupMap();
    location.reload();
  };
  section.appendChild(retryBtn);

  // Affichage de la section et masquage du formulaire
  section.style.display = "block";
  document.getElementById("locationForm").style.display = "none";
}

// Affichage de la carte des coordonnées avec Mapbox
function renderCoordinatesCard(cityData, weatherData, container) {
  const coordCard = document.createElement("div");
  coordCard.className = "coordinates-card";
  
  coordCard.innerHTML = `
    <h3>📍 ${cityData.name}</h3>
    <div class="coord-display">
      <div class="coord-item">
        <div class="coord-label">Latitude</div>
        <div class="coord-value animated-value">${cityData.lat.toFixed(4)}°</div>
      </div>
      <div class="coord-item">
        <div class="coord-label">Longitude</div>
        <div class="coord-value animated-value">${cityData.lon.toFixed(4)}°</div>
      </div>
    </div>
    <div class="radar-controls">
      <button class="radar-btn active" data-layer="none">🗺️ Carte</button>
      <button class="radar-btn" data-layer="precipitation">🌧️ Précipitations</button>
      <button class="radar-btn" data-layer="clouds">☁️ Nuages</button>
      <button class="radar-btn" data-layer="temperature">🌡️ Température</button>
      <button class="radar-btn" data-layer="pressure">🌪️ Pression</button>
      <button class="radar-btn" data-layer="wind">💨 Vent</button>
    </div>
    <div id="weather-map" class="weather-map">
      <div class="map-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>
    <div class="map-info">
      📍 Naviguez dans la carte • 🌧️ Précipitations • ☁️ Nuages • 🌡️ Température • 🌪️ Pression • 💨 Vent • 🔄 Données temps réel
    </div>
  `;
  
  container.appendChild(coordCard);
  
  // Animer l'apparition des coordonnées
  setTimeout(() => {
    const values = coordCard.querySelectorAll('.animated-value');
    values.forEach((value, index) => {
      setTimeout(() => {
        value.classList.add('updating');
        setTimeout(() => value.classList.remove('updating'), 800);
      }, index * 200);
    });
  }, 300);
  
  // Ajouter les event listeners pour les boutons radar
  setupRadarControls(coordCard);
  
  // Initialiser la carte après que l'élément soit dans le DOM
  setTimeout(() => {
    initializeWeatherMap(cityData, weatherData);
  }, 500);
}

// Configuration des contrôles radar
function setupRadarControls(cardElement) {
  const radarButtons = cardElement.querySelectorAll('.radar-btn');
  
  radarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Retirer l'état actif de tous les boutons
      radarButtons.forEach(b => b.classList.remove('active'));
      // Activer le bouton cliqué
      btn.classList.add('active');
      
      const layer = btn.getAttribute('data-layer');
      switchWeatherLayer(layer);
    });
  });
}

// Basculer entre les couches météo
function switchWeatherLayer(layerType) {
  if (!weatherMap) return;
  
  // Supprimer les couches météo existantes
  removeWeatherLayers();
  
  // Ajouter la nouvelle couche selon le type
  switch(layerType) {
    case 'precipitation':
      addPrecipitationLayer();
      break;
    case 'clouds':
      addCloudsLayer();
      break;
    case 'temperature':
      addTemperatureLayer();
      break;
    case 'pressure':
      addPressureLayer();
      break;
    case 'wind':
      addWindLayer();
      break;
    case 'none':
    default:
      // Juste la carte de base, rien à ajouter
      showLayerMessage('🗺️ Vue carte normale');
      break;
  }
}

// Supprimer toutes les couches météo
function removeWeatherLayers() {
  if (!weatherMap) return;
  
  const layersToRemove = [
    'precipitation-layer', 
    'clouds-layer', 
    'temperature-layer',
    'pressure-layer',
    'wind-layer'
  ];
  
  layersToRemove.forEach(layerId => {
    if (weatherMap.getLayer(layerId)) {
      weatherMap.removeLayer(layerId);
    }
    if (weatherMap.getSource(layerId + '-source')) {
      weatherMap.removeSource(layerId + '-source');
    }
  });
}

// Ajouter la couche de précipitations (RainViewer API)
function addPrecipitationLayer() {
  if (!weatherMap) return;
  
  // API RainViewer pour les données radar gratuites
  const precipitationUrl = 'https://tilecache.rainviewer.com/v2/radar/{time}/256/{z}/{x}/{y}/6/1_1.png';
  
  // Obtenir l'heure actuelle pour les données radar
  fetch('https://api.rainviewer.com/public/weather-maps.json')
    .then(response => response.json())
    .then(data => {
      if (data.radar && data.radar.past && data.radar.past.length > 0) {
        const latestTime = data.radar.past[data.radar.past.length - 1].time;
        const urlWithTime = precipitationUrl.replace('{time}', latestTime);
        
        weatherMap.addSource('precipitation-layer-source', {
          type: 'raster',
          tiles: [urlWithTime],
          tileSize: 256,
          attribution: '© RainViewer'
        });
        
        weatherMap.addLayer({
          id: 'precipitation-layer',
          type: 'raster',
          source: 'precipitation-layer-source',
          paint: {
            'raster-opacity': 0.7
          }
        });
        
        // Animation d'apparition
        animateLayerOpacity('precipitation-layer', 0, 0.7);
      }
    })
    .catch(error => {
      console.log('Données radar non disponibles:', error);
      showLayerMessage('🌧️ Données radar temporairement indisponibles');
    });
}

// Ajouter la couche de nuages (OpenWeatherMap)
function addCloudsLayer() {
  if (!weatherMap) return;
  
  const cloudsUrl = `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
  
  try {
    weatherMap.addSource('clouds-layer-source', {
      type: 'raster',
      tiles: [cloudsUrl],
      tileSize: 256,
      attribution: '© OpenWeatherMap'
    });
    
    weatherMap.addLayer({
      id: 'clouds-layer',
      type: 'raster',
      source: 'clouds-layer-source',
      paint: {
        'raster-opacity': 0.6
      }
    });
    
    // Animation d'apparition
    animateLayerOpacity('clouds-layer', 0, 0.6);
    showLayerMessage('☁️ Couche nuages activée');
    
  } catch (error) {
    console.error('Erreur couche nuages:', error);
    showLayerMessage('☁️ Erreur lors du chargement des nuages');
  }
}

// Ajouter la couche de température
function addTemperatureLayer() {
  if (!weatherMap) return;
  
  const temperatureUrl = `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
  
  try {
    weatherMap.addSource('temperature-layer-source', {
      type: 'raster',
      tiles: [temperatureUrl],
      tileSize: 256,
      attribution: '© OpenWeatherMap'
    });
    
    weatherMap.addLayer({
      id: 'temperature-layer',
      type: 'raster',
      source: 'temperature-layer-source',
      paint: {
        'raster-opacity': 0.7
      }
    });
    
    // Animation d'apparition
    animateLayerOpacity('temperature-layer', 0, 0.7);
    showLayerMessage('🌡️ Couche température activée');
    
  } catch (error) {
    console.error('Erreur couche température:', error);
    showLayerMessage('🌡️ Erreur lors du chargement des températures');
  }
}

// Animer l'opacité d'une couche
function animateLayerOpacity(layerId, fromOpacity, toOpacity, duration = 1000) {
  if (!weatherMap || !weatherMap.getLayer(layerId)) return;
  
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const currentOpacity = fromOpacity + (toOpacity - fromOpacity) * progress;
    
    weatherMap.setPaintProperty(layerId, 'raster-opacity', currentOpacity);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  requestAnimationFrame(animate);
}

// Afficher un message sur la carte
function showLayerMessage(message) {
  const mapElement = document.getElementById('weather-map');
  
  // Créer une notification temporaire
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(34, 197, 94, 0.9);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.85rem;
    z-index: 1000;
    animation: slideInUp 0.3s ease-out;
    backdrop-filter: blur(10px);
  `;
  notification.textContent = message;
  
  mapElement.style.position = 'relative';
  mapElement.appendChild(notification);
  
  // Supprimer après 3 secondes
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideInUp 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 3000);
}

// Initialisation de la carte Mapbox
function initializeWeatherMap(cityData, weatherData) {
  // Vérifier si Mapbox est disponible
  if (typeof mapboxgl === 'undefined') {
    console.error("Mapbox GL JS n'est pas chargé");
    showFallbackMap(cityData, weatherData);
    return;
  }

  // Définir le token (vérifier qu'il n'est pas vide)
  if (MAPBOX_TOKEN === "YOUR_MAPBOX_TOKEN_HERE") {
    console.warn("⚠️ Token Mapbox non configuré.");
    showFallbackMap(cityData, weatherData);
    return;
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;

  // Supprimer le loading spinner
  const mapContainer = document.getElementById('weather-map');
  mapContainer.innerHTML = '';

  // Créer la carte avec style amélioré
  weatherMap = new mapboxgl.Map({
    container: 'weather-map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [cityData.lon, cityData.lat],
    zoom: 11,
    projection: 'mercator',
    attributionControl: false
  });

  // Ajouter les contrôles de navigation avec style personnalisé
  weatherMap.addControl(new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: true
  }), 'top-right');

  // Ajouter un contrôle d'attribution compact
  weatherMap.addControl(new mapboxgl.AttributionControl({
    compact: true
  }), 'bottom-right');

  // Évènements de la carte
  weatherMap.on('load', () => {
    addWeatherMarkerWithAnimation(cityData, weatherData[0]);
    
    // Effet de zoom fluide à l'initialisation
    setTimeout(() => {
      weatherMap.flyTo({
        center: [cityData.lon, cityData.lat],
        zoom: 12,
        duration: 2000,
        essential: true
      });
    }, 500);
  });

  // Gestion d'erreur
  weatherMap.on('error', (e) => {
    console.error('Erreur carte Mapbox:', e);
    showFallbackMap(cityData, weatherData);
  });
}

// Fallback amélioré avec animations
function showFallbackMap(cityData, weatherData) {
  const mapElement = document.getElementById('weather-map');
  mapElement.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(34, 197, 94, 0.2));
      border: 2px dashed rgba(255, 255, 255, 0.3);
      border-radius: 15px;
      text-align: center;
      padding: 2rem;
      animation: slideInUp 0.6s ease-out;
    ">
      <div style="
        font-size: 3rem; 
        margin-bottom: 1rem;
        animation: pulseGlow 2s infinite;
      ">🗺️</div>
      <div style="
        font-size: 1.1rem; 
        font-weight: bold; 
        margin-bottom: 0.5rem;
        text-shadow: none;
      ">
        Carte météo interactive
      </div>
      <div style="
        font-size: 0.9rem; 
        opacity: 0.8; 
        margin-bottom: 1rem;
        text-shadow: none;
      ">
        📍 ${cityData.name}
      </div>
      <div style="
        font-size: 0.8rem; 
        opacity: 0.7;
        text-shadow: none;
        margin-bottom: 1rem;
      ">
        🌡️ ${weatherData[0].tmax}°C • ☔ ${weatherData[0].probarain}% • 🌤️ ${getWeatherDescription(weatherData[0].weather)}
      </div>
      <div style="
        font-size: 0.7rem; 
        opacity: 0.6; 
        margin-top: 1rem;
        text-shadow: none;
      ">
        📝 Configurez votre token Mapbox pour voir la carte interactive avec radar météo
      </div>
    </div>
  `;
}

// Ajouter un marqueur météo avec animation
function addWeatherMarkerWithAnimation(cityData, dayWeather) {
  if (!weatherMap) return;

  // Créer le contenu du popup avec style amélioré
  const popupContent = `
    <div style="
      padding: 1rem; 
      text-align: center; 
      background: linear-gradient(135deg, #f8fafc, #e2e8f0);
      border-radius: 10px;
      min-width: 200px;
    ">
      <h4 style="
        margin: 0 0 1rem 0; 
        color: #059669;
        font-size: 1.1rem;
        border-bottom: 2px solid #059669;
        padding-bottom: 0.5rem;
      ">${cityData.name}</h4>
      
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.8rem;
        margin-bottom: 1rem;
      ">
        <div style="
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: white;
          padding: 0.5rem;
          border-radius: 8px;
          font-size: 0.85rem;
        ">
          🌡️ Min<br><strong>${dayWeather.tmin}°C</strong>
        </div>
        <div style="
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          padding: 0.5rem;
          border-radius: 8px;
          font-size: 0.85rem;
        ">
          🌡️ Max<br><strong>${dayWeather.tmax}°C</strong>
        </div>
      </div>
      
      <div style="
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
        padding: 0.5rem;
        border-radius: 8px;
        margin-bottom: 0.5rem;
        font-size: 0.85rem;
      ">
        ☔ <strong>${dayWeather.probarain}%</strong> de pluie
      </div>
      
      <div style="
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
        padding: 0.5rem;
        border-radius: 8px;
        font-size: 0.85rem;
      ">
        🌤️ <strong>${getWeatherDescription(dayWeather.weather)}</strong>
      </div>
    </div>
  `;

  // Créer le popup avec style personnalisé
  const popup = new mapboxgl.Popup({ 
    offset: 25,
    closeButton: true,
    closeOnClick: false,
    className: 'weather-popup'
  }).setHTML(popupContent);

  // Créer un élément de marqueur personnalisé avec animation
  const markerElement = document.createElement('div');
  markerElement.innerHTML = `
    <div style="
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
      cursor: pointer;
      animation: pulseGlow 2s infinite;
      transition: transform 0.3s ease;
    " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
      ${getWeatherEmoji(dayWeather.weather)}
    </div>
  `;

  // Créer le marqueur avec l'élément personnalisé
  const marker = new mapboxgl.Marker({
    element: markerElement,
    anchor: 'bottom'
  })
  .setLngLat([cityData.lon, cityData.lat])
  .setPopup(popup)
  .addTo(weatherMap);

  // Animation d'apparition du marqueur
  setTimeout(() => {
    markerElement.style.animation = 'slideInUp 0.8s ease-out, pulseGlow 2s infinite 0.8s';
  }, 100);

  // Ouvrir le popup automatiquement avec délai
  setTimeout(() => {
    marker.togglePopup();
  }, 1500);
}

// Obtenir l'emoji météo correspondant
function getWeatherEmoji(weatherCode) {
  if (weatherCode === 0) return '☀️';
  if ([1, 2].includes(weatherCode)) return '⛅';
  if ([3, 4, 5].includes(weatherCode)) return '☁️';
  if ([6, 7].includes(weatherCode)) return '🌫️';
  if ((weatherCode >= 10 && weatherCode <= 16) || (weatherCode >= 40 && weatherCode <= 48)) return '🌧️';
  if ((weatherCode >= 20 && weatherCode <= 22) || (weatherCode >= 30 && weatherCode <= 32) || (weatherCode >= 60 && weatherCode <= 78)) return '❄️';
  if (weatherCode >= 100 && weatherCode <= 142) return '⛈️';
  if (weatherCode === 235) return '🧊';
  return '🌤️';
}

// Création d'une carte météo pour un jour avec animations
function createWeatherCard(dayData, dayIndex) {
  const card = document.createElement("div");
  card.className = "weather-card";
  
  // Délai d'animation échelonné
  card.style.animationDelay = `${dayIndex * 0.1}s`;
  
  // Titre du jour avec animation
  const dayTitle = document.createElement("h3");
  dayTitle.textContent = getDayLabel(dayIndex);
  dayTitle.style.opacity = '0';
  dayTitle.style.transform = 'translateY(-10px)';
  dayTitle.style.transition = 'all 0.6s ease-out';
  card.appendChild(dayTitle);

  // Date exacte avec animation
  const dateDisplay = document.createElement("div");
  dateDisplay.style.cssText = `
    font-size: 0.9rem;
    color: var(--secondary-color);
    margin-bottom: 1rem;
    font-weight: 500;
    opacity: 0;
    text-shadow: none;
    transform: translateY(-10px);
    transition: all 0.6s ease-out 0.2s;
  `;
  dateDisplay.textContent = getExactDate(dayIndex);
  card.appendChild(dateDisplay);

  // Conteneur des informations avec animation
  const infoContainer = document.createElement("div");
  infoContainer.className = "weather-info";
  infoContainer.style.opacity = '0';
  infoContainer.style.transform = 'translateY(20px)';
  infoContainer.style.transition = 'all 0.8s ease-out 0.4s';
  
  // Informations de base dans le nouvel ordre avec animations individuelles
  const basicInfo = [
    `🌤️ Conditions : ${getWeatherDescription(dayData.weather)}`,
    `🌡️ Température max : ${dayData.tmax}°C`,
    `🌡️ Température min : ${dayData.tmin}°C`,
    `☔ Risque de pluie : ${dayData.probarain}%`,
    `☀️ Ensoleillement : ${formatHours(dayData.sun_hours)}`
  ];

  basicInfo.forEach((info, index) => {
    const p = document.createElement("p");
    p.textContent = info;
    p.className = 'animated-value';
    p.style.opacity = '0';
    p.style.transform = 'translateX(-20px)';
    p.style.transition = `all 0.5s ease-out ${0.6 + index * 0.1}s`;
    infoContainer.appendChild(p);
  });

  // Informations supplémentaires selon les cases cochées avec animations
  let additionalIndex = basicInfo.length;

  if (document.getElementById("show-rain").checked && dayData.rr1) {
    const rainInfo = document.createElement("p");
    rainInfo.textContent = `🌧️ Cumul de pluie : ${dayData.rr1} mm`;
    rainInfo.className = 'animated-value additional-info';
    rainInfo.style.opacity = '0';
    rainInfo.style.transform = 'translateX(-20px)';
    rainInfo.style.transition = `all 0.5s ease-out ${0.6 + additionalIndex * 0.1}s`;
    rainInfo.style.color = 'var(--primary-color)';
    rainInfo.style.fontWeight = '600';
    infoContainer.appendChild(rainInfo);
    additionalIndex++;
  }

  if (document.getElementById("show-wind").checked && dayData.wind10m) {
    const windInfo = document.createElement("p");
    windInfo.textContent = `💨 Vent moyen : ${dayData.wind10m} km/h`;
    windInfo.className = 'animated-value additional-info';
    windInfo.style.opacity = '0';
    windInfo.style.transform = 'translateX(-20px)';
    windInfo.style.transition = `all 0.5s ease-out ${0.6 + additionalIndex * 0.1}s`;
    windInfo.style.color = 'var(--primary-color)';
    windInfo.style.fontWeight = '600';
    infoContainer.appendChild(windInfo);
    additionalIndex++;
  }

  if (document.getElementById("show-wind-dir").checked && dayData.dirwind10m !== undefined) {
    const windDirInfo = document.createElement("p");
    windDirInfo.textContent = `🧭 Direction du vent : ${dayData.dirwind10m}° (${getWindDirection(dayData.dirwind10m)})`;
    windDirInfo.className = 'animated-value additional-info';
    windDirInfo.style.opacity = '0';
    windDirInfo.style.transform = 'translateX(-20px)';
    windDirInfo.style.transition = `all 0.5s ease-out ${0.6 + additionalIndex * 0.1}s`;
    windDirInfo.style.color = 'var(--primary-color)';
    windDirInfo.style.fontWeight = '600';
    infoContainer.appendChild(windDirInfo);
  }

  card.appendChild(infoContainer);

  // Déclencher les animations après l'ajout au DOM
  setTimeout(() => {
    triggerCardAnimations(card);
  }, 100);

  return card;
}

// Déclencher les animations de la carte
function triggerCardAnimations(card) {
  const title = card.querySelector('h3');
  const date = card.querySelector('div');
  const infoContainer = card.querySelector('.weather-info');
  const animatedValues = card.querySelectorAll('.animated-value');

  // Animer le titre
  if (title) {
    title.style.opacity = '1';
    title.style.transform = 'translateY(0)';
  }

  // Animer la date
  if (date) {
    setTimeout(() => {
      date.style.opacity = '0.8';
      date.style.transform = 'translateY(0)';
    }, 200);
  }

  // Animer le conteneur d'infos
  if (infoContainer) {
    setTimeout(() => {
      infoContainer.style.opacity = '1';
      infoContainer.style.transform = 'translateY(0)';
    }, 400);
  }

  // Animer chaque valeur individuellement
  animatedValues.forEach((value, index) => {
    setTimeout(() => {
      value.style.opacity = '1';
      value.style.transform = 'translateX(0)';
      
      // Effet de surbrillance pour les infos supplémentaires
      if (value.classList.contains('additional-info')) {
        setTimeout(() => {
          value.style.background = 'rgba(34, 197, 94, 0.1)';
          value.style.padding = '0.3rem 0.5rem';
          value.style.borderRadius = '8px';
          value.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        }, 200);
      }
    }, 600 + index * 100);
  });
}

// Ajouter la couche de pression
function addPressureLayer() {
  if (!weatherMap) return;
  
  const pressureUrl = `https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
  
  try {
    weatherMap.addSource('pressure-layer-source', {
      type: 'raster',
      tiles: [pressureUrl],
      tileSize: 256,
      attribution: '© OpenWeatherMap'
    });
    
    weatherMap.addLayer({
      id: 'pressure-layer',
      type: 'raster',
      source: 'pressure-layer-source',
      paint: {
        'raster-opacity': 0.5
      }
    });
    
    // Animation d'apparition
    animateLayerOpacity('pressure-layer', 0, 0.5);
    showLayerMessage('🌪️ Couche pression atmosphérique activée');
    
  } catch (error) {
    console.error('Erreur couche pression:', error);
    showLayerMessage('🌪️ Erreur lors du chargement de la pression');
  }
}

// Ajouter la couche de vent
function addWindLayer() {
  if (!weatherMap) return;
  
  const windUrl = `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
  
  try {
    weatherMap.addSource('wind-layer-source', {
      type: 'raster',
      tiles: [windUrl],
      tileSize: 256,
      attribution: '© OpenWeatherMap'
    });
    
    weatherMap.addLayer({
      id: 'wind-layer',
      type: 'raster',
      source: 'wind-layer-source',
      paint: {
        'raster-opacity': 0.6
      }
    });
    
    // Animation d'apparition
    animateLayerOpacity('wind-layer', 0, 0.6);
    showLayerMessages('💨 Couche vent activée - Flèches = direction et intensité');
    
  } catch (error) {
    console.error('Erreur couche vent:', error);
    showLayerMessage('💨 Erreur lors du chargement du vent');
  }
}
  if (!element) return;
  
  element.classList.add('updating');
  element.style.transform = 'scale(1.1)';
  element.style.color = 'var(--primary-color)';
  
  setTimeout(() => {
    element.textContent = newValue;
    element.style.transform = 'scale(1)';
    element.style.color = '';
    element.classList.remove('updating');
  }, 400);


// Animation d'apparition en cascade pour toutes les cartes
function animateWeatherCards() {
  const cards = document.querySelectorAll('.weather-card');
  
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(50px) scale(0.9)';
    
    setTimeout(() => {
      card.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0) scale(1)';
      
      // Effet de rebond
      setTimeout(() => {
        card.style.transform = 'translateY(-5px) scale(1.02)';
        setTimeout(() => {
          card.style.transform = 'translateY(0) scale(1)';
        }, 150);
      }, 400);
      
    }, index * 150);
  });
}




// Fonctions utilitaires
function getDayLabel(dayIndex) {
  const labels = [
    "Aujourd'hui",
    "Demain",
    "Après-demain",
    "Dans 3 jours",
    "Dans 4 jours",
    "Dans 5 jours",
    "Dans 6 jours"
  ];
  return labels[dayIndex] || `Dans ${dayIndex} jours`;
}

function getExactDate(dayIndex) {
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + dayIndex);
  
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  return targetDate.toLocaleDateString('fr-FR', options);
}

function formatHours(hours) {
  return `${hours} ${hours > 1 ? "heures" : "heure"}`;
}

function getWeatherDescription(code) {
  const descriptions = {
    0: "Soleil",
    1: "Peu nuageux",
    2: "Peu nuageux",
    3: "Nuageux",
    4: "Nuageux",
    5: "Nuageux",
    6: "Brouillard",
    7: "Brouillard"
  };
  
  if (descriptions[code]) return descriptions[code];
  if (code >= 10 && code <= 16) return "Pluie";
  if (code >= 20 && code <= 22) return "Neige";
  if (code >= 30 && code <= 32) return "Neige";
  if (code >= 40 && code <= 48) return "Pluie";
  if (code >= 60 && code <= 78) return "Neige";
  if (code >= 100 && code <= 142) return "Orage";
  if (code >= 210 && code <= 232) return "Pluie/Neige";
  if (code === 235) return "Grêle";
  
  return "Conditions variables";
}

function getWindDirection(degrees) {
  const directions = [
    "Nord", "Nord-Nord-Est", "Nord-Est", "Est-Nord-Est",
    "Est", "Est-Sud-Est", "Sud-Est", "Sud-Sud-Est",
    "Sud", "Sud-Sud-Ouest", "Sud-Ouest", "Ouest-Sud-Ouest",
    "Ouest", "Ouest-Nord-Ouest", "Nord-Ouest", "Nord-Nord-Ouest"
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function changeBackground(code) {
  const body = document.body;
  let background = "";

  if (code === 0) {
    background = "url('images/soleil.jpg')";
  } else if ([1, 2].includes(code)) {
    background = "url('images/peu-nuageux.jpg')";
  } else if ([3, 4, 5].includes(code)) {
    background = "url('images/nuageux.jpg')";
  } else if ([6, 7].includes(code)) {
    background = "url('images/brouillard.jpg')";
  } else if (
    (code >= 10 && code <= 16) || 
    (code >= 40 && code <= 48) || 
    (code >= 210 && code <= 212)  
  ) {
    background = "url('images/pluie.jpg')";
  } else if (
    (code >= 20 && code <= 22) ||
    (code >= 30 && code <= 32) ||
    (code >= 60 && code <= 68) ||
    (code >= 70 && code <= 78) ||
    (code >= 220 && code <= 222) ||
    (code >= 230 && code <= 232)
  ) {
    background = "url('images/neige.jpg')";
  } else if (
    (code >= 100 && code <= 108) ||
    (code >= 120 && code <= 138) ||
    [140, 141, 142].includes(code)
  ) {
    background = "url('images/orage.jpg')";
  } else if (code === 235) {
    background = "url('images/grele.jpg')";
  } else {
    background = "url('images/defaut.jpg')";
  }

  body.style.backgroundImage = background;
}

function showLoadingIndicator() {
  submitBtn.textContent = "Chargement...";
  submitBtn.disabled = true;
}

function hideLoadingIndicator() {
  submitBtn.textContent = "Obtenir les prévisions";
  submitBtn.disabled = false;
}

// Nettoyer la carte lors d'une nouvelle recherche
function cleanupMap() {
  if (weatherMap) {
    weatherMap.remove();
    weatherMap = null;
  }
}