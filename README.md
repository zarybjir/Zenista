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

## Radar (žertovná aplikace)

Druhý modul `radar` je samostatná Android aplikace (WebView): kamera telefonu vyhledá
obličeje a každému přidělí náhodnou blikající nálepku nebo vlastní text. Detekce obličejů
je přibalená, aplikace běží offline a obraz nikam neodesílá.

- Stránka: `radar/src/main/assets/web/index.html`
- APK: stejný běh na GitHubu jako u Ženisty, artefakt `radar-apk`.
