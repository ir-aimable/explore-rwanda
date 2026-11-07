import { env } from '../config/env.js';
import { addDays, todayStr } from '../lib/time.js';

const cache = new Map<string, { at: number; data: any }>();

/** Real forecast from Open-Meteo (no key). Never fabricates data; returns an explanatory status instead. */
export async function getWeather(lat: number | null, lng: number | null, date: string, place: string) {
  const base = { place, date, source: 'Open-Meteo (open-meteo.com)' };
  if (!env.weatherEnabled) return { ...base, available: false, reason: 'disabled' };
  if (lat == null || lng == null) return { ...base, available: false, reason: 'no_coordinates' };
  if (date < todayStr()) return { ...base, available: false, reason: 'past_date' };
  if (date > addDays(todayStr(), 15)) return { ...base, available: false, reason: 'beyond_horizon' };
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3 * 3600 * 1000) return hit.data;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Africa%2FKigali&start_date=${date}&end_date=${date}`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error('http ' + r.status);
    const j: any = await r.json();
    const d = j.daily;
    if (!d?.time?.length) throw new Error('empty');
    const data = { ...base, available: true, temp_max: d.temperature_2m_max[0], temp_min: d.temperature_2m_min[0],
      rain_mm: d.precipitation_sum[0], rain_probability: d.precipitation_probability_max?.[0] ?? null,
      wind_kmh: d.wind_speed_10m_max?.[0] ?? null, retrieved_at: new Date().toISOString() };
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return { ...base, available: false, reason: 'provider_unreachable' };
  }
}
