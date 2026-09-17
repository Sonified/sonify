// POST /api/beat  { state, image }  ->  { id, url }
// Stores a shared beat: the sequencer state (JSON) and its sun snapshot (JPEG) in R2.
const MAX_IMAGE_BYTES = 700 * 1024;
const MAX_STATE_BYTES = 16 * 1024;
const ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

function newId(n = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, b => ID_CHARS[b % ID_CHARS.length]).join('');
}

const bool = v => v === true;
const arr = (a, max) => Array.isArray(a) && a.length <= max;

function cleanState(s) {
  if (!s || typeof s !== 'object') return null;
  const p = s.pattern;
  if (!p || typeof p !== 'object') return null;
  if (!arr(p.kick, 64) || !arr(p.hat, 64) || !arr(p.melodyRows, 16)) return null;
  if (!p.melodyRows.every(r => arr(r, 64))) return null;
  const pattern = {
    kick: p.kick.map(Boolean).map(Number),
    hat: p.hat.map(Boolean).map(Number),
    melodyRows: p.melodyRows.map(r => r.map(Boolean).map(Number)),
    melodyFreqs: arr(p.melodyFreqs, 64) ? p.melodyFreqs.map(f => arr(f, 16) ? f.map(Number).filter(Number.isFinite) : []) : [],
    pitches: arr(p.pitches, 16) ? p.pitches.map(Number).filter(Number.isFinite) : [],
    waveType: typeof p.waveType === 'string' ? p.waveType.slice(0, 16) : 'sine',
    bpm: Number.isFinite(+p.bpm) ? Math.min(240, Math.max(40, +p.bpm)) : 100,
    step: Number.isFinite(+p.step) ? +p.step : 0.15,
    steps: Number.isFinite(+p.steps) ? Math.min(64, Math.max(1, +p.steps)) : 16,
  };
  const wavetable = typeof s.wavetable === 'string' && /^[\w.-]{1,64}$/.test(s.wavetable) ? s.wavetable : null;
  return { pattern, wavetable, reverb: bool(s.reverb), delay: bool(s.delay), loop: bool(s.loop) };
}

export async function onRequestPost({ request, env }) {
  if (!env.BEATS) return json({ error: 'storage not configured' }, 500);
  const len = +(request.headers.get('content-length') || 0);
  if (len > MAX_IMAGE_BYTES * 1.4 + MAX_STATE_BYTES) return json({ error: 'too large' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const state = cleanState(body && body.state);
  if (!state) return json({ error: 'bad state' }, 400);
  const stateText = JSON.stringify(state);
  if (stateText.length > MAX_STATE_BYTES) return json({ error: 'state too large' }, 413);

  const m = typeof body.image === 'string' && body.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return json({ error: 'bad image' }, 400);
  const bin = Uint8Array.from(atob(m[1]), ch => ch.charCodeAt(0));
  if (bin.length > MAX_IMAGE_BYTES || bin[0] !== 0xff || bin[1] !== 0xd8) return json({ error: 'bad image' }, 400);

  const id = newId();
  await env.BEATS.put(`beats/${id}.json`, stateText, { httpMetadata: { contentType: 'application/json' } });
  await env.BEATS.put(`beats/${id}.jpg`, bin, { httpMetadata: { contentType: 'image/jpeg' } });

  const origin = new URL(request.url).origin;
  return json({ id, url: `${origin}/beat/${id}` }, 201);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
