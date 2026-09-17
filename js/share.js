/* ============================================================
   Share a beat (Play the Sun page)
   Collects the sequencer state (pattern, wavetable, delay, reverb, loop) and
   the half-second of the sun video on screen, and posts them to /api/beat
   (Cloudflare Pages Function). The returned link opens a page that loads that
   exact beat; its preview is the matching pre-baked sun thumbnail.
   ============================================================ */
(function () {
  'use strict';
  const btn = document.getElementById('seq-share');
  const toast = document.getElementById('seq-share-toast');
  if (!btn) return;

  const TITLE = 'Check out this beat I made with the sun';
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

  // Which pre-baked thumbnail to use: the half-second the sun video is showing right now.
  const THUMB_COUNT = 246;
  function currentFrame() {
    const v = document.querySelector('.sun-video');
    const t = v && Number.isFinite(v.currentTime) ? v.currentTime : 0;
    return Math.max(0, Math.floor(t * 2)) % THUMB_COUNT;
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
    // Lock the width so nothing the label does can reflow the toolbar.
    btn.style.width = Math.ceil(btn.getBoundingClientRect().width) + 'px';
    let shared = false;
    try {
      const state = readState();
      if (!state.pattern) throw new Error('no pattern yet');
      const res = await fetch('/api/beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, frame: currentFrame() }),
      });
      if (!res.ok) throw new Error('save failed ' + res.status);
      const { url } = await res.json();
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title: TITLE, text: TITLE, url }); say('Shared'); shared = true; }
        catch (e) { if (e && e.name !== 'AbortError') { shared = await copy(url); say(shared ? 'Link copied' : url); } }
      } else {
        shared = await copy(url);
        say(shared ? 'Link copied' : url);
      }
    } catch (err) {
      console.warn('[share]', err);
      say('Could not share right now');
    }
    if (shared) {
      // Success: the button becomes a green check for a moment, then returns.
      btn.textContent = '✓';
      btn.classList.add('is-shared');
      setTimeout(() => {
        btn.textContent = label;
        btn.classList.remove('is-shared');
        btn.style.width = '';
        busy = false;
      }, 1200);
    } else {
      btn.style.width = '';
      busy = false;
    }
  });

  // ---- glisten: a light sweeps across the Share button now and then ----
  // Organic: each edit to the beat has a 1-in-5 chance. Timed: at the top of
  // each minute with no glisten, the chance escalates 2/5 → 3/5 → 4/5 → certain.
  let lastGlisten = 0, quietMinutes = 0;
  function glisten() {
    if (busy) return;                    // not over the green check
    lastGlisten = Date.now();
    quietMinutes = 0;
    btn.classList.remove('glisten');
    void btn.offsetWidth;                // restart cleanly if one is mid-sweep
    btn.classList.add('glisten');
  }
  btn.addEventListener('animationend', () => btn.classList.remove('glisten'));

  const synth = document.getElementById('stem-music');
  if (synth) {
    const isBeatEdit = t => t.closest && t.closest('.seq-cell, #seq-randomize') && !t.closest('#seq-share');
    synth.addEventListener('click', e => { if (isBeatEdit(e.target) && Math.random() < 0.2) glisten(); });
    synth.addEventListener('change', e => { if (!e.target.closest('#seq-share') && Math.random() < 0.2) glisten(); });
  }

  const MINUTE_CHANCE = [0.4, 0.6, 0.8, 1];
  setInterval(() => {
    if (Date.now() - lastGlisten < 60e3) return;   // happened organically this minute
    const p = MINUTE_CHANCE[Math.min(quietMinutes, MINUTE_CHANCE.length - 1)];
    quietMinutes++;
    if (Math.random() < p) glisten();
  }, 60e3);

  // Exposed for the beat page loader (functions/beat/[id].js injects the state before load).
  window.SONIFY_SHARE_KEYS = KEYS;
})();
