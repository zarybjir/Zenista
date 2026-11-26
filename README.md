# Ženista — Android aplikace

Roguelike hledání min zabalené do Android aplikace (WebView). Hra běží offline,
postup, odemčení ženisté i rozehraná mise se ukládají v telefonu.

- Hra: `app/src/main/assets/web/index.html`
- APK se sestaví samo na GitHubu po každém pushi (záložka **Actions** → poslední běh → **Artifacts** → `zenista-apk`).
- Tag `v1.0.1` navíc vytvoří Release s APK (umí z něj aktualizovat Obtainium).

## Podpis a aktualizace

Bez nastavených secrets vznikne debug APK podepsaná náhodným klíčem běžce:
další verze pak nejde nainstalovat přes starou (musíš odinstalovat a postup se smaže).
Pro aktualizace se zachováním dat nastav v Settings → Secrets and variables → Actions:
`ZENISTA_KEYSTORE_B64`, `ZENISTA_KEYSTORE_PASSWORD`, `ZENISTA_KEY_ALIAS`, `ZENISTA_KEY_PASSWORD`
(klidně stejný klíč jako u Stihnu to?).

# Ryby na medvědy

Druhá hra v repu, ve složce `ryby/`: fyzikální střílečka, ve které se z rybářského prutu vystřelují
ryby na medvědy schované ve stavbách z ledu, dřeva a kamene. Kreslená vektorová grafika:
ryby a medvědi s výrazy, bloky se třemi stupni poškození, pozadí s horami, lesem a řekou.
Osmnáct úrovní prvního prostředí (řeka v lese) se stoupající obtížností, v některých skalní
plošiny a kopce, přes které je potřeba střílet obloukem. Hodnocení jednou až třemi hvězdami (body za rozbité bloky, medvědy a hlavně za
nevystřelené ryby), výběr úrovně a ukládání postupu v zařízení.

Ryby: **pstruh** (bez schopnosti), **sardinky** (rozdělí se na hejno tří), **štika** (prudce zrychlí),
**čtverzubec** (nafoukne se a odhodí okolí), **sumec** (těžký, bourá vahou), **úhoř** (výboj zasáhne
medvědy i za překážkou). Schopnost se spouští klepnutím za letu, před prvním nárazem.
Medvědi: medvídě, medvěd, medvěd s přilbou z kotlíku a grizzly. Nárazy doprovází úlomky, otřes kamery, vyskakující body a zvuky;
medvědi se lekají letící ryby a po výstřelu vedle se smějí.

- Android: modul `rybyapp/`, APK vzniká na GitHubu stejně jako u Ženisty (**Actions** → poslední běh →
  **Artifacts** → `ryby-apk`). Aplikace se jmenuje Ryby na medvědy a instaluje se vedle Ženisty.
  Pro podpis používá stejné secrets `ZENISTA_KEYSTORE_*`.
- V prohlížeči: `python3 -m http.server 8080 -d ryby` a otevřít `http://127.0.0.1:8080/`.
- Ovládání: tahem od prutu zamířit a napnout, puštěním vystřelit. Tah jinde posouvá pohled,
  kolečko myši nebo dva prsty mění přiblížení.
  Klávesa R nebo tlačítko vpravo nahoře úroveň spustí znovu, Escape nebo tlačítko se třemi čarami
  otevře výběr úrovně, odtud vede tlačítko Zpět do hlavní nabídky (Hrát, zapnutí a vypnutí zvuku). Gamepad: levá páčka míří, A střílí a spouští schopnost, Y restart, B výběr úrovně.
- Testy: `node ryby/tests/run.js` (logika) a `node ryby/tests/browser.js` (prohlížeč, Playwright).
- Pokyny pro vývoj a plán dalších kroků jsou v `CLAUDE.md`.
