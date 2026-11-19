(function () {
  'use strict';

  var CONFIG = window.TW_CONFIG;
  var ORDER = ['intro', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'email', 'result', 'thanks'];

  var QUESTIONS = [
    { screen: 'q1', key: 'homeValue', num: 1, title: 'Wat is de geschatte waarde van je woning?', help: 'Een ruwe schatting volstaat.', options: [
      { id: 'lt300', label: 'Minder dan €300.000' },
      { id: '300to500', label: '€300.000 tot €500.000' },
      { id: '500to750', label: '€500.000 tot €750.000' },
      { id: '750to1000', label: '€750.000 tot €1.000.000' },
      { id: 'gt1000', label: 'Meer dan €1.000.000' }
    ] },
    { screen: 'q2', key: 'gardenSize', num: 2, title: 'Hoe groot is je tuin?', help: '', options: [
      { id: 'lt100', label: 'Minder dan 100 m²' },
      { id: '100to250', label: '100 tot 250 m²' },
      { id: '250to500', label: '250 tot 500 m²' },
      { id: '500to1000', label: '500 tot 1.000 m²' },
      { id: 'gt1000', label: 'Meer dan 1.000 m²' }
    ] },
    { screen: 'q3', key: 'gardenState', num: 3, title: 'Hoe ziet je tuin er vandaag uit?', help: '', options: [
      { id: 'bare', label: 'Kale grond of werf (nieuwbouw)' },
      { id: 'dated', label: 'Verouderd of verwaarloosd' },
      { id: 'loose', label: 'Netjes maar zonder samenhang' },
      { id: 'done', label: 'Al mooi aangelegd' }
    ] },
    { screen: 'q4', key: 'extras', num: 4, multi: true, title: 'Wat zou je willen toevoegen?', help: 'Meerdere keuzes mogelijk.', options: [
      { id: 'terras', label: 'Terras' },
      { id: 'pergola', label: 'Overdekte zithoek of pergola' },
      { id: 'keuken', label: 'Buitenkeuken' },
      { id: 'zwem', label: 'Zwemvijver of zwembad' },
      { id: 'verlichting', label: 'Tuinverlichting' },
      { id: 'privacy', label: 'Privacy en groene afscheiding' },
      { id: 'tuinhuis', label: 'Tuinhuis of poolhouse' },
      { id: 'onderhoud', label: 'Onderhoudsvriendelijke beplanting' }
    ] },
    { screen: 'q5', key: 'region', num: 5, title: 'In welke regio woon je?', help: '', options: [
      { id: 'antwerpen', label: 'Antwerpen' },
      { id: 'oostvl', label: 'Oost-Vlaanderen' },
      { id: 'westvl', label: 'West-Vlaanderen' },
      { id: 'vlbrabant', label: 'Vlaams-Brabant' },
      { id: 'limburg', label: 'Limburg' },
      { id: 'brussel', label: 'Brussel' },
      { id: 'wallonie', label: 'Wallonië' }
    ] },
    { screen: 'q6', key: 'plans', num: 6, title: 'Wat zijn je plannen met de woning?', help: '', options: [
      { id: 'sell2', label: 'Verkopen binnen 2 jaar' },
      { id: 'sell5', label: 'Verkopen binnen 5 jaar' },
      { id: 'stay', label: 'Hier blijven wonen' }
    ] }
  ];

  var PLAN_TEXT = {
    sell2: 'Een verzorgde tuin is vaak het eerste wat kopers zien op de foto’s. Focus op terras, structuur en groen dat meteen af oogt.',
    sell5: 'Je hebt tijd om ervan te genieten én je woning sterker te positioneren bij verkoop.',
    stay: 'De grootste winst zit in je eigen woongenot. De meerwaarde is een mooie bonus.'
  };

  function has(a, id) { return (a.extras || []).indexOf(id) >= 0; }
  var BULLET_RULES = [
    { test: function (a) { return a.gardenState === 'bare' || a.gardenState === 'dated'; }, text: 'Een afgewerkte basis: structuur, paden en gezond groen.' },
    { test: function (a) { return has(a, 'terras'); }, text: 'Een terras dat aansluit op je leefruimte.' },
    { test: function (a) { return has(a, 'privacy'); }, text: 'Groene privacy die het hele jaar werkt.' },
    { test: function (a) { return has(a, 'onderhoud'); }, text: 'Een tuin die er met weinig onderhoud verzorgd uitziet.' },
    { test: function (a) { return a.plans === 'sell2'; }, text: 'Snel zichtbaar resultaat voor verkoopfoto’s.' },
    { test: function () { return true; }, text: 'Verlichting die je tuin ook ’s avonds laat leven.' }
  ];

  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------- State ---------- */
  var state = {
    screen: 'intro',
    answers: { extras: [] },
    form: { first: '', email: '', phone: '', postcode: '', optin: false },
    submittedAt: null,
    quoteRequested: false
  };
  var debug = /[?&]debug=1\b/.test(location.search);
  var advanceTimer = null;

  /* ---------- Calculation ---------- */
  function roundTo(n) { return Math.round(n / CONFIG.roundTo) * CONFIG.roundTo; }
  function euro(n) { return typeof n === 'number' ? '€' + n.toLocaleString('nl-BE') : '€…'; }

  function calc(a) {
    if (!a.homeValue || !a.gardenSize || !a.gardenState || !a.region) return null;
    var extras = a.extras || [];
    var homeValue = CONFIG.homeValueMid[a.homeValue];
    var base = CONFIG.basePct[a.gardenState] || 0;
    var bonusRaw = extras.reduce(function (s, e) { return s + (CONFIG.bonusPct[e] || 0); }, 0);
    var bonus = Math.min(bonusRaw, CONFIG.bonusMaxPct);
    var rf = CONFIG.regionFactor[a.region] != null ? CONFIG.regionFactor[a.region] : 1;
    var mid = homeValue * (base + bonus) * rf;
    var invBase = (CONFIG.areaM2[a.gardenSize] || 0) * CONFIG.pricePerM2 +
      extras.reduce(function (s, e) { return s + (CONFIG.pricePerExtra[e] || 0); }, 0);
    return {
      low: roundTo(mid * CONFIG.valueRange.low),
      high: roundTo(mid * CONFIG.valueRange.high),
      investLow: roundTo(invBase * CONFIG.investRange.low),
      investHigh: roundTo(invBase * CONFIG.investRange.high)
    };
  }

  function leadScore(a, f) {
    var L = CONFIG.lead, s = 0;
    if (a.homeValue === '750to1000' || a.homeValue === 'gt1000') s += L.valueHigh;
    else if (a.homeValue === '500to750') s += L.valueMid;
    else s += L.valueLow;
    if (a.plans === 'sell2') s += L.sell2;
    else if (a.plans === 'sell5') s += L.sell5;
    else if (a.plans === 'stay') s += L.stay;
    if ((a.extras || []).length >= 3) s += L.extras3;
    if (f.phone && f.phone.trim()) s += L.phone;
    s = Math.min(s, 100);
    return { score: s, segment: s >= L.hot ? 'Hot' : (s >= L.warm ? 'Warm' : 'Cool') };
  }

  function readUtm() {
    var out = { utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '' };
    try {
      var p = new URLSearchParams(location.search);
      Object.keys(out).forEach(function (k) { out[k] = p.get(k) || ''; });
    } catch (e) {}
    return out;
  }

  function answerLabels(a) {
    var out = {};
    QUESTIONS.forEach(function (q) {
      var v = a[q.key];
      var label = function (id) { return (q.options.filter(function (o) { return o.id === id; })[0] || {}).label; };
      if (q.multi) out[q.key] = (v || []).map(function (id) { return { id: id, label: label(id) }; });
      else out[q.key] = v ? { id: v, label: label(v) } : null;
    });
    return out;
  }

  function buildPayload(event) {
    var res = calc(state.answers);
    var lead = leadScore(state.answers, state.form);
    return {
      event: event,
      answers: answerLabels(state.answers),
      contact: { firstName: state.form.first, email: state.form.email, phone: state.form.phone, postcode: state.form.postcode },
      newsletterOptIn: !!state.form.optin,
      estimate: res ? { low: res.low, high: res.high } : null,
      investment: res ? { low: res.investLow, high: res.investHigh } : null,
      leadScore: lead.score,
      segment: lead.segment,
      pageUrl: location.href,
      utm: readUtm(),
      website: ($('#tw-website') || {}).value || '',
      timestamp: state.submittedAt || new Date().toISOString()
    };
  }

  function sendLead(event) {
    var payload = buildPayload(event);
    try { window.dispatchEvent(new CustomEvent('tuinwaarde:lead', { detail: payload })); } catch (e) {}
    if (window.dataLayer) window.dataLayer.push({ event: 'tuinwaarde_' + event, tuinwaarde: payload });
    if (CONFIG.crmEndpoint) {
      fetch(CONFIG.crmEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
        .catch(function () {});
    }
    return payload;
  }

  /* ---------- DOM helpers ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function bind(name, value) { $$('[data-bind="' + name + '"]').forEach(function (el) { el.textContent = value; }); }
  function bindHtml(name, html) { $$('[data-bind="' + name + '"]').forEach(function (el) { el.innerHTML = html; }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- Navigation ---------- */
  function go(to) {
    clearTimeout(advanceTimer);
    state.screen = to;
    render();
    window.scrollTo(0, 0);
    var main = $('#tw-main');
    if (main) main.focus({ preventScroll: true });
  }
  function goBack() {
    var i = ORDER.indexOf(state.screen);
    if (i > 0) go(ORDER[i - 1]);
  }
  function goNext() {
    var i = ORDER.indexOf(state.screen);
    if (i < ORDER.length - 1) go(ORDER[i + 1]);
  }

  /* ---------- Rendering ---------- */
  function currentQuestion() {
    return QUESTIONS.filter(function (q) { return q.screen === state.screen; })[0] || null;
  }

  function renderQuestion(q) {
    var val = state.answers[q.key];
    $('#tw-q-count').textContent = 'Vraag ' + q.num + ' van 6';
    $('#tw-progress').setAttribute('aria-valuenow', q.num);
    $('#tw-progress-fill').style.width = Math.round((q.num / 6) * 100) + '%';
    $('#tw-q-title').textContent = q.title;
    $('#tw-q-help').textContent = q.help;

    var opts = $('#tw-options');
    opts.setAttribute('aria-label', q.title);
    opts.classList.toggle('is-multi', !!q.multi);
    opts.innerHTML = q.options.map(function (o) {
      var sel = q.multi ? (val || []).indexOf(o.id) >= 0 : val === o.id;
      return '<button type="button" class="tw-option" data-option="' + esc(o.id) + '" aria-pressed="' + sel + '">' +
        '<span>' + esc(o.label) + '</span>' +
        '<span class="tw-indicator" aria-hidden="true">' + CHECK_SVG + '</span></button>';
    }).join('');

    var next = $('#tw-next');
    next.hidden = !q.multi;
    next.disabled = q.multi ? (state.answers.extras || []).length === 0 : false;
  }

  function renderResultData() {
    var res = calc(state.answers);
    bind('low', euro(res && res.low));
    bind('high', euro(res && res.high));
    bind('investLow', euro(res && res.investLow));
    bind('investHigh', euro(res && res.investHigh));

    var bullets = BULLET_RULES.filter(function (r) { return r.test(state.answers); }).slice(0, 3);
    bindHtml('bullets', bullets.map(function (b) {
      return '<li><span class="tw-bullet-icon" aria-hidden="true">' + CHECK_SVG + '</span><span>' + esc(b.text) + '</span></li>';
    }).join(''));
    bindHtml('teaserBullets', bullets.map(function (b) { return '<span>' + esc(b.text) + '</span>'; }).join(''));

    var planOpt = QUESTIONS[5].options.filter(function (o) { return o.id === state.answers.plans; })[0];
    bind('planLabel', planOpt ? planOpt.label : '');
    bind('planText', PLAN_TEXT[state.answers.plans] || '');
    bind('firstName', state.form.first.trim());

    $('#tw-notice').hidden = !CONFIG.showPlaceholderNotice;
  }

  function render() {
    var q = currentQuestion();
    var key = q ? 'question' : state.screen;
    $$('.tw-screen').forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-screen') === key); });
    $$('[data-show-not="intro"]').forEach(function (el) { el.hidden = state.screen === 'intro'; });

    if (q) renderQuestion(q);
    if (state.screen === 'email' || state.screen === 'result' || state.screen === 'thanks') renderResultData();
    if (state.screen === 'result') $('#tw-pdf-note').hidden = true;

    $$('[data-crm]').forEach(function (el) { el.hidden = !debug; });
    if (debug && (state.screen === 'result' || state.screen === 'thanks')) {
      bind('crm', JSON.stringify(buildPayload(state.quoteRequested ? 'quote_requested' : 'result_viewed'), null, 2));
    }
  }

  /* ---------- Form ---------- */
  var FIELDS = ['first', 'email', 'phone', 'postcode'];

  function setError(name, msg) {
    var input = $('#tw-' + name), err = $('#tw-' + name + '-err');
    if (!err) return;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    err.textContent = msg || '';
    err.hidden = !msg;
  }

  function validate() {
    var f = state.form, e = {};
    if (!f.first.trim()) e.first = 'Vul je voornaam in.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Vul een geldig e-mailadres in.';
    if (!/^\d{4}$/.test(f.postcode.trim())) e.postcode = 'Vul een geldige postcode in (4 cijfers).';
    ['first', 'email', 'postcode'].forEach(function (k) { setError(k, e[k]); });
    return e;
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (ev) {
    var opt = ev.target.closest('.tw-option');
    if (opt) {
      var q = currentQuestion();
      if (!q) return;
      var id = opt.getAttribute('data-option');
      if (q.multi) {
        var cur = state.answers.extras || [];
        state.answers.extras = cur.indexOf(id) >= 0 ? cur.filter(function (x) { return x !== id; }) : cur.concat(id);
        renderQuestion(q);
        var again = $('.tw-option[data-option="' + id + '"]');
        if (again) again.focus();
      } else {
        state.answers[q.key] = id;
        renderQuestion(q);
        clearTimeout(advanceTimer);
        advanceTimer = setTimeout(goNext, 220);
      }
      return;
    }

    var btn = ev.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.getAttribute('data-action')) {
      case 'start': go('q1'); break;
      case 'back': goBack(); break;
      case 'next': if (!btn.disabled) goNext(); break;
      case 'quote':
        state.quoteRequested = true;
        sendLead('quote_requested');
        go('thanks');
        break;
      case 'pdf':
        // TODO: PDF genereren (server-side of via een PDF-dienst)
        $('#tw-pdf-note').hidden = false;
        break;
    }
  });

  var form = $('#tw-form');
  FIELDS.forEach(function (name) {
    $('#tw-' + name).addEventListener('input', function (ev) {
      state.form[name] = ev.target.value;
      setError(name, '');
    });
  });
  $('#tw-optin').addEventListener('change', function (ev) { state.form.optin = ev.target.checked; });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var errors = validate();
    var firstBad = ['first', 'email', 'postcode'].filter(function (k) { return errors[k]; })[0];
    if (firstBad) { $('#tw-' + firstBad).focus(); return; }
    state.submittedAt = new Date().toISOString();
    sendLead('result_viewed');
    go('result');
  });

  render();
})();
