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
  price: $('price'), priceRon: $('priceRon'),
  payEur: $('payEur'), payUsd: $('payUsd'), payTry: $('payTry'),
  calcBtn: $('calcBtn'), resetBtn: $('resetBtn'),
  result: $('result'), resultTitle: $('resultTitle'), resultNote: $('resultNote'),
  outTry: $('outTry'), outEur: $('outEur'), outUsd: $('outUsd'),
  footRate: $('footRate'),
};

// ---- Helpers ----
const num = (v) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n > 0 ? n : 0;
};
const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  setRateBar('loading', 'Loading rates… (Kur yükleniyor…)');
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
    setRateBar('error', 'No internet. Open once online to load rates. (İnternet yok)');
    els.footRate.textContent = 'No rate available yet';
  }
}

function onRatesReady(isLive) {
  const when = R.date ? R.date : (R.fetchedAt || '').slice(0, 10);
  if (isLive) {
    setRateBar('live', `Live rate • ${when}  (Güncel kur)`);
  } else {
    setRateBar('offline', `Offline — last rate ${when}  (Çevrimdışı)`);
  }
  els.footRate.textContent =
    `1 € = ${R.eurToTry.toFixed(3)} ₺   ·   1 $ = ${R.usdToTry.toFixed(3)} ₺   ·   1 ₺ = ${R.tryToRon.toFixed(4)} RON`;
  updateRonHint();
  if (!els.result.hidden) doCalc(); // refresh if a result is showing
}

function setRateBar(kind, text) {
  els.rateBar.className = 'rate-bar rate-' + kind;
  els.rateText.textContent = text;
}

// ---- Live RON hint under price ----
function updateRonHint() {
  const p = num(els.price.value);
  if (!R) { els.priceRon.textContent = '≈ … RON (lei)'; return; }
  const ron = p * R.tryToRon;
  els.priceRon.textContent = `≈ ${fmt(ron)} RON (lei)`;
}

// ---- Core calculation ----
function doCalc() {
  if (!R) {
    setRateBar('error', 'No rate loaded yet. Connect to internet once. (Kur yok)');
    return;
  }
  const price   = num(els.price.value);
  const paidTry = num(els.payTry.value)
                + num(els.payEur.value) * R.eurToTry
                + num(els.payUsd.value) * R.usdToTry;

  const changeTry = paidTry - price;
  const absTry = Math.abs(changeTry);

  const inTry = absTry;
  const inEur = absTry / R.eurToTry;
  const inUsd = absTry / R.usdToTry;

  els.outTry.textContent = fmt(inTry);
  els.outEur.textContent = fmt(inEur);
  els.outUsd.textContent = fmt(inUsd);

  els.result.hidden = false;
  els.result.classList.remove('pos', 'neg');

  if (changeTry >= 0) {
    els.result.classList.add('pos');
    els.resultTitle.textContent = 'Change to receive (Para üstü)';
    els.resultNote.textContent = 'Amount the seller must give you back, shown in each currency.';
  } else {
    els.result.classList.add('neg');
    els.resultTitle.textContent = 'Still to pay (Kalan ödeme)';
    els.resultNote.textContent = 'You still owe this amount — shown in each currency.';
  }
  els.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetAll() {
  els.price.value = '';
  els.payEur.value = '';
  els.payUsd.value = '';
  els.payTry.value = '';
  els.result.hidden = true;
  updateRonHint();
  els.price.focus();
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
[els.price, els.payEur, els.payUsd, els.payTry].forEach((inp) =>
  inp.addEventListener('input', sanitize)
);
els.price.addEventListener('input', updateRonHint);
els.calcBtn.addEventListener('click', doCalc);
els.resetBtn.addEventListener('click', resetAll);
els.payTry.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCalc(); });

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
