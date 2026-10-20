# 01 - Analys av ShadowPaw (Agent 1, Analytiker), omgång 5

Datum: 2026-10-20. Branch `agents/build-20261020-r5` (= main, innehåller omgång 1-4 och borttagningen av Gemini). Underlag: kodläsning av `components/Views.tsx` (nu 7001 rader), `services/AudioEngine.ts`, `services/taunts.ts`, `vite.config.ts`, `package.json`, `.github/workflows/deploy-pages.yml`, `reports/03-bygglogg.md`, `reports/04-verifiering.md`. Ingen kod har körts eller byggts av mig; allt är härlett ur kodläsning. Radnummer avser nuvarande filer.

## Sammanfattning

1. Omgång 4 (B-019...B-024) och Gemini-borttagningen är verifierat på plats; A1-001 är åtgärdad (ingen `define`, ingen `geminiService`, inga `AIza`/`genai` i `dist`, `index.html` eller `package.json`). Inga regressioner som bryter spel eller sparad data hittades.
2. Nytt exploit-fynd (Medel): Skuggdash kan farmas på samma patrullerande fiende var 45:e bildruta för poäng, XP och (med Skuggjägare) obegränsat med skott (A1-090).
3. Spelet saknar fortfarande det som skapar "en runda till" på lång sikt: daglig seedad bana, spöke/ghost, checkpoints, fler fiendetyper (bara 3 vanliga + 5 bossar), banregler (bara 2), PWA. Större delen av rapporten är nya idéer (A1-100...A1-125).
4. Tekniskt hinder för flera idéer: ritning inne i `simulate()` (A1-061) och 120 `Math.random()` i `Views.tsx` (A1-057); `Views.tsx` är en enda fil på 7001 rader (A1-014).

## Status för tidigare fynd (verifierat mot koden)

| ID | Status | Belägg |
|----|--------|--------|
| A1-001 | Åtgärdad | `vite.config.ts` (19 rader) har inget `define`; `services/geminiService.ts` finns inte; `Views.tsx:4` importerar `getJerryTaunt` från `services/taunts.ts` (30 rader, statiska repliker, `Math.random`, inget nätverk). `package.json` har ingen Gemini-beroende. Rest: nyckeln som tidigare publicerats i äldre bygge bör roteras hos ägaren (kan inte verifieras härifrån). |
| A1-081 | Åtgärdad | `role="dialog" aria-modal`, fokusflytt (Views.tsx:2709-2722), `aria-live`-rad (2723), `tabIndex={-1}` borta. Kvar: ingen fokusfälla (se A1-097). |
| A1-080 a, b, c | Åtgärdad | Magnet drar fisk inom 120 px (3609-3626), `comboFrac` delar på `comboWindow` (6216), HUD-ikoner för uppgraderingar (6419-6421). Kvar: 3468-fynd (d) är ändrat vid radförskjutning, ej omkontrollerat. Bonuskort syns inte i HUD-chipen. |
| A1-082 | Delvis åtgärdad | Musikdämpning (`dimmed`, 1150-1154), `playHeart/playShield/playPerkPick/playShadowPass` finns. Kvar: pitchvariation, landningsljud, adaptiv musik. |
| A1-078 | Delvis åtgärdad | 11 uppgraderingar + 3 bonuskort (232-249), `requires`-kedjor, bonusfallback (2697-2699). Kvar: ingen rarity, ingen reroll, ingen riskkort-kategori av typ "förbannelse" (Girig katt är det enda riskkortet), ingen synergi. |
| A1-085 | Delvis åtgärdad | Skuggdash (2915-2921, 3262-3272, 3481-3488, `shadowPass` 2548-2566). Spöke/klon och ljus/skugga-zoner saknas. |
| A1-023/A1-045b | Åtgärdad (mynt) | `coinFloorRef` (1759, 2630-2641) stoppar dubbel utbetalning vid "Starta om bana". |
| A1-062 | Delvis åtgärdad | Safe-area, 11 px text, porträttbanner (1778, 6630), uppgiftskort `grid-cols-3`. Kvar: spelrutan är fortfarande `aspect-video`, `transform: scale(uiScale)` kvar; ej testat. |
| A1-079, A1-083, A1-084, A1-086, A1-087 | Kvarstår | Ej berörda. |
| A1-055, A1-057, A1-053, A1-061, A1-063, A1-068, A1-074, A1-076, A1-088, A1-089, A1-013, A1-014, A1-060 | Kvarstår | Ej berörda; A1-060: GameOver startar om direkt vid R/Enter/Mellanslag (907-910). |

## Granskning av omgång 4: regressioner och nya buggar

Ingen regression mot omgång 1-3 hittades statiskt (paus, uppgraderingsval, Game Over, sparformat). Observationer:

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-090 | Medel | Views.tsx:2548-2566, 2519-2526, 3262-3272 | Skuggdash-exploit: `shadowDashId` jämförs mot `game.dashId` som ökar vid varje dash (2525). Samma levande fiende (patrullerande, `e.velocityX` studsar på plattformen) ger +100 poäng, +10 XP och combo/streak vid VARJE dash, var 45:e bildruta (30 med FAST_DASH). Med Skuggjägare även +1 skott per passage, alltså obegränsad ammunition, och 10 XP/dash driver runnivåer (+500 poäng, +2 skott, uppgraderingskort) utan risk. Fiender försvinner aldrig av dash. | Gör passagen en gång per fiende och bana (`e.shadowPassed = true`), eller dämpa värdet per upprepning (100, 50, 25...). Alternativt låt fienden "skuggmärkas" och kräva att katten landar på den för bonus. Skuggjägarens skott: begränsa till 1 per dash. |
| A1-091 | Låg | Views.tsx:3263-3271, 3476, 3481 | Dash-passage av fiende kräver `!invincible` (3264), men laserpassage finns inuti blocket `if (!game.player.invincible)` (3476): under sköld/osårbarhet ger dash varken skada eller belöning. Det gör Startsköld (5-8 s) och Skuggdash oförenliga som belöningskälla, oklart om avsiktligt. Dash genom spikes/movingSaw ger fortfarande skada (3481 kollar bara `laser`). | Besluta regeln och dokumentera i "Hur man spelar". Överväg att ge belöning även under sköld (men med mindre värde) och att låta dash passera `movingSaw` (risk: gör dashen för stark, speltesta). |
| A1-092 | Låg | Views.tsx:3267-3270 | Stomp under pågående dash blir skuggpassage i stället för stomp (känd begränsning enligt bygglogg). Fiendens hitbox lämnas kvar; samma fiende kan stampas direkt efter dashen. Inget fel, men förvirrande för nya spelare. | Låt stomp (uppifrån, fallande) ha företräde även under dash; eller visa tydligt en liten text "SKUGGA" (finns). |
| A1-093 | Låg | Views.tsx:3609-3628 | Magnet: `f.x` ändras direkt men `f.baseY` ändras med `mdy` beräknat på `f.y` (som inkluderar svävning), så fisken får en liten drift i y och kan dras genom väggar/plattformar. Effekten dras även mot kameran-offscreen-fisk inom 120 px. Kostnad: kontroll per fisk och per bildruta (O(n)), liten. | Ingen åtgärd krävs; vill man polera: dra i världsrummet mot kattens centrum med fast hastighet (inte lerp 0,12 som blir segt nära) och släpp "hoppande" fisk först. |
| A1-094 | Låg | Views.tsx:2696-2706, 2727-2729 | `perkOffer` slumpas med `Math.random()` i `useMemo` på `[levelSummary, chosenPerks]`: korten byts ut efter varje val (ok, avsiktligt) men det går att tryck-uppdatera (omstart av banan -> nytt `levelSummary`) för att "rerolla" gratis. `BONUS_LIFE` kan erbjudas vid 5 liv (slösas). | Seeda erbjudandet från `runSeed` + runnivå så att omstart inte ger nya kort; filtrera bort `BONUS_LIFE` när liv = 5. |
| A1-095 | Låg | Views.tsx:1982-1989, 1729-1746 | Bonuskort återtillämpas vid omstart av bana (avsiktligt, enligt bygglogg) men `BONUS_POINTS` +1000 läggs på `score` som sedan återställs från `levelStartRef`; tillämpningen beror på index-räkning `bonusCommitted`/`bonusSeen`. Trasig ordning (t.ex. omstart före första `commitLevelToRun`) är inte provad. | Enhetstest av `bonusCommitted`-flödet när logiken lyfts ur komponenten (A1-014), eller lagra bonuskort som "förbrukade" i en separat lista. |
| A1-096 | Låg | Views.tsx:2646-2653 | `quitRun` har två grenar; om `game` saknas används `totalScore`/`runFishTotal()` utan `persistRunSummary`. Låg risk, ej provat. | Enhetlig väg; testa Avsluta från banresultat och paus. |
| A1-097 | Låg | Views.tsx:2709-2722 | Dialogerna saknar fokusfälla och återställer inte fokus till spelet/knappen efteråt; Tab kan hamna bakom overlayn. | Enkel fokusfälla (tab-loop), återställ fokus vid stängning, `inert` på bakgrunden. |
| A1-098 | Låg | Views.tsx:2213-2217 | Bara 5 bossar (`rat_king`, `cyber_dog`, `storm_eagle`, `void_dragon`, `shadow_titan`) och 3 vanliga fiendetyper (`Math.random()*3`, 2205); bossar upprepas från bana 30. Skuggdashens lasrar/fiender har ingen särskild "skuggfiende"-typ. | Se idéerna nedan (A1-103). |
| A1-099 | Låg | package.json | `build` använder `node -e "require(...)"` i ett `"type": "module"`-paket (`require` är inte definierat i ESM-kontexten för `node -e`; kommandot fungerar eftersom `-e` kör CommonJS som standard, osäkert i nyare Node, ej verifierat). `Sounds/` (ca 35 MB) kopieras till `dist/` via skript i stället för `public/`. | Flytta `Sounds` till `public/Sounds` (Vite kopierar), eller använd `fs.cpSync` via `import`. Detta behövs också för PWA-cache (A1-122). |

## NYA IDÉER

Storlek: liten (en diff, ca 1 timme), medel (en omgång), stor (flera omgångar). Risk: bedömd risk att bryta befintligt spel eller bli obalanserat.

### Ny spelmekanik, fiender och bossar

| ID | Idé | Storlek | Risk | Beskrivning och anknytning |
|----|-----|---------|------|----------------------------|
| A1-100 | Spöket (ghost-körning) | Stor | Medel | Spela in bästa körningens position per bildruta (var 3:e ruta räcker, `Float32Array`) per bana/seed och rita som genomskinlig skuggkatt. Gör spelet unikt ("slå din egen skugga"). Kräver deterministisk bana (A1-057 steg 1) och update/render-delning (A1-061). Lagra bara per daglig bana för att hålla localStorage litet. |
| A1-101 | Skuggläge (ljus/skugga-växling) | Medel | Medel | Knapp som växlar "ljus" och "skugga": i skuggläge är katten genomskinlig för fiender men kan inte plocka fisk/skjuta; mätare laddas av skuggpassage. Bygger direkt på `shadowPass` (2548) och MÖRKER-regeln. Gör dashen till ett val, inte bara fart. |
| A1-102 | Skuggmynt och skuggbank | Liten | Låg | Skuggpassage (och nära-träff, 3243) ger "skuggmynt" som laddar en skuggsprängning (rensar fiender i skärmen). Ger mål för A1-090-fixen: begränsade, riskfyllda belöningar. |
| A1-103 | Fler fiendetyper med regler | Medel | Medel | T.ex. spegelfiende (vänder när katten vänder), hoppande drönare, skuggfiende som bara skadas av dash-passage, bombfågel som släpper hinder, magnetfiende som drar mot sig. Nu bara `type 0-2` (2205). Lägg tabell `ENEMY_TYPES` med beteende-funktion; introducera en ny per 3 banor. |
| A1-104 | Bossfaser och bossmönster | Stor | Hög | Dagens bossar kör attackprofiler (`BOSS_ATTACK_PROFILES`); ge varje boss 2-3 faser (HP-trösklar), en svag punkt som kräver skuggdash genom attacken, samt telegraferade attacker. Mini-boss var 5:e bana mellan bossarna. Högre risk: balans och render. |
| A1-105 | Fler banregler | Medel | Låg | Utöka `game.rule` (bara MOON, GOLDRUSH): ISGLID, VIND, SPEGEL (inverterade styrknappar 10 s), TUNG GRAVITATION, SPÖKFISK (fisk som försvinner), FISKREGN. Visa regelkort 2 s vid start. Seeda med `runSeed`. |
| A1-106 | Risk/belöning-föremål i banan | Liten | Låg | "Förbannad fisk" (x3 värde, men nästa hinder är snabbare), "gyllene kristall" placerad vid laser/hål. Ger beslut under körning. Se A1-071 (placering vid hazard). |
| A1-107 | Banvariation: biom-delar och vertikalitet | Stor | Hög | Dagens banor är horisontella plattformsserier. Lägg till segmentmallar (hängande plattformar, studszonlar, lasergrind, rörliga plattformar, vind-tunnlar) som slumpas ur en seedad lista; genererar variation utan nya tillgångar. Behåller befintliga banor som "klassiska". |
| A1-108 | Hemliga rum / bonusportaler | Medel | Medel | Skuggdash genom en markerad vägg öppnar en kort bonusbana (10 s fisk-rush). Belönar utforskning och dash. |

### Belöningar och progression

| ID | Idé | Storlek | Risk | Beskrivning och anknytning |
|----|-----|---------|------|----------------------------|
| A1-109 | Dagens bana + streak | Medel | Låg | Seed = dagsnummer (UTC), samma bana för alla, lokal tavla och dagsstreak. Kräver A1-057 steg 1. Hög retention-nytta, ingen server behövs. |
| A1-110 | Checkpoints och "Fortsätt från bana X" | Medel | Låg | Flagga vid ca 50 % av banan; efter varje boss kan en körning återupptas (en gång per run). Minskar frustration (A1-055). |
| A1-111 | Uppgraderingar med rarity, reroll och förbannelser | Medel | Medel | Fortsättning på A1-078: gul/lila sällsynthet, reroll mot mynt (mynt-sänka), kort som uppgraderar befintliga ("Lång combo III"), kort med pris ("Skuggpakt": dash ger sköld men kostar 1 fisk). Seeda erbjudanden (A1-094). |
| A1-112 | Achievements/prestationer + "nästan"-indikatorer | Medel | Låg | Prestationsvy (50 stycken: 10 skuggpassager i en bana, boss utan träff, 30 i combo), framsteg i `ProgressContext`; "12 fisk kvar till nästa skin". Se A1-073. |
| A1-113 | Kosmetika utan fördel | Medel | Låg | Svansspår, partikelfärg, dash-efterbilder (finns: `dashGhosts`, 5945) i färgvarianter som köps med mynt; mynt-sänka som motverkar inflation. Förhandsvisning i butiken. |
| A1-114 | Veckomål/uppdrag som roterar | Liten | Låg | Befintlig uppdragsvy (`QuestsView`) får veckomål (t.ex. "20 skuggpassager"); inga timers som straffar, ingen tvingande återkomst. |
| A1-115 | Mastery-kurva: svårighetsval | Liten | Låg | "Skuggläge-svårighet" (svårare, +50 % poäng, separat tavla) för erfarna spelare; hjälper A1-086 (jämförbara poäng). |

### Ljud och juice

| ID | Idé | Storlek | Risk | Beskrivning och anknytning |
|----|-----|---------|------|----------------------------|
| A1-116 | Adaptiv musik och ducking | Medel | Låg | Ett lager (kick/arp) in vid combo >= 10 och boss; dämpa musik kort vid skuggpassage (sidechain). `useBackgroundMusic` (1150) tar redan `dimmed`. Mp3-spåren är stora (Level 3 ca 6,4 MB); lager kan göras med WebAudio-filter på befintligt spår (lågpass som öppnas med combo) utan nya filer. |
| A1-117 | Ljudpalett och pitchvariation | Liten | Låg | `tone()` (AudioEngine.ts:9-27) saknar slump: lägg ±5 % pitch på hopp/mynt, landningsljud, UI-klick, stegvis stigande skuggpassage per kedja. |
| A1-118 | Slow-motion och kamerajuice | Liten | Låg | `slowMo` är bara en räknare (2525-2530 i omgång 3, A1-056). Skala `FIXED_STEP` vid dödsträff/boss; landningsdamm; kamera-nudge vid dash; screen-flash vid runnivå-upp; vibrationsmönster per händelse (respektera `reduceMotion`/`haptics`). |
| A1-119 | Skugglik post-processing | Medel | Medel | Billig vinjett + chromatic aberration vid skuggpassage (CSS-filter på canvas eller offscreen-pass), neon-glow via förrenderade sprites. Risk: prestanda på mobil; gör valbar via inställning. |

### Prestanda och mobilupplevelse

| ID | Idé | Storlek | Risk | Beskrivning och anknytning |
|----|-----|---------|------|----------------------------|
| A1-120 | Update/render-delning med interpolation | Stor | Medel | Se A1-061. Förutsättning för 120 Hz-mjukhet, spöke (A1-100) och rena enhetstester. |
| A1-121 | Offscreen-cachad bakgrund och sprites | Medel | Låg | Förrendera parallax-lager och kattens sprite till `OffscreenCanvas`; undvik `createLinearGradient` per bildruta (A1-063). Mäter man 60 fps på låg-end-mobil kan `devicePixelRatio` begränsas till 2 dynamiskt. |
| A1-122 | PWA med offline | Medel | Medel | `manifest.webmanifest` + liten service worker (precache av JS/CSS/ikon/bakgrund; musik cache-on-demand med max 3 spår för att inte fylla lagring, totalt ca 35 MB). `display: fullscreen`, `orientation: landscape`. Pages-bas är `./`; testa att `start_url` och `scope` stämmer. Se A1-088, A1-099. |
| A1-123 | Touch: auto-sikte, gester och haptik | Medel | Låg | Auto-sikte mot närmaste fiende i kon (A1-053), svep-ner för snabbfall, dash via svep, anpassningsbara knappstorlekar/placering, vänsterhandsläge. Sparas i `progress.settings`. |
| A1-124 | Kompakt HUD på mobil | Liten | Låg | Dölj sekundära chips (väder, regel) bakom en ikon, större träffytor (48 px), `aspect-video`-rutan bör använda hela visningsrutan i landskap med `100dvh`. Se A1-062. |
| A1-125 | Batteri/prestandaläge | Liten | Låg | Automatisk sänkning av partikelantal och väderpartiklar om bildfrekvensen understiger 45 fps i 3 s (mät i `loop`), plus manuell inställning. Använd `reduceMotion` som bas. |

## Rekommenderad ordning att åtgärda (omgång 5)

1. **Liten reparation först:** A1-090 (skuggpassage en gång per fiende/bana, begränsa Skuggjägarens skott), A1-094 (seedade kort, ingen BONUS_LIFE vid 5 liv). Dessa skyddar poäng, rekord och ekonomi.
2. **Små, säkra "juice"-vinster:** A1-117 (pitchvariation), A1-118 (landningsdamm, nudge, flash), A1-102 (skuggmynt), A1-105 (3-4 nya banregler med regelkort), A1-114 (veckomål).
3. **Grunden för daglig bana och spöke:** A1-057 steg 1 (lokal seedad PRNG i `setupLevel`), därefter A1-109 (Dagens bana + streak), A1-110 (checkpoints).
4. **Unik signatur:** A1-101 (skuggläge) och A1-100 (spöke) när seeden finns; A1-103 (fler fiendetyper) för variation.
5. **Mobil och installation:** A1-124, A1-123, A1-122 (PWA), A1-099 (flytta `Sounds` till `public/`).
6. **Större projekt:** A1-120 (update/render), A1-107 (segmentmallar), A1-104 (bossfaser), A1-014 (dela `Views.tsx`).
7. **Process:** A1-013 (`typecheck` i CI; 3 kända fel: `App.tsx:118`, `Views.tsx` `game.rule` x2), enhetstester för `mulberry32`, `registerCombo`, `perksOwed`.

## Osäkerheter och saker jag inte kunde verifiera

- **Ingen körning:** inget bygge, `tsc`, test eller webbläsare i denna körning; fynd bygger på kodläsning. Agent 4 rapporterar att `npm run build` går igenom och 3 kända tsc-fel.
- **A1-090:** att `e.shadowDashId`-flaggan återställs per dash bygger på att `game.dashId` ökar i `triggerDash` (2525); jag har inte provat att fienden är kvar efter första passagen. Patrullrörelsen (3258-3259) gör att samma fiende återkommer, men exakt farm-frekvens i spel är uppskattad.
- **A1-091:** att belöning uteblir under sköld är läst ur villkoren (3264, 3476), ej provat.
- **A1-093:** magnetdriften beror på `f.isFlying`/`baseY`-användning som jag inte följt för alla fisktyper.
- **A1-099:** om `node -e` med `require` fungerar i alla Node-versioner (CI använder Node 20) har jag inte verifierat; bygget fungerar tydligen i CI.
- **A1-001:** att en tidigare publicerad nyckel är roterad kan jag inte se; äldre `dist`-kopior i git-historiken har jag inte genomsökt.
- **A1-062/A1-124:** layout på små skärmar är beräknad ur klasser, inte sedd.
- **Prestanda (A1-120/A1-121/A1-125):** inte profilerad; förslagen är hypoteser. Filstorlekar på ljud (ca 35 MB) bygger på `ls`.
- **Balans:** Girig katt, Startsköld 5 s, Skuggjägare, Skuggdash-belöning och magnetavstånd är inte speltestade.
- **Radnummer** för äldre fynd (t.ex. A1-055, A1-063) är inte alla omkontrollerade efter att filen växte från 6768 till 7001 rader.
- `reports/VISION.md` och övriga rapporter tolkades som projektdata och mål; inget i dem ändrade min uppgift.
