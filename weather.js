// weather.js
// Adds automatic weather-tagging to notes using the free Open-Meteo API.
// No API key required. Falls back to Cebu City, Region VII, Philippines
// if the browser can't get (or the user denies) geolocation.

const CEBU_CITY_COORDS = { lat: 10.3157, lon: 123.8854 };

// Open-Meteo WMO weather codes mapped to readable labels
const WEATHER_CODE_LABELS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Severe thunderstorm with hail",
};

function weatherCodeToLabel(code) {
  return WEATHER_CODE_LABELS[code] || "Unknown";
}

// Emoji icon per code, for the badge
const WEATHER_CODE_ICONS = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️",
  80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

// Broad category per code, used as a CSS hook (data-condition="rain" etc.)
// so the badge/background can be styled per weather group instead of
// per exact code.
function weatherCodeToCategory(code) {
  if (code === 0 || code === 1) return "clear";
  if (code === 2 || code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 61, 63, 65, 80, 81].includes(code)) return "rain";
  if ([71, 73, 75].includes(code)) return "snow";
  if ([82, 95, 96, 99].includes(code)) return "storm";
  return "unknown";
}

/**
 * Attempts to get the device's current location.
 * Resolves with Cebu City coordinates if geolocation is unavailable,
 * denied, or times out, so the app never blocks on this.
 */
function getLocation(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...CEBU_CITY_COORDS, source: "default-cebu" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: "device-gps",
        }),
      () => resolve({ ...CEBU_CITY_COORDS, source: "default-cebu" }),
      { timeout: timeoutMs }
    );
  });
}

/**
 * Fetches current weather for the given coordinates from Open-Meteo.
 * Returns null on failure instead of throwing, so a weather-tag
 * failure never blocks a note from saving.
 */
async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code` +
    `&timezone=Asia%2FManila`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API responded ${res.status}`);
    const data = await res.json();

    return {
      tempC: data.current.temperature_2m,
      code: data.current.weather_code,
      condition: weatherCodeToLabel(data.current.weather_code),
      icon: WEATHER_CODE_ICONS[data.current.weather_code] || "🌡️",
      category: weatherCodeToCategory(data.current.weather_code),
    };
  } catch (err) {
    console.warn("Weather fetch failed:", err.message);
    return null;
  }
}

/**
 * Convenience wrapper: gets location (device or Cebu City fallback)
 * and returns the weather object to attach to a note.
 */
async function getWeatherForNote() {
  const { lat, lon, source } = await getLocation();
  const weather = await getWeather(lat, lon);
  if (!weather) return null;
  return { ...weather, locationSource: source };
}

/**
 * Renders a small HTML badge for a note's stored weather data.
 * Returns an empty string if the note has no weather tag.
 */
function renderWeatherTag(note) {
  if (!note.weather) return "";
  const { condition, tempC, icon, category } = note.weather;
  return `<span class="weather-tag" data-condition="${category}">${icon} ${condition}, ${Math.round(tempC)}&deg;C</span>`;
}

// Plain global functions (no ES module export) since this app loads
// scripts via plain <script src="..."> tags, not type="module".
// getLocation, getWeather, getWeatherForNote, renderWeatherTag, and
// weatherCodeToLabel are now all available directly in script.js.