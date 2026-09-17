/* ============================================================
   SONIFY — page order & links
   ------------------------------------------------------------
   This is the one file to edit when you want to rearrange the site.

   PAGE_ORDER  Names match <section data-page="..."> in index.html.
               Pages listed here appear in this order. Pages left
               out are removed from the DOM entirely (their canvases
               and audio never initialize, so there is no cost).

   Try an order without editing anything:
     http://localhost:3334/?pages=hero,synth,work-with-robert

   LINKS       Anything with data-link="key" in index.html gets its
               href from here. Leave a value blank and the element is
               marked .is-pending (shows a "coming soon" note, or falls
               back to email for the contact button).
   ============================================================ */
window.SONIFY = {
  PAGE_ORDER: [
    'hero',              // Sound Science title + solar wind
    'nasa-video',        // Listen To SPACE (NASA Video)
    'audio-production',  // HARP + Edgar Mitchell VR
    'pop',               // JVKE golden hour + sample pack + Rolling Stone
    'synth',             // Sequencer + wavetable synth (from Sonara)
    'work-with-robert',  // Headshot, logos, contact
  ],

  // Shareable page links: sonify.now.audio/#connect etc. (js/sonify.js keeps the
  // address bar in sync while scrolling and jumps to the page on load).
  SLUGS: {
    'hero':             'soundscience',
    'nasa-video':       'listen',
    'audio-production': 'experience',
    'pop':              'music',
    'synth':            'play',
    'work-with-robert': 'connect',
    'qr':               'qr',
  },

  // Phone-only switches (desktop ignores these)
  MOBILE: {
    blobs: false,        // nebula blobs behind "Step inside the data"
    starEmitter: false,  // the slow wandering emitter that adds stars to the starfield
  },

  // Inline contact form on the Work with Robert page (js/contact-form.js).
  // Posts to the "Sound Science: Work with Robert" Google Form. Entry IDs are the
  // form's questionIds converted from hex (Forms API: GET forms/<id>).
  // Choice values on the page must match the form's option text exactly.
  FORM: {
    // Choice layout: 'list' (vertical checkboxes / radio buttons, like straka.la)
    // or 'chips' (pill buttons). On localhost, clicking the portrait flips between them.
    style: 'list',
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSf0D42jndoFzznXSsRWfbnjAB_u8ek0O-mHcxKnZ_7bdJG1SQ/formResponse',
    entries: {
      name:          'entry.1406118423',
      email:         'entry.1404109041',
      role:          'entry.1804815478', // I am a...
      services:      'entry.1296234172', // I'm interested in...
      interests:     'entry.1609566717', // data curiosity
      message:       'entry.135140102',
    },
    // Optional fallback: a Formspree endpoint (https://formspree.io/f/xxxx). When set, it is used instead.
    formspree: '',
    email: 'robert@auralab.io',
  },

  LINKS: {
    // Public share link to the Solar Sample Pack zip (Dropbox / Drive / GitHub release)
    samplePack: 'https://data.now.audio/samples/Solar_Sample_Pack_I.zip',

    // Google Form URL for "Start a conversation". Blank = falls back to email.
    googleForm: 'https://docs.google.com/forms/d/e/1FAIpQLSf0D42jndoFzznXSsRWfbnjAB_u8ek0O-mHcxKnZ_7bdJG1SQ/viewform',

    // The Google Form *embed* URL (the one ending in ?embedded=true).
    // When set, "Start a conversation" opens the form inline in a modal over the
    // page (the last page is a fixed 100vh section, so it cannot grow to hold a
    // form). Blank it to have the button open the form in a new tab instead.
    googleFormEmbed: 'https://docs.google.com/forms/d/e/1FAIpQLSf0D42jndoFzznXSsRWfbnjAB_u8ek0O-mHcxKnZ_7bdJG1SQ/viewform?embedded=true',

    rollingStone: 'https://www.rollingstone.co.uk/culture/tiktok-star-jvke-announces-new-version-of-golden-hour-featuring-sounds-from-nasa-library-29304/',
    email: 'mailto:robert@auralab.io',
  },
};

(function () {
  'use strict';
  const cfg = window.SONIFY;
  const main = document.getElementById('pages');
  if (!main) return;

  // ----- 1. Page order -----
  const qs = new URLSearchParams(location.search);
  const param = qs.get('pages');
  const order = (param
    ? param.split(',').map(s => s.trim()).filter(Boolean)
    : cfg.PAGE_ORDER).slice();

  // ?qr=1 appends the QR page after everything else (presentation mode: scroll
  // one past the end to reveal the code). Never shown otherwise.
  if (qs.get('qr') === '1' && !order.includes('qr')) order.push('qr');

  const all = Array.from(main.querySelectorAll('section[data-page]'));
  const byName = new Map(all.map(s => [s.dataset.page, s]));
  const used = new Set();

  order.forEach(name => {
    const s = byName.get(name);
    if (!s) { console.warn(`[pages] no <section data-page="${name}"> found, skipping`); return; }
    if (used.has(name)) return;
    main.appendChild(s); // appending an existing node moves it to the end
    used.add(name);
  });

  all.forEach(s => { if (!used.has(s.dataset.page)) s.remove(); });

  const finalPages = Array.from(main.querySelectorAll('section[data-page]'));
  finalPages.forEach((s, i) => {
    s.classList.toggle('is-first', i === 0);
    s.classList.toggle('is-last', i === finalPages.length - 1);
  });
  console.log('[pages] order:', finalPages.map(s => s.dataset.page).join(' → '));

  // ----- 1b. Phone switches (runs before visuals.js, so removed canvases never initialize) -----
  const isPhone = document.documentElement.classList.contains('is-mobile');
  if (isPhone) {
    // Phones: starfield stays a fixed layer behind every page; no spectrum bars.
    document.getElementById('spectrum-canvas')?.remove();
    if (cfg.MOBILE && !cfg.MOBILE.blobs) {
      document.getElementById('vision-canvas')?.remove();
      document.querySelector('#vision .vision-bg')?.remove(); // its static glow wash too
    }
  } else {
    // Desktop: starfield lives inside the Listen to Space page, as in Sonara.
    const stars = document.getElementById('edu-canvas');
    const home = document.getElementById('education');
    if (stars && home) home.insertBefore(stars, home.firstChild);
  }

  // ----- 2. Links -----
  document.querySelectorAll('[data-link]').forEach(el => {
    const key = el.dataset.link;
    const url = cfg.LINKS[key];
    if (url) {
      el.href = url;
      el.classList.remove('is-pending');
      return;
    }
    el.classList.add('is-pending');
    if (key === 'googleForm') {
      el.href = cfg.LINKS.email || '#';
      el.removeAttribute('target');
    } else {
      el.href = '#';
      el.addEventListener('click', e => e.preventDefault());
    }
  });

  // ----- 3. Inline Google Form (modal) -----
  // #form-embed fills with the form iframe and is presented as a modal over the
  // page when the CTA is clicked. The CTA keeps its real href, so middle-click,
  // no-JS, and the secondary email link all still work.
  const embed = document.getElementById('form-embed');
  if (embed && cfg.LINKS.googleFormEmbed) {
    const iframe = document.createElement('iframe');
    iframe.title = 'Start a conversation';
    iframe.loading = 'lazy';
    embed.appendChild(iframe);

    const modal = document.createElement('div');
    modal.id = 'form-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="form-modal-backdrop" data-close></div>
      <div class="form-modal-panel" role="dialog" aria-modal="true" aria-label="Start a conversation">
        <div class="form-modal-bar">
          <span class="form-modal-title">Start a conversation</span>
          <a class="form-modal-newtab" href="${cfg.LINKS.googleForm || cfg.LINKS.googleFormEmbed}" target="_blank" rel="noopener">Open in new tab</a>
          <button type="button" class="form-modal-close" data-close aria-label="Close">&times;</button>
        </div>
      </div>`;
    modal.querySelector('.form-modal-panel').appendChild(embed);
    embed.hidden = false;
    document.body.appendChild(modal);

    let lastFocus = null;
    function openModal() {
      if (!iframe.src) iframe.src = cfg.LINKS.googleFormEmbed; // load on first open
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.documentElement.classList.add('modal-open');
      requestAnimationFrame(() => modal.classList.add('is-open'));
    }
    function closeModal() {
      modal.classList.remove('is-open');
      document.documentElement.classList.remove('modal-open');
      setTimeout(() => { modal.hidden = true; }, 250);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

    document.querySelectorAll('[data-link="googleForm"]').forEach(btn => {
      btn.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // respect open-in-new-tab gestures
        if (document.documentElement.classList.contains('is-mobile')) return; // phones: open the form itself, no modal
        e.preventDefault();
        openModal();
      });
    });
  }
})();
