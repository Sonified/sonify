/* ============================================================
   Inline contact form (Work with Robert page)
   - "Other" role: reveals and requires a short text field.
   - ?type=student|educator|corporate|researcher|other pre-selects the role.
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
  const roleOther = form.querySelector('.cf-other');
  const interestOther = form.querySelector('.cf-interest-other');

  // ----- conditional fields -----
  function syncConditionals() {
    const other = form.querySelector('input[name="role"]:checked')?.dataset.type === 'other';
    roleOther.hidden = !other;
    el.roleOther.required = other;
    if (!other) clearError(el.roleOther);

    const intOther = form.querySelector('input[name="interests"][value="__other_option__"]').checked;
    interestOther.hidden = !intOther;
  }
  form.addEventListener('change', syncConditionals);

  // ----- deep link: ?type=student etc. -----
  const type = new URLSearchParams(location.search).get('type');
  if (type) {
    const r = form.querySelector(`input[name="role"][data-type="${CSS.escape(type.toLowerCase())}"]`);
    if (r) r.checked = true;
  }
  syncConditionals();

  // ----- validation -----
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function markError(node) {
    (node.closest('.cf-field') || node.closest('.cf-group') || node).classList.add('cf-invalid');
  }
  function clearError(node) {
    (node.closest('.cf-field') || node.closest('.cf-group') || node).classList.remove('cf-invalid');
  }
  form.addEventListener('input', e => clearError(e.target));
  form.addEventListener('change', e => clearError(e.target));

  function validate() {
    let firstBad = null;
    const bad = el => { markError(el); if (!firstBad) firstBad = el; };
    form.querySelectorAll('input[type="text"], input[type="email"]').forEach(i => {
      if (i.closest('[hidden]')) return;
      const v = i.value.trim();
      if (i.required && !v) bad(i);
      else if (i.type === 'email' && v && !EMAIL_RE.test(v)) bad(i);
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
    return {
      name: f.name.value.trim(),
      email: f.email.value.trim(),
      role: role ? role.value : '',
      roleOther: f.roleOther.value.trim(),
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
    if (d.role === '__other_option__') b.append(e.role + '.other_option_response', d.roleOther);
    d.interests.forEach(v => b.append(e.interests, v));
    if (d.interests.includes('__other_option__')) b.append(e.interests + '.other_option_response', d.interestsOther || 'Other');
    if (d.message) b.append(e.message, d.message);
    b.append('fvv', '1');
    return b;
  }

  function readable(d) {
    const role = d.role === '__other_option__' ? `Other: ${d.roleOther}` : d.role;
    const ints = d.interests.map(v => v === '__other_option__' ? `Other: ${d.interestsOther}` : v).join(', ');
    return { role, interests: ints };
  }

  async function send(d) {
    if (cfg.formspree) {
      const r = readable(d);
      const res = await fetch(cfg.formspree, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: d.name, email: d.email,
          role: r.role, interests: r.interests, message: d.message,
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
      `Describes me: ${r.role}`, r.interests ? `Curious about: ${r.interests}` : '',
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
})();
