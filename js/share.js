/* ============================================================
   Share a beat (Play the Sun page)
   Collects the sequencer state (pattern, wavetable, delay, reverb, loop),
   snapshots the live sun with its solar-wind trails, and posts both to
   /api/beat (Cloudflare Pages Function). The returned link opens a page
   whose preview shows that exact sun and loads that exact beat.
   ============================================================ */
(function () {
  'use strict';
  const btn = document.getElementById('seq-share');
  const toast = document.getElementById('seq-share-toast');
  if (!btn) return;

  const TITLE = 'Check out this beat I just made with the sun ☀️🥁';
  const KEYS = ['sonara-seq-pattern', 'sonara-wavetable', 'sonara-reverb', 'sonara-delay', 'sonara-loop'];

  function readState() {
    const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    let pattern = null;
    try { pattern = JSON.parse(get('sonara-seq-pattern') || 'null'); } catch (e) {}
    const wt = get('sonara-wavetable') || document.getElementById('wt-select')?.dataset.value || null;
    return {
      pattern,
      wavetable: wt,
      reverb: get('sonara-reverb') === '1',
      delay: get('sonara-delay') === '1',
      loop: get('sonara-loop') === '1',
    };
  }

  // 1200x630 preview: the live sun, cover-fit, with a quiet wordmark.
  function makePreview() {
    const src = window.SONIFY_SUN && window.SONIFY_SUN.snapshot();
    const W = 1200, H = 630;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (src && src.width && src.height) {
      const k = Math.max(W / src.width, H / src.height) * (window.SONIFY_SUN.scale ? window.SONIFY_SUN.scale() : 1);
      const dw = src.width * k, dh = src.height * k;
      g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
    const grad = g.createLinearGradient(0, H * 0.7, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.65)');
    g.fillStyle = grad; g.fillRect(0, H * 0.7, W, H * 0.3);
    g.fillStyle = 'rgba(212,168,67,0.95)';
    g.font = '600 26px "Space Mono", ui-monospace, monospace';
    g.textBaseline = 'alphabetic';
    g.fillText('SONIFY.NOW.AUDIO', 44, H - 40);
    return c.toDataURL('image/jpeg', 0.82);
  }

  let toastTimer = 0;
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 2600);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {}
      ta.remove(); return ok;
    }
  }

  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const label = btn.textContent;
    btn.textContent = 'Sharing…';
    try {
      const state = readState();
      if (!state.pattern) throw new Error('no pattern yet');
      const image = makePreview();
      const res = await fetch('/api/beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, image }),
      });
      if (!res.ok) throw new Error('save failed ' + res.status);
      const { url } = await res.json();
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title: TITLE, text: TITLE, url }); say('Shared'); }
        catch (e) { if (e && e.name !== 'AbortError') { await copy(url); say('Link copied'); } }
      } else {
        const ok = await copy(url);
        say(ok ? 'Link copied' : url);
      }
    } catch (err) {
      console.warn('[share]', err);
      say('Could not share right now');
    } finally {
      btn.textContent = label;
      busy = false;
    }
  });

  // Exposed for the beat page loader (functions/beat/[id].js injects the state before load).
  window.SONIFY_SHARE_KEYS = KEYS;
})();
