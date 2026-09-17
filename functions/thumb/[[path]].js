// GET /thumb/0171/NNN.jpg  ->  pre-baked share thumbnail from R2 (thumbs/0171/NNN.jpg)
export async function onRequestGet({ params, env }) {
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!/^0171\/\d{3}\.jpg$/.test(path) || !env.BEATS) return new Response('not found', { status: 404 });
  const obj = await env.BEATS.get(`thumbs/${path}`);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
