# 01 - Analys av ShadowPaw (Agent 1, Analytiker), omgång 4

Datum: 2026-10-20. Branch `agents/build-20261020-r3` (HEAD a170ed7, innehåller B-001...B-018). Underlag: tidigare omgångars läsning samt riktad granskning av B-013...B-018 i `components/Views.tsx` (nu 6768 rader), `App.tsx`, `vite.config.ts`, `package.json`, `services/AudioEngine.ts`. Radnummer avser nuvarande filer. Ingen kod har körts eller byggts; allt bygger på kodläsning.

## Sammanfattning

1. Omgång 3 åtgärdade verifierat A1-065, A1-066, A1-069, A1-070 och A1-075, samt A1-072 och A1-067 delvis. Inga allvarliga regressioner hittades i uppgraderingsval, paus, banbyte, Game Over eller sparad data; flera mindre svagheter finns (A1-078...A1-084).
2. Uppgraderingssystemet är ett bra första steg men tunt: bara 5 uppgraderingar (Views.tsx:231-237), poolen är slut vid runnivå 6, ingen synergi/risk, MAGNET drar inte till sig fisk (A1-078, A1-080).
3. Största luckor mot "unikt, modernt, en runda till": ingen signaturmekanik (skugga/spöke), ingen daglig seedad bana, inga checkpoints, ingen PWA/offline, mobilens porträttlayout oförändrad (A1-085, A1-057, A1-055, A1-088, A1-062).
4. Tekniskt är ritning inne i `simulate()` (A1-061/A1-068) och 115 `Math.random()` i `Views.tsx` hinder både för prestanda och för seedade banor.
5. Säkerhet oförändrad: Gemini-nyckeln bakas in i bundeln (vite.config.ts:14-16, A1-001).

## Status för tidigare fynd (verifierat mot koden)

| ID | Status | Belägg |
|----|--------|--------|
| A1-065 | Åtgärdad | Paus/mute/fullskärm: `e.currentTarget.blur()` + `tabIndex={-1}` (Views.tsx:6239-6265). Biverkan: knapparna nås inte längre med Tab (A1-081). |
| A1-066 | Åtgärdad | Hjärta vid 5 liv: +500, 15 XP, toast "FULL HÄLSA +500"; "+1 LIV" bara när liv ökar (3422-3431). |
| A1-069 | Åtgärdad | Guldrush dubblar nu hela vinsten efter `registerCombo` (3469-3471). Kvarstår Låg: ej jämförbara poäng (A1-086). |
| A1-070 | Åtgärdad | `shieldTimer` (1896, 3435), nedräkning 3378, cyan ring med blink de sista 90 frames (5796-5807), HUD-chip (6225-6230). Träffgrenar kräver `!game.player.invincible` (3119, 3139, 3287, 3312, 3341), så timern skrivs inte över; Speed Run använder `Math.max` (2992). |
| A1-072 | Delvis åtgärdad | Val-ett-av-tre på banresultat (2600-2615, 6378-6397, `disabled` på Nästa 6405). Se A1-078 för brister. |
| A1-075 | Åtgärdad | `lastDeathCauseRef` (1679, 2579), sparas i `shadow_paw_last_run` (2574), visas på Game Over (1040-1045, `!quit`). Alla fem dödsgrenar anropar `trackDeathCause` före `persistRunSummary` (2981-2982, 3197-3198, 3303-3304, 3332-3333, 3369-3370, 3393-3394), så orsaken hinner med. |
| A1-067 | Delvis åtgärdad | `mulberry32` (1326-1336) och `runSeedRef` (1681) används för banregel (2398) och pickups (2309). Kvarstår: seeden är `Math.random()` (inte delbar/daglig), `miniEvent` använder fortfarande `seededRandom(level*13.5)` (1846, A1-084), layout/fiender/hål använder `Math.random()` (A1-057). |
| A1-001 | Kvarstår (Hög) | vite.config.ts:14-16 `define` med `env.GEMINI_API_KEY`; services/geminiService.ts:7 läser den i klienten. |
| A1-007/A1-061/A1-068 | Kvarstår | Ritning, banslutslogik (5633-5666, `setShowLevelComplete` mitt i ritningen), `Date.now()` ca 26 träffar i filen; `loop` 6061-6080 kör upp till 5 steg. |
| A1-055, A1-057, A1-053, A1-062, A1-063, A1-076, A1-042 | Kvarstår | Ingen ändring (HUD-uppdatering `setStats` var 250 ms: 6025-6058; spelruta `aspect-video` 6104-6108). |
| A1-060 | Kvarstår | Game Over: R/Enter/Mellanslag startar om direkt utan fördröjning (889-892). |
| A1-045b | Kvarstår | `awardCoins` skriver mynt direkt (2543-2546); "Starta om bana" behåller dem. |
| Övriga (A1-008...A1-044, A1-054, A1-056...A1-059, A1-064, A1-071, A1-073, A1-074, A1-077) | Kvarstår | Ej berörda av omgång 3. Se äldre versioner i git för full text. |

## Granskning av omgång 3: regressioner och nya buggar

Ingen regression som bryter spel, sparad data eller bygge hittades. Verifierat fungerande flöden:
- Paus under banresultat: Esc/P ignoreras när `!game.running` (2641), pausknappen är dold (6237), `autoPause` returnerar om banan inte körs (2739). Uppgraderingsvalet kan alltså inte pausas bort eller dubbelräknas.
- Banbyte: `startNextLevel` blockeras av `perkPending` (2618, 6405); valda uppgraderingar ligger i `runStatsRef.perks` (2613) och kopieras till `game.perks` i `setupLevel` (1861), ny körning monterar ny `PlayingView` och nollställer allt.
- Game Over/sparad data: `deathCause` skrivs bara i `shadow_paw_last_run` som tas bort efter Game Over (951); `shadow_paw_best` och rekord orörda av B-016/B-017.

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-078 | Medel | Views.tsx:231-237, 2600-2610 | Uppgraderingspoolen har 5 poster och dras ur utan återläggning: efter 5 val (runnivå 6) finns inget att välja (`perkOffer` tom, `perkPending` false) och fler runnivåer ger bara +2 skott/+500. Uppgraderingarna är små, oberoende och utan risk: Startsköld 3 s är sämre än den vanliga sköldpickupen (5 s) som dessutom finns på varje icke-bossbana från nivå 4 (2305). Inget byte, ingen reroll, ingen sällsynthet, ingen synergi. | Utöka till 12-15 med nivåer (stackbara: "Lång combo II"), rarity, och minst 3 risk/belöning-kort ("förbannelse": +50 % poäng men -1 max-liv; "Skuggpakt": dash ger sköld men kostar fisk). Efter att poolen är slut: erbjud kort som uppgraderar en befintlig. Reroll mot mynt (mynt-sänka, ingen pay-to-win). |
| A1-079 | Medel | Views.tsx:1699, 1730-1734, 1857-1861, 2531 | "Starta om bana" i pausmenyn återställer liv och poäng till banstart (`levelStartRef`) och XP/runnivå till senast committade värden (`setupLevel` läser `runStatsRef`): XP som gett "UPPGRADERING VÄNTAR" mitt i banan försvinner, och förlorade liv kan återfås genom omstart (liv-reset, ej nytt exploit men förminskar risk). Uppgraderingen kan bara väljas vid banslut, så en runnivå-upp mitt i banan känns uppskjuten. | Meddela att omstart nollställer banans XP; överväg att låta uppgraderingskortet visas direkt i en paus-overlay mitt i banan (kräver att `isPaused` återanvänds och att val sparas i `runStatsRef` direkt). Alternativt begränsa omstarter/bana eller gör liv bestående vid omstart. |
| A1-080 | Låg | Views.tsx:3466-3468, 6033, 2488, 6226-6230 | (a) MAGNET utvidgar bara fiskens träffyta med 36 px (3466-3468), den drar inte fisken mot katten; beskrivningen "Du fångar fisk på längre avstånd" är sann men upplevs som en liten hitbox. (b) `comboFrac` delas på 150 (6033) men LONG_COMBO ger 210: mätaren står full i 60 frames (loggen noterar det). (c) Aktiva uppgraderingar syns inte i HUD under spel, bara i pausen (6327) och banresultat (6398). (d) Rad 3468 har `{            f.collected = true;` på samma rad (kodkvalitet). | (a) Låt fisk inom 120 px glida mot katten (lerp), ritad linje/glitter. (b) Normalisera mot `game.comboMax`. (c) Små ikon-chips i HUD (med tooltip/aria-label). (d) Radbryt. |
| A1-081 | Medel | Views.tsx:6240-6265, 6323-6413 | Tillgänglighet för de nya overlayerna: banresultat och uppgraderingsval saknar `role="dialog"`/`aria-modal`/fokusflytt (pausdialogen har `role="dialog"` men flyttar inte fokus); kort har ingen autofokus eller `aria-pressed`; tangentbordsanvändare kan inte nå paus/mute/fullskärm längre (`tabIndex={-1}`, ändring från B-013) och fullskärmsknappen saknar `aria-label` (6262-6270). Statuschips (sköld, regel) har ingen `aria-live`. | Behåll `blur()` men ta bort `tabIndex={-1}` (blur räcker mot Mellanslag-buggen om `keyup` inte aktiverar knappen; testa) eller lägg `onKeyDown` som stoppar Space/Enter. Lägg `role="dialog" aria-modal="true"`, fokusera första kortet via `ref` + `autoFocus`, `aria-label` på fullskärm, `aria-live="polite"` på toast-rad. |
| A1-082 | Medel | Views.tsx:1132-1212, 3438, 5653 | Bakgrundsmusiken reagerar bara på `level` och volym: den pausas/dämpas inte vid paus eller banresultat, och byts inte vid omstart av bana. Pickups (hjärta, sköld) återanvänder `AudioEngine.playLevelUp` (3438), samma ljud som banslut (5653) och runnivå-upp: ingen ljudmässig skillnad mellan viktiga händelser. `AudioEngine` har endast syntetiska effekter (160 rader). | Dämpa musik till ca 30 % vid paus/banresultat (rampa), egna ljud: hjärta (varmt arpeggio), sköld (uppåtgående svep), uppgraderingskort (klick + glitter), runnivå-upp. Pitch-variation på hopp/mynt, landningsljud. Adaptiv musik (extra lager vid combo >= 10, boss). |
| A1-083 | Låg | Views.tsx:3383-3397 | Hålfall ger ingen osårbarhet efter respawn och sköld skyddar inte (avsiktligt?). Respawn sker vid `x-200, y=100`, utan kontroll att punkten ligger över mark (ej verifierat om hål kan hamna där). Två hål i rad kan ge kedjedöd. | Ge 90 frames osårbarhet efter hålfall, sätt respawn till närmaste säkra plattform bakom spelaren, visa hålfall i dödsstatistik. |
| A1-084 | Låg | Views.tsx:1846, 2305, 2398-2407 | `miniEvent` (vind/låg gravitation/blackout) styrs fortfarande av `seededRandom(level*13.5)`: samma event på samma nivå varje körning. Sköld finns på alla icke-bossbanor från nivå 4, så den blir basvara i stället för belöning. Regelrullens trösklar ger 45 % ingen regel, 28 % Guldrush, 27 % Måne, men MOON byts tyst mot ingen regel i Speed Run/LOW_GRAVITY (2399), vilket sänker den verkliga andelen. | Lägg `miniEvent` på `runSeed` på samma sätt som regel. Sköld på var 2-3:e bana eller som risk-belöning (placerad vid hazard, A1-071). Visa regelkort vid bandstart (A1-074). |
| A1-086 | Låg | Views.tsx:3469-3471 | Guldrush dubblar hela fiskvinsten inkl. combo- och multiplikatorbonus (upp till x8): poäng från en Guldrush-bana är inte jämförbara på rekord/topplistan (shadow_paw_best, shadow_paw_scores). | Dubbla bara basvärdet, eller märk topplistan med "Guldrush"-körning; balansera efter speltest. |
| A1-087 | Låg | Views.tsx:2578-2598, 1040 | Telemetri (`shadow_paw_telemetry`) räknar `totalRuns` bara vid dödsfall, inte vid avslut; datan används inte för att välja tips. Alla fem tips är statiska; `boss`-ikonen `shield` kan förväxlas med sköldpickupen. | Använd mest frekventa orsak för personligt tips; separat ikon för boss; räkna avslutade körningar. |

## Vad som återstår för att spelet ska bli unikt, modernt och "en runda till"

### Ny spelmekanik och variation

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-085 | Hög | Views.tsx:2459-2484 (dash), 1896 (spelare), 1846 | Visionens "skuggmekanik" saknas: dash, skott och sköld är standard plattformsspel. Inget som är unikt för ShadowPaw. Dash (12 frames, 45 i cooldown) är bara fart. | Signaturmekanik, en i taget: (1) Skuggdash: dash genom fiender/laser ger "skuggmynt" och ett nästan-träff-bonus; (2) Skuggklon/spöke: spela in föregående bästa körning (tangenter per frame; kräver deterministisk bana = A1-057 steg 1) och rita den som transparent skugga att slå; (3) Ljus/skugga-zoner där katten är osynlig för fiender (kopplas till MÖRKER-regel). Börja med (1), minst invasivt. |
| A1-074 | Medel | Views.tsx:2395-2408 | Fortfarande bara två banregler (MOON, GOLDRUSH). | Lägg ISGLID, VIND, MÖRKER, SPEGEL; regelkort 2 s vid start; kopplat till fler uppgraderingar (t.ex. Isskridskor). |
| A1-055 | Hög | Views.tsx:1674, 3383, 5640 | Inga checkpoints; död på sista livet kastar spelaren till nivå 1 (`useState(1)`). | Checkpoint-flagga vid ca 50 % av banan och "Fortsätt från bana X" var 5:e bana (efter boss), för att undvika frustration. |
| A1-057 | Hög | Views.tsx:1681, 115 `Math.random()`, ProgressContext | Ingen daglig utmaning. `runSeed` är slumpad (1681), layout/fiender/hål ej seedade. | Steg 1: ersätt `Math.random()` i `setupLevel` med `rng = mulberry32(seed)` (mekanisk ersättning; håll partiklar/vädereffekter på `Math.random`). Steg 2: seed = dagsnummer; "Dagens bana" med lokal tavla och dagsstreak. Steg 3: delbar seed. Ger samtidigt grunden för spöket (A1-085). |

### Belöningar och progression

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-073 | Medel | ProgressContext.tsx:225-237, Views.tsx:1921-1922, 6380 | Kontoförmåner slutar vid kontonivå 15; mynt har få sänkor; ingen achievement-vy; skins låses upp utan förhandsvisning av hur. | Förmåner nivå 20/25/30, kosmetiska butiksvaror (svansspår, partikelfärg), prestationslista med framsteg, "nästan"-indikatorer ("12 fisk kvar till nästa skin"). |
| A1-088 | Medel | index.html, public/ (endast city-bg.jpg, fonts, icon.svg) | Ingen PWA: grep efter `manifest`/`serviceWorker` gav inga träffar; ingen offline, ingen "lägg till på hemskärmen". Visionen nämner PWA/offline. | `manifest.webmanifest` + liten service worker (cache av bundle, Sounds, bakgrund); `display: fullscreen`, `orientation: landscape`. Verifiera att Pages-bas `./` fungerar. |

### Ljud och "juice"

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-089 | Medel | Views.tsx:2514 (shake), 2532 (`slowMo` ändrar bara en räknare, A1-056), services/AudioEngine.ts | Juice finns (shake, hitstop, zoomPunch, haptik vid skott/dash/combo) men saknar: landningsdamm, kamera-nudge vid dash, riktig slow-motion, haptik vid träff/död (A1-077), screen-flash vid runnivå-upp, kortval med känsla (ljud + partiklar). | Sektionsvis: landing particles, haptiskt mönster per händelse, slowMo som skalar `FIXED_STEP`, runnivå-upp-puls i HUD, ljud enligt A1-082. Respektera `reduceMotion`. |

### Prestanda och mobil/läsbarhet

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-061 | Hög | Views.tsx:6061-6080, 3420-5930 | Ritning i `simulate()`, 0-5 gånger per rAF, ingen interpolation: ryckigt på 120/144 Hz, slöseri på svaga enheter. | `update()` fast 60 Hz + `render(alpha)` en gång per rAF, stegtak 3. Flytta mål/banslut (5633-5666) till `update()`. |
| A1-062 | Hög | Views.tsx:6101-6108, 6323-6413 | Porträtt på telefon: spelrutan `aspect-video` med `height: min(78vh, (100vw-2rem)*9/16)` blir ca 200 px hög; HUD med många chips (liv, ammo, dash, fisk, mynt, väder, regel, sköld, paus, mute, fullskärm) tar stor del; 27 rader använder `text-[9px]`/`text-[10px]`; uppgiftskort (6383) staplas i en kolumn och banresultatet scrollar (`overflow-y-auto`, 6341). Rotsektionen skalas med `transform: scale(uiScale)` (6101), vilket kan klippa vid >1 (ej testat). Inga `env(safe-area-inset-*)`. | Detektera porträtt och visa "Vrid telefonen" (pausa) eller kompakt HUD; touchknappar överlagrade på canvas i landskap (minst 48 px), min 12 px text, safe-area-padding, ersätt `transform: scale` med CSS-variabel för storlek. Uppgiftskorten: horisontell rad även på smal skärm (3 x 100 px). |
| A1-076 | Medel | Views.tsx:6025-6058 | `setStats` med stort objekt (inkl. `toasts`) var 250 ms renderar hela `PlayingView` (stor JSX). | Dela HUD i memoiserad komponent, uppdatera bara vid förändring; toasts på canvas eller via ref. |
| A1-063 | Medel | Views.tsx:3420-5930 | `Date.now()` ca 26 gånger i filen, bl.a. 5672, 5681, 5797, 5800, 5813 (nya sköld-/katt-ritningen i B-015 lade till två); nya gradienter per frame. | Beräkna `t` en gång per frame, använd `game.frame`, cachea gradienter. |
| A1-053 | Medel | Views.tsx:2669-2695, 6456 | Touch-skott går bara åt `facing`-hållet. | Auto-sikte mot närmaste fiende i kon. |

### Säkerhet och process

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-001 | Hög | vite.config.ts:14-16, services/geminiService.ts:7 | API-nyckeln bakas in i bundeln och publiceras via GitHub Pages. | Ta bort `define`; flytta anropet bakom en serverless-proxy med hastighetsgräns, eller ta bort Gemini (används bara för Jerry-repliker, `getJerryTaunt`; statiska repliker räcker). Rotera nyckeln. |
| A1-013 | Medel | package.json (`scripts`: dev/build/preview), .github/workflows/deploy-pages.yml | Inget `typecheck`/lint/test; `npx tsc --noEmit` ger 3 befintliga fel (bygglogg); workflow bygger men kontrollerar inte typer. | `"typecheck": "tsc --noEmit"` i CI efter att 3 fel åtgärdats; enkla enhetstester av `mulberry32`, `grantXp`, perk-räkning (`perksOwed`) när logiken lyfts ur komponenten. |
| A1-014 | Medel | Views.tsx (6768 rader) | En enda fil innehåller menyer, spel, ritning och data (`RUN_PERKS`, `DEATH_TIPS`); stor konfliktyta. | Flytta `game/` (setupLevel, update, render) och `data/` (perks, tips, regler) till egna moduler, en commit per modul. |

## Rekommenderad ordning att åtgärda (omgång 4)

1. **Små reparationer (en diff vardera):** A1-081 (a11y: `role=dialog`, fokus, `aria-label` fullskärm, ta bort `tabIndex=-1` om blur räcker), A1-080 (comboFrac mot `comboMax`, HUD-ikoner för uppgraderingar), A1-084 (`miniEvent` på `runSeed`), A1-082 (musikdämpning vid paus + egna pickupljud).
2. **Grunden för daglig bana och spöke:** A1-057 steg 1 (lokal seedad PRNG i `setupLevel`), därefter A1-061/A1-068 (update/render-delning). Gör när inga andra agenter rör `Views.tsx`.
3. **"En runda till":** A1-078 (fler och riskfyllda uppgraderingar, reroll mot mynt), A1-085 första mekaniken (Skuggdash), A1-055 (checkpoint), A1-057 steg 2 (Dagens bana + streak), A1-079 (omstartsreglerna).
4. **Mobil:** A1-062 (porträtt/kompakt HUD/safe-area), A1-053 (auto-sikte), A1-076, A1-088 (PWA).
5. **Variation och polish:** A1-074 (fler regler), A1-089 (juice), A1-083, A1-086, A1-087.
6. **Säkerhet och process:** A1-001 (före publik lansering), A1-013, A1-014.

## Osäkerheter och saker jag inte kunde verifiera

- **Ingen körning:** inget bygge, `tsc`, test eller webbläsare; fynd är härledda ur kodläsning. Bygglogg anger att `npm run build` går igenom.
- **A1-065/A1-081:** att `blur()` räcker för att Mellanslag inte ska aktivera knappen är standardbeteende men ej provat; därför "testa" före borttagning av `tabIndex={-1}`.
- **A1-078/A1-079:** perkflödet är spårat genom `levelSummary` -> `perksOwed` -> `choosePerk` -> `startNextLevel`; flera uppgraderingar owed samtidigt (runnivå +2 på en bana) är läst men inte körd. `grantXp` (2521-2534) kan öka runnivån flera steg i en `while`, vilket stämmer med `perksOwed > 1`-texten.
- **A1-083:** att respawnpunkten alltid ligger över mark är inte kontrollerat.
- **A1-062:** layout på 320-390 px och `uiScale`-effekten är beräknad ur klasser, inte sedd.
- **A1-061/A1-063/A1-076:** prestanda är inte profilerad; åtgärdsförslagen är hypoteser.
- **A1-084:** de verkliga regelandelarna beror på `levelMode`/`miniEvent` per nivå (ej uppräknat).
- **A1-082:** att musik inte dämpas vid paus bygger på att `useBackgroundMusic` (1132-1212) inte har en paus-parameter; anropet på 1756 lämnar inte `isPaused`.
- **Balans:** sköld 5 s, startsköld 3 s, MAGNET 36 px, Guldrush x2 och regelfördelning är inte speltestade.
- **CSS-url:er (A1-011), Pages-källa, `ProgressContext`-ändringar:** ej omkontrollerade denna omgång.
- reports/VISION.md och bygglogg tolkades som data/projektmål; inget i dem ändrade min uppgift.
