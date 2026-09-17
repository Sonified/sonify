/* ============================================================
   Inline contact form (Work with Robert page)
   - ?type=student|educator|producer|researcher|company|curious pre-selects "I am a...";
     ?interest=mentorship|workshop|talk|commission|research pre-checks "I'm interested in...".
   - Submits to the Google Form's formResponse endpoint (no redirect),
     or to Formspree when SONIFY.FORM.formspree is set.
   Config: window.SONIFY.FORM in js/pages.js
   ============================================================ */
(function () {
  'use strict';
  const form = document.getElementById('contact-form');
  const cfg = window.SONIFY && window.SONIFY.FORM;
  if (!form || !cfg) return;

  const el = form.elements; // named controls (form.name would be the form's own name attribute)
  const success = form.parentElement.querySelector('.cf-success');
  const status = form.querySelector('.cf-status');
  const submitBtn = form.querySelector('.cf-submit');
  const interestOther = form.querySelector('.cf-interest-other');

  // ----- choice layout: 'list' or 'chips' (SONIFY.FORM.style) -----
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const STYLE_KEY = 'sonify_formStyle';
  function applyStyle(name) {
    const style = name === 'chips' ? 'chips' : 'list';
    form.classList.toggle('cf--list', style === 'list');
    form.classList.toggle('cf--chips', style === 'chips');
    return style;
  }
  let localStyle = null;
  if (isLocal) { try { localStyle = localStorage.getItem(STYLE_KEY); } catch (e) {} }
  let currentStyle = applyStyle(localStyle || cfg.style || 'list');
  if (isLocal) {
    // Localhost only: click the portrait to flip the layout (remembered in this browser).
    const photo = document.querySelector('.wwr-photo');
    if (photo) {
      photo.style.cursor = 'pointer';
      photo.title = 'Toggle form layout (localhost only)';
      photo.addEventListener('click', () => {
        const root = document.documentElement;
        const before = photo.getBoundingClientRect().top;
        root.style.scrollSnapType = 'none';
        currentStyle = applyStyle(currentStyle === 'list' ? 'chips' : 'list');
        window.scrollBy(0, photo.getBoundingClientRect().top - before);
        requestAnimationFrame(() => requestAnimationFrame(() => { root.style.scrollSnapType = ''; }));
        try { localStorage.setItem(STYLE_KEY, currentStyle); } catch (e) {}
        console.log('[contact-form] layout:', currentStyle);
      });
    }
  }

  // ----- message box grows with its text (manual drag-resize still works on desktop) -----
  const msg = el.message;
  if (msg) {
    const grow = () => {
      if (msg.scrollHeight > msg.clientHeight) {
        msg.style.height = 'auto';
        msg.style.height = (msg.scrollHeight + 2) + 'px';
      }
    };
    msg.addEventListener('input', grow);
  }

  // ----- after the email: reveal the rest of the form -----
  // People who fill in name + email shouldn't think that's the whole form.
  const roleGroup = form.querySelector('input[name="role"]')?.closest('.cf-group');
  let revealed = false;
  const emailError = document.getElementById('cf-email-error');
  function showEmailError(on) {
    if (!emailError) return;
    emailError.classList.toggle('is-shown', on);
    el.email.setAttribute('aria-invalid', on ? 'true' : 'false');
    const field = el.email.closest('.cf-field');
    if (on) field.classList.add('cf-invalid'); else field.classList.remove('cf-invalid');
  }
  function checkEmail() {
    const v = el.email.value.trim();
    showEmailError(v !== '' && !EMAIL_RE.test(v));
  }
  el.email.addEventListener('blur', checkEmail);
  el.email.addEventListener('input', () => {
    // Only clear while typing; never nag mid-word.
    if (emailError.classList.contains('is-shown') && EMAIL_RE.test(el.email.value.trim())) showEmailError(false);
  });

  function revealRest() {
    if (revealed || !roleGroup) return;
    const email = el.email.value.trim();
    if (!EMAIL_RE.test(email)) return;
    const r = roleGroup.getBoundingClientRect();
    const vh = window.innerHeight;
    // Only move if the next question isn't really on screen: its heading plus the first row
    // of options (~90px) must be visible for us to leave the page alone.
    if (r.top + 90 <= vh) { revealed = true; return; }
    revealed = true;
    // Bring the options up to about a third of the way down the screen.
    window.scrollBy({ top: r.top - vh * 0.35, behavior: 'smooth' });
  }
  el.email.addEventListener('change', revealRest);
  el.email.addEventListener('blur', revealRest);
  // Enter in Name moves to Email; Enter in Email reveals the options instead of submitting.
  el.name.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); el.email.focus(); }
  });
  el.email.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); checkEmail(); if (EMAIL_RE.test(el.email.value.trim())) { el.email.blur(); revealRest(); } }
  });

  // ----- conditional fields -----
  function syncConditionals() {
    const intOther = form.querySelector('input[name="interests"][value="__other_option__"]').checked;
    interestOther.hidden = !intOther;
  }
  form.addEventListener('change', syncConditionals);

  // ----- deep link: ?type=student etc. -----
  const qs = new URLSearchParams(location.search);
  const TYPE_ALIASES = { corporate: 'company', agency: 'company', musician: 'producer', scientist: 'researcher', other: 'curious' };
  const type = (qs.get('type') || '').toLowerCase();
  if (type) {
    const r = form.querySelector(`input[name="role"][data-type="${CSS.escape(TYPE_ALIASES[type] || type)}"]`);
    if (r) r.checked = true;
  }
  (qs.get('interest') || '').toLowerCase().split(',').filter(Boolean).forEach(t => {
    const c = form.querySelector(`input[name="services"][data-type="${CSS.escape(t.trim())}"]`);
    if (c) c.checked = true;
  });
  syncConditionals();

  // ----- validation -----
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function markError(node) {
    (node.closest('.cf-field') || node.closest('.cf-group') || node).classList.add('cf-invalid');
  }
  function clearError(node) {
    (node.closest('.cf-field') || node.closest('.cf-group') || node).classList.remove('cf-invalid');
  }
  // The email field manages its own error state (message + border) in checkEmail().
  // Once every highlighted field is corrected, the red submit message resets too
  // (checked a tick later, after all handlers have updated their own state).
  function maybeClearStatus() {
    setTimeout(() => {
      if (status.classList.contains('is-error') && !form.querySelector('.cf-invalid')) {
        status.textContent = '';
        status.classList.remove('is-error');
      }
    }, 0);
  }
  form.addEventListener('input', e => { if (e.target !== el.email) clearError(e.target); maybeClearStatus(); });
  form.addEventListener('change', e => { if (e.target !== el.email) clearError(e.target); maybeClearStatus(); });

  function validate() {
    let firstBad = null;
    const bad = el => { markError(el); if (!firstBad) firstBad = el; };
    form.querySelectorAll('input[type="text"], input[type="email"]').forEach(i => {
      if (i.closest('[hidden]')) return;
      const v = i.value.trim();
      if (i.required && !v) bad(i);
      else if (i.type === 'email' && v && !EMAIL_RE.test(v)) { bad(i); if (i === el.email) showEmailError(true); }
    });
    ['role'].forEach(name => {
      if (!form.querySelector(`input[name="${name}"]:checked`)) bad(form.querySelector(`input[name="${name}"]`));
    });
    return firstBad;
  }

  // ----- payload -----
  function collect() {
    const f = el;
    const role = form.querySelector('input[name="role"]:checked');
    const interests = Array.from(form.querySelectorAll('input[name="interests"]:checked')).map(i => i.value);
    const services = Array.from(form.querySelectorAll('input[name="services"]:checked')).map(i => i.value);
    return {
      name: f.name.value.trim(),
      email: f.email.value.trim(),
      role: role ? role.value : '',
      services,
      interests,
      interestsOther: f.interestsOther.value.trim(),
      message: f.message.value.trim(),
    };
  }

  function googleBody(d) {
    const e = cfg.entries;
    const b = new URLSearchParams();
    b.append(e.name, d.name);
    b.append(e.email, d.email);
    b.append(e.role, d.role);
    d.services.forEach(v => b.append(e.services, v));
    d.interests.forEach(v => b.append(e.interests, v));
    if (d.interests.includes('__other_option__')) b.append(e.interests + '.other_option_response', d.interestsOther || 'Other');
    if (d.message) b.append(e.message, d.message);
    b.append('fvv', '1');
    return b;
  }

  function readable(d) {
    const ints = d.interests.map(v => v === '__other_option__' ? `Other: ${d.interestsOther}` : v).join(', ');
    return { role: d.role, services: d.services.join(', '), interests: ints };
  }

  async function send(d) {
    if (cfg.formspree) {
      const r = readable(d);
      const res = await fetch(cfg.formspree, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: d.name, email: d.email,
          role: r.role, services: r.services, interests: r.interests, message: d.message,
        }),
      });
      if (!res.ok) throw new Error('formspree ' + res.status);
      return;
    }
    // Google Forms does not send CORS headers; an opaque no-cors POST still records the response.
    await fetch(cfg.action, { method: 'POST', mode: 'no-cors', body: googleBody(d) });
  }

  function mailtoFallback(d) {
    const r = readable(d);
    const lines = [
      `Name: ${d.name}`, `Email: ${d.email}`,
      `I am a: ${r.role}`, r.services ? `Interested in: ${r.services}` : '', r.interests ? `Curious about: ${r.interests}` : '',
      d.message ? `\n${d.message}` : '',
    ].filter(Boolean).join('\n');
    return `mailto:${cfg.email}?subject=${encodeURIComponent('Sound Science: Work with Robert')}&body=${encodeURIComponent(lines)}`;
  }

  // ----- submit -----
  let sending = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    status.textContent = '';
    status.classList.remove('is-error');
    const firstBad = validate();
    if (firstBad) {
      status.textContent = 'Please fill in the highlighted fields.';
      status.classList.add('is-error');
      firstBad.focus({ preventScroll: true });
      firstBad.closest('.cf-field, .cf-group')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const data = collect();
    sending = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      await send(data);
      try { localStorage.removeItem('sonify_cf_draft'); } catch (e2) {}
      form.hidden = true;
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      console.warn('[contact-form] send failed', err);
      status.innerHTML = `Something went wrong sending that. <a href="${mailtoFallback(data)}">Send it by email instead</a>.`;
      status.classList.add('is-error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    } finally {
      sending = false;
    }
  });
  // ----- draft: progress survives a reload, in this browser only -----
  // Every edit is saved (debounced); reopening restores the fields and, when
  // the page loads back onto Connect, the exact scroll position. A successful
  // send clears it.
  const DRAFT_KEY = 'sonify_cf_draft';
  const textFields = () => form.querySelectorAll('input[type="text"], input[type="email"], textarea');
  let draftTimer = 0;
  function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const d = { text: {}, checks: [], y: Math.round(window.scrollY), t: Date.now() };
        textFields().forEach((i, n) => { if (i.value.trim()) d.text[i.name || 'f' + n] = i.value; });
        form.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked')
          .forEach(i => d.checks.push(i.name + '\u0000' + i.value));
        if (!Object.keys(d.text).length && !d.checks.length) localStorage.removeItem(DRAFT_KEY);
        else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      } catch (e) {}
    }, 300);
  }
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);

  // While a draft exists, remember where on the page they are.
  let yTimer = 0;
  window.addEventListener('scroll', () => {
    if (yTimer) return;
    yTimer = setTimeout(() => {
      yTimer = 0;
      try {
        const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (d) { d.y = Math.round(window.scrollY); localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); }
      } catch (e) {}
    }, 400);
  }, { passive: true });

  (function restoreDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) {}
    if (!d) return;
    try {
      textFields().forEach((i, n) => {
        const k = i.name || 'f' + n;
        if (d.text && d.text[k] != null && !i.value) i.value = d.text[k];
      });
      (d.checks || []).forEach(kv => {
        const parts = kv.split('\u0000');
        const box = form.querySelector(`input[name="${CSS.escape(parts[0])}"][value="${CSS.escape(parts[1])}"]`);
        if (box) box.checked = true;
      });
      syncConditionals();
      if (el.message && el.message.value) el.message.dispatchEvent(new Event('input'));  // regrow the box
      // Land them right where they were, once the page's own jump has settled.
      if (d.y > 200 && /connect/.test(location.hash)) {
        const apply = () => {
          const root = document.documentElement;
          root.style.scrollSnapType = 'none';
          window.scrollTo(0, d.y);
          requestAnimationFrame(() => requestAnimationFrame(() => { root.style.scrollSnapType = ''; }));
        };
        if (document.readyState === 'complete') setTimeout(apply, 250);
        else window.addEventListener('load', () => setTimeout(apply, 250), { once: true });
      }
    } catch (e) {}
  })();
})();