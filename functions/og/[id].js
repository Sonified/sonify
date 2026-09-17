// GET /og/<id>  ->  the beat's sun snapshot (used as the link preview image)
export async function onRequestGet({ params, env }) {
  const id = String(params.id || '').replace(/\.jpg$/, '');
  if (!/^[a-z0-9]{6,16}$/.test(id) || !env.BEATS) return new Response('not found', { status: 404 });
  const obj = await env.BEATS.get(`beats/${id}.jpg`);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
