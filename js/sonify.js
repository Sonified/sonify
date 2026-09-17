/**
 * SONIFY additions on top of the Sonara runtime:
 *   1. Click-to-play YouTube facades (thumbnail + play button → iframe).
 *      Leaving a page tears the iframe down so audio never bleeds into
 *      the next page during a presentation.
 *   2. Solar flow canvas: golden energy streaming right from the headshot
 *      on the "work with Robert" page.
 */

(function () {
  'use strict';

  // ===== 1. YouTube facades =====
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

    function activate() {
      if (el.querySelector('iframe')) return;
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
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

    el.addEventListener('click', activate);
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
