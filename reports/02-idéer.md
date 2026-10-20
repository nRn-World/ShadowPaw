# 02 - Idéer och byggplan (Agent 2, Idégranskare), varv 6

Datum: 2026-10-20. Underlag: `reports/01-analys.md` (varv 6, Paket P6), `reports/VISION.md`, kodläsning av `components/Views.tsx` (7061 rader), `context/ProgressContext.tsx`, `types.ts`, `services/AudioEngine.ts`. Inget bygge kördes av mig. Radnummer gäller nuvarande filer; Agent 3 ska söka på funktionsnamn/kodsnuttar om raderna har glidit.

## Bedömning av Agent 1:s rapport

Stämmer (verifierat mot koden):
- A1-130: rad 2533 `Math.min(SHADOWFLOW ? 22 : 45, FAST_DASH ? 30 : 45)` ger alltid 22 på SHADOWFLOW-banor, FAST_DASH är verkningslös där. Korrekt.
- A1-131: rad 2706 läser `gameRef.current?.lives` inne i `useMemo` (2703-2715) med `eslint-disable` på deps. Korrekt. Rättningen är enklare än Agent 1 antydde: `levelSummary` (setLevelSummary, rad 5868-5876) är redan en dep, man behöver bara lägga `lives: game.lives` i objektet och läsa därifrån.
- A1-135/A1-141: `e.type` används bara vid ritning (5086, 5163) och skapas på 2209-2214. Rörelsen (3309-3313) är gemensam. Korrekt.
- A1-136: slumpintervallen på 2462-2474 stämmer: MOON >= 0.73, GOLDRUSH 0.45-0.73, SHADOWFLOW 0.30-0.45, alltså är intervallet 0.00-0.30 ledigt (ingen regel).
- A1-140: skuggpassager räknas inte i någon statistik (`shadowPass`, 2555-2573, ändrar bara poäng/XP/effekter). `applyRunResults` (ProgressContext.tsx:303-356) och `runStatsRef` (Views.tsx:1728-1751) saknar fältet.
- A1-152 / A1-151: SKINS (Views.tsx:16-22) har 5 poster och används i butiken (6890) och QuestsView (7043), så nya skins syns automatiskt på båda ställena.

Fel eller överdrivet:
- A1-142: VIND och MÖRKER finns redan som miniEvents (`WIND` 1895/3000, `BLACKOUT` 1895/6253). Att lägga dem som banregler vore dubbelt och kan kollidera. FISKREGN är riskabelt: banan klaras bara när alla fiskar i `game.fishes` är tagna (5848), så fallande fisk som missas skulle kunna göra banan omöjlig. Det som är säkert och nytt är ISGLID och en regel som lyfter skuggpassagen (se B-033).
- A1-157: hit-stop finns redan (`game.hitStop`, 1893, 2950-2953, satt till 2 vid bossträff 3077). Det som saknas är att använda den vid skuggpassage och stomp. Det är alltså inte ny infrastruktur.
- A1-155: haptiken är utspridd på nio ställen (2502, 2517, 2550, 2571, 2609, 2862, 3515, 3560, 3635), inte bara två. Att centralisera är därför lite större än Agent 1 skrev, men fortfarande mekaniskt.
- A1-150: prestationer visas inte med namn någonstans (QuestsView 7041 visar bara antal). Nya prestationer är därför osynliga utan en namnlista; den ingår i B-034. A1-134 (toast i spel) tas inte med, det är en egen punkt.
- A1-143 (skuggfiende) kallas "Liten/Låg" men rör skott, fiendekollision, `enemiesDefeatedInRun` och fiskräkning och bör ses som medel; flyttad till fria idéer.
- Paketordningen "6, 3, 1, 2, 4, 5" följs i princip, men B-034 måste byggas före B-035 eftersom skins låses upp via de nya prestationerna.

## Byggplan

Gemensamma regler för Agent 3: en punkt i taget, kör `npm run build` efter varje, ändra inte `Math.random()`-sekvensen i banbygget (2195-2216; ny slump i spelloopen får använda `Math.random` men inte i `buildLevel`), inga ändringar i befintligt sparformat (nya fält är valfria). Respektera `progress.settings.reduceMotion` och `haptics`.

### B-031: SHADOWFLOW/FAST_DASH och liv i perkOffer

- **Bakgrund:** A1-130, A1-131.
- **Ändring:**
  1. I `triggerDash` (Views.tsx 2526-2552, raden 2533): ersätt `Math.min(...)` med multiplikativ beräkning: `let cd = game.perks?.includes('FAST_DASH') ? 30 : 45; if (game.rule === 'SHADOWFLOW') cd = Math.max(18, Math.floor(cd * 0.5));` => 45 normalt, 30 med FAST_DASH, 22 med SHADOWFLOW, 18 med båda (golv 18 så att dashen (12 frames) aldrig blir i princip ständig).
  2. I `setLevelSummary({...})` (5868-5876) lägg `lives: game.lives`. I `perkOffer` (2703-2715, rad 2706) byt `gameRef.current?.lives ?? 0` mot `levelSummary?.lives ?? 0`. Behåll deps `[levelSummary, chosenPerks]` men ta bort `eslint-disable`-raden om ingen annan varning uppstår.
- **Berörda filer:** `components/Views.tsx` (`triggerDash`, `PlayingView` perkOffer, `setLevelSummary`).
- **Verifiering:** `npm run build`. Läs koden: kontrollera att alla fyra kombinationer ger 45/30/22/18. Manuellt: nå en SHADOWFLOW-bana med och utan kortet "Snabb dash" och se att dashen laddas märkbart fortare med kortet. Kontrollera att kortvalet efter bana fortfarande visar 3 kort och att BONUS_LIFE inte erbjuds vid 5 liv.
- **Risk:** Låg.
- **Status:** GODKÄND

### B-032: Olika beteende per fiendetyp (utfall och hopp)

- **Bakgrund:** A1-141 (A1-135).
- **Ändring:** I fiendeloopen `game.enemies.forEach` (3292) ersätt det gemensamma rörelseblocket 3308-3313 med typberoende logik, men behåll standardpatrull (`e.x += e.velocityX` + studs mot plattformskanter) för typ 0 och som grundrörelse för övriga.
  - Lazy-init vid första uppdatering: `if (e.baseVx === undefined) { e.baseVx = e.velocityX; e.baseY = e.y; }` (efter GOLDRUSH-multiplikationen vid 2469, därför lazy).
  - **Typ 1 (råtta), bara från bana 4 (`game.level >= 4`, kontrollera fältnamnet för banan i `game`):** när katten är på samma höjd (`|dy| < 50`), horisontellt 60-200 px bort, inte `invincible`, inte `dashing`, och `e.lungeCd` är 0: starta förvarning `e.windup = 24` (råttan står still, ritas med röd blinkning och "!" över sig). När `windup` når 0: utfall `e.lunge = 14` frames med fart `Math.sign(riktning mot katten) * Math.max(4, Math.abs(e.baseVx) * 2.2)` men högst 5,5 px/frame; klampa `e.x` inom plattformens kanter. Efter utfallet `e.lungeCd = 150` och `e.velocityX = riktning * Math.abs(e.baseVx)`. Skuggdash, stomp och hopp fungerar som vanligt (kollisionsreglerna rörs inte).
  - **Typ 2, bara från bana 3:** litet hopp i rytm: var 90:e frame (förskjuten med `e.x` så att de inte hoppar i takt) en 24-frames båge, `e.y = e.baseY - 16 * Math.sin(Math.PI * t / 24)`. Max 16 px så att stomp-regeln (`playerBottom < enemyTop + 20`, rad 3342) och skott (3046) fungerar som förut. Återställ `e.y = e.baseY` efter bågen.
  - Rita förvarningen i fiendeloopen för rendering (5072-5085, före typgrenen 5086): om `e.windup > 0`, rita röd halvtransparent ruta/ring runt fienden och ett "!" ovanför. Med `reduceMotion` används stadig färg i stället för blinkning.
  - Bana 1-2 påverkas inte (bana 1 begränsar redan fiender, 2450-2457).
- **Berörda filer:** `components/Views.tsx` (fiendeuppdatering ca 3292-3313, fiendeutritning ca 5072-5086).
- **Verifiering:** `npm run build`. Starta bana 4-5 och se: råttor ger tydlig röd förvarning i 0,4 s före utfall, utfallet stannar på plattformen, dash genom utfallet ger "SKUGGA!", stomp ger +200 som förut. Bana 1-3 oförändrad för råttor. Typ 2 hoppar men går fortfarande att stompa och skjuta. Leta efter fiender som glider av plattformen eller fastnar (e.x klampad).
- **Risk:** Medel (ändrar spelkänsla; hålls smal med bana-gating, 0,4 s förvarning och fartstak så att det inte blir orättvist).
- **Status:** GODKÄND

### B-033: Två nya banregler, ISGLID och SKUGGJAKT

- **Bakgrund:** A1-142, A1-136 (rättad enligt bedömningen ovan: VIND/MÖRKER/FISKREGN utgår).
- **Ändring:** I regelblocket (Views.tsx 2459-2475) lägg till två grenar i det lediga intervallet utan att ändra befintliga trösklar (MOON >= 0.73, GOLDRUSH 0.45-0.73, SHADOWFLOW 0.30-0.45):
  - `else if (roll >= 0.18 && roll < 0.30)`: `rule = 'ISGLID'`, `game.friction = 0.92` (nu 0.85, används bara på rad 2979 för marken), toast "ISGLID: längre glid".
  - `else if (roll >= 0.08 && roll < 0.18)`: `rule = 'SKUGGJAKT'`, toast "SKUGGJAKT: skuggpassager ger dubbla poäng". I `shadowPass` (2555-2573): `const pts = (hunter ? 200 : 100) * (game.rule === 'SKUGGJAKT' ? 2 : 1)`.
  - Rulla 0.00-0.08 förblir "ingen regel". Samma `mulberry32`-roll som idag.
  - HUD (6459-6472): lägg två etiketter i `ruleStyle` ("Isglid" ljusblå, "Skuggjakt" lila) i stället för nuvarande fallback "Månsvävning" för okända regler; gör kedjan explicit så att okända regler inte visas som månsvävning.
  - Valfritt: bryt inte mot att samma regel kan komma två banor i rad (A1-136); lämna.
- **Berörda filer:** `components/Views.tsx` (regelblock 2459-2475, `shadowPass` 2555-2573, HUD 6459-6472). Ingen ändring av banbygget.
- **Verifiering:** `npm run build`. Tillfälligt tvinga regeln i dev (ändra inte i commit) eller spela banor 3-12 tills de dyker upp: ISGLID ger synligt längre glid vid stopp, SKUGGJAKT visar "SKUGGA! +200" (+400 med SHADOW_HUNTER). Regelkortet i HUD visar rätt text. MOON/GOLDRUSH/SHADOWFLOW oförändrade (samma roll-intervall).
- **Risk:** Låg.
- **Status:** GODKÄND

### B-034: Skuggpassager i statistik, veckouppdrag och fler prestationer

- **Bakgrund:** A1-140, A1-133, A1-150.
- **Ändring:**
  1. Räkna: i `shadowPass` (2555) `game.shadowPassesInLevel = (game.shadowPassesInLevel || 0) + 1;`. Lägg `shadowPasses: 0` i `runStatsRef` (1728), `r.shadowPasses += game.shadowPassesInLevel || 0;` i `commitLevelToRun` (1736-1751), och `shadowPasses: runStatsRef.current.shadowPasses + (game.shadowPassesInLevel || 0)` i `persistRunSummary` (2663-2678).
  2. Sparande: `types.ts` stats (rad 75-82) får `shadowPasses?: number` (valfri). `defaultProgress.stats` (ProgressContext.tsx:71-78) får `shadowPasses: 0`. `applyRunResults` (typ 97-105, impl 303-356) får valfritt `shadowPasses?: number` och adderar `stats.shadowPasses = (p.stats.shadowPasses || 0) + (results.shadowPasses || 0)`. Läsningen sprider redan `defaultProgress.stats`, så gamla sparfiler fungerar.
  3. Veckouppdrag: `createWeeklyQuests` (35-41) får `w3` "Vecko-jakt: skuggpassager" (`target: 25 + Math.floor(seededRandom(seed + 13) * 15)`, `reward: 450`), och `applyRunResults` ökar `w3`. Migrering för befintliga sparfiler: i mount-effekten (166-180) om `weeklyQuests` saknar `w3` och veckan inte nollställs, lägg till `w3` från `createWeeklyQuests(week)`. Rör inga andra uppdrag.
  4. Prestationer: ny konstant `ACHIEVEMENTS` (id, svenskt namn, beskrivning) nära SKINS (Views.tsx rad ca 16-22) med de sju befintliga (`combo_10`, `enemy_60`, `fish_300`, `boss_3`, `flawless`, `close_call`, `streak_20`) plus tre nya: `shadow_10` ("Skuggtass": 10 skuggpassager i en körning), `shadow_100` ("Skuggmästare": 100 skuggpassager totalt, `(progress.stats.shadowPasses||0) + run >= 100`), `level_10` ("Tio banor": nådde bana 10, `reachedLevel >= 10`). Lås upp i GameOverView-effekten (938-973) med `unlockAchievement` bredvid de befintliga (läs `lastRun.shadowPasses`). Skicka `shadowPasses: lastRun.shadowPasses || 0` till `applyRunResults` (938).
  5. UI: i QuestsView (7038-7050) lista `ACHIEVEMENTS` med namn/beskrivning och låst/upplåst-status i stället för bara antalet.
- **Berörda filer:** `components/Views.tsx`, `context/ProgressContext.tsx`, `types.ts`.
- **Verifiering:** `npm run build`. Spela en körning, gör flera skuggpassager, dö: GameOver/uppdrag visar att `w3` har ökat, `progress.stats.shadowPasses` ökat (se `localStorage['shadow_paw_progress_v2']`). Starta med gammal sparfil (utan `w3`/`shadowPasses`): ingen krasch, `w3` tillkommer. Prestationslistan visar 10 poster; befintliga upplåsta syns som upplåsta. 10 passager i en körning ger `shadow_10`.
- **Risk:** Låg (nya valfria fält; rör inte befintliga nycklar). Kontrollera att `applyRunResults` fortfarande bara körs en gång per körning (didFinishRef, 927).
- **Status:** GODKÄND

### B-035: Två nya skins och "nästan"-indikatorer

- **Bakgrund:** A1-151, A1-152. Beroende: B-034 (prestationerna och `shadowPasses`).
- **Ändring:**
  1. SKINS (Views.tsx 16-22): lägg `umbra` ("Umbra", `color: '#6d28d9'`, `accent: '#1e0b3a'`, hint "Gör 10 skuggpassager i en körning") och `gold` ("Guldtass", `color: '#e0b43a'`, `accent: '#4a3508'`, hint "Nå bana 10"). Ren kosmetika, ingen fördel. Lås upp i GameOver-effekten: `shadow_10` -> `unlockSkin('umbra')`, `level_10` -> `unlockSkin('gold')`. Skinn visas automatiskt i butiken (6890) och QuestsView (7043). Kontrollera att spelfiguren ritas med `skin.color/accent` (1851) så att inget extra behövs.
  2. "Nästan"-indikator på GameOver (nära 1094-1131, under resultatkortet): ta ett snapshot `const [statsBefore] = useState(progress.stats)` vid mount (som `bestBefore`, 889) och visa ett rad med närmaste olåsta mål: t.ex. "12 fisk kvar till Frost" (300 - (totalFishCollected + fishesCollected)), "9 fiender kvar till Ember", "1 boss kvar till Aurora", "3 skuggpassager kvar till Umbra". Visa bara det närmaste olåsta målet (en rad), dölj om allt är upplåst. Räkna med `statsBefore` + körningens värden (inte `progress.stats`, som uppdateras av `applyRunResults` efter första renderingen och annars dubbelräknas).
  3. Samma text som liten hint på skinnkorten i butiken är valfritt; gör det bara om det är en rad.
- **Berörda filer:** `components/Views.tsx` (SKINS 16-22, GameOverView 874-1150, ev. butik 6890).
- **Verifiering:** `npm run build`. Dummy-spara progress med 290 totala fiskar och avsluta en körning med 3 fisk: raden visar "7 fisk kvar till Frost" (inte dubbelräknat). Efter upplåsning visas ett annat mål. Nya skins syns som låsta i butik och QuestsView, kan väljas när upplåsta, och spelfiguren ritas med dem. Inget borttaget.
- **Risk:** Låg.
- **Status:** GODKÄND

### B-036: Juice, hit-stop, stigande ton och centraliserad haptik

- **Bakgrund:** A1-155, A1-156, A1-157 (korrigerade: `hitStop` finns redan).
- **Ändring:**
  1. Haptik: lägg `const haptic = (kind: 'jump'|'dash'|'shadow'|'hit'|'land'|'shoot'|...)` i `PlayingView` (före `tryPerformJump`, rad ca 2494) med mönster och som respekterar `progress.settings.haptics && navigator.vibrate`. Ersätt de nio inline-anropen (2502, 2517, 2550, 2571, 2609, 2862, 3515, 3560, 3635) med `haptic(...)` med samma längder som idag. Nytt: kort `haptic('land')` (6 ms) i landningsblocket 3268-3272 när `impactSpeed > 6`. Inga beteendeändringar utöver landningen.
  2. Stigande ton: `AudioEngine.playShadowPass(chain = 0)` (AudioEngine.ts:111-114) multiplicerar `from`/`to` med `Math.pow(1.06, Math.min(chain, 6))`. I `shadowPass` (2555): `game.shadowChain = (game.shadowChainTimer > 0 ? game.shadowChain + 1 : 0); game.shadowChainTimer = 120;` och minska timern i spelloopen (t.ex. i `simulate`, nära 2995); anropa `playShadowPass(game.shadowChain)`. Tonerna går via `tone()` som redan har tak på 20 Hz.
  3. Hit-stop: i `shadowPass` och vid stomp (3342-3353) sätt `if (!progress.settings.reduceMotion && game.hitStop === 0) game.hitStop = 3` (stomp: 2). Använd befintlig `hitStop`-hantering (2950-2953), som frysar simuleringen, så dashen (`p.dashing`) fryser också och tidsfönster blir inte kortare. Sätt aldrig hitStop > 3.
- **Berörda filer:** `components/Views.tsx` (`PlayingView` 1689+, `tryPerformJump`, `triggerDash`, `shadowPass`, `simulate`, fiendeloopen 3292+), `services/AudioEngine.ts` (`playShadowPass`).
- **Verifiering:** `npm run build`. Spela: skuggpassager i följd (inom 2 s) låter allt högre och återställs efter paus; en enskild passage låter som tidigare. Merkbar men kort frysning vid skuggpassage/stomp, ingen frysning med `reduceMotion` på. Haptiken (testa på mobil eller `navigator.vibrate`-mock i konsolen) ger samma längder som förut plus kort landning. Ingen dubbel haptik, inget ljudfel i konsolen.
- **Risk:** Låg (hit-stop är tunt och begränsat till 3 frames; refaktorn av haptik är mekanisk).
- **Status:** GODKÄND

## Fria idéer för framtiden

Dessa är för stora eller för riskfyllda för ett litet varv. Orkestratören godkänner inga punkter härifrån; de är underlag för framtida varv.

### F-001: Dagens bana (seedad layout)
- **Bakgrund:** A1-057, A1-109, A1-100. Banbygget använder `Math.random()` (2195-2216 m.fl.); en daglig delad bana kräver att allt i `buildLevel` flyttas till en seedad `mulberry32`.
- **Idé:** Samma bana för alla en dag, egen topplista lokalt, streak.
- **Risk:** Hög (ändrar generering, balans och alla banor).
- **Status:** FÖRESLAGEN

### F-002: Spöke (replay av bästa körningen)
- **Bakgrund:** A1-100. Kräver deterministisk simulering eller inspelning av positioner per frame.
- **Risk:** Hög.
- **Status:** FÖRESLAGEN

### F-003: Checkpoints
- **Bakgrund:** Banorna är långa; en checkpoint halvvägs minskar frustration men påverkar poäng, fisk och boss-arena.
- **Risk:** Hög (balans, state, fiskräkning).
- **Status:** FÖRESLAGEN

### F-004: Dela upp update/render och Views.tsx
- **Bakgrund:** A1-120, A1-107, A1-014. `Views.tsx` är 7061 rader och `PlayingView` blandar logik och ritning.
- **Risk:** Hög (stor omstrukturering, svårgranskad, bryter radhänvisningar).
- **Status:** FÖRESLAGEN

### F-005: PWA (manifest + service worker)
- **Bakgrund:** A1-122, A1-163, A1-099. Kräver flytt av `Sounds/` till `public/` och cache-strategi.
- **Risk:** Medel-Hög (cachebuggar kan servera gammal version).
- **Status:** FÖRESLAGEN

### F-006: Skuggläge
- **Bakgrund:** A1-101 m.fl. En hel spelvariant där skuggmekaniken är kärnan.
- **Risk:** Hög.
- **Status:** FÖRESLAGEN

### F-007: Bossfaser och svag punkt via skuggdash
- **Bakgrund:** A1-145, A1-102. Kräver speltest av bossarnas profiler (`BOSS_ATTACK_PROFILES`, 1335).
- **Risk:** Hög.
- **Status:** FÖRESLAGEN

### F-008: Skuggfiende (kan bara besegras via skuggpassage)
- **Bakgrund:** A1-143. Rör skottkollision (3046), fiendekollision (3316-3361), `enemiesDefeatedInRun` och fiskräkning; bör bygga på B-034 och B-032.
- **Risk:** Medel (omklassad från Agent 1:s Låg).
- **Status:** FÖRESLAGEN

### F-009: Skuggmätare och skuggsprängning
- **Bakgrund:** A1-146. HUD-stapel + ny dasheffekt som rensar fiender; kräver balans mot poäng och uppdrag.
- **Risk:** Medel.
- **Status:** FÖRESLAGEN

### F-010: Miniboss var 5:e bana mellan bossarna
- **Bakgrund:** A1-144. Återanvänder bossprofiler men ny spawn och belöning.
- **Risk:** Medel.
- **Status:** FÖRESLAGEN

### F-011: Riskkort (Skuggpakt, Glaskatt)
- **Bakgrund:** A1-149. Ny kortkategori i `RUN_PERKS`; balansrisk (x2 poäng på 1 liv).
- **Risk:** Medel.
- **Status:** FÖRESLAGEN

### F-012: FISKREGN och hemliga fiskstigar
- **Bakgrund:** A1-142/A1-148. Fisk som skapas dynamiskt påverkar `game.fishes`-räkningen (5848) och kan göra banor ospelbara om den inte exkluderas från kravet.
- **Risk:** Medel.
- **Status:** FÖRESLAGEN

### F-013: Adaptiv musik och auto-prestandaläge
- **Bakgrund:** A1-158, A1-160. Lågpassfilter styrt av combo (`useBackgroundMusic`, 1154); automatisk sänkning av partiklar vid låg fps.
- **Risk:** Medel (webbljud och fps-mätning på olika enheter).
- **Status:** FÖRESLAGEN

### F-014: Autosikte v2 och touch-inställningar
- **Bakgrund:** A1-132, A1-161. Bossar som mål, förutsägelse, knappstorlek och vänsterhandsläge i `settings` (types.ts:60-72).
- **Risk:** Medel (kräver test på riktig touch-enhet).
- **Status:** FÖRESLAGEN

### F-015: Toast i spel för prestationer, titlar/ranger, rekordindikator
- **Bakgrund:** A1-134, A1-153, A1-154. Små UI-förbättringar som kan tas i ett senare varv efter B-034/B-035.
- **Risk:** Låg.
- **Status:** FÖRESLAGEN

### F-016: CI-typkontroll och enhetstester
- **Bakgrund:** A1-013, A1-055. Tre kända tsc-fel ska rättas först; tester för `mulberry32` och `registerCombo`.
- **Risk:** Låg-Medel.
- **Status:** FÖRESLAGEN

---
Varv 6: B-031...B-036 godkända av orkestratören å ägarens vägnar 2026-10-20 (ägarens uttryckliga förhandsgodkännande i chatten). Punkterna under "Fria idéer" förblir FÖRESLAGEN.
