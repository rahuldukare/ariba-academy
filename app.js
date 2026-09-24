(function () {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const $ = (id) => document.getElementById(id);
  const num = (v) => Number(String(v || '').replace(/[^0-9.]/g, '')) || 0;
  const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

  function render(d) {
    document.querySelectorAll('[data-bind]').forEach((el) => {
      const v = get(d, el.dataset.bind);
      if (v !== undefined && v !== null && v !== '') el.textContent = v;
    });
    if (d.seo) {
      if (d.seo.title) document.title = d.seo.title;
      const m = document.querySelector('meta[name="description"]');
      if (m && d.seo.description) m.setAttribute('content', d.seo.description);
    }

    $('hero-highlights').innerHTML = (d.hero?.highlights || []).map((h) => `<li>${check}${esc(h)}</li>`).join('');
    $('pain-list').innerHTML = (d.painPoints?.items || []).map((h) => `<li>${esc(h)}</li>`).join('');

    $('modules').innerHTML = (d.curriculum || [])
      .map(
        (m, i) => `
      <details class="module" ${i === 0 ? 'open' : ''}>
        <summary>
          <span class="module-week">${esc(m.week)}</span>
          <span class="module-title">${esc(m.title)}</span>
          <span class="module-hours">${esc(m.hours)}</span>
        </summary>
        <ul>${(m.topics || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </details>`
      )
      .join('');

    $('audience').innerHTML = (d.audience || [])
      .map((a, i) => `<div class="card"><span class="card-num">0${i + 1}</span><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></div>`)
      .join('');

    const bonuses = d.bonuses || [];
    $('bonuses').innerHTML = bonuses
      .map(
        (b, i) => `<div class="card bonus"><p class="bonus-tag">Bonus ${i + 1}</p><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p>
        <p class="bonus-val"><s>${esc(b.value)}</s> <strong>FREE</strong></p></div>`
      )
      .join('');
    const total = bonuses.reduce((s, b) => s + num(b.value), 0);
    $('bonus-total').textContent = (d.course?.currency || '₹') + total.toLocaleString('en-IN');

    const mentor = d.mentor || {};
    const initials = (mentor.name || 'AA').split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
    $('mentor-photo').innerHTML = mentor.photo
      ? `<img src="${esc(mentor.photo)}" alt="${esc(mentor.name)}" loading="lazy" />`
      : `<span>${esc(initials)}</span>`;
    $('mentor-stats').innerHTML = (mentor.stats || [])
      .map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
      .join('');

    const t = d.testimonials || [];
    if (t.length) {
      $('testimonials-section').hidden = false;
      $('testimonials').innerHTML = t
        .map((x) => `<figure class="card"><blockquote>“${esc(x.text)}”</blockquote><figcaption><strong>${esc(x.name)}</strong><span>${esc(x.role)}</span></figcaption></figure>`)
        .join('');
    }

    $('cert-points').innerHTML = (d.certificate?.points || []).map((h) => `<li>${check}${esc(h)}</li>`).join('');

    $('faq-list').innerHTML = (d.faqs || [])
      .map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
      .join('');

    const c = d.contact || {};
    const links = [];
    if (c.whatsapp) links.push(`<a class="btn btn-wa" href="https://wa.me/${esc(c.whatsapp.replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">Chat on WhatsApp</a>`);
    if (c.phone) links.push(`<a href="tel:${esc(c.phone.replace(/\s/g, ''))}">📞 ${esc(c.phone)}</a>`);
    if (c.email) links.push(`<a href="mailto:${esc(c.email)}">✉️ ${esc(c.email)}</a>`);
    $('contact-links').innerHTML = links.join('');

    const p = num(d.course?.price), o = num(d.course?.originalPrice);
    $('discount-badge').textContent = o > p && p > 0 ? `${Math.round((1 - p / o) * 100)}% OFF` : '';
    if (!(o > p)) document.querySelectorAll('.old-price').forEach((el) => (el.hidden = true));

    startCountdown(d.course?.batchDate);
  }

  let timer;
  function startCountdown(iso) {
    const target = new Date(iso);
    const box = document.querySelector('[data-countdown]');
    const dateText = $('batch-date-text');
    if (isNaN(target)) { dateText.textContent = 'To be announced'; return; }
    dateText.textContent = target.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    $('batch-field').value = target.toISOString().slice(0, 10);
    const pad = (n) => String(n).padStart(2, '0');
    clearInterval(timer);
    const tick = () => {
      let diff = Math.max(0, target - Date.now()) / 1000;
      const dd = Math.floor(diff / 86400); diff -= dd * 86400;
      const hh = Math.floor(diff / 3600); diff -= hh * 3600;
      const mm = Math.floor(diff / 60); const ss = Math.floor(diff - mm * 60);
      box.querySelector('[data-d]').textContent = pad(dd);
      box.querySelector('[data-h]').textContent = pad(hh);
      box.querySelector('[data-m]').textContent = pad(mm);
      box.querySelector('[data-s]').textContent = pad(ss);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  $('year').textContent = new Date().getFullYear();

  fetch('/content/site.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then(render)
    .catch((e) => console.error('Could not load site content', e));
})();
