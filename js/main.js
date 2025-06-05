// Configuration et éléments DOM
const API_TOKEN = "30d71a74ad1c665d279168dca98378581270be4587da3ab13c51ffde8de4cbae";
const postalInput = document.getElementById("postal-input");
const cityDropdown = document.getElementById("cityDropdown");
const submitBtn = document.getElementById("submitBtn");
const daysSelector = document.getElementById("days-selector");
const darkModeToggle = document.getElementById("darkModeToggle");

// Variables globales
let selectedDays = 1;
let selectedCity = null;
let currentCityData = null;

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
    renderCoordinatesCard(cityData, section);
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

  // Bouton de nouvelle recherche
  const retryBtn = document.createElement("button");
  retryBtn.textContent = "Nouvelle recherche";
  retryBtn.className = "reloadButton";
  retryBtn.onclick = () => location.reload();
  section.appendChild(retryBtn);

  // Affichage de la section et masquage du formulaire
  section.style.display = "block";
  document.getElementById("locationForm").style.display = "none";
}

// Affichage de la carte des coordonnées
function renderCoordinatesCard(cityData, container) {
  const coordCard = document.createElement("div");
  coordCard.className = "coordinates-card";
  
  coordCard.innerHTML = `
    <h3>📍 Localisation de ${cityData.name}</h3>
    <div class="coord-display">
      <div class="coord-item">
        <div class="coord-label">Latitude</div>
        <div class="coord-value">${cityData.lat.toFixed(6)}°</div>
      </div>
      <div class="coord-item">
        <div class="coord-label">Longitude</div>
        <div class="coord-value">${cityData.lon.toFixed(6)}°</div>
      </div>
    </div>
    <p style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.9;">
      Coordonnées géographiques en degrés décimaux
    </p>
  `;
  
  container.appendChild(coordCard);
}

// Création d'une carte météo pour un jour
function createWeatherCard(dayData, dayIndex) {
  const card = document.createElement("div");
  card.className = "weather-card";
  
  // Titre du jour
  const dayTitle = document.createElement("h3");
  dayTitle.textContent = getDayLabel(dayIndex);
  card.appendChild(dayTitle);

  // Date exacte
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

  // Conteneur des informations
  const infoContainer = document.createElement("div");
  infoContainer.className = "weather-info";
  
  // Informations de base dans le nouvel ordre
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

  // Informations supplémentaires selon les cases cochées
  if (document.getElementById("show-rain").checked && dayData.rr1) {
    const rainInfo = document.createElement("p");
    rainInfo.textContent = `🌧️ Cumul de pluie : ${dayData.rr1} mm`;
    infoContainer.appendChild(rainInfo);
  }

  if (document.getElementById("show-wind").checked && dayData.wind10m) {
    const windInfo = document.createElement("p");
    windInfo.textContent = `💨 Vent moyen : ${dayData.wind10m} km/h`;
    infoContainer.appendChild(windInfo);
  }

  if (document.getElementById("show-wind-dir").checked && dayData.dirwind10m !== undefined) {
    const windDirInfo = document.createElement("p");
    windDirInfo.textContent = `🧭 Direction du vent : ${dayData.dirwind10m}° (${getWindDirection(dayData.dirwind10m)})`;
    infoContainer.appendChild(windDirInfo);
  }

  card.appendChild(infoContainer);
  return card;
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