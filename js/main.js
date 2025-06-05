// Configuration et éléments DOM
const API_TOKEN = "30d71a74ad1c665d279168dca98378581270be4587da3ab13c51ffde8de4cbae";
const MAPBOX_TOKEN = "pk.eyJ1IjoiamVhbmJyZ2kiLCJhIjoiY21iamU2NHByMGZyZzJqcjE0dnh4dmx1YSJ9.Drkef-crT2kJHWDi0k1dow";
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
      dayButtons.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      
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

  const selectedOption = cityDropdown.options[cityDropdown.selectedIndex];
  currentCityData = {
    code: cityCode,
    name: selectedOption.textContent,
    lat: parseFloat(selectedOption.dataset.lat),
    lon: parseFloat(selectedOption.dataset.lon)
  };

  try {
    showLoadingIndicator();
    const weatherData = await getWeatherData(cityCode, selectedDays);
    renderWeatherResults(weatherData, currentCityData);
    
    if (weatherData.length > 0) {
      changeBackground(weatherData[0].weather);
    }
    
  } catch (err) {
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

  const title = document.createElement("h2");
  title.textContent = `Prévisions météo pour ${cityData.name}`;
  title.style.marginBottom = "2rem";
  title.style.textAlign = "center";
  section.appendChild(title);

  if (document.getElementById("show-coords").checked) {
    renderCoordinatesCard(cityData, weatherData, section);
  }

  const cardsContainer = document.createElement("div");
  cardsContainer.className = "weather-cards";
  section.appendChild(cardsContainer);

  weatherData.forEach((dayData, index) => {
    const card = createWeatherCard(dayData, index);
    cardsContainer.appendChild(card);
  });

  setTimeout(() => {
    animateWeatherCards();
  }, 200);

  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Nouvelle recherche";
  retryBtn.className = "reloadButton";
  retryBtn.onclick = () => {
    cleanupMap();
    location.reload();
  };
  section.appendChild(retryBtn);

  section.style.display = "block";
  document.getElementById("locationForm").style.display = "none";
}

// Affichage de la carte des coordonnées - PRÉCIPITATIONS PAR DÉFAUT
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
    <div id="weather-map" class="weather-map">
      <div class="map-loading">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;
  
  container.appendChild(coordCard);
  
  setTimeout(() => {
    const values = coordCard.querySelectorAll('.animated-value');
    values.forEach((value, index) => {
      setTimeout(() => {
        value.classList.add('updating');
        setTimeout(() => value.classList.remove('updating'), 800);
      }, index * 200);
    });
  }, 300);
  
  setTimeout(() => {
    initializeWeatherMap(cityData, weatherData);
  }, 1000);
}

// Configuration des contrôles radar
function setupRadarControls(cardElement) {
  const radarButtons = cardElement.querySelectorAll('.radar-btn');
  
  radarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      radarButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const layer = btn.getAttribute('data-layer');
      switchWeatherLayer(layer);
    });
  });
}

// Initialisation carte Mapbox BASIQUE - VERSION STABLE
function initializeWeatherMap(cityData, weatherData) {
  console.log("🗺️ Test Mapbox:", typeof mapboxgl !== 'undefined');
  console.log("🔑 Token OK:", MAPBOX_TOKEN !== "YOUR_MAPBOX_TOKEN_HERE");
  
  if (typeof mapboxgl === 'undefined') {
    console.log("❌ Mapbox manquant");
    showInteractiveMap(cityData, weatherData);
    return;
  }

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === "YOUR_MAPBOX_TOKEN_HERE") {
    console.log("❌ Token manquant");
    showInteractiveMap(cityData, weatherData);
    return;
  }

  try {
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapContainer = document.getElementById('weather-map');
    if (!mapContainer) {
      console.log("❌ Conteneur manquant");
      return;
    }
    
    mapContainer.innerHTML = '';
    console.log("✅ Création carte...");

    // Carte avec paramètres compatibles v2.15
    weatherMap = new mapboxgl.Map({
      container: 'weather-map',
      style: 'mapbox://styles/mapbox/streets-v11', // Style plus ancien et stable
      center: [cityData.lon, cityData.lat],
      zoom: 11,
      attributionControl: false
    });

    // Timeout de sécurité
    setTimeout(() => {
      if (!weatherMap || !weatherMap.loaded()) {
        console.log("⚠️ Timeout carte");
        showInteractiveMap(cityData, weatherData);
      }
    }, 10000);

    // Contrôles
    weatherMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Events
    weatherMap.on('load', () => {
      console.log("✅ Carte chargée !");
      addWeatherMarker(cityData, weatherData[0]);
    });

    weatherMap.on('error', (e) => {
      console.log("❌ Erreur détaillée:", e.error);
      showInteractiveMap(cityData, weatherData);
    });

  } catch (error) {
    console.log("❌ Exception:", error.message);
    showInteractiveMap(cityData, weatherData);
  }
}

// Carte interactive alternative
function showInteractiveMap(cityData, weatherData) {
  const mapElement = document.getElementById('weather-map');
  mapElement.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      border-radius: 15px;
      text-align: center;
      padding: 2rem;
      color: white;
      position: relative;
      overflow: hidden;
    ">
      <div style="position: relative; z-index: 2;">
        <div style="
          font-size: 4rem; 
          margin-bottom: 1rem;
        ">${getWeatherEmoji(weatherData[0].weather)}</div>
        
        <h3 style="
          font-size: 1.4rem; 
          font-weight: bold; 
          margin-bottom: 1rem;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          📍 ${cityData.name}
        </h3>
        
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
          max-width: 300px;
        ">
          <div style="
            background: rgba(255,255,255,0.2);
            padding: 1rem;
            border-radius: 10px;
            backdrop-filter: blur(10px);
          ">
            <div style="font-size: 0.8rem; opacity: 0.9;">Température</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${weatherData[0].tmax}°C</div>
          </div>
          
          <div style="
            background: rgba(255,255,255,0.2);
            padding: 1rem;
            border-radius: 10px;
            backdrop-filter: blur(10px);
          ">
            <div style="font-size: 0.8rem; opacity: 0.9;">Pluie</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${weatherData[0].probarain}%</div>
          </div>
        </div>
        
        <div style="
          background: rgba(255,255,255,0.15);
          padding: 1rem;
          border-radius: 10px;
          backdrop-filter: blur(10px);
          margin-bottom: 1rem;
        ">
          <div style="font-size: 0.9rem; margin-bottom: 0.5rem;">📍 Coordonnées</div>
          <div style="font-size: 0.8rem;">
            ${cityData.lat.toFixed(4)}°N • ${cityData.lon.toFixed(4)}°E
          </div>
        </div>
      </div>
    </div>
  `;
}

// Marqueur météo
function addWeatherMarker(cityData, dayWeather) {
  if (!weatherMap) return;

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

  const popup = new mapboxgl.Popup({ 
    offset: 25,
    closeButton: true,
    closeOnClick: false
  }).setHTML(popupContent);

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
      transition: transform 0.3s ease;
    " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
      ${getWeatherEmoji(dayWeather.weather)}
    </div>
  `;

  const marker = new mapboxgl.Marker({
    element: markerElement,
    anchor: 'bottom'
  })
  .setLngLat([cityData.lon, cityData.lat])
  .setPopup(popup)
  .addTo(weatherMap);

  setTimeout(() => {
    marker.togglePopup();
  }, 1500);
}

// Basculer entre les couches météo
function switchWeatherLayer(layerType) {
  if (!weatherMap) return;
  
  removeWeatherLayers();
  
  if (layerType === 'precipitation') {
    addPrecipitationLayer();
  }
}

// Supprimer toutes les couches météo
function removeWeatherLayers() {
  if (!weatherMap) return;
  
  try {
    if (weatherMap.getLayer('precipitation-layer')) {
      weatherMap.removeLayer('precipitation-layer');
    }
    if (weatherMap.getSource('precipitation-layer-source')) {
      weatherMap.removeSource('precipitation-layer-source');
    }
  } catch (error) {
    // Ignore silencieusement
  }
}

// Ajouter la couche de précipitations
function addPrecipitationLayer() {
  if (!weatherMap) return;
  
  const precipitationUrl = 'https://tilecache.rainviewer.com/v2/radar/nowcast/256/{z}/{x}/{y}/6/1_1.png';
  
  try {
    weatherMap.addSource('precipitation-layer-source', {
      type: 'raster',
      tiles: [precipitationUrl],
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
    
    animateLayerOpacity('precipitation-layer', 0, 0.7);
    
  } catch (error) {
    // Fallback silencieux
  }
}

// Animer l'opacité d'une couche
function animateLayerOpacity(layerId, fromOpacity, toOpacity, duration = 1000) {
  if (!weatherMap || !weatherMap.getLayer(layerId)) return;
  
  const startTime = performance.now();
  
  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    let currentOpacity = fromOpacity + (toOpacity - fromOpacity) * progress;
    currentOpacity = Math.max(0, Math.min(1, currentOpacity));
    
    try {
      weatherMap.setPaintProperty(layerId, 'raster-opacity', currentOpacity);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    } catch (error) {
      // Ignore
    }
  }
  
  requestAnimationFrame(animate);
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

// Création d'une carte météo pour un jour avec animation simple
function createWeatherCard(dayData, dayIndex) {
  const card = document.createElement("div");
  card.className = "weather-card";
  card.style.animationDelay = `${dayIndex * 0.1}s`;
  
  const dayTitle = document.createElement("h3");
  dayTitle.textContent = getDayLabel(dayIndex);
  card.appendChild(dayTitle);

  const dateDisplay = document.createElement("div");
  dateDisplay.style.cssText = `
    font-size: 0.9rem;
    color: var(--secondary-color);
    margin-bottom: 1rem;
    font-weight: 500;
    opacity: 0.8;
    text-shadow: none;
  `;
  dateDisplay.textContent = getExactDate(dayIndex);
  card.appendChild(dateDisplay);

  const infoContainer = document.createElement("div");
  infoContainer.className = "weather-info";
  
  const basicInfo = [
    `🌤️ Conditions : ${getWeatherDescription(dayData.weather)}`,
    `🌡️ Température max : ${dayData.tmax}°C`,
    `🌡️ Température min : ${dayData.tmin}°C`,
    `☔ Risque de pluie : ${dayData.probarain}%`,
    `☀️ Ensoleillement : ${formatHours(dayData.sun_hours)}`
  ];

  basicInfo.forEach(info => {
    const p = document.createElement("p");
    p.textContent = info;
    infoContainer.appendChild(p);
  });

  if (document.getElementById("show-rain").checked && dayData.rr1) {
    const rainInfo = document.createElement("p");
    rainInfo.textContent = `🌧️ Cumul de pluie : ${dayData.rr1} mm`;
    rainInfo.style.color = 'var(--primary-color)';
    rainInfo.style.fontWeight = '600';
    infoContainer.appendChild(rainInfo);
  }

  if (document.getElementById("show-wind").checked && dayData.wind10m) {
    const windInfo = document.createElement("p");
    windInfo.textContent = `💨 Vent moyen : ${dayData.wind10m} km/h`;
    windInfo.style.color = 'var(--primary-color)';
    windInfo.style.fontWeight = '600';
    infoContainer.appendChild(windInfo);
  }

  if (document.getElementById("show-wind-dir").checked && dayData.dirwind10m !== undefined) {
    const windDirInfo = document.createElement("p");
    windDirInfo.textContent = `🧭 Direction du vent : ${dayData.dirwind10m}° (${getWindDirection(dayData.dirwind10m)})`;
    windDirInfo.style.color = 'var(--primary-color)';
    windDirInfo.style.fontWeight = '600';
    infoContainer.appendChild(windDirInfo);
  }

  card.appendChild(infoContainer);
  return card;
}

// Animation d'apparition simple pour toutes les cartes
function animateWeatherCards() {
  const cards = document.querySelectorAll('.weather-card');
  
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    
    setTimeout(() => {
      card.style.transition = 'all 0.6s ease-out';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 100);
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