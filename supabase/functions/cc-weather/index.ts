// Caddy Coach weather: current conditions at the course (wind, gusts, temperature, rain chance) and ground heights.
// Uses the Met Office when a METOFFICE_API_KEY secret is set (Site Specific Global Spot, free tier), otherwise Open-Meteo
// (add an OPENMETEO_API_KEY secret once the app is commercial). Answers are cached for 30 minutes per ~2 km square, so
// the free Met Office allowance of 360 calls a day covers many golfers.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const URL_ = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const MO_KEY = Deno.env.get('METOFFICE_API_KEY') || '', OM_KEY = Deno.env.get('OPENMETEO_API_KEY') || '';
const omBase = OM_KEY ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
const omKey = OM_KEY ? `&apikey=${encodeURIComponent(OM_KEY)}` : '';

// Met Office "significant weather" codes to the weather codes the app already understands
function moCode(c: number): number {
  if (c <= 1) return 0; if (c <= 3) return 2; if (c <= 6) return 45; if (c <= 8) return 3;
  if (c <= 10) return 80; if (c === 11) return 53; if (c === 12) return 61; if (c <= 14) return 82; if (c === 15) return 65;
  if (c <= 18) return 66; if (c <= 21) return 65; if (c <= 24) return 71; if (c <= 27) return 75; return 95;
}

async function cached(key: string, maxAgeMin: number) {
  const r = await fetch(`${URL_}/rest/v1/weather_cache?key=eq.${encodeURIComponent(key)}&select=data,at`, { headers: ADMIN });
  if (!r.ok) return null;
  const rows = await r.json();
  if (rows[0] && Date.now() - Date.parse(rows[0].at) < maxAgeMin * 60e3) return rows[0].data;
  return null;
}
async function store(key: string, data: unknown) {
  await fetch(`${URL_}/rest/v1/weather_cache`, { method: 'POST', headers: { ...ADMIN, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, data, at: new Date().toISOString() }]) }).catch(() => {});
}

async function metOffice(lat: number, lon: number) {
  const r = await fetch(`https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/hourly?latitude=${lat}&longitude=${lon}&includeLocationName=false&excludeParameterMetadata=true`,
    { headers: { apikey: MO_KEY, accept: 'application/json' } });
  if (!r.ok) throw new Error('metoffice ' + r.status);
  const j = await r.json();
  const ts = j.features?.[0]?.properties?.timeSeries || [];
  const now = Date.now();
  let i = ts.findIndex((t: { time: string }) => Date.parse(t.time) > now - 30 * 60e3); if (i < 0) i = 0;
  const c = ts[i] || {}, next = ts.slice(i, i + 4);
  const mph = (ms: number | undefined) => ms == null ? null : ms * 2.237;
  return { t: c.screenTemperature, ws: mph(c.windSpeed10m), wd: c.windDirectionFrom10m, gust: mph(c.windGustSpeed10m),
    code: moCode(c.significantWeatherCode ?? 7), rain: Math.max(0, ...next.map((x: { probOfPrecipitation?: number }) => x.probOfPrecipitation || 0)), src: 'Met Office' };
}
async function openMeteo(lat: number, lon: number) {
  const r = await fetch(`${omBase}/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code&hourly=precipitation_probability&forecast_hours=4&wind_speed_unit=mph&timezone=auto${omKey}`);
  if (!r.ok) throw new Error('open-meteo ' + r.status);
  const j = await r.json(), c = j.current || {};
  return { t: c.temperature_2m, ws: c.wind_speed_10m, wd: c.wind_direction_10m, gust: c.wind_gusts_10m, code: c.weather_code,
    rain: Math.max(0, ...((j.hourly && j.hourly.precipitation_probability) || [0])), src: 'Open-Meteo' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { msg: 'Use POST' });
  let b: { action?: string; lat?: number; lon?: number; pts?: { lat: number; lon: number }[] };
  try { b = await req.json(); } catch { return json(400, { msg: 'Bad request' }); }
  const ok = (la: unknown, lo: unknown) => typeof la === 'number' && typeof lo === 'number' && la > 49 && la < 61.5 && lo > -9 && lo < 2.5;

  if (b.action === 'elevation') {
    const pts = (b.pts || []).filter(p => ok(p.lat, p.lon)).slice(0, 40);
    if (!pts.length) return json(400, { msg: 'No points' });
    const key = 'e:' + pts.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join(';');
    const hit = await cached(key, 60 * 24 * 365); if (hit) return json(200, hit);
    const r = await fetch(`${omBase}/v1/elevation?latitude=${pts.map(p => p.lat.toFixed(5)).join(',')}&longitude=${pts.map(p => p.lon.toFixed(5)).join(',')}${omKey}`);
    if (!r.ok) return json(502, { msg: 'Ground heights unavailable' });
    const j = await r.json(), out = { elevation: j.elevation || [] };
    await store(key, out); return json(200, out);
  }

  const lat = Number(b.lat), lon = Number(b.lon);
  if (!ok(lat, lon)) return json(400, { msg: 'Outside the UK' });
  const key = `w:${(Math.round(lat * 50) / 50).toFixed(2)},${(Math.round(lon * 50) / 50).toFixed(2)}`;
  const hit = await cached(key, 30); if (hit) return json(200, hit);
  let w = null;
  if (MO_KEY) { try { w = await metOffice(lat, lon); } catch (e) { console.error(String(e)); } }
  if (!w) { try { w = await openMeteo(lat, lon); } catch (e) { console.error(String(e)); return json(502, { msg: 'Weather unavailable' }); } }
  await store(key, w); return json(200, w);
});
