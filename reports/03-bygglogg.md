# 03 - Bygglogg (Agent 3, Byggare)

Datum: 2026-10-20. Branch: `agents/build-20261020`. Ordning: B-003, B-001, B-005, B-006, B-004, B-002. Alla sex byggda; `npm run build` gick igenom efter varje punkt. Inga manuella spel-/enhetstester gjordes (ingen webbläsare); verifiering är endast bygget. package-lock.json orörd.

## B-003: Fyra små buggfixar
- Ändrat: Fart-uppgraderingen ger nu +0,4 fart per steg över 5 (tak +1,5) i `setupLevel`; butikstexten visar effekten. AudioEngine `init()` respekterar `muted` och kör `resume()` om kontexten är suspended. Råa `\uXXXX` i HowToPlay ersatta med riktiga tecken. `city-bg.jpg` använder `import.meta.env.BASE_URL`.
- Filer: components/Views.tsx, services/AudioEngine.ts, App.tsx.
- Build: OK.
- Begränsningar: Fartbalans ej speltestad. Fart-uppgradering ger +0,2 per köp enligt idén (0,5 steg x 0,4). BASE_URL i dist ej kontrollerad under undersökväg (bara att `city-bg.jpg` finns i bundeln).

## B-001: Paus
- Ändrat: Loopen hoppar över `simulate` vid paus och nollställer tidsackumulatorn. Paus-overlay (Fortsätt / Starta om bana / Huvudmeny). Auto-paus vid `visibilitychange` (hidden) och `window blur`; tangenter nollas vid auto-paus; input ignoreras medan pausad. `restartKey` (enda nya effektberoende) bygger om banan; `levelStartRef` sparar poäng/liv vid banstart så omstart inte behåller mid-bana-värden.
- Filer: components/Views.tsx (PlayingView).
- Build: OK.
- Begränsningar: Mynt som redan tjänats under försöket behålls vid omstart (lagras direkt i ProgressContext). Musik pausas inte. Blur-auto-paus triggas även av klick utanför fönstret/devtools.

## B-005: Combo-mätare
- Ändrat: A1-022 fixat (centrum sparas före e.x = -1000, `for...of` med `break`, en kula dödar max en fiende). `comboFrac` i stats och en combo-pill i HUD (visas vid combo >= 2, färgtier vid 5/10/20, ingen backdrop-blur). Tier-feedback vid combo 5/10/20: toast, `playCombo`, shake (4, ej vid reduceMotion), vibration om haptics på.
- Filer: components/Views.tsx.
- Build: OK.
- Begränsningar: Mätaren uppdateras var 250 ms (CSS-transition 280 ms jämnar ut). Befintliga shake-/zoomvärden på andra ställen respekterar fortfarande inte reduceMotion (A1-026 endast delvis).

## B-006: Game Over
- Ändrat: R / Enter / Mellanslag startar om (inte när fokus är i inputfält, ignorerar key repeat); knapptext "Spela igen (R)". `bestBefore` läses en gång före sparning; rubrik "Nytt rekord!" bara om score > bästa, annars "X poäng från ditt rekord"; formuläret kvar (tonat vid 0 poäng). `lastRun` läses en gång (useState) och `shadow_paw_last_run` rensas efter konsumtion; `didFinishRef` skyddar mot dubbel effekt i StrictMode. `shadow_paw_scores` parsas med try/catch.
- Filer: components/Views.tsx (GameOverView).
- Build: OK.
- Begränsningar: Space/Enter på en fokuserad knapp (t.ex. "Huvudmeny") startar om i stället; `onRestart` i effektens beroenden. `getJerryTaunt` oförändrad.

## B-004: Touch
- Ändrat: `isTouchDevice` beräknas synkront via `matchMedia('(pointer: coarse)')` (effekt-setter borttagen). Skärmknappar använder Pointer Events med `setPointerCapture`, `onPointerUp/Cancel` och blockerad context menu. Canvas-gester och gest-overlayn borttagna. `touch-none select-none` på canvas och kontrollrad. Dash-knapp fanns redan.
- Filer: components/Views.tsx.
- Build: OK.
- Begränsningar: Ej testat på riktig enhet. En tap på canvas på touch kan fortfarande ge syntetisk `mousedown` (skott), `handleMouseDown` behölls enligt plan. Enheter med `pointer: fine` som primär (hybridlaptops) får inga skärmknappar.

## B-002: Körningsstatistik
- Ändrat: `runStatsRef` (nollställs bara vid ny körning) seedar `game.*InRun`, xp, runLevel, xpIntoLevel, xpNeeded i `setupLevel`; `commitLevelToRun` kopierar tillbaka vid `startNextLevel`. `persistRunSummary` summerar bestStreak (max), nearMisses och coins över banor. `onEnd` får fiskar summerade över hela körningen (`runFishTotal`, alla sju anropsställen). `setLives(game.lives)` direkt vid banslut; perfekt-bonus jämförs mot banstartens liv. Beslut: XP/runnivå består mellan banor (kommentar i koden).
- Filer: components/Views.tsx.
- Build: OK.
- Begränsningar: `noHit` förblir per bana (oförändrat). Statistik committas först när nästa bana startas; avbryts körningen före dess används ref + aktuell bana (konsistent). Vid omstart av bana nollställs den banans kills/fiskar i statistiken, men redan intjänade mynt kvarstår. Ej testat manuellt (jämför `shadow_paw_last_run`).
