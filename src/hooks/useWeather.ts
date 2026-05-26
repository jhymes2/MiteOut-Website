import { useState, useEffect, useCallback } from "react";
import { WeatherDay } from "@/lib/calendar";

const WEATHER_CACHE_KEY = "hivemind_weather_cache";
const LOCATION_KEY = "hivemind_location";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface WeatherCache {
  lat: number;
  lon: number;
  fetched_at: number;
  days: WeatherDay[];
}

interface Coords {
  lat: number;
  lon: number;
}

export function useGeolocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [prompted, setPrompted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LOCATION_KEY);
    if (saved) {
      try {
        setCoords(JSON.parse(saved));
      } catch {}
    }
    setPrompted(true);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: Coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(c);
        localStorage.setItem(LOCATION_KEY, JSON.stringify(c));
      },
      () => {}
    );
  }, []);

  const clearLocation = useCallback(() => {
    setCoords(null);
    localStorage.removeItem(LOCATION_KEY);
    localStorage.removeItem(WEATHER_CACHE_KEY);
  }, []);

  return { coords, prompted, requestLocation, clearLocation };
}

export function useWeather(coords: Coords | null) {
  const [weather, setWeather] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!coords) {
      setWeather([]);
      return;
    }

    const { lat, lon } = coords;

    // Check cache
    try {
      const raw = localStorage.getItem(WEATHER_CACHE_KEY);
      if (raw) {
        const cache: WeatherCache = JSON.parse(raw);
        if (
          Math.abs(cache.lat - lat) < 0.5 &&
          Math.abs(cache.lon - lon) < 0.5 &&
          Date.now() - cache.fetched_at < CACHE_TTL_MS
        ) {
          setWeather(cache.days);
          return;
        }
      }
    } catch {}

    setLoading(true);
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&temperature_unit=fahrenheit&timezone=auto&forecast_days=16`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const days: WeatherDay[] = (data.daily.time as string[]).map(
          (date: string, i: number) => ({
            date,
            temp_max: Math.round(data.daily.temperature_2m_max[i]),
            temp_min: Math.round(data.daily.temperature_2m_min[i]),
            condition_code: data.daily.weathercode[i],
          })
        );
        setWeather(days);
        const cache: WeatherCache = { lat, lon, fetched_at: Date.now(), days };
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [coords?.lat, coords?.lon]);

  const getDay = useCallback(
    (date: string): WeatherDay | null =>
      weather.find((w) => w.date === date) ?? null,
    [weather]
  );

  return { weather, loading, getDay };
}
