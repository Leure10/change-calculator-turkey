/* ===== Change Calculator — Turkey ===== *
 * Rates: EUR-based. From one response we derive:
 *   eurToTry = TRY per 1 EUR
 *   usdToTry = TRY per 1 USD  = TRY / USD
 *   tryToRon = RON per 1 TRY  = RON / TRY
 * Sources (no API key, CORS-friendly), tried in order with fallback.
 * Last good rates cached in localStorage for full offline use.
 */

'use strict';

const STORE_KEY = 'ccx_rates_v1';

// ---- Rate sources (primary + fallbacks) ----
const SOURCES = [
  {
    name: 'Frankfurter (ECB)',
    url: 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY,RON,USD',
    parse: (j) => ({
      eur_try: j.rates.TRY,
      eur_usd: j.rates.USD,
      eur_ron: j.rates.RON,
      date: j.date,
    }),
  },
  {
    name: 'currency-api (jsDelivr)',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',
    parse: (j) => ({
      eur_try: j.eur.try,
      eur_usd: j.eur.usd,
      eur_ron: j.eur.ron,
      date: j.date,
    }),
  },
  {
    name: 'open.er-api',
    url: 'https://open.er-api.com/v6/latest/EUR',
    parse: (j) => ({
      eur_try: j.rates.TRY,
      eur_usd: j.rates.USD,
      eur_ron: j.rates.RON,
      date: (j.time_last_update_utc || '').slice(5, 16),
    }),
  },
];

// ---- App state ----
let R = null; // { eurToTry, usdToTry, tryToRon, date, source, fetchedAt, offline }

// ---- DOM ----
const $ = (id) => document.getElementById(id);
const els = {
  rateBar: $('rateBar'), rateText: $('rateText'),
  priceTry: $('priceTry'), priceEur: $('priceEur'), priceUsd: $('priceUsd'),
  convTry: $('convTry'), convEur: $('convEur'), convUsd: $('convUsd'), convRon: $('convRon'),
  payTry: $('payTry'), payEur: $('payEur'), payUsd: $('payUsd'),
  calcBtn: $('calcBtn'), resetBtn: $('resetBtn'),
  result: $('result'), resultTitle: $('resultTitle'),
  outTry: $('outTry'), outEur: $('outEur'), outUsd: $('outUsd'),
  rateEur: $('rateEur'), rateUsd: $('rateUsd'), rateRon: $('rateRon'),
};
const priceInputs = [els.priceTry, els.priceEur, els.priceUsd];
const payInputs = [els.payTry, els.payEur, els.payUsd];

// ---- Helpers ----
const num = (v) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n > 0 ? n : 0;
};
const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Shrink the digits until they fit their box (big amounts like 12,450.00)
function fit(el) {
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > 9) {
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
}
const fitAll = () => document.querySelectorAll('.box output, .box input').forEach(fit);

function normalize(raw, sourceName, offline) {
  return {
    eurToTry: raw.eur_try,
    usdToTry: raw.eur_try / raw.eur_usd,
    tryToRon: raw.eur_ron / raw.eur_try,
    date: raw.date || '',
    source: sourceName,
    fetchedAt: raw.fetchedAt || new Date().toISOString(),
    offline: !!offline,
  };
}

// ---- Rate loading ----
async function fetchWithTimeout(url, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function saveRates(raw, sourceName) {
  const payload = { ...raw, fetchedAt: new Date().toISOString(), source: sourceName };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(payload)); } catch (e) {}
}

function loadCached() {
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (!s) return null;
    const raw = JSON.parse(s);
    if (!raw || !raw.eur_try) return null;
    return normalize(raw, raw.source || 'saved', true);
  } catch (e) { return null; }
}

async function loadRates() {
  setRateBar('loading', 'Loading rates… · Kur yükleniyor…');
  for (const src of SOURCES) {
    try {
      const j = await fetchWithTimeout(src.url);
      const raw = src.parse(j);
      if (!raw.eur_try || !raw.eur_usd || !raw.eur_ron) throw new Error('missing fields');
      saveRates(raw, src.name);
      R = normalize(raw, src.name, false);
      onRatesReady(true);
      return;
    } catch (e) {
      // try next source
    }
  }
  // All live sources failed → offline fallback
  const cached = loadCached();
  if (cached) {
    R = cached;
    onRatesReady(false);
  } else {
    setRateBar('error', 'No internet — open once online · İnternet yok');
  }
}

function onRatesReady(isLive) {
  const when = R.date ? R.date : (R.fetchedAt || '').slice(0, 10);
  if (isLive) {
    setRateBar('live', `Live rate · Güncel kur · ${when}`);
  } else {
    setRateBar('offline', `Offline · Çevrimdışı · ${when}`);
  }
  els.rateEur.textContent = R.eurToTry.toFixed(2);
  els.rateUsd.textContent = R.usdToTry.toFixed(2);
  els.rateRon.textContent = (1 / R.tryToRon).toFixed(2);
  updateConversion();
  if (els.result.classList.contains('done')) doCalc(); // refresh a shown result
}

function setRateBar(kind, text) {
  els.rateBar.className = 'rate-bar rate-' + kind;
  els.rateText.textContent = text;
}

// ---- Currency → TRY factor ----
function toTry(cur) {
  if (cur === 'EUR') return R.eurToTry;
  if (cur === 'USD') return R.usdToTry;
  return 1;
}

// Price in TRY, from whichever single price box is filled
function priceInTry() {
  const filled = priceInputs.find((i) => num(i.value) > 0);
  if (!filled || !R) return 0;
  return num(filled.value) * toTry(filled.dataset.cur);
}

// ---- Automatic conversion row ----
function updateConversion() {
  const outs = [els.convTry, els.convEur, els.convUsd, els.convRon];
  const p = priceInTry();
  if (!R || p <= 0) { outs.forEach((o) => (o.textContent = '—')); fitAll(); return; }
  els.convTry.textContent = fmt(p);
  els.convEur.textContent = fmt(p / R.eurToTry);
  els.convUsd.textContent = fmt(p / R.usdToTry);
  els.convRon.textContent = fmt(p * R.tryToRon);
  fitAll();
}

// ---- Core calculation ----
function doCalc() {
  if (!R) {
    setRateBar('error', 'No rate loaded yet — connect once · Kur yok');
    return;
  }
  const price = priceInTry();
  if (price <= 0) { els.priceTry.focus(); return; }

  const paidTry = num(els.payTry.value)
                + num(els.payEur.value) * R.eurToTry
                + num(els.payUsd.value) * R.usdToTry;
  if (paidTry <= 0) { els.payTry.focus(); return; }

  const changeTry = paidTry - price;
  const absTry = Math.abs(changeTry);

  els.outTry.textContent = fmt(absTry);
  els.outEur.textContent = fmt(absTry / R.eurToTry);
  els.outUsd.textContent = fmt(absTry / R.usdToTry);

  els.result.classList.remove('pos', 'neg');
  els.result.classList.add('done', changeTry >= 0 ? 'pos' : 'neg');
  els.resultTitle.innerHTML = changeTry >= 0
    ? 'Change <span>Para üstü</span>'
    : 'Still to pay <span>Kalan ödeme</span>';
  fitAll();
}

function clearResult() {
  els.result.classList.remove('done', 'pos', 'neg');
  els.resultTitle.innerHTML = 'Change <span>Para üstü</span>';
  [els.outTry, els.outEur, els.outUsd].forEach((o) => (o.textContent = '—'));
  fitAll();
}

function resetAll() {
  [...priceInputs, ...payInputs].forEach((i) => (i.value = ''));
  updateConversion();
  clearResult();
  els.priceTry.focus();
}

// ---- Input sanitation: allow only numbers + one separator ----
function sanitize(e) {
  let v = e.target.value.replace(/[^\d.,]/g, '');
  const firstSep = v.search(/[.,]/);
  if (firstSep !== -1) {
    v = v.slice(0, firstSep + 1) + v.slice(firstSep + 1).replace(/[.,]/g, '');
  }
  e.target.value = v;
}

// ---- Wire up ----
priceInputs.forEach((inp) => inp.addEventListener('input', (e) => {
  sanitize(e);
  // Only one price box at a time: typing in one clears the others
  if (inp.value) priceInputs.forEach((o) => { if (o !== inp) o.value = ''; });
  updateConversion();
  clearResult();
}));
payInputs.forEach((inp) => {
  inp.addEventListener('input', (e) => { sanitize(e); clearResult(); });
});

// Keyboard covers most of the screen: close it when a box is done.
// "Done"/Enter key on the keyboard → hide keyboard (tap a box to bring it back).
[...priceInputs, ...payInputs].forEach((inp) => {
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
});
// Tap anywhere outside a box → hide keyboard.
document.addEventListener('pointerdown', (e) => {
  const a = document.activeElement;
  if (a && a.tagName === 'INPUT' && !e.target.closest('.box')) a.blur();
});
els.calcBtn.addEventListener('click', () => { document.activeElement.blur(); doCalc(); });
els.resetBtn.addEventListener('click', resetAll);
window.addEventListener('resize', fitAll);

// ---- Service worker (offline) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

// ---- Refresh rates when connection returns / app refocused ----
window.addEventListener('online', loadRates);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine) loadRates();
});

// ---- Boot: show cached instantly, then refresh live ----
(function boot() {
  const cached = loadCached();
  if (cached) { R = cached; onRatesReady(false); }
  loadRates();
})();
