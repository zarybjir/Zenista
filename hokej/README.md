# Hokej '98

Arkádový hokej ve stylu her z konce 90. let — TV kamera z boku, příklepy, golfáky z první,
bodyčeky, varhany, houkačka, záznam gólu a tři hvězdy zápasu. Pro 1–2 hráče (až 4)
proti počítači nebo proti sobě, i ve spolupráci.

Běží v prohlížeči (HTML5 + Gamepad API), bez instalace čehokoli dalšího.
Týmy a hráči jsou smyšlení.

## Legion Go S / Steam Deck (SteamOS)

1. Přepni do **plochy** (Steam → Napájení → Přepnout na plochu).
2. V aplikaci **Discover** nainstaluj **Chromium** (pokud ho ještě nemáš).
3. Stáhni složku `hokej` (např. z GitHubu jako ZIP: *Code → Download ZIP*) a rozbal ji třeba do
   `~/Games/hokej`.
4. Souboru `hokej.sh` povol spouštění: pravé tlačítko → *Vlastnosti → Oprávnění → Je spustitelný*
   (nebo v Konsoli `chmod +x ~/Games/hokej/hokej.sh`).
5. Ve Steamu na ploše: **Hry → Přidat hru mimo Steam… → Procházet** → vyber `hokej.sh`
   (v dialogu přepni filtr na *Všechny soubory*) → **Přidat vybrané programy**.
6. Volitelně ji ve vlastnostech přejmenuj na „Hokej '98".
7. Vrať se do **herního režimu** a spusť hru z knihovny (sekce *Mimo Steam*).

**Ovladač:** ve hře zmáčkni tlačítko Steam/Legion → *Nastavení ovladače* a zvol šablonu
**Gamepad** (ne „Webový prohlížeč" — ta mapuje páčku na myš).

**Dva hráči:** Legion Go S má jeden vestavěný ovladač, druhý hráč potřebuje další gamepad
(Bluetooth nebo USB — Xbox, PlayStation, 8BitDo…). Na obrazovce *Výběr ovladačů* si každý
posune svůj ovladač páčkou k týmu: oba na různé strany = proti sobě, oba na stejnou stranu =
spolupráce proti počítači.

**Ukončení:** tlačítko Steam → *Ukončit hru*.

Spouštěč `hokej.sh` spustí lokální server (`python3`, je součástí SteamOS) na portu 47098 a
Chromium v režimu kiosku s povoleným zvukem bez kliknutí. Log je v `~/.cache/hokej98.log`.
Najde i Google Chrome, Brave nebo Edge (flatpak), případně Firefox (tam ale zvuk může začít až
po stisku klávesy).

## Na počítači

Otevři `index.html` v Chromu/Firefoxu (nebo spusť `./hokej.sh`). Funguje gamepad i klávesnice:

- **Klávesnice 1:** WASD, J = A, K = X, L = B, I = Y, Mezerník = sprint, Esc = pauza
- **Klávesnice 2:** šipky, Num1 = A, Num2 = X, Num3 = B, Num5 = Y, Num0 = sprint, Enter = pauza

## Ovládání (Xbox rozložení)

| | S pukem | Bez puku |
|---|---|---|
| Levá páčka | bruslení | bruslení |
| RT / RB | sprint | sprint |
| A | přihrávka ve směru páčky | přepnout hráče / „přihraj mi" |
| X | střela — ťuknutí = zápěstí, držení = příklep | bodyček |
| B | klička | šťouchnutí holí |
| Y | lobovaná přihrávka / nahození | přepnout hráče |
| Menu | pauza | pauza |

- **Golfák z první:** zmáčkni X, zatímco k tobě letí přihrávka.
- **Míření:** páčka nahoru/dolů při vystřelení = vzdálená/bližší tyč.
- **Buly:** zmáčkni A nebo X přesně ve chvíli, kdy puk dopadne na led.

## Nastavení

Délka třetiny (1–20 min), obtížnost (lehká/normální/těžká), hlasitost, hlasový komentář
(systémová syntéza řeči — pokud v systému není, hra je prostě bez komentáře), záznam po gólu.
