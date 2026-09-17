// POST /api/beat  { state, frame }  ->  { id, url }
// Stores a shared beat: the sequencer state plus which pre-baked sun thumbnail to show
// (frame = half-second index into thumbs/0171/, 0..THUMB_COUNT-1). No images are uploaded.
const MAX_STATE_BYTES = 16 * 1024;
const THUMB_COUNT = 246;
const ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

function newId(n = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, b => ID_CHARS[b % ID_CHARS.length]).join('');
}

// Readable share slugs, tiered: adjective-sunword-musicnoun (40x40x40 = 64k) is
// the base; only when a candidate collides does the wow tier flip on as a suffix
// (blazing-solar-groove-yesss), multiplying the space to 1.28M.
const WOWS = ['wow', 'woww', 'whoa', 'whoaa', 'wooah', 'omg', 'omgg', 'yes', 'yess', 'yesss', 'yessss', 'wowza', 'yay', 'ooh', 'oooh', 'aha', 'dang', 'hey', 'mmm', 'fire'];
const ADJS = ['blazing', 'golden', 'radiant', 'molten', 'cosmic', 'luminous', 'roaring', 'burning', 'glowing', 'shimmering', 'flaming', 'searing', 'gleaming', 'dazzling', 'scorching', 'soaring', 'swirling', 'thundering', 'electric', 'magnetic', 'stellar', 'wild', 'epic', 'mighty', 'fierce', 'brilliant', 'booming', 'pulsing', 'raging', 'vivid', 'sizzling', 'sparkling', 'glittering', 'thunderous', 'volcanic', 'hypnotic', 'celestial', 'incandescent', 'kinetic', 'blistering'];
const SUNS = ['solar', 'sun', 'corona', 'flare', 'plasma', 'photon', 'fusion', 'helio', 'sunspot', 'aurora', 'sunburst', 'sunrise', 'sunset', 'zenith', 'equinox', 'eclipse', 'radiance', 'daylight', 'starlight', 'supernova', 'magnetosphere', 'heliosphere', 'prominence', 'chromosphere', 'photosphere', 'filament', 'solstice', 'sunbeam', 'starshine', 'lightyear', 'cosmos', 'nebula', 'quasar', 'pulsar', 'comet', 'nova', 'orbit', 'gravity', 'magnetometer', 'granule'];
const BEATS = ['groove', 'beat', 'riff', 'pulse', 'rhythm', 'banger', 'jam', 'drop', 'anthem', 'bop', 'loop', 'track', 'tune', 'melody', 'remix', 'sequence', 'symphony', 'song', 'shuffle', 'cadence', 'tempo', 'harmony', 'chorus', 'hook', 'breakbeat', 'backbeat', 'bassline', 'crescendo', 'encore', 'refrain', 'serenade', 'sonata', 'overture', 'rhapsody', 'medley', 'mixtape', 'ballad', 'jingle', 'downbeat', 'upbeat'];

const pickWord = list => list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];

const bool = v => v === true;
// The sequencer's exact schema: 16 steps, 5 melody rows, 5 pitches, melodyFreqs
// derived from rows+pitches. Whatever arrives is normalized into that shape, so
// a stored beat can never carry a pattern that breaks the page that loads it.
const DEFAULT_PITCHES = [523.25, 493.88, 440, 392, 349.23, 329.63, 293.66, 261.63]; // C major, C5 down to C4

function cleanState(s) {
  if (!s || typeof s !== 'object') return null;
  const p = s.pattern;
  if (!p || typeof p !== 'object' || !Array.isArray(p.kick)) return null;
  const cells = r => {
    const out = new Array(16).fill(0);
    if (Array.isArray(r)) for (let i = 0; i < 16; i++) out[i] = r[i] ? 1 : 0;
    return out;
  };
  const kick = cells(p.kick);
  const hat = cells(p.hat);
  let pitches = Array.isArray(p.pitches) && p.pitches.length >= 5 && p.pitches.length <= 8 && p.pitches.every(f => Number.isFinite(+f) && +f > 0)
    ? p.pitches.map(Number)
    : DEFAULT_PITCHES;
  while (pitches.length < 8) pitches = [...pitches, pitches[pitches.length - 1] / 2];   // legacy shorter patterns
  const rows = Array.isArray(p.melodyRows) ? p.melodyRows : [];
  const melodyRows = Array.from({ length: 8 }, (_, r) => cells(rows[r]));
  const melodyFreqs = Array.from({ length: 16 }, (_, i) => {
    const on = [];
    for (let r = 0; r < 8; r++) if (melodyRows[r][i]) on.push(pitches[r]);
    return on;
  });
  const bpm = Number.isFinite(+p.bpm) ? Math.min(240, Math.max(40, +p.bpm)) : 100;
  const MODES = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
  const pattern = {
    kick, hat, melodyRows, melodyFreqs, pitches,
    waveType: typeof p.waveType === 'string' && p.waveType ? p.waveType.slice(0, 16) : 'sine',
    bpm, step: 60 / bpm / 2, steps: 16,
    root: Number.isFinite(+p.root) && +p.root > 0 && +p.root < 4000 ? +p.root : 0,
    mode: MODES.includes(p.mode) ? p.mode : 'ionian',
  };
  const wavetable = typeof s.wavetable === 'string' && /^[\w.-]{1,64}$/.test(s.wavetable) ? s.wavetable : null;
  const octave = s.octave === 'rand' ? 'rand' : Math.max(0, Math.min(3, Math.round(+s.octave) || 0));
  return { pattern, wavetable, reverb: bool(s.reverb), delay: bool(s.delay), loop: bool(s.loop), octave };
}

export async function onRequestPost({ request, env }) {
  if (!env.BEATS) return json({ error: 'storage not configured' }, 500);
  const len = +(request.headers.get('content-length') || 0);
  if (len > MAX_STATE_BYTES) return json({ error: 'too large' }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const state = cleanState(body && body.state);
  if (!state) return json({ error: 'bad state' }, 400);
  const frame = Number.isInteger(body.frame) && body.frame >= 0 && body.frame < THUMB_COUNT ? body.frame : 0;
  const record = JSON.stringify({ ...state, frame });
  if (record.length > MAX_STATE_BYTES) return json({ error: 'state too large' }, 413);

  // Tier 1: three words. Tier 2 (only if the namespace pushes back): -wow suffix.
  // Last resort: a short random id, which can never collide in practice.
  let id = null;
  for (let i = 0; i < 4 && !id; i++) {
    const cand = `${pickWord(ADJS)}-${pickWord(SUNS)}-${pickWord(BEATS)}`;
    if (!(await env.BEATS.head(`beats/${cand}.json`))) id = cand;
  }
  for (let i = 0; i < 4 && !id; i++) {
    const cand = `${pickWord(ADJS)}-${pickWord(SUNS)}-${pickWord(BEATS)}-${pickWord(WOWS)}`;
    if (!(await env.BEATS.head(`beats/${cand}.json`))) id = cand;
  }
  if (!id) id = newId();
  await env.BEATS.put(`beats/${id}.json`, record, { httpMetadata: { contentType: 'application/json' } });

  const origin = new URL(request.url).origin;
  return json({ id, url: `${origin}/beat/${id}` }, 201);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
