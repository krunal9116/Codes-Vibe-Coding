/* ============================================
   🌦️ Weather Dashboard — App Logic
   3D City · Weather Particles · Open-Meteo API
   ============================================ */

// ── Constants ──
const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_CITY = 'New York';

// ── DOM References ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    skyBg: $('#sky-bg'),
    starsContainer: $('#stars-container'),
    celestialBody: $('#celestial-body'),
    sun: $('#sun'),
    moon: $('#moon'),
    cloudsContainer: $('#clouds-container'),
    weatherCanvas: $('#weather-canvas'),
    lightningFlash: $('#lightning-flash'),
    fogOverlay: $('#fog-overlay'),
    buildingsContainer: $('#buildings-container'),
    cityReflection: $('#city-reflection'),
    cityInput: $('#city-input'),
    searchBtn: $('#search-btn'),
    locateBtn: $('#locate-btn'),
    cityName: $('#city-name'),
    weatherDate: $('#weather-date'),
    tempValue: $('#temp-value'),
    weatherDesc: $('#weather-desc'),
    feelsTemp: $('#feels-temp'),
    humidity: $('#humidity'),
    wind: $('#wind'),
    visibility: $('#visibility'),
    pressure: $('#pressure'),
    sunriseTime: $('#sunrise-time'),
    sunsetTime: $('#sunset-time'),
    arcSun: $('#arc-sun'),
    forecastCards: $('#forecast-cards'),
    iconCanvas: $('#icon-canvas'),
    loadingScreen: $('#loading-screen'),
    errorToast: $('#error-toast'),
    errorMsg: $('#error-msg'),
    errorClose: $('#error-close'),
};

// ── State ──
let currentWeather = null;
let ctx = dom.weatherCanvas.getContext('2d');
let iconCtx = dom.iconCanvas.getContext('2d');
let particles = [];
let animFrame = null;
let lightningTimeout = null;
let windowFlickerInterval = null;

// ── WMO Weather Code Mapping ──
const WMO_CODES = {
    0: { desc: 'Clear sky', icon: '☀️', group: 'clear' },
    1: { desc: 'Mainly clear', icon: '🌤️', group: 'clear' },
    2: { desc: 'Partly cloudy', icon: '⛅', group: 'clouds' },
    3: { desc: 'Overcast', icon: '☁️', group: 'clouds' },
    45: { desc: 'Foggy', icon: '🌫️', group: 'fog' },
    48: { desc: 'Rime fog', icon: '🌫️', group: 'fog' },
    51: { desc: 'Light drizzle', icon: '🌦️', group: 'drizzle' },
    53: { desc: 'Moderate drizzle', icon: '🌦️', group: 'drizzle' },
    55: { desc: 'Dense drizzle', icon: '🌦️', group: 'drizzle' },
    56: { desc: 'Freezing drizzle', icon: '🌧️', group: 'drizzle' },
    57: { desc: 'Heavy freezing drizzle', icon: '🌧️', group: 'drizzle' },
    61: { desc: 'Slight rain', icon: '🌧️', group: 'rain' },
    63: { desc: 'Moderate rain', icon: '🌧️', group: 'rain' },
    65: { desc: 'Heavy rain', icon: '🌧️', group: 'rain' },
    66: { desc: 'Freezing rain', icon: '🌧️', group: 'rain' },
    67: { desc: 'Heavy freezing rain', icon: '🌧️', group: 'rain' },
    71: { desc: 'Slight snowfall', icon: '❄️', group: 'snow' },
    73: { desc: 'Moderate snowfall', icon: '❄️', group: 'snow' },
    75: { desc: 'Heavy snowfall', icon: '❄️', group: 'snow' },
    77: { desc: 'Snow grains', icon: '❄️', group: 'snow' },
    80: { desc: 'Slight rain showers', icon: '🌦️', group: 'rain' },
    81: { desc: 'Moderate rain showers', icon: '🌧️', group: 'rain' },
    82: { desc: 'Violent rain showers', icon: '🌧️', group: 'rain' },
    85: { desc: 'Slight snow showers', icon: '🌨️', group: 'snow' },
    86: { desc: 'Heavy snow showers', icon: '🌨️', group: 'snow' },
    95: { desc: 'Thunderstorm', icon: '⛈️', group: 'thunder' },
    96: { desc: 'Thunderstorm with hail', icon: '⛈️', group: 'thunder' },
    99: { desc: 'Thunderstorm with heavy hail', icon: '⛈️', group: 'thunder' },
};

function getWMO(code) {
    return WMO_CODES[code] || { desc: 'Unknown', icon: '🌡️', group: 'clear' };
}

// ── Initialize ──
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    dom.searchBtn.addEventListener('click', () => searchCity());
    dom.cityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchCity();
    });
    dom.locateBtn.addEventListener('click', geoLocate);
    dom.errorClose.addEventListener('click', hideError);

    generateStars();
    generateCity();
    startWindowFlicker();
    searchCity(DEFAULT_CITY);
}

// ── API (Open-Meteo — NO API KEY NEEDED) ──
async function geocodeCity(name) {
    try {
        const res = await fetch(`${GEO_API}?name=${encodeURIComponent(name)}&count=1&language=en`);
        const data = await res.json();
        if (!data.results || data.results.length === 0) {
            throw new Error(`City "${name}" not found`);
        }
        const r = data.results[0];
        return {
            lat: r.latitude,
            lon: r.longitude,
            name: r.name,
            country: r.country_code,
            timezone: r.timezone,
        };
    } catch (err) {
        showError(err.message);
        return null;
    }
}

async function fetchWeatherData(lat, lon, timezone) {
    try {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,is_day',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
            timezone: timezone || 'auto',
            forecast_days: 6,
        });
        const res = await fetch(`${WEATHER_API}?${params}`);
        if (!res.ok) throw new Error('Weather API error');
        return await res.json();
    } catch (err) {
        showError(err.message);
        return null;
    }
}

// ── Search ──
async function searchCity(cityOverride) {
    const city = cityOverride || dom.cityInput.value.trim();
    if (!city) return;

    showLoading();

    const geo = await geocodeCity(city);
    if (!geo) { hideLoading(); return; }

    const data = await fetchWeatherData(geo.lat, geo.lon, geo.timezone);
    if (!data) { hideLoading(); return; }

    currentWeather = { geo, data };
    updateUI(geo, data);
    updateSky(data);
    updateWeatherEffects(data);
    updateCelestial(data);
    updateForecast(data);
    hideLoading();
}

async function geoLocate() {
    if (!navigator.geolocation) {
        showError('Geolocation not supported');
        return;
    }
    showLoading();
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude: lat, longitude: lon } = pos.coords;
            // Reverse geocode to get city name
            try {
                const res = await fetch(`${GEO_API}?name=&count=1&language=en`);
                // Open-Meteo geocoding doesn't support reverse, so we use the weather API timezone
            } catch {}

            const data = await fetchWeatherData(lat, lon, 'auto');
            if (data) {
                const geo = { lat, lon, name: data.timezone?.split('/').pop().replace(/_/g, ' ') || 'Your Location', country: '', timezone: data.timezone };
                currentWeather = { geo, data };
                updateUI(geo, data);
                updateSky(data);
                updateWeatherEffects(data);
                updateCelestial(data);
                updateForecast(data);
            }
            hideLoading();
        },
        () => {
            showError('Location access denied');
            hideLoading();
        }
    );
}

// ── Update UI ──
function updateUI(geo, data) {
    const current = data.current;
    const daily = data.daily;

    // City & Date
    dom.cityName.textContent = geo.country ? `${geo.name}, ${geo.country}` : geo.name;
    const now = new Date();
    dom.weatherDate.textContent = now.toLocaleDateString('en', {
        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric'
    });

    // Temperature
    animateNumber(dom.tempValue, Math.round(current.temperature_2m));
    dom.feelsTemp.textContent = Math.round(current.apparent_temperature);
    dom.weatherDesc.textContent = getWMO(current.weather_code).desc;

    // Details
    dom.humidity.textContent = `${current.relative_humidity_2m}%`;
    dom.wind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    dom.visibility.textContent = '--'; // Open-Meteo free doesn't include visibility
    dom.pressure.textContent = `${Math.round(current.surface_pressure)} hPa`;

    // Sun tracker
    if (daily.sunrise && daily.sunset) {
        const sunrise = new Date(daily.sunrise[0]);
        const sunset = new Date(daily.sunset[0]);
        dom.sunriseTime.textContent = sunrise.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });
        dom.sunsetTime.textContent = sunset.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });
        updateSunArc(Date.now(), sunrise.getTime(), sunset.getTime());
    }

    // Weather icon
    const isNightNow = current.is_day === 0;
    drawWeatherIcon(current.weather_code, isNightNow);

    dom.cityInput.value = '';
}

function updateForecast(data) {
    dom.forecastCards.innerHTML = '';
    const daily = data.daily;
    if (!daily) return;

    // Skip today (index 0), show next 5 days
    for (let i = 1; i < Math.min(daily.time.length, 6); i++) {
        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.style.animationDelay = `${(i - 1) * 0.1}s`;

        const date = new Date(daily.time[i]);
        const dayName = i === 1 ? 'Tomorrow' : date.toLocaleDateString('en', { weekday: 'short' });
        const wmo = getWMO(daily.weather_code[i]);
        const tempMax = Math.round(daily.temperature_2m_max[i]);
        const tempMin = Math.round(daily.temperature_2m_min[i]);

        card.innerHTML = `
            <span class="forecast-day">${dayName}</span>
            <span class="forecast-icon">${wmo.icon}</span>
            <span class="forecast-temp">${tempMax}°</span>
            <span class="forecast-temp-min">${tempMin}°</span>
            <span class="forecast-desc">${wmo.desc}</span>
        `;
        dom.forecastCards.appendChild(card);
    }
}

// ── Sky Gradient ──
function updateSky(data) {
    const isNightNow = data.current.is_day === 0;
    const weatherCode = data.current.weather_code;
    const group = getWMO(weatherCode).group;

    let skyTop, skyMid, skyBottom, skyHorizon;

    if (isNightNow) {
        skyTop = '#050a1a';
        skyMid = '#0d1333';
        skyBottom = '#151b4a';
        skyHorizon = '#1f2466';
        dom.starsContainer.style.opacity = '1';
    } else {
        skyTop = '#0c4a8c';
        skyMid = '#1e6cc0';
        skyBottom = '#5da0d8';
        skyHorizon = '#87ceeb';
        dom.starsContainer.style.opacity = '0';

        // Check golden hour
        if (data.daily?.sunrise && data.daily?.sunset) {
            const now = Date.now();
            const sunrise = new Date(data.daily.sunrise[0]).getTime();
            const sunset = new Date(data.daily.sunset[0]).getTime();
            const dayLen = sunset - sunrise;
            const progress = (now - sunrise) / dayLen;
            if (progress < 0.15 || progress > 0.85) {
                skyTop = '#1a1040';
                skyMid = '#4a2060';
                skyBottom = '#c95030';
                skyHorizon = '#f08030';
                dom.starsContainer.style.opacity = '0.3';
            }
        }
    }

    // Override for heavy weather
    if (['rain', 'drizzle', 'thunder'].includes(group)) {
        skyTop = isNightNow ? '#030610' : '#1a2030';
        skyMid = isNightNow ? '#0a1020' : '#2a3545';
        skyBottom = isNightNow ? '#101828' : '#3a4a5a';
        skyHorizon = isNightNow ? '#15202e' : '#4a5a6a';
    }
    if (group === 'snow') {
        skyTop = isNightNow ? '#0a0e1a' : '#3a4555';
        skyMid = isNightNow ? '#121830' : '#556575';
        skyBottom = isNightNow ? '#1a2040' : '#708090';
        skyHorizon = isNightNow ? '#202848' : '#8a9aaa';
    }
    if (group === 'fog') {
        skyMid = isNightNow ? '#1a1a2e' : '#5a6a7a';
        skyBottom = isNightNow ? '#202030' : '#7a8a9a';
    }

    document.documentElement.style.setProperty('--sky-top', skyTop);
    document.documentElement.style.setProperty('--sky-mid', skyMid);
    document.documentElement.style.setProperty('--sky-bottom', skyBottom);
    document.documentElement.style.setProperty('--sky-horizon', skyHorizon);
}

// ── Celestial Bodies ──
function updateCelestial(data) {
    const isNightNow = data.current.is_day === 0;

    if (isNightNow) {
        dom.sun.style.display = 'none';
        dom.moon.style.display = 'block';
        dom.celestialBody.style.top = '60px';
        dom.celestialBody.style.right = '15%';
        dom.celestialBody.style.left = 'auto';
    } else {
        dom.sun.style.display = 'block';
        dom.moon.style.display = 'none';

        if (data.daily?.sunrise && data.daily?.sunset) {
            const now = Date.now();
            const sunrise = new Date(data.daily.sunrise[0]).getTime();
            const sunset = new Date(data.daily.sunset[0]).getTime();
            const dayLen = sunset - sunrise;
            const progress = Math.max(0, Math.min(1, (now - sunrise) / dayLen));
            const arcY = 120 - Math.sin(progress * Math.PI) * 100;
            const arcX = 10 + progress * 60;
            dom.celestialBody.style.top = `${arcY}px`;
            dom.celestialBody.style.left = `${arcX}%`;
            dom.celestialBody.style.right = 'auto';
        }
    }

    updateBuildingLights(isNightNow);
}

// ── Weather Effects ──
function updateWeatherEffects(data) {
    const group = getWMO(data.current.weather_code).group;
    const code = data.current.weather_code;

    // Clear previous
    cancelAnimationFrame(animFrame);
    particles = [];
    clearTimeout(lightningTimeout);
    document.body.className = '';
    dom.fogOverlay.style.opacity = '0';
    dom.cloudsContainer.innerHTML = '';

    if (group === 'rain' || group === 'drizzle') {
        document.body.classList.add('weather-rain');
        const intensity = group === 'drizzle' ? 100 : (code >= 65 || code >= 82) ? 400 : 250;
        createRainParticles(intensity);
        animateParticles();
        addClouds(8, 0.25);
    } else if (group === 'thunder') {
        document.body.classList.add('weather-rain');
        createRainParticles(400);
        animateParticles();
        startLightning();
        addClouds(10, 0.3);
    } else if (group === 'snow') {
        document.body.classList.add('weather-snow');
        const intensity = (code >= 75) ? 300 : 200;
        createSnowParticles(intensity);
        animateParticles();
        addClouds(5, 0.15);
    } else if (group === 'fog') {
        dom.fogOverlay.style.opacity = '1';
        addClouds(4, 0.1);
    } else if (group === 'clouds') {
        const cloudCount = code === 1 ? 2 : code === 2 ? 5 : 8;
        const cloudOpacity = code === 1 ? 0.08 : code === 2 ? 0.15 : 0.22;
        addClouds(cloudCount, cloudOpacity);
    }
    // 'clear' → nothing extra
}

// ── Rain Particles ──
function createRainParticles(count) {
    const w = dom.weatherCanvas.width;
    const h = dom.weatherCanvas.height;
    for (let i = 0; i < count; i++) {
        particles.push({
            type: 'rain',
            x: Math.random() * w,
            y: Math.random() * h,
            length: 15 + Math.random() * 20,
            speed: 12 + Math.random() * 10,
            thickness: 1 + Math.random(),
            opacity: 0.2 + Math.random() * 0.4,
            wind: 2 + Math.random() * 3,
        });
    }
}

// ── Snow Particles ──
function createSnowParticles(count) {
    const w = dom.weatherCanvas.width;
    const h = dom.weatherCanvas.height;
    for (let i = 0; i < count; i++) {
        particles.push({
            type: 'snow',
            x: Math.random() * w,
            y: Math.random() * h,
            radius: 1.5 + Math.random() * 3,
            speed: 0.5 + Math.random() * 1.5,
            drift: (Math.random() - 0.5) * 1.5,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.01 + Math.random() * 0.02,
            opacity: 0.4 + Math.random() * 0.5,
        });
    }
}

// ── Particle Animation Loop ──
function animateParticles() {
    const w = dom.weatherCanvas.width;
    const h = dom.weatherCanvas.height;
    ctx.clearRect(0, 0, w, h);

    particles.forEach(p => {
        if (p.type === 'rain') {
            p.x += p.wind;
            p.y += p.speed;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.wind * 0.5, p.y - p.length);
            ctx.strokeStyle = `rgba(174, 210, 255, ${p.opacity})`;
            ctx.lineWidth = p.thickness;
            ctx.stroke();
            if (p.y > h * 0.85) {
                ctx.beginPath();
                ctx.arc(p.x, h * 0.85, 2, 0, Math.PI, true);
                ctx.strokeStyle = `rgba(174, 210, 255, ${p.opacity * 0.5})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
            if (p.y > h || p.x > w + 20) {
                p.x = Math.random() * w;
                p.y = -p.length;
            }
        } else if (p.type === 'snow') {
            p.wobble += p.wobbleSpeed;
            p.x += p.drift + Math.sin(p.wobble) * 0.5;
            p.y += p.speed;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.1})`;
            ctx.fill();
            if (p.y > h + 10 || p.x < -20 || p.x > w + 20) {
                p.x = Math.random() * w;
                p.y = -10;
            }
        }
    });

    animFrame = requestAnimationFrame(animateParticles);
}

// ── Lightning ──
function startLightning() {
    function flash() {
        dom.lightningFlash.classList.add('flash');
        document.body.classList.add('shake');
        drawLightningBolt();
        setTimeout(() => dom.lightningFlash.classList.remove('flash'), 80);
        setTimeout(() => {
            dom.lightningFlash.classList.add('flash');
            setTimeout(() => dom.lightningFlash.classList.remove('flash'), 60);
        }, 200);
        setTimeout(() => document.body.classList.remove('shake'), 400);
        lightningTimeout = setTimeout(flash, 4000 + Math.random() * 8000);
    }
    lightningTimeout = setTimeout(flash, 2000 + Math.random() * 3000);
}

function drawLightningBolt() {
    const w = dom.weatherCanvas.width;
    const h = dom.weatherCanvas.height;
    const startX = w * 0.2 + Math.random() * w * 0.6;
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 200, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(150, 150, 255, 0.8)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    let x = startX, y = 0;
    ctx.moveTo(x, y);
    while (y < h * 0.7) {
        x += (Math.random() - 0.5) * 60;
        y += 20 + Math.random() * 40;
        ctx.lineTo(x, y);
        if (Math.random() < 0.25) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 80, y + 30 + Math.random() * 40);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    }
    ctx.stroke();
    ctx.restore();
}

// ── Clouds ──
function addClouds(count, opacity) {
    dom.cloudsContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud';
        const w = 120 + Math.random() * 200;
        const h = 40 + Math.random() * 30;
        cloud.style.width = `${w}px`;
        cloud.style.height = `${h}px`;
        cloud.style.top = `${5 + Math.random() * 25}%`;
        cloud.style.opacity = opacity + Math.random() * 0.1;
        cloud.style.setProperty('--speed', `${30 + Math.random() * 50}s`);
        cloud.style.animationDelay = `-${Math.random() * 40}s`;
        dom.cloudsContainer.appendChild(cloud);
    }
}

// ── 3D City Skyline ──
function generateCity() {
    dom.buildingsContainer.innerHTML = '';
    const containerWidth = window.innerWidth;
    const buildingCount = Math.floor(containerWidth / 30);

    let x = 0;
    for (let i = 0; i < buildingCount; i++) {
        const building = document.createElement('div');
        building.className = 'building';

        const bWidth = 20 + Math.random() * 45;
        const bHeight = 50 + Math.random() * 180;
        const gap = Math.random() * 6;

        building.style.left = `${x}px`;
        building.style.width = `${bWidth}px`;
        building.style.height = `${bHeight}px`;

        // Depth layer (parallax-like Z)
        const layer = Math.random();
        if (layer < 0.3) {
            building.style.opacity = '0.4';
            building.style.height = `${bHeight * 0.6}px`;
            building.style.filter = 'brightness(0.5)';
            building.style.zIndex = '1';
        } else if (layer < 0.6) {
            building.style.opacity = '0.7';
            building.style.height = `${bHeight * 0.8}px`;
            building.style.zIndex = '2';
        } else {
            building.style.zIndex = '3';
        }

        const shade = 15 + Math.random() * 25;
        building.style.background = `rgb(${shade}, ${shade + 5}, ${shade + 15})`;

        // 3D right face
        const side = document.createElement('div');
        side.style.cssText = `
            position: absolute; top: 0; right: -6px; width: 6px; height: 100%;
            background: rgba(0,0,0,0.3);
            transform: skewY(-45deg); transform-origin: top left;
        `;
        building.appendChild(side);

        // 3D top face
        const top3d = document.createElement('div');
        top3d.style.cssText = `
            position: absolute; top: -3px; left: 0; width: 100%; height: 6px;
            background: rgba(${shade + 20}, ${shade + 25}, ${shade + 35}, 0.6);
            transform: skewX(-45deg); transform-origin: bottom left;
        `;
        building.appendChild(top3d);

        // Windows
        const windowGrid = document.createElement('div');
        windowGrid.className = 'window-grid';
        const cols = Math.max(2, Math.floor(bWidth / 10));
        windowGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

        const windowCount = cols * Math.floor(bHeight / 14);
        for (let w = 0; w < windowCount; w++) {
            const win = document.createElement('div');
            win.className = 'window';
            if (Math.random() < 0.3) {
                const litClass = ['lit', 'lit-blue', 'lit-warm', 'lit-white'][Math.floor(Math.random() * 4)];
                win.classList.add(litClass);
            }
            windowGrid.appendChild(win);
        }
        building.appendChild(windowGrid);

        // Antenna on tall buildings
        if (bHeight > 150 && Math.random() > 0.5) {
            const antenna = document.createElement('div');
            antenna.className = 'building-antenna';
            building.appendChild(antenna);
        }

        dom.buildingsContainer.appendChild(building);
        x += bWidth + gap;
    }
}

function updateBuildingLights(night) {
    const windows = $$('.window');
    windows.forEach(win => {
        const isLit = win.classList.contains('lit') ||
                      win.classList.contains('lit-blue') ||
                      win.classList.contains('lit-warm') ||
                      win.classList.contains('lit-white');
        if (night) {
            if (!isLit && Math.random() < 0.35) {
                const litClass = ['lit', 'lit-blue', 'lit-warm', 'lit-white'][Math.floor(Math.random() * 4)];
                win.classList.add(litClass);
            }
        } else {
            if (isLit && Math.random() < 0.6) {
                win.classList.remove('lit', 'lit-blue', 'lit-warm', 'lit-white');
            }
        }
    });
}

function startWindowFlicker() {
    windowFlickerInterval = setInterval(() => {
        const windows = $$('.window');
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const idx = Math.floor(Math.random() * windows.length);
            const win = windows[idx];
            if (!win) continue;
            const isLit = win.classList.contains('lit') ||
                          win.classList.contains('lit-blue') ||
                          win.classList.contains('lit-warm') ||
                          win.classList.contains('lit-white');
            if (isLit) {
                win.classList.remove('lit', 'lit-blue', 'lit-warm', 'lit-white');
            } else {
                const litClass = ['lit', 'lit-blue', 'lit-warm', 'lit-white'][Math.floor(Math.random() * 4)];
                win.classList.add(litClass);
            }
        }
    }, 2000);
}

// ── Stars ──
function generateStars() {
    dom.starsContainer.innerHTML = '';
    for (let i = 0; i < 120; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 60}%`;
        star.style.setProperty('--dur', `${1.5 + Math.random() * 3}s`);
        star.style.animationDelay = `${Math.random() * 3}s`;
        const size = 1 + Math.random() * 2;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        dom.starsContainer.appendChild(star);
    }
}

// ── Sun Arc ──
function updateSunArc(nowMs, sunriseMs, sunsetMs) {
    const dayLength = sunsetMs - sunriseMs;
    let progress;
    if (nowMs < sunriseMs) progress = 0;
    else if (nowMs > sunsetMs) progress = 1;
    else progress = (nowMs - sunriseMs) / dayLength;

    const t = progress;
    const x = (1-t)*(1-t)*20 + 2*(1-t)*t*150 + t*t*280;
    const y = (1-t)*(1-t)*140 + 2*(1-t)*t*(-40) + t*t*140;

    dom.arcSun.setAttribute('cx', x);
    dom.arcSun.setAttribute('cy', y);

    if (nowMs > sunriseMs && nowMs < sunsetMs) {
        dom.arcSun.setAttribute('fill', '#FFD93D');
        dom.arcSun.setAttribute('r', '8');
    } else {
        dom.arcSun.setAttribute('fill', '#6b7280');
        dom.arcSun.setAttribute('r', '6');
    }
}

// ── Weather Icons (Canvas) ──
function drawWeatherIcon(weatherCode, night) {
    const c = iconCtx;
    const w = dom.iconCanvas.width;
    const h = dom.iconCanvas.height;
    c.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const group = getWMO(weatherCode).group;

    if (group === 'clear') {
        if (night) drawMoonIcon(c, cx, cy);
        else drawSunIcon(c, cx, cy);
    } else if (group === 'clouds') {
        if (weatherCode <= 1 && !night) drawSunIcon(c, cx - 10, cy - 10, 18);
        drawCloudIcon(c, cx, cy + 5);
    } else if (group === 'snow') {
        drawCloudIcon(c, cx, cy - 5);
        drawSnowIconDetail(c, cx, cy + 20);
    } else if (group === 'rain' || group === 'drizzle') {
        drawCloudIcon(c, cx, cy - 8);
        drawRainIcon(c, cx, cy + 15);
    } else if (group === 'thunder') {
        drawCloudIcon(c, cx, cy - 8);
        drawBoltIcon(c, cx, cy + 10);
    } else if (group === 'fog') {
        drawFogIcon(c, cx, cy);
    }
}

function drawSunIcon(c, cx, cy, r = 22) {
    const g = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.5);
    g.addColorStop(0, 'rgba(255, 217, 61, 0.4)');
    g.addColorStop(1, 'rgba(255, 217, 61, 0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, r * 1.5, 0, Math.PI * 2); c.fill();
    const sg = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    sg.addColorStop(0, '#fff7a1'); sg.addColorStop(0.5, '#ffd93d'); sg.addColorStop(1, '#f59e0b');
    c.fillStyle = sg;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255, 217, 61, 0.6)'; c.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx + Math.cos(angle) * (r + 5), cy + Math.sin(angle) * (r + 5));
        c.lineTo(cx + Math.cos(angle) * (r + 14), cy + Math.sin(angle) * (r + 14));
        c.stroke();
    }
}

function drawMoonIcon(c, cx, cy) {
    const r = 20;
    c.fillStyle = '#e0e0e0';
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0e27';
    c.beginPath(); c.arc(cx + 8, cy - 6, r * 0.8, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(cx - 4, cy + 3, r * 0.5, cx - 4, cy + 3, r * 2);
    g.addColorStop(0, 'rgba(200, 200, 255, 0.15)');
    g.addColorStop(1, 'rgba(200, 200, 255, 0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(cx - 4, cy + 3, r * 2, 0, Math.PI * 2); c.fill();
}

function drawCloudIcon(c, cx, cy) {
    c.fillStyle = 'rgba(220, 225, 235, 0.9)';
    c.beginPath();
    c.arc(cx - 10, cy, 16, 0, Math.PI * 2);
    c.arc(cx + 8, cy - 2, 20, 0, Math.PI * 2);
    c.arc(cx + 24, cy + 2, 14, 0, Math.PI * 2);
    c.fill();
}

function drawRainIcon(c, cx, cy) {
    c.strokeStyle = 'rgba(96, 165, 250, 0.8)'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
        c.beginPath(); c.moveTo(cx + i * 12, cy); c.lineTo(cx + i * 12 - 3, cy + 12); c.stroke();
    }
}

function drawSnowIconDetail(c, cx, cy) {
    c.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (let i = -1; i <= 1; i++) {
        c.beginPath(); c.arc(cx + i * 14, cy, 3.5, 0, Math.PI * 2); c.fill();
    }
}

function drawBoltIcon(c, cx, cy) {
    c.fillStyle = '#fbbf24';
    c.beginPath();
    c.moveTo(cx, cy); c.lineTo(cx + 8, cy); c.lineTo(cx + 2, cy + 12);
    c.lineTo(cx + 10, cy + 12); c.lineTo(cx - 2, cy + 28);
    c.lineTo(cx + 3, cy + 16); c.lineTo(cx - 5, cy + 16);
    c.closePath(); c.fill();
}

function drawFogIcon(c, cx, cy) {
    c.strokeStyle = 'rgba(200, 200, 210, 0.6)'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
        c.beginPath(); c.moveTo(cx - 25, cy + i * 12); c.lineTo(cx + 25, cy + i * 12); c.stroke();
    }
}

// ── Helpers ──
function animateNumber(el, target) {
    const start = parseInt(el.textContent) || 0;
    const diff = target - start;
    const duration = 600;
    const startTime = performance.now();
    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + diff * ease);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function resizeCanvas() {
    dom.weatherCanvas.width = window.innerWidth;
    dom.weatherCanvas.height = window.innerHeight;
    if (Math.abs(window.innerWidth - (dom.buildingsContainer._lastWidth || 0)) > 200) {
        dom.buildingsContainer._lastWidth = window.innerWidth;
        generateCity();
    }
}

// ── Loading / Error ──
function showLoading() { dom.loadingScreen.classList.remove('hidden'); }
function hideLoading() { dom.loadingScreen.classList.add('hidden'); }

function showError(msg) {
    dom.errorMsg.textContent = msg;
    dom.errorToast.classList.remove('hidden');
    setTimeout(() => dom.errorToast.classList.add('show'), 10);
    setTimeout(() => hideError(), 6000);
}

function hideError() {
    dom.errorToast.classList.remove('show');
    setTimeout(() => dom.errorToast.classList.add('hidden'), 400);
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);
