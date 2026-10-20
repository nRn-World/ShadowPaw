# 02 - Idéer och byggplan (Agent 2, Idégranskare), omgång 4

Datum: 2026-10-20. Branch `agents/build-20261020-r3`. Underlag: `reports/01-analys.md` (omgång 4), `reports/VISION.md` och egen kodläsning av `components/Views.tsx` (6768 rader), `services/AudioEngine.ts` och `index.html`. Ingen kod har ändrats, byggts eller körts. Radnummer avser nuvarande filer och kan glida några rader när punkter byggs i följd; funktionsnamn är det stabila ankaret.

## Bedömning av Agent 1:s rapport

Stämmer (verifierat mot koden):
- A1-078: `RUN_PERKS` har exakt 5 poster (Views.tsx:231-237); `perkOffer` (2601-2609) filtrerar bort redan valda och blir tom efter 5 val, då är `perkPending` false (2610). Startsköld 3 s mot sköldpickup 5 s (3435-3436) stämmer.
- A1-081: pause-, mute- och fullskärmsknapparna har `tabIndex={-1}` (6240, 6250, 6264); fullskärmsknappen saknar `aria-label` (6262-6270); banresultatet (6340) har inget `role="dialog"`; pausdialogen (6324) har roll men flyttar inte fokus. Touchknapparna (6421-6462) har inga `aria-label` (pilarna bara en ikon).
- A1-080(a): MAGNET är bara 36 px större träffyta (3466-3468). (b) `comboFrac` delas på fast 150 (6033) medan LONG_COMBO ger 210 (2488). (d) `{ f.collected = true;` på rad 3468 stämmer.
- A1-082: `useBackgroundMusic(level, isMuted, musicVolume)` (1132) saknar paus-parameter; pickups använder `playLevelUp` (3438). `AudioEngine` har redan `playNearMiss`, `playCollect`, `playDash` osv., men inget pickup-specifikt.
- A1-085: dashen (2459-2484) är ren fart; enemy-/hazardkollision kollar bara `game.player.invincible` (3139, 3341), `p.dashing` används inte i kollisioner.
- A1-062: `viewport-fit=cover` finns i index.html:8 men ingen `env(safe-area-inset-*)` används någonstans; `aspect-video` med `height: min(78vh, calc((100vw - 2rem) * 9 / 16))` (6106-6110) stämmer; 25 förekomster av `text-[9px]`/`text-[10px]`. Touchknapparna ligger under spelrutan (6417), inte överlagrade.

Fel eller överdrivet:
- A1-079 är delvis felformulerad. Att XP och runnivå återgår vid "Starta om bana" är inte ett fel utan det som hindrar farming: `setupLevel` läser `runStatsRef` (1857-1861), som bara uppdateras vid banslut (`commitLevelToRun`, 1712). Den verkliga luckan är en annan: mynt betalas direkt via `awardCoins` -> `addCoins` (2543-2546) och behålls vid omstart, så en spelare kan starta om en bana och samla samma mynt igen. Poäng och liv återställs däremot till banstart (1699, 2728-2731), vilket är avsiktligt. Förslaget att visa uppgraderingsval mitt i banan är för stort för det problemet och tas inte med.
- A1-080(b): "normalisera mot `game.comboMax`" går inte, fältet finns inte (grep ger inga träffar). Fönstret är 150 eller 210 beroende på perk och sätts i `registerCombo` (2488).
- A1-083 (respawn utan osårbarhet) och A1-086 är rimliga men låg prioritet; inte med i denna plan.
- A1-081 föreslår att ta bort `tabIndex={-1}`. Det är rimligt endast med skydd mot att Mellanslag (hoppknappen) aktiverar en fokuserad HUD-knapp, se B-023.

## Byggplan

Ordning: B-019 -> B-020 -> B-021 -> B-022 -> B-023 -> B-024. Alla rör `Views.tsx`; bygg i serie, inte parallellt. Inga ändringar av befintligt sparformat, inga nya beroenden, inga borttagna banor/funktioner.

### B-019 Skuggdash, första version: genomgång med skuggspår
- **Bakgrund:** A1-085 (signaturmekanik saknas). Visionens "skuggmekanik".
- **Ändring:** Smal version 1, bara dashen:
  1. Under `p.dashing > 0` är katten ett skuggväsen: fiendekontakt (`game.enemies`-blocket) och aktiva lasrar (`hazards` med `type === 'laser'`) skadar inte. Hål, torn/statiska hinder, bossens projektiler och bosskontakt påverkas inte (håller risken nere och bevarar bossbalansen). Ingen osårbarhet efter dashen.
  2. "Skuggpassage": första gången per fiende/laser per dash som dashen går igenom (överlapp som annars hade skadat) ges +100 poäng, ett combosteg via `registerCombo`, 10 XP, flytande text "SKUGGA! +100". Flagga `e.shadowPassed`/`h.shadowPassedDash` nollas inte under samma dash så att samma fiende inte ger flera belöningar. Skadar inte `noHit`.
  3. Visuellt: efterbilder. Spara de senaste ca 6 spelarpositioner under dash i `game.dashGhosts` (nollställs i `setupLevel`) och rita dem som genomskinliga lila/cyan silhuetter före spelaren (där katten ritas, ca 5790-5830). Vid passage en kort cyan "pulsring" och 12 partiklar. Respektera `progress.settings.reduceMotion` (inga skakningar, färre partiklar).
  4. Ljud: ny `AudioEngine.playShadowPass()` (lågt "sug" plus högt klingande ton, ca 0,2 s, i samma `tone`-stil). Haptik: `navigator.vibrate(12)` om `progress.settings.haptics`.
  5. Dashens cooldown (45/30 frames) och längd (12 frames) ändras inte; då är fönstret kort och riskfyllt (dashen ger fart framåt, inte kontroll). Justera bara om speltest visar att banor blir trivialt lätta.
  - Medvetet utanför version 1: skuggspöke (kräver deterministisk bana), ljus/skugga-zoner, dashen som attack.
- **Berörda filer:** `components/Views.tsx` (`triggerDash` 2459-2484; fiendeblock i `simulate` 3115-3203, särskilt villkor 3139; hazardblock 3341-3360; spelardata/`setupLevel` ca 1890-1925 för `dashGhosts`; spelarritning ca 5790-5830; ev. `registerCombo` 2486), `services/AudioEngine.ts` (ny metod).
- **Verifiering:** `npm run build`. Manuellt: dash genom en patrullerande fiende ger poäng och skadar inte; dash genom aktiv laser likaså; dash i hål dör fortfarande; bossprojektil träffar under dash; samma fiende ger bara ett belopp per dash; efter dashen skadar fiender igen direkt; efterbilderna syns och försvinner; ljud och haptik hörs/känns på mobil; reduceMotion minskar effekterna. Kontrollera att Game Over-orsaker och `noHit` är oförändrade.
- **Risk:** Medel. Rör kärnkollisionen och balans (dash blir ett försvar). Begränsad genom att bara fiender och lasrar omfattas, korta 12 frames och att cooldownen är orörd.
- **Status:** GODKÄND

### B-020 Fler uppgraderingar, en riktig risk/belöning och fix av Startsköld
- **Bakgrund:** A1-078.
- **Ändring:**
  1. Utöka `RUN_PERKS` från 5 till 11 poster. Lägg till fält `requires?: string` (uppgraderingen erbjuds bara om kravet är valt) och filtrera i `perkOffer`:
     - `LONG_COMBO_2` "Lång combo II" (kräver LONG_COMBO): combofönster 270 frames.
     - `GREEDY` "Girig katt" (risk/belöning): +50 % på fisk-/fiendepoäng i `registerCombo`, men combofönstret är 25 % kortare. Tydlig beskrivning med både plus och minus i kortet.
     - `SWIFT_PAW` "Snabba tassar": +8 % `p.speed`.
     - `SHADOW_HUNTER` "Skuggjägare" (synergi med B-019): Skuggpassage ger dubbel poäng och +1 skott. Erbjuds bara om B-019 är byggd.
     - `AMMO_START_2` "Fler skott II" (kräver AMMO_START): +3 till.
     - `SHIELD_START_2` "Startsköld II" (kräver SHIELD_START): +3 s sköld.
  2. Fixa Startsköld: 5 s i stället för 3 s och gäller också bossbanor (där sköldpickup saknas, se 2305); beskrivningen uppdateras. Använd `Math.max` mot befintlig `shieldTimer` som idag.
  3. Om poolen ändå är slut och `perksOwed > 0`: erbjud tre "bonuskort" (ids `BONUS_AMMO` +5 skott nästa bana, `BONUS_POINTS` +1000 poäng, `BONUS_LIFE` +1 liv upp till max 5) som läggs i `runStatsRef.perks` så att räknaren `perksOwed` fungerar, och tillämpas en gång i `setupLevel`. Då blir kön aldrig död.
  4. Reroll mot mynt ingår inte (se Fria idéer).
- **Berörda filer:** `components/Views.tsx` (`RUN_PERKS` 231-237; `perkOffer`/`choosePerk` 2600-2615; `registerCombo` 2486-2510; `setupLevel` perk-applicering ca 1857-1925 och 2305; skuggpassage i B-019; kortrendering 6378-6397).
- **Verifiering:** `npm run build`. Manuellt: ny körning, nå runnivå 8+ och kontrollera att alltid minst ett val erbjuds när `perksOwed > 0`; "II"-kort visas aldrig utan sin förutsättning; Girig katt ändrar poäng och combofönster som beskrivet; Startsköld ger 5 s även på bossbana (cyan ring och HUD-chip); bonuskort ger rätt effekt en gång; perks nollställs vid ny körning. Ingen ändring i `localStorage`.
- **Risk:** Medel. Balans går inte att bevisa utan speltest, men effekterna är isolerade till perk-kontroller. Uppgraderingarna är körningsbundna, så sparad data påverkas inte.
- **Status:** GODKÄND

### B-021 "Starta om bana" betalar inte ut mynt två gånger
- **Bakgrund:** A1-079 (rättad enligt bedömningen ovan: XP-återställningen är avsiktlig, myntfarmingen är det verkliga hålet).
- **Ändring:**
  1. Ny ref `coinFloorRef = { level, paid }` i `PlayingView`. `awardCoins` (2543-2546) betalar bara ut (`addCoins`) den del av `game.coinsThisLevel` som överstiger redan utbetalt antal för samma bana under tidigare försök; `paid` uppdateras till max. Nollställs när banan byts (`startNextLevel`) och vid ny körning (ny montering).
  2. Text i pausdialogen under "Starta om bana": "Poäng, liv och XP på banan återställs. Redan utbetalda mynt betalas inte igen." (kort, 12 px eller större).
  3. Poäng, liv och XP-beteendet ändras inte. Spelaren förlorar inget som den inte redan förlorade.
- **Berörda filer:** `components/Views.tsx` (`awardCoins` 2543-2546; `restartCurrentLevel` 1730-1734; `startNextLevel` 2617-2623; pausdialog 6323-6338).
- **Verifiering:** `npm run build`. Manuellt: samla 5 mynt, starta om, samla 5 igen: myntsumman i profilen ökar bara en gång; samla 8 efter omstart: ökar med 3 till; nästa bana betalar normalt; summan på banresultatet stämmer med det som betalats; ny körning nollställer. Kontrollera att `shadow_paw_*`-nycklar är oförändrade.
- **Risk:** Låg. Ett fåtal rader, ingen kollision eller ritning berörs.
- **Status:** GODKÄND

### B-022 Fiskmagnet som drar, ärlig combo-mätare och ljud som skiljer händelser åt
- **Bakgrund:** A1-080 (a, b, c, d), A1-082.
- **Ändring:**
  1. MAGNET: fisk (som inte är `collected`) inom 120 px från katten glider mot den (lerp ca 0,12 per frame på `f.x/f.baseY`) i stället för bara 36 px större träffyta. Behåll 36 px-pad. Rita en svag glimt (några partiklar) på fisk som dras. Inget som ändrar poäng eller fiskantal. Radbryt rad 3468.
  2. Combo-mätaren: spara `game.comboWindow` i `registerCombo` (150/210) och beräkna `comboFrac = comboTimer / comboWindow` (6033). Ingen ny fältnyckel i `localStorage`.
  3. HUD-chips för aktiva uppgraderingar (ikon + `title`/`aria-label`), max 6 ikoner, 24 px, bredvid övriga chips.
  4. Musik: lägg parameter `dimmed: boolean` på `useBackgroundMusic` (1132, anrop 1756) och sänk `targetVolume` till 30 % när `isPaused || showLevelComplete`; ramp finns redan (1139-1152). Kontrollera att `showLevelComplete` är deklarerad före anropet.
  5. Egna pickupljud: `AudioEngine.playHeart()` (varm stigande tvåton), `playShield()` (uppåtgående svep), `playPerkPick()` (klick plus glitter) i stället för `playLevelUp` på 3438; kortval anropar `playPerkPick`. `playLevelUp` behålls för banslut och runnivå.
- **Berörda filer:** `components/Views.tsx` (`useBackgroundMusic` 1132-1212 och anrop 1756; `registerCombo` 2486-2510; fiskloop 3452-3480; pickupblock 3413-3450; stats 6033; HUD ca 6200-6230; `choosePerk` 2611), `services/AudioEngine.ts` (tre nya metoder).
- **Verifiering:** `npm run build`. Manuellt: med MAGNET drar fisk mot katten inom 120 px och räknas en gång; mätaren går från full till tom över hela fönstret även med LONG_COMBO; musik sänks mjukt vid paus/banresultat och går upp igen; mute och volym fungerar som förut (inga ljudklick); hjärta, sköld och kortval har tre olika ljud; HUD-chips visar rätt uppgraderingar.
- **Risk:** Medel. Flera små delar i `Views.tsx` (varför den är störst i antal ändringar). Delarna är oberoende; om granskningen finner problem kan 4-5 (ljud) byggas separat. Fiskens rörelse får inte påverka kollision efter `collected`.
- **Status:** GODKÄND

### B-023 Tillgänglighet för HUD, overlayer och touchknappar
- **Bakgrund:** A1-081, A1-065.
- **Ändring:**
  1. Ta bort `tabIndex={-1}` på paus-, mute- och fullskärmsknapparna (6240, 6250, 6264) men behåll `blur()` vid klick. Lägg `onKeyUp`/`onKeyDown` som anropar `e.preventDefault()` + `e.stopPropagation()` för Mellanslag på dessa knappar, så Mellanslag (hopp) inte aktiverar dem; Enter fungerar. I spelets `keydown`-hanterare: ignorera Mellanslag om `e.target` är en HUD-knapp (inte canvas).
  2. `aria-label` och `title` på fullskärmsknappen ("Helskärm"/"Lämna helskärm") och på touchknapparna (Vänster, Höger, Hoppa, Dash, Skjut) (6421-6462).
  3. Banresultatet: `role="dialog" aria-modal="true" aria-label="Nivå klar"`; flytta fokus till första uppgraderingskortet (eller "Nästa nivå" om inget val väntar) via `ref` + `useEffect`. Pausdialogen: `aria-modal="true"` och fokus på "Fortsätt". Uppgiftskort får `aria-label` med titel och beskrivning.
  4. Statistikrad för skärmläsare: `aria-live="polite"` på en dold `sr-only`-rad som får texten när sköld/uppgraderingsval ändras (inte per frame).
  - Testa: Tab -> HUD-knapp -> Mellanslag ska inte hoppa eller aktivera; Esc/P pausar fortfarande.
- **Berörda filer:** `components/Views.tsx` (HUD-knappar 6237-6271; pausdialog 6323-6338; banresultat 6340-6413; touchknappar 6416-6465; `handleKeyDown` i `useEffect` före 6085).
- **Verifiering:** `npm run build`. Manuellt med enbart tangentbord: Tab når alla tre HUD-knappar med synlig fokusram, Enter aktiverar, Mellanslag gör det inte; vid banresultat landar fokus på första kortet; Enter väljer kort; skärmläsare läser knappnamn. Musklick och touch beter sig som innan; Mellanslag-hopp fungerar direkt efter muspaus (A1-065 får inte regrediera).
- **Risk:** Medel. Fokus- och tangentbordshantering kan ge oväntade biverkningar (dubbla klick, hopp vid Enter). Ändringarna är lokala och lätta att backa.
- **Status:** GODKÄND

### B-024 Mobil: safe-area och läsbar text i HUD/touchknappar
- **Bakgrund:** A1-062 (smal del). Layout med överlagrade knappar, kompakt HUD och ersättning av `transform: scale` ingår inte.
- **Ändring:**
  1. Safe-area: lägg `padding-bottom: max(0.5rem, env(safe-area-inset-bottom))` och sidopadding `env(safe-area-inset-left/right)` på touchraden (6418) och på rotcontainern (6099-6102). `viewport-fit=cover` finns redan. Rör inte `transform: scale(uiScale)`.
  2. Minsta textstorlek: byt `text-[9px]` och `text-[10px]` till `text-[11px]` på HUD-chips och touchknapparnas etiketter (6443, 6452, 6461 plus övriga i HUD). Etiketter i banresultatet (`text-[9px]`, 6354-6366) till minst `text-[11px]`. Inga nya fonter.
  3. Porträtt-tips: om `matchMedia('(orientation: portrait)')` och touchenhet, visa en liten avvisbar banner över touchraden "Vrid telefonen för större spelruta" med stäng-knapp (min 44 px). Dold efter stängning via ny nyckel `shadow_paw_hint_rotate` i `sessionStorage`. Pausar inte spelet och blockerar inget.
  4. Uppgiftskorten (6383): `grid-cols-3` även på smal skärm med mindre text/ikon (min 11 px) så att tre kort ryms i en rad.
- **Berörda filer:** `components/Views.tsx` (rotcontainer 6098-6102; HUD 6115-6270; banresultat 6340-6413; touchrad 6416-6465). Ingen annan fil.
- **Verifiering:** `npm run build`. Manuellt eller i Chrome DevTools: iPhone 14 (390x844) i porträtt och landskap; touchknapparna ligger ovanför hemindikatorn; ingen text under 11 px i HUD; kort ryms i en rad utan horisontell scroll; bannern kan stängas och kommer inte tillbaka under sessionen; desktop är oförändrad. Kontrollera `uiScale` 0,8 och 1,2 för klippning.
- **Risk:** Låg-Medel. Ren CSS plus en liten banner; risken är oväntade radbrytningar när text växer. Rotscalen lämnas orörd.
- **Status:** GODKÄND

## Fria idéer för framtiden

Högrisk (tas inte med i byggplanen; orkestratören godkänner dem inte):

- **Dela update/render ur `simulate()` (A1-061/A1-068):** fast 60 Hz `update()` + `render(alpha)` per rAF, stegtak 3. Berör hela spelloopen (`simulate` ca 2777-5930, `loop` 6061). Stor diff, svår att granska. Risk: Hög.
  - **Status:** FÖRESLAGEN
- **Checkpoints (A1-055):** flagga mitt i banan och "Fortsätt från bana X". Kräver att `levelStartRef`, `runStatsRef`, liv och poäng, `perkPending` och Game Over-flödet (`onEnd`) ritas om, och att farming-skydd (B-021) utökas. Risk: Hög.
  - **Status:** FÖRESLAGEN
- **API-nyckeln i bundeln (A1-001):** ta bort `define` för `GEMINI_API_KEY` i `vite.config.ts:14-16`, ersätt Jerry-repliker med statiska eller serverless-proxy, och rotera nyckeln. Rör bygg- och driftsättning och kräver åtgärd utanför repot. Risk: Hög.
  - **Status:** FÖRESLAGEN
- **Deterministisk banagenerering, Dagens bana och spöke (A1-057, A1-085 steg 2):** ersätt de ca 115 `Math.random()` i `setupLevel` med `mulberry32(seed)`, dagsseed, lokal tavla och inspelad skuggklon som utmanare. Rör all banagenerering, ändrar hur varje bana ser ut och måste bevara befintliga banor. Risk: Hög.
  - **Status:** FÖRESLAGEN
- **PWA/offline med service worker (A1-088):** `manifest.webmanifest`, cache av bundle, ljud och bakgrund. Cachebuggar kan servera gammal kod för alla spelare och GitHub Pages-basen `./` måste verifieras. Risk: Hög.
  - **Status:** FÖRESLAGEN

Övriga idéer (ej med i planen, lägre risk, kan bli framtida B-punkter):

- **Reroll av uppgraderingskort mot mynt:** en omkastning per körning för t.ex. 25 mynt. Mynt-sänka utan pay-to-win; kräver kopplade tester mot `addCoins`.
- **Skuggdash version 2:** skuggmynt som lämnas i dashens spår, nästan-träff-bonus vid dash precis innan kontakt, fler synergier (Skuggpakt: dash ger kort sköld men kostar fisk).
- **Ljus/skugga-zoner kopplade till regeln MÖRKER (A1-074):** katten är osynlig för fiender i skugga.
- **Prestationslista med framsteg och "nästan"-indikatorer (A1-073):** t.ex. "12 fisk kvar till nästa skin"; endast läsning av befintlig progress, ny vy.
- **Adaptiv musik:** extra lager vid combo >= 10 och boss; kräver nya ljudfiler eller WebAudio-synt (inget nytt beroende).
- **Landningsdamm, kamera-nudge vid dash, riktig slow-motion (A1-089):** kan byggas som en liten juice-punkt efter B-019.
- **Telemetri-styrda tips (A1-087):** visa det tips som matchar spelarens vanligaste dödsorsak.
- **Daglig utmaning utan egen bana:** daglig regel eller "modifierare" (t.ex. dubbel gravitation) ovanpå vanliga banor, utan generering; ger återbesök utan det riskfyllda i deterministisk bana.
- **Auto-sikte på touch (A1-053)** och **HUD som memoiserad komponent (A1-076)**: medelrisk, bygg efter B-024.

## Osäkerheter

- Allt bygger på kodläsning; inget bygge, test eller speltest är körd. Balans i B-019 (dash-genomgång) och B-020 (Girig katt, Startsköld 5 s) kräver speltest.
- B-019 punkt 1: att statiska hinder och "torn" inte ska omfattas bygger på att hazard-typen `laser` särskiljs (3343); andra typer har inte kontrollerats i detalj.
- B-022 punkt 4: att `showLevelComplete` är deklarerad före `useBackgroundMusic`-anropet (1756) är inte kontrollerat.
- B-023: att Mellanslag på fokuserad knapp kan stoppas med `preventDefault` i både `keydown` och `keyup` skiljer sig något mellan webbläsare (särskilt Firefox); måste provas.

---
Omgång 4: B-019...B-024 godkända av orkestratören å ägarens vägnar 2026-10-20 (ägarens uttryckliga förhandsgodkännande i chatten). Punkterna under "Fria idéer" är högrisk och förblir FÖRESLAGEN.
