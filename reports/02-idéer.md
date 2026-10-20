# 02 - Idéer och byggplan (Agent 2, Idégranskare), omgång 2

Datum: 2026-10-20. Branch `agents/build-20261020`. Underlag: reports/01-analys.md (omgång 2), reports/VISION.md. Radnummer avser nuvarande components/Views.tsx (6451 rader) om inget annat anges. Ingen kod ändrad, inget byggt eller körts.

## Bedömning av Agent 1:s rapport

Verifierat mot koden (stämmer):
- **A1-045 stämmer, och är något bredare.** `setKeyState` (2481-2503) sätter `game.keys[code] = active` (2484) före paus-kollen (2491). `requestJump` (2294) och `fireBullet` (2506, kontrollerar bara `running`) saknar paus-koll; `triggerDash` (2337) likaså. Tillägg: musklicket på canvas (`handleMouseDown`, 2584-2590) anropar också `fireBullet`; paus-overlayn täcker troligen canvas, men det är säkrast att lägga kollen i själva funktionerna.
- **A1-046 stämmer.** `togglePause` (1612) anropas bara från Esc/P (2488) och overlay-knappen (6042). Ingen HUD-knapp.
- **A1-047 stämmer.** Overlay (6044) och banresultat (6093) anropar `onEnd` direkt. `App.handleGameEnd` (App.tsx:81-85) går alltid till GAME_OVER och GameOverView skickar `deaths: 1` (≈rad 866). `persistRunSummary` (2425) körs inte vid frivilligt avslut.
- **A1-048 stämmer.** `isPaused` nollställs bara i `restartCurrentLevel` (1653); effekten som bygger banan (2565-2570) rör den inte, och `setKeyState` kollar inte `game.running`.
- **A1-020 stämmer.** `maxAmmo` får +2 både på 1749 och 1843. På 1844 sätts bara `invincibleTimer = 20`, men `invincible` blir `false` varje frame när timern är 0 och sätts aldrig till `true` (3208-3209), så förmånen gör ingenting. Notering: förmånen heter "Vaksintinkt" (6209) i UI.
- **A1-050 stämmer.** `stats` (ProgressContext 71-78) saknar bästa nivå; ingen nivåinfo når GameOver. Bra nyhet för byggbarhet: `parsed.stats` slås ihop med defaults (ProgressContext 147, 374), så nya nycklar är ofarliga, men jag föreslår ändå en separat localStorage-nyckel för att inte röra `applyRunResults` (rad 345, bygger `stats` explicit) eller export/import-koden.
- **A1-051 stämmer.** Inga pickups finns; spelaren har 5 liv hela körningen. `grantXp` (2399-2411) ger +2 skott och +500 poäng.
- **A1-052 stämmer delvis.** `miniEvent` (1769-1774) finns redan från nivå 3 (WIND, LOW_GRAVITY, BLACKOUT), så "inga banunika regler" är något överdrivet; det som saknas är *synliga, stabila* banregler. `seededRandom(level * ...)` används redan, så deterministiska val per bana är beprövade i koden.

Överdrivet eller att nyansera:
- A1-045 "kattens fart fortsätter när man återupptar": stämmer bara om knappen släpps under pausen utan att `pointerup` når spelet. `autoPause` (2574) nollar tangenter, så vanlig paus via tangent är OK. Gör fixen oavsett.
- A1-049 (key repeat) är liten men enkel; tas med i B-007.
- A1-045b (farming av mynt vid omstart) är verklig men en designfråga; ingår inte i denna omgång (se fria idéer).

## Byggplan

Alla punkter är små, har ingen ändring av sparformat som kan förstöra gammal progress (endast nya nycklar), inga nya beroenden och ingen borttagning av banor/funktioner.

### B-007 - Pausen stoppar all input (tangentbord, touch, mus)
- **Bakgrund:** A1-045, A1-049.
- **Ändring:**
  - Överst i `requestJump` (2294), `triggerDash` (2337) och `fireBullet` (2506): `if (isPausedRef.current) return;` (och `releaseJump` får gärna alltid köra).
  - I `setKeyState` (2481-2503): flytta paus-kollen så att `active === true` ignoreras under paus men `active === false` alltid rensar `game.keys[code]` (undvik fastnade riktningar). Esc/P-hanteringen (27, 80) ligger kvar före kollen.
  - I `handleKeyDown` (2582): ignorera `e.repeat` för Esc/P (och för skott-tangenterna, så att håll-nere inte tömmer ammo). Byte till `e.code` (A1-023) ingår inte.
  - Inaktivera touchknapparna visuellt under paus (`disabled`/`opacity-40` på knapparna 6104-6145 när `isPaused`), samt släpp hållna riktningar i `autoPause` (2572-2580) vilket redan görs för tangenter.
- **Berörda filer:** components/Views.tsx (funktionerna ovan; touchknapparna 6099-6148).
- **Verifiering:** `npm run build`. Manuellt: pausa, tryck hopp/dash/skjut på tangent, mus och touch (devtools touch-emulering) och bekräfta att ammo inte minskar och att katten inte hoppar vid återupptagning; håll Esc och kontrollera att overlayn inte blinkar; håll höger-knapp, pausa, släpp, återuppta: katten står still.
- **Risk:** Låg.
- **Status:** GODKÄND

### B-008 - Pausknapp på touch, pausstate nollställs vid banbyte, "Avsluta körning" sparar statistik
- **Bakgrund:** A1-046, A1-048, A1-047, delvis A1-060 (deaths).
- **Ändring:**
  - **Pausknapp:** ny knapp i HUD-raden (≈5950-5985, i blocket med `pointer-events-auto`), ikon `pause`, `aria-label="Pausa"`, träffyta minst 44x44 px, `onClick={togglePause}`. Dold när `showLevelComplete`. Visas på alla enheter (hjälper även mus).
  - **isPaused-läckage:** i byggeffekten (2565-2570, där `levelStartRef` sätts) anropa `setIsPaused(false); isPausedRef.current = false;`. I `setKeyState`: `if (!game.running && [27,80].includes(code)) return;` så att Esc/P på banresultatet inte pausar.
  - **Avsluta:** ny funktion `quitRun` i PlayingView: `persistRunSummary(game, false)` (om `gameRef.current` finns och `running` eller pausat; vid banresultat är det redan sparat på 5403) och därefter `onEnd(score, runFishTotal(), { quit: true })`. Knapparna 6044 och 6093 anropar `quitRun`, och 6044 döps om till "Avsluta körning" (6093 heter redan "Avsluta"). `App.handleGameEnd` (App.tsx:81-85) tar emot valfri `quit` och lagrar i ny state `lastQuit`; `GameOverView` (812) får valfri prop `quit?: boolean`: `deaths: quit ? 0 : 1` (≈866) och rubriken "Körning avslutad" i stället för "Uppdraget misslyckades". Poäng kan fortfarande sparas på topplistan.
- **Berörda filer:** components/Views.tsx (HUD ≈5950-5985, byggeffekt ≈2565-2570, `setKeyState` 2481-2503, nya `quitRun` nära `persistRunSummary` 2425, knappar 6044/6093, GameOverView 812-905), App.tsx (81-85, 99-100).
- **Verifiering:** `npm run build`. Manuellt: tryck pausknappen med touch-emulering; pausa och tryck "Avsluta körning" efter att ha dödat en fiende, kontrollera att Game Over visar rätt kills/fiskar och att `totalDeaths` inte ökar (ProgressContext stats i devtools Application, localStorage); tryck Esc på banresultatet och bekräfta att nästa bana startar utan paus.
- **Risk:** Låg-medel (rör App.tsx-signatur, men `quit` är valfri så andra anrop påverkas inte).
- **Status:** GODKÄND

### B-009 - Meta-progression light: bästa nivå och rekord på Game Over och startskärm
- **Bakgrund:** A1-050, A1-064 (dödsorsak, valfri liten del).
- **Ändring:**
  - Lägg till `level: game.level` i objektet som `persistRunSummary` skriver (2425-2438). Nytt fält i `shadow_paw_last_run`; GameOver läser det med `lastRun.level || 1`.
  - Ny localStorage-nyckel `shadow_paw_best` = `{ level, score, runLevel }`. Ingen ändring av `PlayerProgress`, `stats` eller `shadow_paw_scores`, så gamla sparningar och export/import berörs inte.
  - GameOverView (812-1011): läs `shadow_paw_best` en gång i `useState`-initiator (som `bestBefore` på 832-841), visa "Nådde nivå X" och, om bättre, "Ny bästa nivå!" med delta ("Bästa: 11, +2"). Skriv det nya rekordet i det befintliga engångsblocket (`didFinishRef`-skyddat, ≈850-900) så StrictMode inte dubblar. Visa även "Dödsorsak" om en kort enradig etikett går att läsa ur `shadow_paw_telemetry` (valfritt, hoppa över om det blir stort).
  - StartMenuView (231-): visa "Bästa nivå X · Bästa poäng Y" under titeln när sådana finns (inget visas för nya spelare). Försiktig parse med try/catch och typkontroll.
- **Berörda filer:** components/Views.tsx (persistRunSummary 2425, GameOverView 812-1011, StartMenuView ≈231-330).
- **Verifiering:** `npm run build`. Manuellt: spela till nivå 2-3 och dö, kontrollera Game Over och startskärm; ta bort `shadow_paw_best` i devtools och bekräfta att inget kraschar; spela med gammal localStorage (utan nyckeln) utan fel; gör samma i StrictMode (dev) och bekräfta att rekordet inte skrivs fel.
- **Risk:** Låg.
- **Status:** GODKÄND

### B-010 - Banpickups: extraliv (hjärta) och sköld, med tydlig feedback
- **Bakgrund:** A1-051 (Hög). Följer VISION: risk/belöning utan pay-to-win.
- **Ändring:**
  - Ny `game.pickups: []` i `setupLevel` (nära `fishes: []`, 1827). Efter fiskplaceringen (≈2225) lägg 0-2 pickups per bana, på toppen av redan genererade, nåbara plattformar (samma metod som fisk, `platforms[idx].y - 36`, inte ground, inte över hål): hjärta på nivå som är delbar med 3 (inte bossbana), sköld på nivå ≥ 4 (en per bana). Placering med `seededRandom(level * 31.7 + n)` så att det inte flyttar `Math.random()`-sekvensen i befintlig generering (viktigt: lägg koden *efter* all befintlig generering).
  - Plockning i simuleringen intill fiskkollisionen (≈3243-3262): hjärta `game.lives = Math.min(5, game.lives + 1)` (`setLives` synkas på 5794; kalla även `setLives(game.lives)` som på 5405), sköld `invincible = true; invincibleTimer = 300`. Toast via `pushToast` ("+1 LIV" / "SKÖLD 5 S"), `AudioEngine`-ljud som redan finns (återanvänd t.ex. level-up/collect-ljud, inget nytt ljud krävs), haptik (`navigator.vibrate`, redan använd i `fireBullet`), partiklar via befintlig partikelfunktion, och `screenShake` bara om `!reduceMotion`.
  - Ritning bredvid fiskritningen (5324-): enkel pulserande hjärta/sköld med glöd (ctx-former, inga bilder, inga nya filer), culling som för fisk (`fxs < -50 || > width+50`).
  - Hjärtat räknas inte som fisk (ingen ändring i `fishes`/`allFishesCollected` 5382-5387 och inte i `noHit`).
- **Berörda filer:** components/Views.tsx (setupLevel ≈1714-1850 för fältet, generering ≈2225, simulation ≈3243, ritning ≈5324, HUD-livsvisning oförändrad).
- **Verifiering:** `npm run build`. Manuellt: spela nivå 3 (hjärta) och 4+ (sköld); kontrollera att livsräknaren i HUD ökar direkt, att tak 5 respekteras, att pickups sitter på plattformar man kan nå, att banans fisktal (x/y) inte ändras, och att bossbanor (5, 10) inte får pickups. Ett skript-/devtools-test som listar `game.pickups` och plattformsnivåerna är bra. Kontrollera att `reduceMotion` tonar ner skak.
- **Risk:** Medel (rör genereringsslutet och simuleringen, men additivt; hålls litet genom att bara använda plattformar som redan finns).
- **Status:** GODKÄND

### B-011 - Banregel per bana ("Guldrush" och "Månsvävning") utan ändring av banagenereringen
- **Bakgrund:** A1-052 (Hög), A1-054 (liten del: tydlig indikator).
- **Ändring:**
  - I `setupLevel` (1714-1850), efter att `game` skapats: välj `game.rule` deterministiskt: `level >= 3 && level % 5 !== 0` och `seededRandom(level * 29.3)`: ca 45 % `NONE`, 28 % `GOLDRUSH` (fiskpoäng x2 via `registerCombo`/poängraden vid fiskplockning ≈3257, men fiender +15 % fart: multiplicera `velocityX` en gång efter fiendegenerering, ≈2064), 27 % `MOON` (`game.gravity *= 0.82`, bara om `levelMode !== 'Speed Run'`, 1754-1760, svävande hopp och längre bågar; inget straff).
  - Visa regeln med en toast vid bansstart (`pushToast`, 2412-) och en liten tagg i HUD bredvid `EVENT {stats.miniEvent}` (≈5992); lägg `rule` i `setStats` (≈5770-5780).
  - Ingen ändring av platformsgenerering, hål, fiender eller `Math.random()`-användning. Befintligt `miniEvent` lämnas orört (regler och miniEvent kan samexistera; undvik `MOON` när `miniEvent.type === 'LOW_GRAVITY'` för att inte dubbla).
- **Berörda filer:** components/Views.tsx (setupLevel ≈1714-1850, fiskplockning ≈3257, HUD ≈5992, stats-uppdatering ≈5770).
- **Verifiering:** `npm run build`. Manuellt: starta nivå 3, 4, 6, 7, 8, 9 (hoppa via devtools eller spela) och bekräfta att samma nivå får samma regel vid omstart; kontrollera att bossnivå och Speed Run inte får `MOON`; kontrollera poängökning x2 i GOLDRUSH och att banan går att klara.
- **Risk:** Låg-medel (påverkar balans men inte struktur; lätt att slå av med `game.rule = 'NONE'`).
- **Status:** GODKÄND

### B-012 - Rätta kontoförmånerna nivå 10 och 15 (dubbel +2 ammo, "Vaksintinkt")
- **Bakgrund:** A1-020.
- **Ändring:**
  - Ta bort den dubbla ammo-bonusen: behåll `if (progress.level >= 10) game.ammo += 2;` (1843) och ta bort `(progress.level >= 10 ? 2 : 0)` ur ammo-uttrycket (1749). Spelare på kontonivå 10+ får därmed en bonus på +2 i stället för +4 (avsiktligt; texten i butiken/skill tree säger "+2 skott" om den finns, kontrollera 6205-6209).
  - Gör nivå 15-förmånen verklig: ersätt `invincibleTimer = 20` (1844) med `game.player.invincible = true; game.player.invincibleTimer = 120;` (2 sekunders startskydd i varje bana). Texten på 6209 kompletteras med "2 s startskydd".
- **Berörda filer:** components/Views.tsx (1749, 1843-1844, 6209).
- **Verifiering:** `npm run build`. Manuellt: sätt `progress.level` till 10 och 15 via importerat sparat tillstånd eller devtools och kontrollera ammo i HUD vid banstart (+2, inte +4) och att katten blinkar (5549) i 2 s på nivå 15 utan att ta skada.
- **Risk:** Låg (tydlig nerf av ammo för höga nivåer; flaggas för ägaren).
- **Status:** GODKÄND

## Fria idéer för framtiden (ej med i byggplanen)

- **Mynt vid banslut (A1-009/A1-045b):** bokför mynt först när banan klaras; löser både farming via omstart och localStorage-skrivning per fisk.
- **Välj ett av tre runuppgraderingar** vid runnivå-upp (dubbel dash, studsande skott, högre combo-tak) som roguelite-lager ovanpå B-010.
- **Checkpoint mitt i långa banor** och "andra chansen" (A1-055); bör vänta tills B-009 visar var spelare faktiskt dör.
- **Daglig seedad bana** med lokal rekordtavla och streak (A1-057), kräver att banagenereringen byter från `Math.random()` till seedat, ett eget block.
- **Prestationsvy** (A1-044) med redan befintliga achievements; billigt och ger mål.
- **Auto-sikte på touch** (A1-053): minsta möjliga kon-assist mot närmaste fiende.
- **Update/render-uppdelning med interpolation** (A1-007/A1-061) och gradient-cache (A1-063): störst teknisk vinst, men stor diff, bör föregås av A1-014 (uppdelning av Views.tsx) och mätning.
- **Combo-slut-feedback** (A1-054): "COMBO FÖRLORAD" och ljud.
- **Telemetri till nytta:** visa "Din vanligaste död" och använd för balans (A1-064).
- **Pekkontroll-val i Inställningar** (Auto/På/Av, A1-059) och landskaps-uppmaning/safe-area (A1-062).
- **Ljud/haptik-palett:** unikt ljud per pickup och per banregel när B-010/B-011 är inne.

---
Omgång 2 godkänd av orkestratören å ägarens vägnar 2026-10-20 (ägarens uttryckliga förhandsgodkännande i chatten: agenterna får fritt förbättra ShadowPaw). Notera B-012: kontoförmånen på nivå 10 går från +4 till +2 ammo.
