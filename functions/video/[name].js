// GET /video/<name>  ->  video from R2 with proper byte-range support.
// Cloudflare Pages static assets ignore Range requests, and iPhone Safari won't play
// video without them. Same-origin also keeps the frames usable by WebGL.
const TYPES = { mp4: 'video/mp4', webm: 'video/webm' };

export async function onRequest({ request, params, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
  const name = String(params.name || '');
  if (!/^[\w.-]{1,80}\.(mp4|webm)$/.test(name) || !env.BEATS) return new Response('not found', { status: 404 });
  const key = `media/${name}`;
  const type = TYPES[name.split('.').pop()];
  const base = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };

  const head = await env.BEATS.head(key);
  if (!head) return new Response('not found', { status: 404 });
  const size = head.size;

  const m = (request.headers.get('Range') || '').match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === '' && m[2] === '')) {
    if (request.method === 'HEAD') return new Response(null, { headers: { ...base, 'Content-Length': String(size) } });
    const obj = await env.BEATS.get(key);
    return new Response(obj.body, { headers: { ...base, 'Content-Length': String(size) } });
  }

  let start, end;
  if (m[1] === '') { const n = Math.min(size, +m[2]); start = size - n; end = size - 1; }   // bytes=-N
  else { start = +m[1]; end = m[2] === '' ? size - 1 : Math.min(size - 1, +m[2]); }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } });
  }
  const length = end - start + 1;
  const headers = { ...base, 'Content-Length': String(length), 'Content-Range': `bytes ${start}-${end}/${size}` };
  if (request.method === 'HEAD') return new Response(null, { status: 206, headers });
  const obj = await env.BEATS.get(key, { range: { offset: start, length } });
  return new Response(obj.body, { status: 206, headers });
}
