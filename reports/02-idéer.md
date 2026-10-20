# 02 - Idégranskning och byggplan (Agent 2, Idégranskare)

Datum: 2026-10-20. Underlag: reports/VISION.md, reports/01-analys.md samt stickprov i koden (components/Views.tsx, App.tsx, services/AudioEngine.ts, context/ProgressContext.tsx). Inget bygge eller körning gjordes; radnummer avser Views.tsx om inget annat anges och kan glida något när tidigare punkter byggts, så Agent 3 bör söka på funktionsnamnen.

## 1. Bedömning av Agent 1:s rapport

Verifierat mot koden och stämmer:
- **A1-003 (paus):** `isPausedRef` sätts (1569-1576) men läses aldrig i `simulate` (2549) eller `loop` (5737). Ingen overlay. `restartCurrentLevel` (1580) är oanvänd och `setCurrentLevel(prev => prev)` skulle ändå inte köra om effekten. Stämmer.
- **A1-004 (Fart):** spelarfarten är `4.6 + level*0.08` (1729) och `progress.upgrades.speed` (default 5, ProgressContext 53) läses inte i spelet, bara i butiken (6183). Stämmer.
- **A1-002 (statistik):** `setupLevel` (1642) skapar nytt `game` med `enemiesDefeatedInRun: 0`, `levelsCompletedInRun: 0`, `bestComboInRun: 0` (1690-1692) osv. `persistRunSummary` (2346) skriver bara det aktuella `game`. Stämmer.
- **A1-005 (mute):** `AudioEngine.init()` rad 36 sätter `gain.value = this.sfxVolume` utan `muted`. Stämmer.
- **A1-015 (rå å):** rad 637, 646, 650, 667, 671 har `å`-sekvenser i JSX-text. Stämmer.
- **A1-011 (city-bg):** App.tsx:116 `<img src="/city-bg.jpg">` med Vite `base: './'`. Stämmer för Pages under undersökväg.
- **A1-022 (skott-kill):** `e.x = -1000` (2643) sätts före `registerCombo(game, 200, e.x, e.y)`, partiklar och "+200"-text. Stämmer, och dessutom saknas `break`, så en kula kan träffa flera fiender.
- **A1-006 (touch):** canvas-gester (2486-2536) och skärmknappar (6016+) finns samtidigt; ingen `touch-action` finns i Views.tsx eller index.css (grep gav 0 träffar). Stämmer.

Nyanseringar:
- A1-001 är latent, inte aktiv: ingen nyckel sätts i CI. Rätt prioritet "Hög" för principen, men det är inte en spelkänslebugg. Utanför denna körning (kräver beslut om Gemini-funktionen).
- A1-007/A1-008 (render per simulate-steg, tung ritning) är troligen korrekta men ej profilerade. Stor refaktor, därför inte i denna plan.
- Jag fann att kombosystemet, screen shake (`game.screenShake`, `hitStop`, `zoomPunch`), haptik (`navigator.vibrate`), multiplikator och toasts redan finns. Det som saknas är att spelaren **ser** combo/multiplikatorn: `COMBO x{combo}` visas endast i debug-overlay (5908). Därför föreslås en synlig combo-mätare (B-005) i stället för ett helt nytt kombosystem.
- Dagliga uppdrag finns redan (ProgressContext), men en daglig *bana* kräver seedad banagenerering (A1-035, `Math.random` används genomgående i `setupLevel`) och är för stor för en liten byggpunkt. Se fria idéer.

## 2. Byggplan (6 punkter, rekommenderad ordning B-001 till B-006)

Ordningen är vald för att minimera konflikter i Views.tsx: B-001 och B-002 rör PlayingView-logiken, B-003 är små spridda fixar, B-004 rör input/JSX nära slutet av PlayingView, B-005 rör simulate/HUD, B-006 rör GameOverView. Bygg en i taget och kör `npm run build` efter varje.

---

### B-001: Paus som fungerar (overlay, auto-paus, omstart av bana)
- **Bakgrund:** A1-003. Esc/P växlar bara en flagga; spelet går vidare. Direkt förstörande för spelkänslan, särskilt på mobil (inkommande samtal, flikbyte).
- **Ändring:**
  1. I `loop` (Views.tsx ca 5737-5753): om `isPausedRef.current`, hoppa över `simulate()`, sätt `previousFrameTime = now` och nollställ `accumulatedTime` så inget "hoppar" vid återupptagning; fortsätt `requestAnimationFrame(loop)`. Pausa även musik/ljud inte nödvändigt.
  2. Lägg en paus-overlay i JSX (nära "Level complete"-overlayn, ca 5966): knappar "Fortsätt", "Starta om bana", "Huvudmeny" (anropar `onEnd`/`onMenu` på samma sätt som befintlig "Avsluta", rad 6010). Använd befintliga knappklasser.
  3. Auto-paus vid `document.visibilitychange` (hidden) och `window blur` genom att sätta `isPaused` till true (registrera i effekten vid 2462-2540 eller en egen liten `useEffect`; rensa i cleanup).
  4. Ersätt döda `restartCurrentLevel` (1580) med en `restartKey`-state (`useState(0)`) som ingår i beroendelistan för spel-effekten (slutar ca 5770) så att banan byggs om; "Starta om bana" ökar den och sätter `isPaused` false. Behåll liv/poäng från banstart (använd samma `lives`/`totalScore` som effekten redan läser, eller återställ till värden vid banstart).
  5. Esc-kollision: fullskärmslyssnaren (1615-1619) lämnas orörd; paus-toggle på Esc får gärna ske parallellt.
- **Berörda filer:** components/Views.tsx (funktionerna `PlayingView`, `togglePause`/`restartCurrentLevel` 1568-1592, `loop` ca 5737-5753, JSX nära 5966-6015).
- **Verifiering:** `npm run build` måste gå igenom. Manuellt: starta spel, tryck P, kontrollera att fiender/timer står still och overlay syns; P igen återupptar utan hopp; byt flik och kom tillbaka, spelet är pausat; "Starta om bana" bygger om banan.
- **Risk:** Medel (rör spelloop och effektberoenden; fel beroendelista kan bygga om banan oavsiktligt). Håll `restartKey` som enda nytt beroende.
- **Status:** GODKÄND

---

### B-002: Körningsstatistik som överlever banbyte (och korrekt liv-synk vid banslut)
- **Bakgrund:** A1-002 (hög), A1-024. Kills, nivåer klarade, bästa combo, bästa streak och nära-träffar nollställs för varje bana, så uppdrag, prestationer och skin-upplåsningar räknas fel.
- **Ändring:**
  1. Inför `runStatsRef = useRef({ enemiesDefeated: 0, levelsCompleted: 0, bestCombo: 0, bestStreak: 0, nearMisses: 0, noHit: true, bossDefeated: false, coins: 0, fish: 0 })` i `PlayingView`, nollställd endast vid montering (ny körning).
  2. I `setupLevel` (ca 1686-1700): initiera `game.enemiesDefeatedInRun`, `levelsCompletedInRun`, `bestComboInRun`, `bossDefeatedInRun` osv. från `runStatsRef.current` i stället för 0, så att alla befintliga `game.*InRun`-ökningar (t.ex. 2647, 2930) fortsätter ackumulera. Alternativt spegla till ref i `persistRunSummary` (2346) och läs därifrån; välj den enklaste med minst rader ändrade.
  3. Uppdatera `runStatsRef.current` vid banslut/död precis före `persistRunSummary` och vid byte till nästa bana, och låt `persistRunSummary` skriva ackumulerade värden (inkl. `levelsCompleted`, `coins` summerat över banor).
  4. Besluta uttryckligen (kommentar i koden): XP/runnivå (`xp`, `runLevel`, `xpNeeded`) **består** mellan banor (rekommenderat, det är körningens progression). `lives`/`score` bärs redan via `existingLives`/`existingScore`.
  5. A1-024: anropa `setLives(game.lives)` direkt vid banslut/död innan nästa bana byggs.
  6. Skicka summerade fiskar via `onEnd(score, fish)` om det idag bara är sista banans (`totalCollectedInLevel`, 6010 och motsvarande anrop vid död); kontrollera båda anropsställena.
- **Berörda filer:** components/Views.tsx (`setupLevel` 1642-1770, `persistRunSummary` 2346-2358, banslut-/dödshantering kring 5330-5360 och `onEnd`-anropen; sök `persistRunSummary(` och `onEndRef.current(`). GameOverView (812-875) behöver ingen ändring förutom att den nu får korrekta värden.
- **Verifiering:** `npm run build`. Manuellt: klara två banor och dö på tredje; på Game Over ska "bästa combo"/fiender i Quests-/statistikvyn spegla summan över banor (jämför `shadow_paw_last_run` i localStorage före/efter). Kontrollera att runnivå inte nollställs mellan banor.
- **Risk:** Medel-hög (central logik, många `any`-fält, lätt att dubbelräkna). Håll diffen liten: initiera från ref, uppdatera ref på ett enda ställe. Undvik att ändra `applyRunResults`-kontraktet.
- **Status:** GODKÄND

---

### B-003: Fyra små buggfixar (Fart-uppgradering, mute efter omladdning, å/ä/ö, city-bg-sökväg)
- **Bakgrund:** A1-004, A1-005, A1-015, A1-011. Alla små, oberoende och låg risk; samlas i en punkt för att få in dem snabbt, men ska committas som separata, tydliga ändringar.
- **Ändring:**
  1. **Fart (A1-004):** i `setupLevel` (rad 1729) lägg till `+ Math.max(0, progress.upgrades.speed - 5) * 0.4` på `player.speed` (varje köp ger +0,5 i `upgrades.speed`, alltså +0,2 fart). Lägg ett tak så att farten inte bryter banorna: `Math.min(…, 1.5)` på tillägget. Skriv i Shop-texten (ca 6175-6193, "Nuvarande: …") vad effekten är. Rör inte priset eller `buyUpgrade` (A1-019 är en separat idé).
  2. **Mute (A1-005):** services/AudioEngine.ts `init()` rad 36: `this.masterGain.gain.value = this.muted ? 0 : this.sfxVolume;`. Lägg även `if (this.ctx.state === 'suspended') this.ctx.resume();` efter skapandet (A1-017, minsta möjliga).
  3. **Rå å (A1-015):** ersätt `å`→å, `ö`→ö, `Å`→Å, `Ä`→Ä, `ä`→ä, `—`→— på raderna 637, 646, 650, 667, 671 i HowToPlayView (585-688). Kontrollera efteråt med `grep -n '\\u00' components/Views.tsx` att inga fler JSX-textträffar finns (träffar inne i JS-strängar med citattecken är OK).
  4. **city-bg (A1-011):** App.tsx:116 `src={`${import.meta.env.BASE_URL}city-bg.jpg`}`. Kontrollera `vite-env.d.ts`/tsconfig-typer; om `import.meta.env` ger typfel, använd `new URL('city-bg.jpg', document.baseURI).href` i stället.
- **Berörda filer:** components/Views.tsx (rad 1729, 637-671, 6175-6193), services/AudioEngine.ts (32-39), App.tsx (116).
- **Verifiering:** `npm run build`. `npm run build && npm run preview` och kontrollera att `city-bg.jpg` laddas (Network-fliken). Manuellt: sätt mute i inställningar, ladda om, starta spel, inga SFX hörs. Köp Fart en gång och se att spelaren rör sig märkbart snabbare. "Så spelar du" visar å/ä/ö.
- **Risk:** Låg. Enda risken är att Fart-balansen gör banorna för lätta; taket hanterar det.
- **Status:** GODKÄND

---

### B-004: Pålitlig touch-styrning (minsta fix: Pointer Events på knappar, touch-action, avbruten touch, multitouch)
- **Bakgrund:** A1-006. Två motstridiga scheman, passiva `preventDefault` är verkningslösa, ingen `touchcancel` (fastnade rörelsetangenter), `touch-action` saknas (dubbeltrycks-zoom/scroll), `isTouchDevice` sätts efter mount. Mobil är en huvudmålgrupp enligt VISION.
- **Ändring (avgränsad, ingen omskrivning av spelinput):**
  1. Beräkna `isTouchDevice` synkront: `useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches)` och ta bort/behåll bara en fallback-effekt vid rad 1637-1640. Detta minskar onödig ombyggnad av banan.
  2. Byt skärmknapparnas `onTouchStart/onTouchEnd` (ca 6016-6068) mot `onPointerDown` / `onPointerUp` / `onPointerCancel` / `onPointerLeave` med `e.currentTarget.setPointerCapture(e.pointerId)`, så multitouch fungerar (ett finger rör, ett annat hoppar/skjuter) och knappen släpps vid avbrott. Behåll samma `setKeyState(...)`-anrop.
  3. Ta bort canvas-gesterna `handleTouchStart/Move/End` (2486-2536 och deras `addEventListener/removeEventListener`, ca 2536-2540 och 5755-5770) samt "Vänster: Jump / Höger: Shoota / Svep"-overlayn (5947-5958) för att undvika dubbla scheman. Behåll `handleMouseDown` (skjuta med mus).
  4. Lägg `touch-action: none` (Tailwind `touch-none`) på canvas, kontrollknappsraden och spelcontainern, och `user-select: none` (finns delvis).
  5. Kontrollera att dash, hopp, skott och vänster/höger alla har en skärmknapp efter ändringen; om Dash saknas, lägg till en knapp som anropar samma funktion som tangentbordets dash.
- **Berörda filer:** components/Views.tsx (`PlayingView`: `isTouchDevice` 1594-1640, touch-handlers 2486-2540, cleanup ca 5755-5770, overlay 5947-5958, knappraden 6014-6070).
- **Verifiering:** `npm run build`. Manuellt i webbläsarens mobil-emulering (Chrome DevTools, touch) och helst en riktig telefon: hålla höger-knapp och trycka hopp samtidigt; släppa utanför knappen släpper rörelsen; ingen sidscroll/zoom vid snabbt tryck. Datorn med mus/tangentbord ska vara oförändrad.
- **Risk:** Medel (ändrar input på mobil som jag inte kunnat testa på riktig enhet; borttagning av canvas-gester är ett medvetet designbeslut: skärmknappar är tydligare). Om ägaren vill behålla gester kan steg 3 hoppas över men då återstår dubbelschemat.
- **Status:** GODKÄND

---

### B-005: Synlig combo-mätare och kraftfullare feedback vid träff (ny funktion)
- **Bakgrund:** Kombosystemet (`registerCombo` 2292, `comboTimer`, multiplikator, `AudioEngine.playCombo`, screen shake, haptik) finns men spelaren ser det bara som flytande text; `COMBO x…` visas bara i debug-overlay (5908). Samtidigt förstörs feedbacken för skott-kills av A1-022 (partiklar och poängtext hamnar vid x = -1000). Tydlig combo-feedback är kärnan i "en runda till"-känslan och skapar mastery utan mörka mönster (belönar skicklighet, inga timers som straffar frånvaro).
- **Ändring:**
  1. **Fix A1-022 (förutsättning):** i kula-mot-fiende-loopen (ca 2641-2660) spara `const cx = e.x + e.width/2, cy = e.y + e.height/2` före `e.x = -1000`, använd dem för `registerCombo`, partiklar och "+200"-text, och avsluta fiendeloopen för den kulan med `break`/`return` (byt `forEach` mot `for…of` om nödvändigt).
  2. **HUD-mätare:** exponera `comboTimer` och `comboTimerMax` (150) i `setStats` (5704-5725; lägg `comboFrac: Math.min(1, (game.comboTimer||0)/150)`). Rendera en kompakt combo-pill i HUD (nära multiplikator/streak, ca 5800-5900) som visar `COMBO x{n}` med en smal förloppsstapel som tömmer sig mot noll och byter färg vid tiers (t.ex. 5, 10, 20). Visa endast när `combo >= 2`. Eftersom stats bara uppdateras var 250 ms, hämta komboms-fraktion med `game.comboTimer` direkt om det går, annars acceptera grov stegning (4 steg/s är OK) men låt CSS `transition` jämna ut.
  3. **Tier-feedback:** vid combo 5, 10, 20 (i `registerCombo`): kort `pushToast`, `AudioEngine.playCombo`, liten extra `game.screenShake = Math.max(game.screenShake, 4)` samt `navigator.vibrate(14)` om `progress.settings.haptics`.
  4. **Respektera `reduceMotion` (A1-026, endast det som berörs):** skala bort ny shake/zoom när `progress.settings.reduceMotion` är sant.
  5. Inga ändringar av poängformler.
- **Berörda filer:** components/Views.tsx (`registerCombo` 2292-2317, kula-loop 2641-2660, `setStats`-objektet och initial `useState` 1594, HUD-JSX ca 5790-5910). services/AudioEngine.ts behöver bara ändras om en ny ton önskas (valfritt, återanvänd `playCombo`).
- **Verifiering:** `npm run build`. Manuellt: skjut en fiende, partiklar och "+200" visas vid fienden (inte utanför); kedja pickup/kills och se mätaren fyllas, tömmas och tiers triggas; sätt "Reducera motion" och se att extra shake uteblir.
- **Risk:** Låg-medel (tillägg i HUD och några rader i `registerCombo`; prestandarisken är liten eftersom en pill ersätter inget tungt, men undvik `backdrop-blur` på pillen enligt A1-008).
- **Status:** GODKÄND

---

### B-006: Snabb omstart och "nästan rekord"-motivation på Game Over (ny funktion)
- **Bakgrund:** VISION nämner snabba omstarter och tydlig progression. Idag krävs musklick på "Spela igen" (1018), och skärmen visar "Nytt rekord!" alltid, även för icke-rekord (A1-021). En ärlig jämförelse mot spelarens eget bästa ger "en runda till"-känsla utan manipulation.
- **Ändring:**
  1. I GameOverView (817-1030): lägg en `keydown`-lyssnare (cleanup i `useEffect`) för `R`, `Enter` och `Space` som anropar `onRestart()`, men **inte** när fokus ligger i namnfältet (`document.activeElement` är en `INPUT`). Visa en liten hint på knappen: "Spela igen (R)".
  2. Beräkna `bestBefore` = högsta `score` i `localStorage['shadow_paw_scores']` (med try/catch och `Array.isArray`-kontroll) **före** att spelarens egen post sparas (`handleSaveScore`, ca 877-882). Visa: om `score > bestBefore` en "Nytt rekord!"-rubrik (befintlig sektion, 975-1000), annars en rad "X poäng från ditt rekord" (neutral text, ingen skuldkänsla) och dölj eller tona ned sparformuläret för 0 poäng. Behåll formuläret för sparande oavsett.
  3. Rensa `shadow_paw_last_run` efter att sammanfattningen konsumerats (efter `applyRunResults`-anropet 836-846), vilket också minskar dubbelräkningsrisken i dev (A1-021, delvis). Om `React.StrictMode` kör effekten två gånger i dev, skydda med en `useRef`-guard (`const didFinishRef = useRef(false)`) kring `addXP`/`applyRunResults`.
  4. Inga timers, inga tvingande val, ingen automatisk omstart.
- **Berörda filer:** components/Views.tsx (`GameOverView` 817-1030: effekten 836-875, `handleSaveScore` 877-882, rubriksektion 975-1000, knapp 1018). App.tsx behöver inga ändringar.
- **Verifiering:** `npm run build`. Manuellt: dö, tryck R och landa direkt i ny runda; dö med lägre poäng än tidigare och se "X poäng från ditt rekord"; skriv i namnfältet och tryck mellanslag/R utan att starta om; dev-läge med StrictMode ger inte dubbel XP.
- **Risk:** Låg (isolerat i en komponent). Se upp med tangentbordsfokus i inputfältet.
- **Status:** GODKÄND

---

## 3. Fria idéer för framtiden (ej med i byggplanen)

Spelmekanik och identitet
1. **Daglig utmaning med seedad bana:** gör `setupLevel` deterministisk (seedad RNG, A1-035) och lägg ett läge "Dagens bana" (samma för alla spelare det datumet, lokal bästa poäng; ingen server behövs). Förutsätter A1-035 och en nåbarhetskontroll.
2. **Skuggmekanik (unik identitet):** en "Skuggdash" som lämnar en skuggkopia som lockar fiender (kort cooldown), eller att stå stilla i skugga laddar nästa skott. Passar namnet och neon-cyberpunk.
3. **Risk/belöning:** valfria "riskkoder" före en bana (t.ex. ett liv färre för x1,5 mynt). Alltid frivilligt, tydligt förklarat.
4. **Fiendevarianter och ny boss per tema:** fler beteenden (skärmhoppande dronor, sköldfiender som måste stampas) med tydliga signaler innan attack.
5. **Förmågor via skins:** varje skin ger en liten kosmetisk eller lätt förmåga (spår efter dash, annan landningspartikel) men aldrig statfördelar som kräver mynt.

Retention och framsteg
6. **Prestationslista (A1-044):** vy med ikon, framsteg och datum; toast i spel vid upplåsning.
7. **Mästerskapsmål:** "Slå ditt bästa combo", "klara bana X utan skada" som valfria personliga mål ovanpå dagliga uppdrag.
8. **Spökdata:** rita spelarens bästa körning som svag skugga (positioner sparas varje 6:e frame) som tävlan mot sig själv.
9. **Delbar rundsammanfattning** via Web Share API (A1-027) med lokalt bildkort.

Teknik och känsla
10. **Uppgraderingstak och stigande pris (A1-019):** maxnivåer, "MAX", validering i uppdateringsfunktionen.
11. **Splitta update/render (A1-007) och cacha bakgrund (A1-008):** nödvändigt för stabil 60 fps på mobil; bör föregås av uppdelning av Views.tsx (A1-014) och typer (A1-013).
12. **Ljud:** `unlock()` vid första gest (A1-016/017), polyfonibegränsning, cacha brusbuffert, flytta Sounds till `public/` och komprimera (A1-030).
13. **PWA/offline (A1-041):** manifest, PNG-ikoner, service worker som cachar app-skal och musik.
14. **Säker lagring (A1-010):** `safeStorage`, versionsfält, schemavalidering och backup som verkligen kan läsas tillbaka.
15. **Tillgänglighet (A1-025, A1-026):** fullt stöd för `reduceMotion`, färgblindsäkra former för faror, `aria`-etiketter.
16. **Gemini (A1-001/A1-032):** besluta om funktionen ska finnas kvar; annars ta bort `define`, `@google/genai` och använd bara statiska repliker (fler varianter per poängintervall).
17. **Byggprocess (A1-012, A1-013, A1-031):** `typecheck`-skript, rensa CI och ta bort `.claude/settings.local.json` ur versionshanteringen.

---
Godkänt av orkestratören å ägarens vägnar 2026-10-20 20:5x (ägarens uttryckliga förhandsgodkännande i chatten: agenterna får fritt förbättra ShadowPaw).
