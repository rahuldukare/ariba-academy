/*
 * SEO build step (runs on Netlify before each deploy — see netlify.toml).
 *
 * Reads content/site.json and:
 *   1. Pre-renders all page content into index.html, so search engines,
 *      social previews and AI crawlers see the full page without running JS.
 *      (app.js still re-renders in the browser, so nothing changes visually.)
 *   2. Updates <title>, meta description, canonical, Open Graph / Twitter tags.
 *   3. Injects JSON-LD structured data (Organization, Course, FAQPage, Person).
 *   4. Writes sitemap.xml with today's date.
 *
 * No dependencies. Run locally with:  node build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const SITE_URL = ((d.seo && d.seo.siteUrl) || 'https://aribaacademy.com').replace(/\/+$/, '');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const num = (v) => Number(String(v || '').replace(/[^0-9.]/g, '')) || 0;
const abs = (u) => (!u ? '' : /^https?:\/\//.test(u) ? u : SITE_URL + (u.startsWith('/') ? '' : '/') + u);
const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------- helpers ----------
function fillId(id, inner) {
  const re = new RegExp(`(<(\\w+)\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</\\2>)`);
  if (!re.test(html)) throw new Error(`build.js: element #${id} not found in index.html`);
  html = html.replace(re, (_, open, _tag, close) => open + inner + close);
}
function fillBinds() {
  html = html.replace(/(<(\w+)\b[^>]*\bdata-bind="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, _tag, key, text, close) => {
    const v = get(d, key);
    return v !== undefined && v !== null && v !== '' ? open + esc(v) + close : m;
  });
}
function setHead(marker, content) {
  const re = /<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/;
  html = html.replace(re, `<!-- SEO:START -->\n${content}\n  <!-- SEO:END -->`);
}

// ---------- 1. body content ----------
fillBinds();
fillId('hero-highlights', (d.hero?.highlights || []).map((h) => `<li>${check}${esc(h)}</li>`).join(''));
fillId('pain-list', (d.painPoints?.items || []).map((h) => `<li>${esc(h)}</li>`).join(''));
fillId(
  'modules',
  (d.curriculum || [])
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
    .join('')
);
fillId(
  'audience',
  (d.audience || [])
    .map((a, i) => `<div class="card"><span class="card-num">0${i + 1}</span><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p></div>`)
    .join('')
);
const bonuses = d.bonuses || [];
fillId(
  'bonuses',
  bonuses
    .map(
      (b, i) => `<div class="card bonus"><p class="bonus-tag">Bonus ${i + 1}</p><h3>${esc(b.title)}</h3><p>${esc(b.text)}</p>
        <p class="bonus-val"><s>${esc(b.value)}</s> <strong>FREE</strong></p></div>`
    )
    .join('')
);
fillId('bonus-total', esc((d.course?.currency || '₹') + bonuses.reduce((s, b) => s + num(b.value), 0).toLocaleString('en-IN')));

const mentor = d.mentor || {};
const initials = (mentor.name || 'AA').split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
fillId(
  'mentor-photo',
  mentor.photo
    ? `<img src="${esc(mentor.photo)}" alt="${esc(mentor.name)}, ${esc(mentor.role)}" width="400" height="400" loading="lazy" />`
    : `<span>${esc(initials)}</span>`
);
fillId('mentor-stats', (mentor.stats || []).map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join(''));

const t = d.testimonials || [];
if (t.length) {
  html = html.replace(/(id="testimonials-section")\s+hidden/, '$1');
  fillId(
    'testimonials',
    t
      .map((x) => `<figure class="card"><blockquote>“${esc(x.text)}”</blockquote><figcaption><strong>${esc(x.name)}</strong><span>${esc(x.role)}</span></figcaption></figure>`)
      .join('')
  );
}

fillId('cert-points', (d.certificate?.points || []).map((h) => `<li>${check}${esc(h)}</li>`).join(''));
fillId('faq-list', (d.faqs || []).map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join(''));

const c = d.contact || {};
const email = (c.email || '').replace(/[,;\s]+$/, '');
const links = [];
if (c.whatsapp) links.push(`<a class="btn btn-wa" href="https://wa.me/${esc(c.whatsapp.replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">Chat on WhatsApp</a>`);
if (c.phone) links.push(`<a href="tel:${esc(c.phone.replace(/\s/g, ''))}">📞 ${esc(c.phone)}</a>`);
if (email) links.push(`<a href="mailto:${esc(email)}">✉️ ${esc(email)}</a>`);
fillId('contact-links', links.join(''));

const price = num(d.course?.price), orig = num(d.course?.originalPrice);
fillId('discount-badge', orig > price && price > 0 ? `${Math.round((1 - price / orig) * 100)}% OFF` : '');
const batch = new Date(d.course?.batchDate);
const batchValid = !isNaN(batch);
fillId(
  'batch-date-text',
  batchValid
    ? batch.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : 'To be announced'
);
fillId('year', String(new Date().getFullYear()));

// ---------- 2 & 3. head: meta + structured data ----------
const title = d.seo?.title || 'SAP Ariba Course | Ariba Academy';
const desc = d.seo?.description || '';
const ogImage = abs(d.seo?.ogImage || '/images/og-image.png');
const brand = d.brand?.name || 'Ariba Academy';
html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`);

const orgId = SITE_URL + '/#organization';
const personId = SITE_URL + '/#trainer';
const sameAs = [c.linkedin, c.youtube, c.instagram].filter(Boolean);
const graph = [
  {
    '@type': 'EducationalOrganization',
    '@id': orgId,
    name: brand,
    url: SITE_URL + '/',
    logo: abs('/images/logo-512.png'),
    description: d.brand?.tagline || desc,
    ...(email ? { email } : {}),
    ...(c.phone || c.whatsapp ? { telephone: '+' + String(c.phone || c.whatsapp).replace(/[^0-9]/g, '') } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  },
  {
    '@type': 'WebSite',
    '@id': SITE_URL + '/#website',
    url: SITE_URL + '/',
    name: brand,
    inLanguage: 'en-IN',
    publisher: { '@id': orgId },
  },
];
if (mentor.name) {
  graph.push({
    '@type': 'Person',
    '@id': personId,
    name: mentor.name,
    jobTitle: mentor.role,
    ...(mentor.photo ? { image: abs(mentor.photo) } : {}),
    worksFor: { '@id': orgId },
    ...(mentor.linkedin ? { sameAs: [mentor.linkedin] } : {}),
  });
}
const totalHours = (d.curriculum || []).reduce((s, m) => s + num(m.hours), 0);
const course = {
  '@type': 'Course',
  '@id': SITE_URL + '/#course',
  name: d.course?.name || title,
  description: desc,
  url: SITE_URL + '/',
  image: ogImage,
  inLanguage: 'en',
  provider: { '@id': orgId },
  educationalLevel: 'Beginner to Intermediate',
  teaches: (d.curriculum || []).map((m) => m.title),
  syllabusSections: (d.curriculum || []).map((m) => ({
    '@type': 'Syllabus',
    name: `${m.week}: ${m.title}`,
    description: (m.topics || []).join('; '),
    ...(num(m.hours) ? { timeRequired: `PT${num(m.hours)}H` } : {}),
  })),
  hasCourseInstance: [
    {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseSchedule: {
        '@type': 'Schedule',
        repeatFrequency: 'Daily',
        byDay: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((x) => 'https://schema.org/' + x),
        ...(batchValid ? { startDate: d.course.batchDate.slice(0, 10) } : {}),
        duration: 'PT1H30M',
      },
      ...(totalHours ? { courseWorkload: `PT${totalHours}H` } : {}),
      ...(mentor.name ? { instructor: [{ '@id': personId }] } : {}),
      location: { '@type': 'VirtualLocation', url: SITE_URL + '/' },
    },
  ],
  ...(price
    ? {
        offers: [
          {
            '@type': 'Offer',
            category: 'Paid',
            price: price,
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            url: SITE_URL + '/#enroll',
          },
        ],
      }
    : {}),
};
graph.push(course);
if ((d.faqs || []).length) {
  graph.push({
    '@type': 'FAQPage',
    '@id': SITE_URL + '/#faq',
    mainEntity: d.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  });
}
const jsonld = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c');

setHead(
  'SEO',
  `  <link rel="canonical" href="${SITE_URL}/" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${esc(brand)}" />
  <meta property="og:locale" content="en_IN" />
  <meta property="og:url" content="${SITE_URL}/" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(title)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />
  <script type="application/ld+json">
${jsonld}
  </script>`
);

fs.writeFileSync(path.join(ROOT, 'index.html'), html);

// ---------- 4. sitemap ----------
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
  </url>
</urlset>
`
);

console.log(`build.js: pre-rendered index.html and sitemap.xml for ${SITE_URL}`);
