// Vercel serverless function: ontvangt een lead van de Tuinwaarde Check en
// verstuurt via Resend (1) een bevestigingsmail naar de lead en (2) een
// leadmelding naar Groenig.
//
// Instellingen (Vercel > Project > Settings > Environment Variables):
//   RESEND_API_KEY     verplicht, de API-sleutel uit Resend
//   LEAD_NOTIFY_EMAIL  verplicht, wie de leadmeldingen krijgt
//   MAIL_FROM          afzender, bv. "Groenig <tuinwaarde@groenig.be>"
//                      (het domein moet geverifieerd zijn in Resend)

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Dezelfde config als de website gebruikt, zodat de bedragen in de mail
// altijd overeenkomen met wat de bezoeker op het scherm zag.
function loadConfig() {
  const src = fs.readFileSync(path.join(process.cwd(), 'config.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.TW_CONFIG;
}
const CONFIG = loadConfig();

const EVENTS = ['result_viewed', 'quote_requested'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Eenvoudige rem tegen misbruik (per server-instantie).
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 5;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
const euro = (n) => '€' + Math.round(n).toLocaleString('nl-BE').replace(/\s/g, '.');
const roundTo = (n) => Math.round(n / CONFIG.roundTo) * CONFIG.roundTo;

function calc(a) {
  const extras = (a.extras || []).filter((e) => e in CONFIG.bonusPct);
  const homeValue = CONFIG.homeValueMid[a.homeValue];
  const base = CONFIG.basePct[a.gardenState];
  if (!homeValue || base == null || !(a.gardenSize in CONFIG.areaM2) || !(a.region in CONFIG.regionFactor)) return null;
  const bonus = Math.min(extras.reduce((s, e) => s + CONFIG.bonusPct[e], 0), CONFIG.bonusMaxPct);
  const mid = homeValue * (base + bonus) * CONFIG.regionFactor[a.region];
  const inv = CONFIG.areaM2[a.gardenSize] * CONFIG.pricePerM2 + extras.reduce((s, e) => s + (CONFIG.pricePerExtra[e] || 0), 0);
  return {
    low: roundTo(mid * CONFIG.valueRange.low),
    high: roundTo(mid * CONFIG.valueRange.high),
    average: roundTo(mid),
    investLow: roundTo(inv * CONFIG.investRange.low),
    investHigh: roundTo(inv * CONFIG.investRange.high)
  };
}

function leadScore(a, phone) {
  const L = CONFIG.lead;
  let s = 0;
  if (a.homeValue === '750to1000' || a.homeValue === 'gt1000') s += L.valueHigh;
  else if (a.homeValue === '500to750') s += L.valueMid;
  else s += L.valueLow;
  if (a.plans === 'sell2') s += L.sell2;
  else if (a.plans === 'sell5') s += L.sell5;
  else if (a.plans === 'stay') s += L.stay;
  if ((a.extras || []).length >= 3) s += L.extras3;
  if (phone) s += L.phone;
  s = Math.min(s, 100);
  return { score: s, segment: s >= L.hot ? 'Hot' : s >= L.warm ? 'Warm' : 'Cool' };
}

/* ---------- E-mails ---------- */

const GREEN = '#083E2F', ORANGE = '#F15F36', GREY = '#4F5B56', STONE = '#E8E8E8';
const FONT = "Inter, Arial, Helvetica, sans-serif";

function layout(inner) {
  return `<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#F4F5F2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F2"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px">
<tr><td style="padding:32px 28px;font-family:${FONT};color:${GREEN};font-size:16px;line-height:1.6">${inner}</td></tr>
</table></td></tr></table></body></html>`;
}

function leadMail(firstName, r) {
  const subject = `${firstName}, je Tuinwaarde Check: gemiddeld ${euro(r.average)} meerwaarde`;
  const html = layout(`
<p style="margin:0 0 16px">Dag ${esc(firstName)},</p>
<p style="margin:0 0 24px">Bedankt voor het invullen van de Tuinwaarde Check. Hier is je resultaat.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GREEN};border-radius:16px"><tr><td style="padding:24px;font-family:${FONT};color:#FFFFFF">
<div style="font-size:14px;color:${STONE}">Gemiddelde geschatte meerwaarde</div>
<div style="font-size:40px;line-height:1.1;font-weight:700;margin:6px 0 8px">${euro(r.average)}</div>
<div style="font-size:15px;color:${STONE}">Tussen ${euro(r.low)} en ${euro(r.high)}, bij een investering van ongeveer ${euro(r.investLow)} tot ${euro(r.investHigh)} in je tuin.</div>
</td></tr></table>
<p style="margin:24px 0 8px;font-size:20px;line-height:1.3;font-weight:500">Investeer in wat <span style="color:${ORANGE}">écht</span> waarde toevoegt</p>
<p style="margin:0 0 20px">We bekijken je tuin graag ter plaatse, bespreken je plannen en maken een offerte op maat. Antwoord gewoon op deze mail, dan nemen we contact met je op.</p>
<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${GREY}">Dit is een indicatieve schatting op basis van gemiddelden, geen officiële waardebepaling. De echte meerwaarde hangt af van je woning, ligging en de markt.</p>
<p style="margin:16px 0 0">Groene groeten,<br>Het team van Groenig</p>`);
  const text = `Dag ${firstName},

Bedankt voor het invullen van de Tuinwaarde Check.

Gemiddelde geschatte meerwaarde: ${euro(r.average)}
Tussen ${euro(r.low)} en ${euro(r.high)}, bij een investering van ongeveer ${euro(r.investLow)} tot ${euro(r.investHigh)} in je tuin.

We bekijken je tuin graag ter plaatse en maken een offerte op maat. Antwoord gewoon op deze mail.

Dit is een indicatieve schatting op basis van gemiddelden, geen officiële waardebepaling.

Groene groeten,
Het team van Groenig`;
  return { subject, html, text };
}

function ownerMail(event, lead, labels, r, score, meta) {
  const quote = event === 'quote_requested';
  const subject = `${quote ? 'Offerteaanvraag' : 'Nieuwe lead'} (${score.segment}, ${score.score}/100): ${lead.firstName}, ${lead.postcode}`;
  const rows = [
    ['Gebeurtenis', quote ? 'Vroeg een offerte aan' : 'Bekeek het resultaat'],
    ['Voornaam', lead.firstName],
    ['E-mail', lead.email],
    ['Telefoon', lead.phone || '–'],
    ['Postcode', lead.postcode],
    ['Nieuwsbrief', lead.optin ? 'Ja' : 'Nee'],
    ['Leadscore', `${score.score}/100 (${score.segment})`],
    ['Meerwaarde', r ? `${euro(r.low)} – ${euro(r.high)} (gem. ${euro(r.average)})` : '–'],
    ['Investering', r ? `${euro(r.investLow)} – ${euro(r.investHigh)}` : '–'],
    ['Woningwaarde', labels.homeValue],
    ['Tuingrootte', labels.gardenSize],
    ['Huidige tuin', labels.gardenState],
    ['Extra\'s', labels.extras],
    ['Regio', labels.region],
    ['Plannen', labels.plans],
    ['Bron (UTM)', meta.utm || '–'],
    ['Pagina', meta.pageUrl || '–']
  ];
  const html = layout(`
<p style="margin:0 0 16px;font-size:20px;font-weight:500">${quote ? 'Offerteaanvraag' : 'Nieuwe lead'} via de Tuinwaarde Check</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:${FONT};font-size:14px;line-height:1.5">
${rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:${GREY};vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:${GREEN}">${esc(v)}</td></tr>`).join('')}
</table>
<p style="margin:20px 0 0;font-size:13px;color:${GREY}">Antwoorden op deze mail gaat rechtstreeks naar de lead.</p>`);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { subject, html, text };
}

async function sendMail(msg) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg)
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

/* ---------- Handler ---------- */

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { RESEND_API_KEY, LEAD_NOTIFY_EMAIL } = process.env;
  const MAIL_FROM = process.env.MAIL_FROM || 'Groenig <onboarding@resend.dev>';
  if (!RESEND_API_KEY || !LEAD_NOTIFY_EMAIL) return res.status(500).json({ error: 'not_configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad_request' });

  // Honeypot: bots vullen dit verborgen veld in, mensen niet.
  if (body.website) return res.status(200).json({ ok: true });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'too_many_requests' });

  const event = EVENTS.includes(body.event) ? body.event : null;
  const c = body.contact || {};
  const lead = {
    firstName: clip(c.firstName, 40),
    email: clip(c.email, 120),
    phone: clip(c.phone, 30),
    postcode: clip(c.postcode, 4),
    optin: !!body.newsletterOptIn
  };
  if (!event || !lead.firstName || !EMAIL_RE.test(lead.email) || !/^\d{4}$/.test(lead.postcode)) {
    return res.status(400).json({ error: 'invalid_lead' });
  }

  // Antwoorden: enkel de id's vertrouwen we; de bedragen rekenen we hier opnieuw uit.
  const ans = body.answers || {};
  const id = (k) => (ans[k] && typeof ans[k].id === 'string' ? ans[k].id : '');
  const label = (k) => clip(ans[k] && ans[k].label, 80) || '–';
  const extras = Array.isArray(ans.extras) ? ans.extras.slice(0, 10) : [];
  const answers = {
    homeValue: id('homeValue'), gardenSize: id('gardenSize'), gardenState: id('gardenState'),
    region: id('region'), plans: id('plans'),
    extras: extras.map((e) => (e && typeof e.id === 'string' ? e.id : '')).filter(Boolean)
  };
  const labels = {
    homeValue: label('homeValue'), gardenSize: label('gardenSize'), gardenState: label('gardenState'),
    region: label('region'), plans: label('plans'),
    extras: extras.map((e) => clip(e && e.label, 60)).filter(Boolean).join(', ') || '–'
  };
  const r = calc(answers);
  const score = leadScore(answers, lead.phone);
  const utm = body.utm && typeof body.utm === 'object'
    ? Object.entries(body.utm).filter(([, v]) => v).map(([k, v]) => `${k}=${clip(v, 80)}`).join(', ')
    : '';
  const meta = { utm, pageUrl: clip(body.pageUrl, 300) };

  const results = {};
  try {
    const owner = ownerMail(event, lead, labels, r, score, meta);
    results.owner = await sendMail({ from: MAIL_FROM, to: [LEAD_NOTIFY_EMAIL], reply_to: lead.email, ...owner });
  } catch (e) {
    console.error('owner mail failed', e.message);
    results.ownerError = true;
  }

  if (event === 'result_viewed' && r) {
    try {
      const mail = leadMail(lead.firstName, r);
      results.lead = await sendMail({ from: MAIL_FROM, to: [lead.email], reply_to: LEAD_NOTIFY_EMAIL, ...mail });
    } catch (e) {
      console.error('lead mail failed', e.message);
      results.leadError = true;
    }
  }

  const ok = !results.ownerError && !results.leadError;
  return res.status(ok ? 200 : 502).json({ ok, sent: { owner: !!results.owner, lead: !!results.lead } });
};
