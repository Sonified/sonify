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
    'synth',             // Sequencer + wavetable synth (from Sonara)
    'work-with-robert',  // Headshot, logos, contact
    // Available but not shown by default (add back here, or use ?pages=...):
    //   'nasa-video'        Listen To SPACE (NASA Video)
    //   'audio-production'  HARP + Edgar Mitchell VR
    //   'pop'               JVKE golden hour + sample pack + Rolling Stone
  ],

  LINKS: {
    // Public share link to the Solar Sample Pack zip (Dropbox / Drive / GitHub release)
    samplePack: '',

    // Google Form URL for "Start a conversation". Blank = falls back to email.
    googleForm: '',

    // Optional: the Google Form *embed* URL (the one ending in ?embedded=true).
    // When set, the form renders inline under the CTA instead of opening a tab.
    googleFormEmbed: '',

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
  const param = new URLSearchParams(location.search).get('pages');
  const order = param
    ? param.split(',').map(s => s.trim()).filter(Boolean)
    : cfg.PAGE_ORDER;

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

  // ----- 3. Optional inline Google Form -----
  const embed = document.getElementById('form-embed');
  if (embed && cfg.LINKS.googleFormEmbed) {
    const iframe = document.createElement('iframe');
    iframe.src = cfg.LINKS.googleFormEmbed;
    iframe.title = 'Contact form';
    iframe.loading = 'lazy';
    embed.appendChild(iframe);
    embed.hidden = false;
  }
})();
