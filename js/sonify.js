/**
 * SONIFY additions on top of the Sonara runtime:
 *   1. Click-to-play YouTube facades (thumbnail + play button → iframe).
 *      Leaving a page tears the iframe down so audio never bleeds into
 *      the next page during a presentation.
 *   2. Solar flow canvas: golden energy streaming right from the headshot
 *      on the "work with Robert" page.
 */

import { getStemAnalyser, setStemFilter, setStemSpace, setStemTempoBend, setStemSustain } from './audio.js?v=26';

(function () {
  'use strict';

  // ===== 1. YouTube facades =====
  // A video starting means the beat yields the stage.
  function pauseSeqIfPlaying() {
    const play = document.getElementById('seq-play');
    if (play && play.classList.contains('clicked')) play.click();   // 'clicked' = playing (main.js)
  }
  // Catches taps on YouTube's own play button (cross-origin iframe): focus
  // leaves the page and lands on the player's iframe.
  window.addEventListener('blur', () => {
    const a = document.activeElement;
    if (a && a.tagName === 'IFRAME' && a.closest('.yt')) pauseSeqIfPlaying();
  });

  function buildFacade(el) {
    const id = el.dataset.yt;
    if (!id) return;
    const title = el.dataset.title || 'Video';

    const img = document.createElement('img');
    img.alt = title;
    img.loading = 'lazy';
    img.decoding = 'async';
    // maxres is 1280x720 when it exists; YouTube returns a 120x90 placeholder when it doesn't.
    img.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
    img.addEventListener('load', () => {
      if (img.naturalWidth < 300) img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }, { once: true });
    img.addEventListener('error', () => { img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }, { once: true });

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'yt-play';
    btn.setAttribute('aria-label', `Play: ${title}`);
    btn.innerHTML = '<svg width="26" height="30" viewBox="0 0 18 20" fill="none" aria-hidden="true"><path d="M2 3.5L16 10L2 16.5V3.5Z" fill="currentColor"/></svg>';

    const label = document.createElement('span');
    label.className = 'yt-label';
    label.textContent = title;

    el.append(img, btn, label);
    el.classList.add('yt-ready');

    function activate(autoplay = true) {
      if (el.querySelector('iframe')) return;
      if (autoplay) pauseSeqIfPlaying();   // desktop facade click starts the video at once
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay ? 1 : 0}&rel=0&modestbranding=1&playsinline=1`;
      iframe.title = title;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      el.appendChild(iframe);
      el.classList.add('yt-active');
    }
    function deactivate() {
      const iframe = el.querySelector('iframe');
      if (iframe) iframe.remove();
      el.classList.remove('yt-active');
    }

    if (document.documentElement.classList.contains('is-mobile')) {
      // Phones: no facade dance — iOS won't carry a tap's gesture into a freshly
      // injected iframe (the "spinner then a second play button" trap). Instead
      // the real player loads when its page scrolls into view, so one tap on
      // YouTube's own button starts it. Scrolling away still tears it down.
      const io = new IntersectionObserver(([en]) => {
        if (en.isIntersecting) activate(false);
        else deactivate();
      }, { threshold: 0.2 });
      io.observe(el.closest('.section') || el);
    } else {
      el.addEventListener('click', activate);
    }
    el._deactivate = deactivate;
  }

  const facades = Array.from(document.querySelectorAll('.yt[data-yt]'));
  facades.forEach(buildFacade);

  // Tear down active players when their page scrolls out of view.
  if (facades.length) {
    const sections = new Set(facades.map(el => el.closest('.section')).filter(Boolean));
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) return;
        entry.target.querySelectorAll('.yt-active').forEach(el => el._deactivate && el._deactivate());
      });
    }, { threshold: 0.25 });
    sections.forEach(s => obs.observe(s));
  }

  // ===== 2. Solar flow canvas =====
  function initSolarFlow() {
    const canvas = document.getElementById('solar-flow-canvas');
    if (!canvas) return;
    if (document.documentElement.classList.contains('is-mobile')) return; // hidden on phones; save the battery
    const section = canvas.closest('.section');
    const ctx = canvas.getContext('2d');
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0, h = 0, dpr = 1;
    let visible = false, raf = 0, t = 0, lastTs = 0;
    const N = 170;
    const particles = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = section.clientWidth;
      h = section.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Emit from the right edge of the portrait, if present.
    function emitter() {
      const photo = section.querySelector('.wwr-photo');
      if (!photo) return { x: w * 0.28, y0: h * 0.25, y1: h * 0.75 };
      const r = photo.getBoundingClientRect();
      const s = section.getBoundingClientRect();
      return {
        x: r.right - s.left - 6,
        y0: r.top - s.top + r.height * 0.08,
        y1: r.top - s.top + r.height * 0.92,
      };
    }

    function spawn(p, e, initial) {
      p.x = e.x + (initial ? Math.random() * (w - e.x) : Math.random() * 24);
      p.y = e.y0 + Math.random() * (e.y1 - e.y0);
      p.vx = 0.6 + Math.random() * 1.6;
      p.amp = 4 + Math.random() * 26;
      p.freq = 0.4 + Math.random() * 1.6;
      p.phase = Math.random() * Math.PI * 2;
      p.size = 0.6 + Math.random() * 1.4;
      p.life = 0;
      p.maxLife = 220 + Math.random() * 360;
      p.warm = Math.random(); // 0 = pale gold, 1 = deep amber
      p.drift = (Math.random() - 0.5) * 0.12;
    }

    function ensureParticles() {
      const e = emitter();
      while (particles.length < N) {
        const p = {};
        spawn(p, e, true);
        p.life = Math.random() * p.maxLife;
        particles.push(p);
      }
    }

    function draw(ts) {
      raf = 0;
      if (!visible) return;
      const dt = lastTs ? Math.min(2.5, (ts - lastTs) / 16.67) : 1;
      lastTs = ts;
      t += 0.016 * dt;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      const e = emitter();
      for (const p of particles) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += (Math.sin(t * p.freq + p.phase) * 0.35 + p.drift) * dt;

        const lifeA = Math.sin(Math.PI * Math.min(1, p.life / p.maxLife));
        const edgeA = Math.max(0, Math.min(1, (w - p.x) / (w * 0.25)));
        const a = lifeA * edgeA;
        if (p.life >= p.maxLife || p.x > w + 10 || a <= 0.005) { spawn(p, e, false); continue; }

        const r = 212 + Math.round(p.warm * 20);
        const g = 168 - Math.round(p.warm * 60);
        const b = 67 - Math.round(p.warm * 40);
        const trail = p.vx * 7;

        // streak
        ctx.strokeStyle = `rgba(${r},${g},${b},${(a * 0.2).toFixed(3)})`;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x - trail, p.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // bright head
        ctx.fillStyle = `rgba(${Math.min(255, r + 30)},${Math.min(255, g + 40)},${b + 60},${(a * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // soft glow bloom just off the photo edge
      const glow = ctx.createRadialGradient(e.x, (e.y0 + e.y1) / 2, 0, e.x, (e.y0 + e.y1) / 2, (e.y1 - e.y0) * 0.9);
      glow.addColorStop(0, 'rgba(212,168,67,0.09)');
      glow.addColorStop(0.5, 'rgba(212,168,67,0.03)');
      glow.addColorStop(1, 'rgba(212,168,67,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h); // full-width so the radial falloff has no hard edge (the photo covers the left side)

      ctx.globalCompositeOperation = 'source-over';
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    }

    function start() {
      if (!raf && visible) { lastTs = 0; raf = requestAnimationFrame(draw); }
    }

    resize();
    ensureParticles();
    window.addEventListener('resize', () => { resize(); });
    if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(section); // page grows when the form reveals fields

    // Track "section on screen" and "tab visible" separately; recompute from both
    // so a hidden tab can wake the loop back up on return.
    let intersecting = false;
    function updateVisible() {
      visible = intersecting && !document.hidden;
      if (visible) start();
    }
    const obs = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      updateVisible();
    }, { threshold: 0.05 });
    obs.observe(section);
    document.addEventListener('visibilitychange', updateVisible);
    window.addEventListener('focus', updateVisible);
    window.addEventListener('pageshow', updateVisible);
  }

  initSolarFlow();

  // ===== 3b. Phone chevron pinned under the yellow ring =====
  // Mirrors the hero hint's timing (show-chevron / pulsing / dismissed) but sits at
  // --ring-bottom, which visuals.js publishes on the hero section.
  (function phoneRingChevron() {
    if (!document.documentElement.classList.contains('is-mobile')) return;
    const hero = document.querySelector('section[data-page="hero"]');
    const hint = hero && hero.querySelector('.scroll-hint');
    if (!hint) return;
    const chev = document.createElement('div');
    chev.className = 'ring-chevron';
    chev.setAttribute('aria-hidden', 'true');
    chev.innerHTML = '<span class="section-down-chevron">&#8964;</span>';
    hero.appendChild(chev);
    const sync = () => {
      const dismissed = hint.dataset.dismissed === '1' || hint.style.opacity === '0';
      chev.classList.toggle('is-shown', hint.classList.contains('show-chevron') && !dismissed);
      chev.classList.toggle('is-pulsing', hint.classList.contains('pulsing') && !dismissed);
    };
    new MutationObserver(sync).observe(hint, { attributes: true, attributeFilter: ['class', 'style', 'data-dismissed'] });
    sync();
  })();

  // ===== 3c. Phones: golden hour waveform band centered behind the sample pack card =====
  (function waveBehindSamplePack() {
    if (!document.documentElement.classList.contains('is-mobile')) return;
    const wave = document.getElementById('cs-canvas');
    const card = document.querySelector('[data-link="samplePack"]');
    const section = wave && wave.closest('.section');
    if (!wave || !card || !section) return;
    const place = () => {
      const top = card.getBoundingClientRect().top - section.getBoundingClientRect().top
        + card.offsetHeight / 2 - wave.offsetHeight / 2;
      wave.style.top = Math.round(top) + 'px';
    };
    place();
    window.addEventListener('resize', place);
    if (window.ResizeObserver) new ResizeObserver(place).observe(section);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  })();

  // ===== 3d. Desktop: keep your place when the window is resized =====
  // With mandatory scroll-snap and a last page taller than the screen, browsers can
  // re-snap to the wrong page (often the bottom) while the window height changes.
  // Remember the page in view + the offset inside it, and restore that after resizing.
  (function holdScrollOnResize() {
    if (document.documentElement.classList.contains('is-mobile')) return;
    const root = document.documentElement;
    const pages = () => Array.from(document.querySelectorAll('#pages > section[data-page]'));
    let anchor = null, resizing = false, settleTimer = 0;
    function capture() {
      const y = window.scrollY;
      let best = null;
      for (const sec of pages()) { if (sec.offsetTop <= y + 2) best = sec; else break; }
      if (best) anchor = { sec: best, offset: y - best.offsetTop };
    }
    function restore() {
      if (!anchor) return;
      const { sec, offset } = anchor;
      const maxInside = Math.max(0, sec.offsetHeight - window.innerHeight);
      const target = sec.offsetTop + Math.min(offset, maxInside);
      root.style.scrollSnapType = 'none';
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, target);
      if (resizing) return; // snapping stays off until the drag settles
      requestAnimationFrame(() => requestAnimationFrame(() => {
        root.style.scrollSnapType = '';
        root.style.scrollBehavior = '';
        window.scrollTo(0, target); // hold position after snapping is re-enabled
      }));
    }
    // Natural scrolling inside a page taller than the screen (the Work with page): snapping is
    // off once you're a little way in, and back on in the band near its top, so scrolling up
    // still stops at the page's top edge (#contact has scroll-snap-stop: always).
    const FREE_AFTER_PX = 48;
    function updateFreeScroll() {
      const y = window.scrollY, vh = window.innerHeight;
      let free = false;
      for (const sec of pages()) {
        if (sec.offsetHeight <= vh + 4) continue;
        const top = sec.offsetTop, bottom = top + sec.offsetHeight;
        if (y >= top + FREE_AFTER_PX && y + vh <= bottom + 2) { free = true; break; }
      }
      root.classList.toggle('free-scroll', free);
    }
    window.addEventListener('scroll', () => { if (!resizing) capture(); updateFreeScroll(); }, { passive: true });
    window.addEventListener('resize', () => {
      if (!resizing) { resizing = true; root.style.scrollSnapType = 'none'; }
      restore();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        resizing = false;
        restore();
        // Whatever happened, snapping goes back to the stylesheet once the resize settles.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!resizing) { root.style.scrollSnapType = ''; root.style.scrollBehavior = ''; }
        }));
      }, 180);
    });
    capture();
  })();

  // ===== 3e. Shareable page links (#soundscience, #listen, #experience, #music, #play, #connect) =====
  (function pageLinks() {
    const slugs = (window.SONIFY && window.SONIFY.SLUGS) || {};
    const root = document.documentElement;
    const pages = Array.from(document.querySelectorAll('#pages > section[data-page]'));
    const slugOf = sec => slugs[sec.dataset.page] || sec.dataset.page;
    const bySlug = new Map(pages.map(sec => [slugOf(sec), sec]));

    // Jumps pause snapping briefly and ALWAYS hand it back to the stylesheet afterwards
    // (clearing the inline style). Only the latest jump restores, so overlapping jumps
    // during page load can't leave snapping switched off.
    let jumpToken = 0;
    function jumpTo(slug) {
      const sec = bySlug.get(slug);
      if (!sec) return false;
      const token = ++jumpToken;
      root.style.scrollSnapType = 'none';
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, sec.offsetTop);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (token !== jumpToken) return;
        window.scrollTo(0, sec.offsetTop); // again, after late layout (fonts, canvases)
        root.style.scrollSnapType = '';
        root.style.scrollBehavior = '';
      }));
      return true;
    }

    // Arriving with a page tag: go there (and don't let the browser restore an old scroll spot).
    const initial = decodeURIComponent(location.hash.slice(1));
    if (initial && bySlug.has(initial)) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      jumpTo(initial);
      window.addEventListener('load', () => jumpTo(initial), { once: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (location.hash.slice(1) === initial) jumpTo(initial); });
    }

    // Keep the address bar in sync with the page in view (replaceState: no back-button clutter).
    let current = initial && bySlug.has(initial) ? initial : null;
    function sync() {
      const mid = window.innerHeight / 2;
      let active = null;
      for (const sec of pages) {
        const r = sec.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) { active = sec; break; }
      }
      if (!active) return;
      const slug = slugOf(active);
      if (slug === current) return;
      // Leave a clean URL on first landing at the top; add tags once the visitor moves.
      if (current === null && active === pages[0]) { current = slug; return; }
      current = slug;
      history.replaceState(history.state, '', location.pathname + location.search + '#' + slug);
    }
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; sync(); });
    }, { passive: true });

    // Typing a tag into the address bar, or clicking a plain #link, jumps there too.
    window.addEventListener('hashchange', () => {
      const slug = decodeURIComponent(location.hash.slice(1));
      if (bySlug.has(slug)) { current = slug; jumpTo(slug); }
    });
  })();

  // ===== 3f. Meditate card: looping sun video with a solar-wind feedback glow =====
  // The video plays hidden; a WebGL2 canvas draws the sun plus a feedback loop
  // (last frame zoomed a touch outward and faded, max'd with the live sun), ported
  // from meditatewiththesun.com. Clipped by the card. Hover: 4x speed and full size.
  // No WebGL2: the plain video shows instead.
  (function sunLoop() {
    const v = document.querySelector('.sun-video');
    if (!v) return;
    const box = v.closest('.meditate-visual');
    const card = v.closest('.meditate-card');
    const cv = box && box.querySelector('.sun-trails');
    const start = parseFloat(v.dataset.start || '0') || 0;
    v.muted = true;

    // ---- start point ----
    let seeked = false;
    const seekToStart = () => {
      if (seeked || !(v.duration > start)) return;
      seeked = true;
      try { v.currentTime = start; } catch (e) {}
    };
    v.addEventListener('loadedmetadata', seekToStart);
    if (v.readyState >= 1) seekToStart();

    // ---- preload: once the rest of the page has loaded, start buffering the video
    // in the background (from the start point, so it's ready when the card is reached) ----
    const startBuffering = () => {
      const go = () => { v.preload = 'auto'; seekToStart(); };
      if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 2000 }); else setTimeout(go, 300);
    };
    if (document.readyState === 'complete') startBuffering();
    else window.addEventListener('load', startBuffering, { once: true });

    // ---- hover: speed 1x -> 4x and size REST -> FULL, eased ----
    const SCALE_REST = 1.134, SCALE_FULL = 1.26, RAMP_MS = 500;   // 10% smaller
    let hoverT = 0, hoverTarget = 0, lastTs = 0;
    let filtT = 0, filtTarget = 0;   // mouse height over the video: top = open, bottom = dark
    let spinT = 0, spinTarget = 0;   // mouse across the video: slows left, speeds right
    let spaceT = 0, spaceTarget = 0; // mouse across the video: dry left, spacious right
    let tempoT = 0, tempoTarget = 0; // mouse across the video: -20..+20 BPM
    let sustT = 1, sustTarget = 1;   // mouse height: top = longer notes (1.8x), bottom = shorter (0.7x)
    if (card && matchMedia('(hover: hover)').matches) {
      card.addEventListener('mouseenter', () => { hoverTarget = 1; kick(); });
      card.addEventListener('mouseleave', () => { hoverTarget = 0; filtTarget = 0; kick(); });
      // Only the video itself is the filter surface: top of the sun = open,
      // bottom of the sun = filtered. The rest of the card leaves it open.
      const surf = box || v;
      surf.addEventListener('mousemove', e => {
        const r = surf.getBoundingClientRect();
        filtTarget = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        sustTarget = filtTarget <= 0.5 ? 1 + (0.5 - filtTarget) * 1.6 : 1 - (filtTarget - 0.5) * 0.6;
        const xn = Math.min(1, Math.max(-1, ((e.clientX - r.left) / r.width) * 2 - 1));
        spinTarget = xn < 0 ? xn * 2 : xn * 4;   // left up to -2x, right up to +4x
        spaceTarget = xn;                        // left dry, right spacious (delay + reverb)
        tempoTarget = xn * 20;                   // left -20 BPM, right +20 BPM
        kick();
      });
      surf.addEventListener('mouseleave', () => { filtTarget = 0; spinTarget = 0; spaceTarget = 0; tempoTarget = 0; sustTarget = 1; kick(); });
    }
    function stepFilter(dt) {
      const k = Math.min(1, dt * 6);
      spinT += (spinTarget - spinT) * k;
      const nextSpace = spaceT + (spaceTarget - spaceT) * k;
      if (Math.abs(nextSpace - spaceT) > 0.0005) { spaceT = nextSpace; setStemSpace(spaceT); }
      const nextTempo = tempoT + (tempoTarget - tempoT) * k;
      if (Math.abs(nextTempo - tempoT) > 0.005) { tempoT = nextTempo; setStemTempoBend(tempoT); }
      const nextSust = sustT + (sustTarget - sustT) * k;
      if (Math.abs(nextSust - sustT) > 0.002) { sustT = nextSust; setStemSustain(sustT); }
      const next = filtT + (filtTarget - filtT) * k;
      if (Math.abs(next - filtT) < 0.0005 && Math.abs(filtTarget - filtT) < 0.001) return false;
      filtT = next;
      setStemFilter(filtT);   // audio LPF slides with the mouse
      return true;
    }

    // ---- clicking through to meditatewiththesun.com (new tab) pauses the beat ----
    if (card) card.addEventListener('click', () => {
      const play = document.getElementById('seq-play');
      if (play && play.classList.contains('clicked')) play.click(); // 'clicked' = playing (main.js setPlayState)
    });
    const smooth = t => t * t * (3 - 2 * t);
    function stepHover(dt) {
      if (hoverT === hoverTarget) return false;
      const d = dt / RAMP_MS;
      hoverT = hoverTarget > hoverT ? Math.min(hoverTarget, hoverT + d) : Math.max(hoverTarget, hoverT - d);
      return true;
    }
    // Playing lifts the resting size halfway to the hover size; hover still goes to full.
    const scaleNow = () => {
      const rest = SCALE_REST + ((SCALE_REST + SCALE_FULL) / 2 - SCALE_REST) * playing;
      return (rest + (SCALE_FULL - rest) * smooth(hoverT)) * (1 + 0.08 * synthLevel);
    };

    // ---- the Solar Synth drives the sun: its output level speeds the sun up and swells it ----
    let synthLevel = 0;
    let playing = 0;                       // eases 0 -> 1 while the sequencer plays
    const synthBuf = new Uint8Array(512);
    function stepSynth() {
      const an = getStemAnalyser();
      let target = 0;
      if (an) {
        const buf = synthBuf.length === an.fftSize ? synthBuf : new Uint8Array(an.fftSize);
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
        target = Math.min(1, Math.sqrt(sum / buf.length) * 5);
      }
      synthLevel += (target - synthLevel) * (target > synthLevel ? 0.35 : 0.06);  // fast attack, slow release
      if (synthLevel < 0.001) synthLevel = 0;
      playing += ((an ? 1 : 0) - playing) * 0.05;                                   // ~1s ease in/out
      if (playing < 0.001) playing = 0;
      // spin targets: 1x at rest, 3x while playing, hover eases toward 6x from
      // wherever it is; the live synth level adds on top (capped at 8x below).
      let rate = 1 + 2 * playing;                    // rest 1x -> playing 3x
      rate += (6 - rate) * smooth(hoverT);           // hover -> 6x
      rate *= (1 + 1.5 * synthLevel);
      rate = Math.max(0.25, rate + spinT);           // mouse X trims the spin -2x..+4x
      try { if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = Math.min(8, rate); } catch (e) {}
    }

    // ---- feedback renderer ----
    const TRAIL = { zoom: 1.995, decay: 0.10, radius: 0.77, amount: 0.55 };   // per-second dials
    // Each sequencer kick gates the sun's injection off for ~100ms (audio.js calls
    // this at the audible moment), so the beat radiates outward as dark rings.
    let kickWaveUntil = 0;
    window.SONIFY_ONKICK = () => { kickWaveUntil = performance.now() + 100; };
    // ...and each hat brightens the rim injection for 100ms: a bright ring out.
    let hatFlashUntil = 0, hatBoost = 1;
    window.SONIFY_ONHAT = () => {
      hatFlashUntil = performance.now() + 100;
      hatBoost = 1.03 + Math.random() * 0.10;   // surface flares 3-13%, fresh each hat
    };
    const gl = cv && cv.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false });
    let fx = null;
    if (gl) {
      try { fx = makeTrails(gl); } catch (e) { console.warn('[sun] trails off:', e.message); fx = null; }
    }
    box && box.classList.toggle('trails-on', !!fx);
    if (!fx) v.style.transform = `scale(${SCALE_REST})`;

    function makeTrails(g) {
      const VS = `#version 300 es
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
      const FS = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uPrev;
uniform sampler2D uSun;
uniform vec2 uRes;
uniform vec3 uSunRect;
uniform float uZoom;
uniform float uDecay;
uniform float uRadius;
uniform float uAmount;
uniform float uMode;
uniform float uBright;
uniform float uSeed;
uniform float uSunBoost;
out vec4 frag;
vec3 sun(vec2 px) {
  vec2 s = (px - uSunRect.xy) / uSunRect.z;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return vec3(0.0);
  float r = length(s - 0.5) * 2.0;
  float win = 1.0 - smoothstep(0.9, 0.995, r);
  return texture(uSun, s).rgb * win;
}
void main() {
  vec2 px = vUV * uRes;
  vec2 c = uRes * 0.5;
  float r = length(px - c) / (uSunRect.z * 0.5);
  vec2 q = (c + (px - c) / uZoom) / uRes;
  vec3 prev = (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) ? vec3(0.0) : texture(uPrev, q).rgb;
  vec3 hist = prev * uDecay;
  vec3 s = sun(px);
  if (uMode < 0.5) {
    float gate = smoothstep(uRadius - 0.03, uRadius + 0.03, r);
    frag = vec4(max(hist, s * gate * uSeed), 1.0);
  } else {
    vec3 sb = s * uSunBoost;   // hat pulses flare the visible solar surface
    frag = vec4(min(vec3(1.0), mix(sb, max(hist, sb), uAmount) * uBright), 1.0);
  }
}`;
      const sh = (type, src) => {
        const o = g.createShader(type); g.shaderSource(o, src); g.compileShader(o);
        if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o));
        return o;
      };
      const prog = g.createProgram();
      g.attachShader(prog, sh(g.VERTEX_SHADER, VS));
      g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS));
      g.linkProgram(prog);
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog));
      g.useProgram(prog);
      g.bindVertexArray(g.createVertexArray());
      const u = {};
      for (const n of ['uPrev', 'uSun', 'uRes', 'uSunRect', 'uZoom', 'uDecay', 'uRadius', 'uAmount', 'uMode', 'uBright', 'uSeed', 'uSunBoost']) u[n] = g.getUniformLocation(prog, n);
      g.uniform1i(u.uPrev, 0);
      g.uniform1i(u.uSun, 1);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      const tex = (w, h) => {
        const t = g.createTexture();
        g.bindTexture(g.TEXTURE_2D, t);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        return t;
      };
      const sunTex = tex(1, 1);
      let W = 0, H = 0, ping = null, pong = null;
      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(2, Math.round(box.clientWidth * dpr));
        const h = Math.max(2, Math.round(box.clientHeight * dpr));
        if (w === W && h === H) return;
        W = w; H = h; cv.width = W; cv.height = H;
        for (const o of [ping, pong]) if (o) { g.deleteTexture(o.tex); g.deleteFramebuffer(o.fbo); }
        const make = () => {
          const t = tex(W, H), fbo = g.createFramebuffer();
          g.bindFramebuffer(g.FRAMEBUFFER, fbo);
          g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
          g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT);
          return { tex: t, fbo };
        };
        ping = make(); pong = make();
        g.bindFramebuffer(g.FRAMEBUFFER, null);
        g.uniform2f(u.uRes, W, H);
      }
      function draw(dt) {
        resize();
        if (v.readyState < 2) return;
        const side = Math.min(W, H) * scaleNow();
        g.uniform3f(u.uSunRect, (W - side) / 2, (H - side) / 2, side);
        g.activeTexture(g.TEXTURE1);
        g.bindTexture(g.TEXTURE_2D, sunTex);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, v);
        g.activeTexture(g.TEXTURE0);
        g.bindTexture(g.TEXTURE_2D, ping.tex);
        // More feedback while the synth plays: trails linger longer and stream out faster.
        const L = synthLevel;
        g.uniform1f(u.uZoom, Math.pow(TRAIL.zoom + 0.9 * L, dt));
        // While playing, trails keep most of their light per second (0.10 at rest -> 0.92 at full level),
        // so they survive long enough to stream all the way to the card's edges.
        g.uniform1f(u.uDecay, Math.pow(TRAIL.decay + (0.92 - TRAIL.decay) * L, dt));
        g.uniform1f(u.uRadius, TRAIL.radius);
        g.uniform1f(u.uAmount, Math.min(1, TRAIL.amount + 0.3 * synthLevel));
        g.uniform1f(u.uBright, (1 + 0.6 * L) * (1 - 0.35 * filtT));   // synth swell, dimmed as the filter closes
        // Kick wave: each kick closes the seed injection for a moment, carving a
        // dark ring at the rim that rides the flow outward. Hats push it the other
        // way: a brighter rim for 100ms becomes a bright ring riding the same flow.
        const nowMs = performance.now();
        g.uniform1f(u.uSeed, nowMs < kickWaveUntil ? 0.0 : (nowMs < hatFlashUntil ? 1.5 : 1.0));
        g.uniform1f(u.uSunBoost, nowMs < hatFlashUntil ? hatBoost : 1.0);
        g.viewport(0, 0, W, H);
        g.bindFramebuffer(g.FRAMEBUFFER, pong.fbo);
        g.uniform1f(u.uMode, 0);
        g.drawArrays(g.TRIANGLES, 0, 3);
        g.bindFramebuffer(g.FRAMEBUFFER, null);
        g.uniform1f(u.uMode, 1);
        g.drawArrays(g.TRIANGLES, 0, 3);
        [ping, pong] = [pong, ping];
      }
      return { draw };
    }

    // ---- run only while visible ----
    let visible = false, raf = 0;
    function frame(ts) {
      raf = 0;
      if (!visible) return;
      const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 1 / 60;
      lastTs = ts;
      stepHover(dt * 1000);
      stepFilter(dt);
      stepSynth();
      if (fx) fx.draw(dt);
      else v.style.transform = `scale(${scaleNow()})`;
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (visible && !raf) { lastTs = 0; raf = requestAnimationFrame(frame); } }
    const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const setVisible = on => {
      visible = on && !document.hidden;
      if (visible) { tryPlay(); kick(); } else { v.pause(); }
    };
    if ('IntersectionObserver' in window) {
      let inView = false;
      new IntersectionObserver(([en]) => { inView = en.isIntersecting; setVisible(inView); }, { threshold: 0.05 }).observe(box || v);
      document.addEventListener('visibilitychange', () => setVisible(inView));
    } else {
      setVisible(true);
    }
  })();

  // ===== 4. Hero scroll cue on load =====
  // Sonara only reveals the chevron after a Listen click (and then ~10s later).
  // A first-time viewer needs the "scroll down" cue without doing anything, so
  // arm a chevron-only hint a few seconds after load. Sonara's own logic takes
  // over from there: it dismisses the hint on scroll-away and shows the data
  // caption once the solar wind is playing.
  (function armHeroCue() {
    const hero = document.querySelector('section[data-page="hero"]');
    const hint = hero && hero.querySelector('.scroll-hint');
    if (!hint) return;
    const REVEAL_MS = 4000, PULSE_MS = 1200;
    setTimeout(() => {
      if (hint.dataset.dismissed === '1' || hint.classList.contains('visible')) return;
      const rect = hero.getBoundingClientRect();
      if (rect.bottom < window.innerHeight * 0.5) return; // already scrolled past
      hint.classList.add('chevron-only', 'visible', 'show-chevron');
      setTimeout(() => {
        if (hint.dataset.dismissed !== '1') hint.classList.add('pulsing');
      }, PULSE_MS);
    }, REVEAL_MS);
  })();

  // ===== 3. Jump links: data-jump="<data-page>" scrolls to that page wherever it sits in PAGE_ORDER =====
  document.querySelectorAll('[data-jump]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(`section[data-page="${link.dataset.jump}"]`);
      if (!target) return; // page not in PAGE_ORDER: let the href fallback do its thing
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
