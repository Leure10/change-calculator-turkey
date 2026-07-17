# Change Calculator (Para Üstü) — Turkey

A tiny, offline-capable web app (PWA) to calculate your **change** while shopping in Turkey.
You enter the price in Turkish Lira and how much you pay in EUR / USD / TRY, and it shows the
change you should get back — in all three currencies.

- **Live exchange rate** fetched on every open (ECB via Frankfurter, with two fallbacks).
- **Works offline**: if there's no internet, it uses the last rate saved while online.
- **Fullscreen**, large readable numbers, English + Turkish labels.
- No account, no API key, no cost.

## How the rate works
Rates come from an EUR base. From one response the app derives:
- `EUR → TRY` (lira per euro)
- `USD → TRY` (lira per dollar)
- `TRY → RON` (lei per lira, for the price-in-lei hint)

Sources, tried in order: Frankfurter (ECB) → fawazahmed0 currency-api (jsDelivr CDN) → open.er-api.
ECB rates update once per working day, so the rate won't move on weekends — that's normal.

## Run locally
```bash
cd rest-calculator-turcia
python3 -m http.server 8765
# open http://localhost:8765
```

## Install on your Android phone (as a PWA — no APK needed)
1. Open the live URL in **Chrome** on the phone.
2. Menu (⋮) → **Add to Home screen**.
3. Open it from the new icon → it starts fullscreen and works offline.

## Turn it into a real APK (optional)
1. Make sure the app is live on an HTTPS URL (GitHub Pages does this).
2. Go to **https://www.pwabuilder.com**, paste the URL, click **Start**.
3. Choose **Android** → **Generate Package** → download the `.apk` (signing key is created for you).
4. On the phone: enable **Install unknown apps** for your file manager, then open the `.apk`.

## Files
| File | Purpose |
|------|---------|
| `index.html` | UI structure |
| `style.css` | Design (light, high-contrast, mobile-first) |
| `app.js` | Rate fetching + offline cache + change calculation |
| `manifest.webmanifest` | PWA manifest (fullscreen, icons) |
| `service-worker.js` | Offline app-shell caching |
| `icons/` | App icons (Turkish Lira mark) |
