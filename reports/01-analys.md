# 01 - Analys av ShadowPaw (Agent 1, Analytiker), varv 6

Datum: 2026-10-20. Branch `agents/build-20261020-r6` (= main, omgång 1-5 och borttagen Gemini). Underlag: kodläsning av `components/Views.tsx` (7061 rader), `context/ProgressContext.tsx`, `services/AudioEngine.ts`, `types.ts`, `package.json`, `reports/03-bygglogg.md`, `reports/04-verifiering.md`. Inget bygge eller test kördes av mig; allt är härlett ur kodläsning. Radnummer avser nuvarande filer.

## Sammanfattning

1. Varv 5 (B-025...B-030) är på plats i koden och jag hittade ingen regression som bryter spel eller sparad data. A1-090 (dash-farm) och A1-094 (kort-reroll) är åtgärdade.
2. Små nya brister i varv 5: SHADOWFLOW gör perken FAST_DASH verkningslös (A1-130), seedade kort använder `gameRef.current.lives` utanför deps (A1-131), autosikte siktar inte på bossar och ignorerar väggar (A1-132).
3. Största möjligheten: fiendetyperna 0-2 skiljer sig bara visuellt (`e.type` används endast vid ritning, Views.tsx:5086, 5163), skuggpassager räknas inte i uppdrag/achievements, och det finns bara 7 achievements och 4 köpfria skins. Det är billiga, synliga vinster.
4. Förslag på ett "paket" av små idéer som ryms på ett varv och tillsammans ger synlig skillnad finns sist (Paket P6).

## Status för tidigare fynd (verifierat mot koden)

| ID | Status | Belägg |
|----|--------|--------|
| A1-090 | Åtgärdad | `e.shadowPassed` (Views.tsx:3317-3322) och `h.shadowPassed` (3536-3538) ger belöning en gång per fiende/laser. `shadowDashId` används ej. |
| A1-094 | Åtgärdad | `perkOffer` seedad med `mulberry32` (2708); `BONUS_LIFE` filtreras vid >= 5 liv (2705). Se A1-131 för liten rest. |
| A1-097 / A1-081 | Åtgärdad (mestadels) | `trapTab` (2733), fokusåterställning (2755-2762), `onKeyDown` på båda dialogerna (6588, 6606). Kvar: ingen `inert` på bakgrunden, tangentbord ej provat. |
| A1-082 | Delvis | Pitchvariation och `playLand` finns (AudioEngine.ts:11-27, 138-141; Views.tsx:3272). Kvar: adaptiv musik, haptik vid landning. |
| A1-105 | Delvis | Tre regler: MOON, GOLDRUSH, SHADOWFLOW (2460-2474). Kvar: fler regler. |
| A1-053/A1-123 | Delvis | Touch-autosikte (2822-2837, 6750). Kvar: gester, knappstorlek, vänsterhandsläge. |
| A1-091 | Kvarstår, dokumenterat | Ingen belöning under sköld (3317, 3532). |
| A1-092, A1-093, A1-095, A1-096, A1-098, A1-099 | Kvarstår | Ej berörda. `build` i package.json använder fortfarande `node -e "require(...)"` och kopierar `Sounds/` (A1-099). |
| A1-055, A1-057, A1-061, A1-063, A1-013, A1-014, A1-060, A1-062, A1-086, A1-088 | Kvarstår | Ej berörda. Fortfarande 3 kända tsc-fel och ingen `typecheck` i CI. |
| A1-114 | Delvis | `weeklyQuests` finns redan (ProgressContext.tsx:35-41, Views.tsx:7005) men bara "samla fisk" och "besegra fiender". |

## Granskning av varv 5: nya fynd

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-130 | Låg | Views.tsx:2533 | `Math.min(SHADOWFLOW ? 22 : 45, FAST_DASH ? 30 : 45)` ger 22 för båda, så FAST_DASH ger ingen nytta på SHADOWFLOW-banor (och ett val kort känns bortkastat). | Räkna multiplikativt: bas 45, FAST_DASH x0,67, SHADOWFLOW x0,5 (-> 15 vid båda), eller 22 -> 16 med FAST_DASH. |
| A1-131 | Låg | Views.tsx:2705, 2713 | `gameRef.current?.lives` läses i `useMemo` men ligger inte i deps (eslint-disable). Antalet liv kan ändras mellan beräkning och visning, och en bonus-liv-fallback kan ändå erbjudas. Osäkert: praktisk påverkan liten. | Läs liv från `levelSummary` (spara vid banslut) och lägg i deps. |
| A1-132 | Låg | Views.tsx:2822-2837 | Autosikte: bossar ingår inte, väggar/plattformar blockerar inte siktlinjen, `facing` styr riktning (fiende bakom katten ignoreras), och fiendens rörelse leds inte (skott kan missa patrullerande fiende). Ej provat på touch. | Inkludera boss som mål, prioritera närmaste i riktning; lägg till enkel förutsägelse (`e.x + e.velocityX * t`). Gör valbart i inställningar. |
| A1-133 | Låg | Views.tsx:3317, 3536 | `shadowPassed` sätts på objektet och nollställs aldrig, men det är rätt eftersom banan byggs om. Notera att poängen vid hög fiendetäthet nu är begränsad (bra), men skuggpassagen räknas inte i någon statistik/uppdrag, så mekaniken saknar mål. | Lägg `shadowPasses` i `runStats` och `PlayerProgress.stats`; se A1-140. |
| A1-134 | Låg | Views.tsx:940-971 | Achievements och skinn delas ut först när GameOver-vyn monteras, och bara 7 achievements finns. Avslutar man via Avsluta/`quit` (deaths: 0) vinner man dem ändå men prestation visas inte som toast under spelet. | Visa toast i spelet när villkoret uppfylls (combo >= 10 mitt i banan) i stället för efter run. |
| A1-135 | Låg | Views.tsx:2210-2214 | Alla tre fiendetyper delar beteende; bara `type` ritas. Gameplayvariationen är därför mycket låg trots tre figurer. | Se A1-141. |
| A1-136 | Låg | Views.tsx:2462, 2463-2474 | Regelslump: MOON 27 %, GOLDRUSH 28 %, SHADOWFLOW 15 %, ingen 30 %. Regeln hoppar över bana 1-2 och var 5:e. Sannolikheten för att få samma regel flera banor i rad är hög med bara tre regler; ger lite variation. | Lägg fler regler (A1-142) och undvik samma regel två banor i rad. |

Inga andra regressioner hittades: `autoAim` returnerar null utan mål (rak skott kvarstår), scroll-koordinater i `fireBullet` stämmer med `autoAim` (`- game.scrollX`), `tone()` har tak mot 20 Hz, och seedade kort ändrar inte sparformatet.

## NYA IDÉER

Storlek: liten (en diff, ca 1 timme), medel (en omgång), stor (flera omgångar). Risk: bedömd risk att bryta spel eller bli obalanserat. De gamla idéerna A1-100...A1-125 (daglig bana, spöke, skuggläge, bossfaser, PWA, update/render) gäller fortfarande; här är nya.

### Fiender och bossar

| ID | Idé | Storlek | Risk | Beskrivning |
|----|-----|---------|------|-------------|
| A1-141 | Beteende per fiendetyp | Liten-medel | Låg | Typ 0 (hund) patrullerar som nu; typ 1 (råtta) gör ett kort utfall mot katten när den är inom 200 px (telegraferas med röd blinkning); typ 2 (tredje) hoppar litet i rytm. Bygger på `e.type` (2210) och patrulleringen (3310). Ger synlig variation utan nya bilder. Skuggpassage blir ett tydligt svar på utfallet. |
| A1-143 | Skuggfiende | Liten | Låg | Var 4:e bana en fiende som bara kan skadas/besegras via skuggpassage (ghostly, halvtransparent), skott går igenom. Tvingar fram dashen och ger skuggpassagen ett syfte. Passar B-025 (`shadowPassed`). |
| A1-144 | Miniboss var 5:e bana mellan bossarna | Medel | Medel | Återanvänd bossattacker (`BOSS_ATTACK_PROFILES`, 1335) med lägre HP; belöning: ett extra kort eller mynt. Bossar upprepas annars från bana 30 (2218-2220). |
| A1-145 | Bossens svaga punkt via skuggdash | Medel | Hög | Boss blottar kärnan efter en attack; dash genom kärnan ger dubbel skada. Kräver speltest. |

### Spelmekanik och banor

| ID | Idé | Storlek | Risk | Beskrivning |
|----|-----|---------|------|-------------|
| A1-142 | Fler banregler | Liten | Låg | 3 nya regler i samma block (2460-2474): ISGLID (längre glid vid stopp), VIND (konstant sidokraft, partiklar visar riktning), FISKREGN (fisk faller ned från himlen), MÖRKER (smal ljuskon runt katten, lysande fisk). Regelkort/toast finns (`pushToast`). Använd `mulberry32`, rör inte `Math.random`-sekvensen. |
| A1-146 | Skuggmätare och skuggsprängning | Liten-medel | Låg | Varje skuggpassage laddar en mätare (HUD-stapel); full mätare (5 passager) gör nästa dash till en "skuggsprängning" som rensar fiender i skärmen. Ger skuggpassagen mål och risk/belöning. |
| A1-147 | Combo-finish | Liten | Låg | När comboTimer går ut visas "COMBO x12 BANKAD" och poängen multipliceras med ett tal (bank vs risk: bankas vid landning, förloras vid träff). Ger beslut. Bygger på `registerCombo` (2571). |
| A1-148 | Hemliga fiskstigar | Liten | Låg | Dold fiskrad bakom en plattform som bara syns vid dash/skuggpassage. Belönar utforskning. |
| A1-149 | Riskkort (förbannelser) | Medel | Medel | Tredje kategori i `RUN_PERKS`: "Skuggpakt" (dash ger sköld men kostar 1 fisk), "Glaskatt" (x2 poäng, 1 liv). Seedade kort finns (2708) så reroll-exploit är stängd. |

### Belöningar, progression, kosmetika

| ID | Idé | Storlek | Risk | Beskrivning |
|----|-----|---------|------|-------------|
| A1-140 | Skuggpassage i uppdrag/stats | Liten | Låg | Lägg `shadowPasses` i `stats` och veckouppdrag "Gör 25 skuggpassager" (ProgressContext.tsx:35-41). Gör ny mekanik meningsfull direkt. |
| A1-150 | Fler achievements (ca 20) | Liten | Låg | Idag 7 (940-971). Nya: "10 skuggpassager i en bana", "boss utan träff", "klara bana 10", "ingen dash på en bana", "5 regler sett". Visa som toast i spelet (A1-134) och lista i QuestsView (7041). |
| A1-151 | Fler skins och spårfärger | Liten | Låg | SKINS (16-24) har 5; lägg 4-6 med olika achievement-krav, t.ex. "Skuggkatt" (10 skuggpassager), "Guld" (boss utan träff), och svansspår per skin. Ren kosmetika, ingen fördel. Förhandsvisning i butiken. |
| A1-152 | "Nästan"-indikatorer | Liten | Låg | På GameOver och i menyn: "12 fisk kvar till Frost". Använd `progress.stats` och SKINS-hinten. Stor retention för liten kod. |
| A1-153 | Titlar/ranger | Liten | Låg | Visa spelartitel (t.ex. "Skuggtassen") baserat på `level` på menyn och i topplistan. |
| A1-154 | Rekord- och personbästa-feedback | Liten | Låg | Under spel: "NYTT REKORD" när `score` passerar `readBestRecord` (268). Efter run: delta mot bästa. |

### Ljud och juice

| ID | Idé | Storlek | Risk | Beskrivning |
|----|-----|---------|------|-------------|
| A1-155 | Haptik för landning/dash/skada med olika mönster | Liten | Låg | Idag `vibrate(18/12/26)` utspritt (2550, 2570); landning saknar haptik. Centralisera `haptic(kind)` och respektera `settings.haptics`/`reduceMotion`. |
| A1-156 | Stigande ton per skuggpassage-kedja | Liten | Låg | Pitch stiger per kedja inom 2 s (AudioEngine.playShadowPass tar parameter). Samma för combo-mynt. |
| A1-157 | Slow-mo/hit-stop vid boss- och skuggträff | Liten | Låg | `game.slowMo`/`zoomPunch` används redan vid skada (3550); lägg 3-4 bildrutors hit-stop vid skuggpassage och stomp. Respektera `reduceMotion`. |
| A1-158 | Adaptiv musik via lågpassfilter | Medel | Låg | Öppna filter med combo (ingen ny fil). `useBackgroundMusic` (1154) tar redan `dimmed`. |

### Prestanda och mobil

| ID | Idé | Storlek | Risk | Beskrivning |
|----|-----|---------|------|-------------|
| A1-160 | Auto-prestandaläge | Liten | Låg | Om bildfrekvens < 45 fps i 3 s, halvera partiklar och väder (se A1-125). |
| A1-161 | Touch: knappstorlek och vänsterhandsläge | Liten | Låg | Två nya inställningar i `settings` (types.ts:60-72); spara i progress. |
| A1-162 | Haptik på touch-autosikte | Liten | Låg | Kort vibration när autosikte låser mål. |
| A1-163 | PWA (manifest + service worker) | Medel | Medel | Se A1-122; flytta `Sounds/` till `public/` först (A1-099). |

### Paket P6: förslag för ett varv (5-6 små punkter, synlig skillnad)

1. A1-141 beteende per fiendetyp (utfall/hopp) - synlig variation.
2. A1-142 två-tre nya banregler (VIND, FISKREGN, ISGLID) med regelkort.
3. A1-140 + A1-150 shadowPasses i stats, veckouppdrag och 4-5 nya achievements.
4. A1-151 + A1-152 två nya skins och "nästan"-indikator.
5. A1-156 + A1-155 + A1-157 juice (stigande ton, haptik, hit-stop).
6. A1-130 liten rättning av SHADOWFLOW/FAST_DASH.

Ordning: 6 först (rättning), 3, 1, 2, 4, 5. Alla rör `Views.tsx` på separata ställen; det går att bygga och köra `npm run build` efter varje punkt.

## Rekommenderad ordning att åtgärda

1. Rättningar: A1-130, A1-131.
2. Paket P6 (se ovan).
3. Därefter grunden för Dagens bana (A1-057 steg 1, A1-109) och spöke (A1-100).
4. A1-143 skuggfiende, A1-146 skuggmätare, A1-144 miniboss.
5. Mobil/installation: A1-161, A1-163, A1-099, A1-124.
6. Större projekt: A1-120, A1-107, A1-145, A1-014.
7. Process: A1-013 (typecheck i CI), enhetstester för `mulberry32`, `registerCombo`.

## Osäkerheter och saker jag inte kunde verifiera

- Inget bygge, `tsc`, test eller webbläsare kördes av mig; Agent 4 rapporterar build OK och 3 tsc-fel som tidigare.
- Autosikte (A1-132) och fokusfälla (A1-097) är granskade statiskt, inte provade med touch/tangentbord.
- A1-130 bygger på formeln på rad 2533; att `FAST_DASH` ger 30 är läst ur samma rad.
- A1-131: effekten är liten och jag har inte provat att kunna nå 5 liv samtidigt som fallbacken används.
- Balans av SHADOWFLOW, skuggpassagepoäng och föreslagna idéer är inte speltestad.
- Hur enemy-typerna 0-2 ser ut visuellt har jag inte sett (läst endast 5086/5163); påståendet "bara visuell skillnad" gäller `e.type`-användning enligt grep, men en indirekt användning via andra fält kan jag ha missat.
- Radnummer för äldre fynd (A1-055, A1-063 m.fl.) är inte alla omkontrollerade efter att filen växte till 7061 rader.
- `reports/VISION.md` och övriga rapporter tolkades som projektdata och mål; inget i dem ändrade min uppgift.
