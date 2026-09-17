// GET /beat/<id>  ->  the site, with this beat's preview tags and settings baked in.
const TITLE = 'Check out this beat I made with the sun';
const DESC = 'Sound Science: play NASA data at sonify.now.audio';

export async function onRequestGet({ request, params, env }) {
  const id = String(params.id || '');
  if (!/^[a-z0-9]([a-z0-9-]{1,62}[a-z0-9])?$/.test(id) || !env.BEATS) return env.ASSETS.fetch(new URL('/', request.url));
  const obj = await env.BEATS.get(`beats/${id}.json`);
  if (!obj) return env.ASSETS.fetch(new URL('/', request.url));
  const state = await obj.json();

  const origin = new URL(request.url).origin;
  const pageUrl = `${origin}/beat/${id}`;
  const frame = Number.isInteger(state.frame) && state.frame >= 0 && state.frame < 246 ? state.frame : 0;
  const imgUrl = `${origin}/thumb/0171/${String(frame).padStart(3, '0')}.jpg`;

  // Before any page script runs: load this beat into the sequencer's saved settings,
  // and open on the Play the Sun page.
  const store = {
    'sonara-seq-pattern': JSON.stringify(state.pattern),
    'sonara-reverb': state.reverb ? '1' : '0',
    'sonara-delay': state.delay ? '1' : '0',
    'sonara-loop': state.loop ? '1' : '0',
  };
  if (state.wavetable) store['sonara-wavetable'] = state.wavetable;
  if (state.octave != null) store['sonara-seq-octave'] = String(state.octave);
  const loader = `<script>(function(){try{var s=${JSON.stringify(store).replace(/</g, '\\u003c')};for(var k in s)localStorage.setItem(k,s[k]);}catch(e){}if(!location.hash)history.replaceState(null,'',location.pathname+location.search+'#play');})();</script>`;

  const meta = [
    ['property', 'og:title', TITLE],
    ['property', 'og:description', DESC],
    ['property', 'og:url', pageUrl],
    ['property', 'og:image', imgUrl],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:type', 'website'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', TITLE],
    ['name', 'twitter:description', DESC],
    ['name', 'twitter:image', imgUrl],
    ['name', 'description', DESC],
  ];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const metaHtml = meta.map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}">`).join('');

  const page = await env.ASSETS.fetch(new URL('/', request.url));
  const out = new HTMLRewriter()
    .on('head', { element(el) { el.prepend(`<base href="/">${loader}`, { html: true }); el.append(metaHtml, { html: true }); } })
    // The tab keeps the site's own <title>; the share text lives only in og:/twitter: tags.
    .on('meta[property^="og:"], meta[name^="twitter:"], meta[name="description"]', { element(el) { el.remove(); } })
    .transform(page);
  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'no-cache');
  return new Response(out.body, { status: 200, headers });
}
