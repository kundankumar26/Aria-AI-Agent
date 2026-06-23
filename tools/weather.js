// tools/weather.js

export const weatherTool = {
    type: "function",
    function: {
        name: "get_weather",
        description: `Get current weather and 5-day forecast for any city.
                  Use when user asks about weather, temperature,
                  rain, or what to wear/pack.`,
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    description: "City name e.g. 'Mumbai', 'Delhi', 'Bangalore'"
                },
                units: {
                    type: "string",
                    description: "Temperature units: 'metric' (Celsius) or 'imperial' (Fahrenheit)",
                    enum: ["metric", "imperial"]
                }
            },
            required: ["city"]
        }
    }
};

export async function get_weather({ city, units = "metric" }) {
    const BASE = "https://api.openweathermap.org/data/2.5";
    const KEY = process.env.OPENWEATHER_API_KEY;
    const UNIT = units === "metric" ? "°C" : "°F";

    // ── Current weather ──────────────────────────────────
    const [currentRes, forecastRes] = await Promise.all([
        fetch(`${BASE}/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${KEY}`),
        fetch(`${BASE}/forecast?q=${encodeURIComponent(city)}&units=${units}&appid=${KEY}`)
    ]);

    if (!currentRes.ok) {
        throw new Error(`City "${city}" not found. Try a different spelling.`);
    }

    const current = await currentRes.json();
    const forecast = await forecastRes.json();

    // ── Format current conditions ────────────────────────
    const now = `
        🌍 ${current.name}, ${current.sys.country}
        🌡️  Temperature: ${Math.round(current.main.temp)}${UNIT} 
            (feels like ${Math.round(current.main.feels_like)}${UNIT})
        ☁️  Conditions: ${current.weather[0].description}
        💧 Humidity: ${current.main.humidity}%
        🌬️  Wind: ${Math.round(current.wind.speed)} m/s
        👁️  Visibility: ${(current.visibility / 1000).toFixed(1)} km
    `.trim();

    // ── Format 5-day forecast (one entry per day at noon) ──
    const dailyForecasts = forecast.list
        .filter(item => item.dt_txt.includes("12:00:00"))
        .slice(0, 5)
        .map(item => {
            const date = new Date(item.dt * 1000)
                .toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
            return `  ${date}: ${Math.round(item.main.temp_min)}–${Math.round(item.main.temp_max)}${UNIT}, ${item.weather[0].description}`;
        })
        .join("\n");

    return `${now}\n\n📅 5-Day Forecast:\n${dailyForecasts}`;
}