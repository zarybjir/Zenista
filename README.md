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
ryby na medvědy schované ve stavbách z ledu, dřeva a kamene. Zatím je hotové jádro hry
s jednoduchou grafikou: prak, jedna ryba (pstruh), tři materiály, jeden medvěd, tři úrovně,
výhra, prohra a restart. Nárazy doprovází úlomky, otřes kamery, vyskakující body a zvuky;
medvědi se lekají letící ryby a po výstřelu vedle se smějí.

- Spuštění: `python3 -m http.server 8080 -d ryby` a otevřít `http://127.0.0.1:8080/`.
- Ovládání: tahem od prutu zamířit a napnout, puštěním vystřelit. Tah jinde posouvá pohled,
  kolečko myši nebo dva prsty mění přiblížení.
  Klávesa R nebo tlačítko vpravo nahoře úroveň spustí znovu. Gamepad: levá páčka míří, A střílí, Y restart.
- Testy: `node ryby/tests/run.js` (logika) a `node ryby/tests/browser.js` (prohlížeč, Playwright).
- Pokyny pro vývoj a plán dalších kroků jsou v `CLAUDE.md`.
