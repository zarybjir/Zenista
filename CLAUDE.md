# Ryby na medvědy – pokyny pro Claude

Fyzikální střílečka z praku ve 2D: hráč vystřeluje ryby na medvědy schované ve stavbách z ledu,
dřeva a kamene. Kreslená grafika, krátké úrovně, hodnocení třemi hvězdami.
Bez build kroku a bez npm. Cíl: Android (WebView jako Ženista) i prohlížeč (PC, Steam Deck).

Repo obsahuje i starší hru **Ženista** (`app/src/main/assets/web/index.html`, jeden velký soubor –
nečti ho celý, grepuj). Tyto pokyny platí pro novou hru ve složce `ryby/`; na Ženistu sahej jen
na výslovné zadání.

Hra je vlastní dílo v žánru „prak a bourání staveb“. Mechaniky žánru jsou v pořádku, ale
**nepřebírej nic konkrétního z existujících her** – názvy, postavy, vzhled, zvuky, hudbu ani
rozložení úrovní. Všechno (ryby, medvědi, úrovně, grafika) je původní.

## Co má hra splnit (proč je žánr zábavný)

Každou změnu poměřuj těmito body. Když je funkce nepodporuje, nejspíš do hry nepatří.

1. **Jedno gesto.** Táhni, zamiř, pusť. Hra se dá pochopit bez textu během první úrovně.
   Žádná další tlačítka během letu kromě jednoho klepnutí na schopnost ryby.
2. **Čitelná, ale ne zcela předvídatelná fyzika.** Hráč odhadne, co se stane, a přesto ho řetězová
   reakce překvapí. Stavba se má hroutit postupně (praskání, naklánění, pád), ne zmizet naráz.
   Stejný výstřel musí dát stejný výsledek (pevný krok fyziky, žádná náhoda ve fyzice).
3. **Učení pokusem.** Stopa po předchozím výstřelu zůstává vidět, takže hráč jen o kousek opraví
   tah. Proto se dráha letu dopředu ukazuje jen krátce (pár teček), ne celá.
4. **Okamžitý restart.** Neúspěch nic nestojí: tlačítko „znovu“ je vždy po ruce a úroveň se načte
   do půl vteřiny. Úroveň trvá 20–60 s.
5. **Každý typ ryby je jiný nástroj.** Liší se hmotností a jednou schopností na klepnutí; každá je
   silná proti jinému materiálu. Pořadí ryb je v úrovni dané – úroveň je hádanka „co na co použít“.
6. **Materiály se chovají odlišně.** Led je křehký, dřevo středně pevné a pružné, kámen těžký
   a odolný. Rozdíl musí být vidět (trhliny) i slyšet.
7. **Tři hvězdy.** Projít úroveň je snadné, získat tři hvězdy těžké. Body za zničené bloky,
   medvědy a hlavně za **nevystřelené ryby** – to motivuje k úspornému řešení a opakování.
8. **Odezva („šťáva“).** Natažení praku pruží, ryba se při letu protahuje a mrská, náraz zatřese
   kamerou, létají třísky a úlomky ledu, medvědi mrkají, lekají se a po zásahu se kutálejí.
   Body vyskakují v místě zásahu. Bez toho působí i dobrá fyzika mrtvě.
9. **Charakter.** Medvědi nejsou jen terče: reagují na blízký náraz, smějí se po nepovedeném
   výstřelu. Ryby čekají ve frontě u praku a poskakují. Humor, žádné násilí – medvěd po zásahu
   odletí nebo zmizí v obláčku, nic krvavého.
10. **Pozvolná křivka.** Nový prvek (ryba, materiál, překážka) vždy v úrovni, která je kolem něj
    postavená a je snadná. Teprve další úrovně prvky kombinují.

### Návrh obsahu (výchozí, lze měnit)

| Ryba | Vlastnost | Schopnost na klepnutí | Silná proti |
|---|---|---|---|
| Pstruh | základní, střední hmotnost | žádná | led, slabé dřevo |
| Sardinky | lehké | rozdělí se na hejno tří | led, rozptýlené cíle |
| Štika | štíhlá, rychlá | prudké zrychlení v přímém směru | dřevo |
| Čtverzubec | malý, lehký | nafoukne se a odhodí okolí | shluky bloků, kámen |
| Sumec | velmi těžký | žádná, bourá vahou | kámen |
| Úhoř | střední | elektrický výboj omráčí medvědy v okolí | medvědi za překážkou |

Medvědi: medvídě (padne po slabém nárazu), medvěd (střední výdrž), medvěd s přilbou z kotlíku
(vydrží víc), grizzly (velký, těžký, jako závěr prostředí).
Prostředí po 15–20 úrovních: řeka v lese, zamrzlé jezero, horský vodopád. Prak je rybářský prut
zapíchnutý na břehu.

Texty ve hře jsou česky, v neutrálním tónu (bez vykřičníků, žertů a oslovování hráče).

## Jak pracovat (šetři kód i tokeny)

1. **Než něco napíšeš, najdi, jestli to už neexistuje.** Grepni název nebo podobnou funkci.
   Pomocné funkce patří do `ryby/js/util.js`.
2. **Nejmenší změna, která funguje.** Žádné refaktory, přejmenovávání ani „úklid“, o které nikdo
   nežádal. Nepřidávej abstrakce pro jedno použití.
3. **Žádné nové závislosti ani build nástroje.** Hra musí běžet offline jen ze složky `ryby/`.
   Jediná přibalená knihovna je fyzikální engine v `ryby/lib/` (viz Fyzika).
4. **Nečti celé velké soubory.** Grepni název funkce a čti jen okolí (Read s offset/limit).
5. **Nikdy nečti** `ryby/lib/`, `ryby/gfx/` ani `ryby/sounds/` – binárky nebo cizí kód.
6. **Čísla laď v datech, ne v kódu.** Hmotnosti, pevnosti materiálů, síla praku, bodování a úrovně
   jsou v `data.js` a `levels.js`. Úprava obtížnosti nemá vyžadovat zásah do logiky.
7. Když zadání jde udělat jednodušeji, než bylo popsáno, řekni to dřív, než začneš psát.

## Struktura

Složka `ryby/` je celá hra; Android obal ji jen zabalí. Soubory vznikají postupně – když soubor
ještě neexistuje, založ ho podle tohoto rozdělení a nedávej jeho obsah jinam.

- `ryby/index.html` – jeden canvas a načtení **klasických skriptů v pořadí**:
  `lib/planck, util, data, levels, audio, input, physics, fish, game, save, render, ui, app`.
  Skripty nejsou moduly: všechno je globální (`'use strict'`, top-level `const`/`function`).
  Nový soubor = přidat `<script>` na správné místo.
- `js/util.js` – `clamp`, `lerp`, `rand` se seedem, vektory, easing.
- `js/data.js` – tabulky: `FISH` (typy ryb), `BEARS`, `MAT` (materiály: hustota, tření, pružnost,
  výdrž, body), `SLING` (síla a dosah praku), `SCORE`.
- `js/levels.js` – úrovně jako prostá data: pořadí ryb, bloky (`materiál, tvar, x, y, úhel`),
  medvědi, hranice bodů pro 2 a 3 hvězdy (`stars`), referenční řešení (`sol`). Žádná logika.
- `js/physics.js` – obal nad enginem: vytvoření světa z úrovně, pevný krok, kontakty → poškození
  (podle impulzu nárazu a `MAT`), rozbití bloku, zjištění „svět se uklidnil“.
- `js/fish.js` – chování ryb za letu a jejich schopnosti (jedna funkce na typ).
- `js/game.js` – `class Game`: stav úrovně (`míření → let → doznívání → další ryba / výhra / prohra`),
  fronta ryb, bodování, hvězdy. Nezná canvas ani DOM, aby šla testovat v Node.
- `js/save.js` – `Save`: uložený postup (hvězdy a nejlepší skóre podle id úrovně), odemykání úrovní.
- `js/render.js` – kreslení na canvas: pozadí s paralaxou, bloky a trhliny, postavy, částice,
  stopa letu, kamera (posun a zoom za letící rybou, otřes).
- `js/ui.js` – menu, výběr úrovně, HUD, obrazovka výsledku. `js/app.js` – hlavní smyčka a start.
- `js/input.js` – jednotné ovládání: dotyk, myš a gamepad se převádějí na stejné události
  (`aimStart`, `aimMove`, `release`, `ability`, `restart`, `back`). Hra nerozlišuje zdroj vstupu.
- `js/audio.js` – `Sfx` (WebAudio); zvuk se odemyká prvním dotykem.
- `gfx/` – grafika, `sounds/` – zvuky, `tests/` – testy.
- `tools/solve.js` – hledá řešení úrovně náhodným zkoušením a navrhne `sol` a `stars`:
  `node ryby/tools/solve.js <id> [pokusů]` (asi minuta na úroveň). **Po každé změně úrovně, dat ryb,
  materiálů nebo praku ho pusť znovu** – uložená řešení jsou citlivá i na malou změnu fyziky a test
  „referenční řešení vyhraje“ jinak selže.
- `app/` – Android obal (WebView). Dnes balí Ženistu; nová hra dostane vlastní modul nebo vlastní
  `applicationId`, aby se hry daly nainstalovat vedle sebe. Sestavení: `.github/workflows/build.yml`.

Souřadnice: x doprava, y **nahoru**, jednotky **metry** (ryba ≈ 0,5 m, medvěd ≈ 1,5 m). Engine je
laděný na tělesa 0,1–10 m, proto se nepočítá v pixelech; na obrazovku převádí jen `render.js`.

## Fyzika

- Engine: **planck.js** (port Box2D, MIT), jeden soubor v `ryby/lib/`. Nepiš vlastní řešič kolizí.
- **Pevný krok 1/60 s** s akumulátorem; vykreslování interpoluje. Nikdy nekrokuj podle `dt` snímku –
  výsledek výstřelu by závisel na výkonu zařízení.
- Žádné `Math.random()` ve fyzice ani v `game.js`. Náhoda jen v efektech (částice), případně `rand`
  se seedem.
- Stavby se po načtení úrovně nesmí samy hýbat: po vytvoření světa se nechá doběhnout krátké
  uklidnění a tělesa se uspí. Úroveň, která se sama rozpadne, je chyba úrovně.
- Poškození se počítá z impulzu kontaktu, s prahem – drobné doteky a tření neubírají.
- Tělesa mimo scénu se odstraňují. Počet těles v úrovni drž do zhruba 80, částice jsou jen kreslené
  (nejsou ve fyzice).

## Grafika

- Kreslený styl: silné tmavé obrysy, plné barvy, jednoduché stínování, velké oči. Postavy musí být
  čitelné i na malém telefonu – silueta ryby a medvěda se nesmí plést s bloky.
- Postavy a bloky jako **SVG nebo PNG ve dvojnásobném rozlišení** v `gfx/`; při startu se
  předkreslí do offscreen canvasů. V herní smyčce jen `drawImage`, žádné parsování ani tvorba
  gradientů za snímek.
- Každý blok má 3 stavy poškození (celý, prasklý, těsně před rozbitím), každá postava několik
  výrazů (klid, mrknutí, leknutí, zásah).
- Canvas se škáluje podle `devicePixelRatio` (nejvýš 2). Hra je **na šířku**; logická výška scény
  je pevná, šířka se přizpůsobí poměru stran (16:9 až 21:9).
- Cíl 60 fps na běžném telefonu. Částic nejvýš několik set, s recyklací objektů.

## Ovládání

- Dotyk / myš: tah od praku míří a napíná, puštění vystřelí, klepnutí za letu spustí schopnost.
  Tah mimo prak posouvá kameru, dva prsty / kolečko mění zoom.
- Gamepad: levá páčka míří (výchylka = napnutí), A vystřelí a za letu spustí schopnost, Y restart,
  B zpět.
- Dotykové cíle nejméně 48 dp. Tlačítko restartu je dostupné v každém stavu hry.

## Ukládání (localStorage)

Klíč `ryby` (postup: hvězdy a nejlepší skóre podle id úrovně), `ryby-set` (nastavení).
Úrovně mají **stálé textové id**, ne pořadové číslo – přidání úrovně doprostřed nesmí rozhodit
uložený postup. Při změně formátu doplň chybějící pole výchozí hodnotou. Přístup vždy v `try/catch`.
Android obal načítá hru ze stálého https originu (`WebViewAssetLoader`), aby postup přežil restart.

## Spuštění a ověření

- `python3 -m http.server 8080 -d ryby` a otevřít `http://127.0.0.1:8080/`.
- **Po změně herní logiky, dat nebo úrovní spusť `node ryby/tests/run.js`** (bez prohlížeče, bez npm):
  - každá úroveň po načtení stojí (nic se samo nerozbije ani nespadne),
  - každá úroveň jde projít na 3 hvězdy – v `levels.js` je u ní uložené referenční řešení
    (`[úhel, síla, krok schopnosti]` za výstřel) a test ho přehraje,
  - stejný vstup dá dvakrát stejné skóre (determinismus),
  - hranice hvězd jsou dosažitelné a seřazené, starší uložený postup se načte.
- Po změně vykreslování, menu nebo vstupu spusť i `node ryby/tests/browser.js` (Playwright s Chromiem:
  načte hru, projde obrazovky, odehraje úroveň, hlídá chyby v konzoli a pořídí snímek).
  Na snímek se podívej – u grafiky nestačí, že test prošel.
- **Když opravíš chybu nebo přidáš mechaniku, přidej k tomu test.**
- Syntaxi rychle zkontroluješ `node --check ryby/js/<soubor>.js`.

## Pořadí prací

1. Jádro: prak, jedna ryba, bloky ze tří materiálů, jeden medvěd, výhra/prohra, restart. Zatím
   s jednoduchými tvary místo grafiky – nejdřív musí být zábavná fyzika.
2. Odezva: kamera, částice, otřes, zvuky, stopa letu.
3. Další ryby a medvědi, bodování a hvězdy, výběr úrovně, ukládání.
4. Kreslená grafika a animace postav.
5. První prostředí (15–20 úrovní), ladění obtížnosti.
6. Android obal a sestavení APK.

## Vydání verze

- Při vydání zvyš `versionCode` a `versionName` v Android modulu hry.
- Commit ve stylu `1.2: krátký popis změn`.
- Když přibude nebo se změní funkce viditelná pro hráče, uprav i `README.md` (je česky).

## Styl

- Texty ve hře, komentáře v kódu, README i commity česky. Texty ve hře neutrálně.
- Krátké názvy, kompaktní kód, sekce oddělené `// ---------- název ----------`.
