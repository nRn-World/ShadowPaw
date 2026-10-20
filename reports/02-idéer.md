# 02 - Idéer och byggplan (Agent 2, Idégranskare), omgång 3

Datum: 2026-10-20. Branch `agents/build-20261020-r2`. Underlag: `reports/01-analys.md` (omgång 3), `reports/VISION.md`, och kontrollläsning av `components/Views.tsx` (6636 rader) och `App.tsx`. Ingen kod har körts eller ändrats. Radnummer avser nuvarande `Views.tsx` om inget annat anges.

## Bedömning av Agent 1:s rapport

Stämmer (verifierat mot koden):
- **A1-065:** HUD-knapparna (paus 6140-6148, mute 6149-6161, fullskärm 6162-6169) är `<button>` utan `blur()`. Fönstrets `keydown` (2678-2683) ropar `setKeyState(32)` utan `preventDefault`, så Mellanslag ger både hopp och en `click` på den fokuserade knappen. Bugg bekräftad (webbläsarbeteendet är standard men inte provkört).
- **A1-066:** `game.lives = Math.min(5, game.lives + 1)` (3352) med start 5 liv (1640). Toasten "+1 LIV", ljud och partiklar spelas även när inget ökar. Bekräftat.
- **A1-069:** `registerCombo(game, 50, ...)` (3390) följt av platt `game.score += 50` (3391). Bonusen blir bara en riktig x2 utan combo/multiplikator. Bekräftat. Etiketterna står på 2357 och 6129.
- **A1-072/A1-075:** runnivå ger bara +2 skott och +500 poäng (`grantXp` 2472-2484). `trackDeathCause` (2527-2546) skriver bara telemetri; orsaken når aldrig Game Over. Bekräftat.
- **A1-067:** pickups (2264) och banregel (2349) beror bara på `level`. `seededRandom` (1297-1300) är en `sin`-hash. Bekräftat.
- **A1-068/A1-061:** mål/banslut ligger i ritdelen (5557-5586) och `Date.now()` används för blink (5716). `loop` är 5969-5988 (A1 anger 5966-5985, en liten avvikelse).

Fel eller överdrivet:
- **A1-070 (överskrivning av sköld):** påståendet att träff kan förkorta en pågående sköld stämmer inte. Alla träffgrenar (fiende 3069, bossprojektil 3217, bosskontakt 3242, hazard 3271) är skyddade av `!game.player.invincible`. Den enda riktiga överskrivningen är Speed Run-tidens utgång (2921-2922, sätter 90 oavsett) och nivå 15-förmånen (1880, bara vid start). Skölden skyddar dessutom inte mot hål (3312-3326, ingen kontroll). Att indikator saknas stämmer.
- **A1-072 radhänvisningar:** "2658-2661, 2399-2411" är fel. Runnivå-upp sker i `grantXp` (2472-2484); 2658-2661 är `levelStartRef`/`setupLevel`. Runnivå följer med mellan banor via `runStatsRef` (1666-1685), vilket A1 har rätt i.
- **A1-066 "bärs över banor":** rätt, men start-liv och tak är 5 även för `levelStartRef` (1659); ingen kontonivåförmån höjer taket. Förslaget "höj tak till 6" skulle röra sparformat/balans och tas inte med.
- **A1-055 (höjd prioritet):** rimlig men mer riskfylld än rapporten antyder, eftersom checkpoint måste samspela med `levelStartRef` (2658-2661), poäng, mynt (A1-045b) och återstartslogiken. Därför flyttad till fria idéer.

## Byggplan

Ordning: B-013 till B-015 är små reparationer (oberoende av varandra, B-015 före B-016). B-016 är omgångens "en runda till"-mekanik. B-017 och B-018 är små tillägg. Varje punkt ska byggas, granskas och verifieras med `npm run build` samt manuell spelkontroll. `npx tsc --noEmit` kan köras lokalt som jämförelse (antal fel före/efter; inget skript läggs till och inga beroenden).

### B-013: HUD-knappar ska inte fånga Mellanslag/Enter
- **Bakgrund:** A1-065.
- **Ändring:** I `PlayingView` (HUD ca 6139-6170) anropa `e.currentTarget.blur()` efter klick på paus-, mute- och fullskärmsknappen, och lägg `tabIndex={-1}` på de tre knapparna så de inte nås av Tab under spel. Pausdialogens knappar (6227-6229) lämnas som de är, eftersom de avmonteras. Rör inte tangenthanteringen (2568-2597). Tillgänglighet: `aria-label`/`title` behålls; tangentbordsanvändare pausar fortsatt med Esc/P.
- **Berörda filer:** `components/Views.tsx` (ca 6139-6170, HUD i `PlayingView`).
- **Verifiering:** `npm run build`. Manuellt: klicka paus, tryck Fortsätt, tryck Mellanslag flera gånger och bekräfta att hoppet fungerar och spelet inte pausas. Samma för mute och fullskärm. Kontrollera att touchskärmen fortfarande kan pausa (tryck på paus).
- **Risk:** Låg.
- **Status:** GODKÄND

### B-014: Hjärta vid full liv ger belöning, Guldrush ger verklig x2
- **Bakgrund:** A1-066 och A1-069 (två små, oberoende ändringar i samma block, en diff vardera om granskaren vill).
- **Ändring:**
  1. Hjärta (3351-3354): om `game.lives >= 5`, ge `game.score += 500` och `grantXp(game, 15)`, toast "FULL HÄLSA +500" (färg som hjärtat), och inga mynt (undviker farmning via banomstart, jfr A1-045b). Annars som idag. "+1 LIV" visas bara när liv faktiskt ökar. Ljud/partiklar behålls.
  2. Guldrush (3390-3391): mät `const before = game.score;` före `registerCombo(...)`, och vid `GOLDRUSH` lägg `game.score += game.score - before` efter. Det gör att hela fiskvinsten (bas + combo + multiplikator) dubblas. Etiketterna (2357 toast, 6129 HUD-chip) säger redan "x2" och behöver inte ändras. Combo-räknare och flytande text rörs inte.
- **Berörda filer:** `components/Views.tsx` (pickup-loopen 3342-3372 och fiskinsamling 3387-3395, i `simulate()` inuti `PlayingView`).
- **Verifiering:** `npm run build`. Manuellt: spela nivå 3 med full liv och plocka hjärtat (poäng +500, ingen "+1 LIV"); tappa ett liv och plocka hjärtat (liv +1 och "+1 LIV"). På en Guldrush-nivå (kontrollera att regeln visas) jämför poängökning per fisk mot en vanlig nivå vid combo 1 (ska ~dubbleras) och vid högre combo (ska också dubbleras). Se att poängen inte hoppar orimligt i HUD.
- **Risk:** Låg. Balans: Guldrush blir lite mer givande vid hög combo; acceptabelt eftersom etiketten lovar x2.
- **Status:** GODKÄND

### B-015: Egen sköldindikator (tydlig aura och HUD-nedräkning)
- **Bakgrund:** A1-070 (korrigerad: ingen träffoverskrivning, men Speed Run-tidens utgång kan förkorta skölden).
- **Ändring:**
  1. Lägg `shieldTimer: 0` i `player` i `setupLevel` (ca 1854). Sköldpickup (3355-3359) sätter `pl.shieldTimer = 300` och behåller `invincible = true; invincibleTimer = Math.max(invincibleTimer, 300)`. I uppdateringen vid 3308 minskas `shieldTimer` ett steg per frame när > 0.
  2. Ritning vid 5716: blinka inte när `shieldTimer > 90`; rita en cyan ring/aura runt katten (en `arc`, ingen ny gradient per frame) som blinkar sista 1,5 s. Efter träff (egen `invincibleTimer`) fungerar blinket som förut.
  3. HUD: nytt fält `shield` (sekunder, `Math.ceil(shieldTimer/60)`) i `stats` (1695, 5935) och ett chip bredvid regelchipet (6126-6132) som visas när > 0. Samma stil som övriga chips, text minst 12 px.
  4. Speed Run-utgång (2921-2922): använd `Math.max(invincibleTimer, 90)` så en aktiv sköld inte förkortas.
- **Berörda filer:** `components/Views.tsx` (`setupLevel` ca 1854; stats 1695 och 5934-5961; pickup 3355-3359; 3308; ritning ca 5716; HUD 6119-6132).
- **Verifiering:** `npm run build`. Manuellt: plocka sköld på nivå 4+, bekräfta aura, nedräkning 5 till 1 i HUD och blink de sista sekunderna; bekräfta att man är osårbar exakt så länge. Ta träff efter skölden: normalt blink. Speed Run med tidens utgång under sköld: skölden förkortas inte. Reduce-motion: ingen extra skakning läggs till.
- **Risk:** Låg.
- **Status:** GODKÄND

### B-016: Välj en av tre uppgraderingar per runnivå ("en runda till")
- **Bakgrund:** A1-072 (Hög), A1-051/A1-073 (variation i körningar). Bygg efter B-015.
- **Ändring:** Varje gång runnivån höjts får spelaren välja en uppgradering på **banresultatskärmen** (inte mitt i spelet, så ingen ny pausfas, inget inputproblem och inga timers). Antal val att göra = `levelSummary.runLevel - 1 - perks.length`, begränsat av antal kvarvarande uppgraderingar. Inga pengar, ingen ekonomi, ingen betalning: rena körningsval som nollställs vid ny körning.
  1. Konstant `RUN_PERKS` nära `readBestRecord` (ca 230-240), fem uppgraderingar: `LONG_COMBO` (combo-fönster 150 till 210 frames, `registerCombo` 2437-2440 och jämförelsen mot 150 i `comboFrac` 5942 oförändrad via `Math.min(1, ...)`), `FAST_DASH` (dashCooldown 45 till 30, `triggerDash` 2416), `AMMO_START` (+3 skott vid banstart, `setupLevel` ca 1784), `MAGNET` (fiskens träffruta utvidgas med 36 px per sida, 3388-3389), `SHIELD_START` (3 s sköld vid banstart via `shieldTimer = 180` från B-015, ca 1880). Alla fem är små en-raders effekter som läser `game.perks`.
  2. `runStatsRef` (1666-1670) får `perks: [] as string[]`. `setupLevel` kopierar den till `game.perks` (ca 1816-1819). Valen sparas bara i `runStatsRef`; inga nya localStorage-nycklar, ingen ändring i ProgressContext eller sparformat. En omstart av bana (`restartCurrentLevel` 1689-1693) behåller perks eftersom valen görs före banan startar.
  3. UI i banresultatet (6234-6281): när val återstår visas tre kort (ikon, svensk titel, en rad förklaring, `button` med minst 48 px träffyta) dragna ur kvarvarande uppgraderingar (`Math.random()` räcker). "NÄSTA NIVÅ" (6273) är `disabled` tills alla val är gjorda; "Avsluta" fungerar alltid. Efter val visas en rad med valda uppgraderingar. Ingen autofokus (undviker Mellanslag-problem, jfr B-013). Listan med valda uppgraderingar visas även i pausdialogen (6222-6232), en rad.
  4. Toast "UPPGRADERING VÄNTAR" (via `pushToast`) vid runnivå-upp i `grantXp` (2481), så spelaren vet att något väntar.
- **Berörda filer:** `components/Views.tsx` (konstant ca 230-240; `runStatsRef` 1666-1670; `setupLevel` ca 1784/1816-1819/1880; `triggerDash` 2410-2418; `registerCombo` 2437-2469; `grantXp` 2472-2484; fisk 3387-3389; banslut 5557-5586 `setLevelSummary`; overlay 6234-6281 och 6222-6232). Eventuellt ett litet `useState` för valda perks så kortet uppdateras.
- **Verifiering:** `npm run build`. Manuellt: spela till runnivå 2 och klara banan, kontrollera att tre kort visas, att "Nästa nivå" är låst tills ett valts, att valet syns i nästa bana (dash snabbare, magnet fångar fisk lite längre bort, +3 skott, 3 s sköld, längre combo). Starta ny körning: valen är borta. Starta om bana mitt i: valen finns kvar. Död: ingen krasch, ingen skrivning till localStorage. Testa att kvarvarande val blir korrekt om två runnivåer togs på en bana.
- **Risk:** Medel (ny UI-state i banresultatet och flera små hakar i simulate; ingen ändring av sparformat). Håll varje effekt bakom `game.perks.includes(...)` så en bugg bara drabbar den enskilda uppgraderingen.
- **Status:** GODKÄND

### B-017: Visa dödsorsak och tips på Game Over
- **Bakgrund:** A1-075 (B-009 hoppade över den).
- **Ändring:** Ny `lastDeathCauseRef = useRef<string | null>(null)` i `PlayingView` (nära 1666). `trackDeathCause` (2527-2546) sätter `lastDeathCauseRef.current = cause` (anropas redan bara vid sista döden: 2911, 3127, 3233, 3262, 3299, 3322, alltid före `persistRunSummary`). `persistRunSummary` (2511-2525) lägger till `deathCause: lastDeathCauseRef.current` i `shadow_paw_last_run` (befintlig nyckel, ett nytt fält, gammal data utan fältet fortsätter fungera). I `GameOverView` (läser `lastRun` vid 841-847): om `!quit` och orsak finns, visa en rad med ikon och ett svenskt tips under "Nådde nivå" (1016-1021), t.ex. enemy: "Hoppa på fiender uppifrån eller skjut dem", hazard: "Vänta in lasern och hoppa över", hole: "Använd dubbelhopp och dash över hål", timer: "Samla fisk i en jämn takt, tiden tar slut", boss: "Rör dig och undvik projektilerna, skjut när bossen stannar". Okänd orsak: ingen rad. Ingen ändring av telemetrin eller `applyRunResults`.
- **Berörda filer:** `components/Views.tsx` (`PlayingView` ca 1666, 2511-2546; `GameOverView` 841-847 och 1016-1021).
- **Verifiering:** `npm run build`. Manuellt: dö på varje sätt (fiende, hazard, hål, boss, Speed Run-tid) och bekräfta rätt rad; avsluta körning via paus: ingen orsak visas; starta om direkt efter Game Over och döda på ny orsak: ingen kvarglömd gammal orsak (ref skapas per körning och `shadow_paw_last_run` rensas redan vid 933).
- **Risk:** Låg.
- **Status:** GODKÄND

### B-018: Variation mellan körningar (runSeed för banregel och pickups)
- **Bakgrund:** A1-067 (smal del), grund för framtida daglig utmaning (A1-057).
- **Ändring:** Lägg till `mulberry32(seed)` (tio rader, ingen beroende) bredvid `seededRandom` (1297-1300), och `runSeedRef = useRef(Math.floor(Math.random() * 2**31))` i `PlayingView` (nära 1666; en seed per körning, så omstart av en bana ger samma regel/pickups). Byt endast de två seedade ställena: pickupplacering (2264) och banregelrullen (2349) så att de använder `mulberry32(runSeed ^ Math.imul(level, 2654435761))` i stället för `seededRandom(level * ...)`. All annan generering (layout, fiender, hål, väder, miniEvent 1805) lämnas orörd, och `Math.random()`-sekvensen ändras inte (pickup/regel-blocken ligger redan efter övrig generering, 2252-2253 och 2346). Villkoren för regel (nivå >= 3, inte bossnivå, inte Speed Run för MOON, inte LOW_GRAVITY) och pickuptyp (nivå % 3, nivå >= 4) ändras inte. Fördelning ~28 % GOLDRUSH, ~27 % MOON oförändrad.
- **Berörda filer:** `components/Views.tsx` (ca 1297-1300, 1666, 2254-2272, 2346-2359).
- **Verifiering:** `npm run build`. Manuellt: starta flera körningar, jämför vilken regel nivå 3/6/7 får (ska variera mellan körningar), upprepa en bana med "Starta om bana" (ska ge samma regel/pickups), kontrollera att hjärta/sköld alltid ligger på nåbara plattformar (samma kandidatfilter) och att inga pickups saknas efter ändringen.
- **Risk:** Låg. Mindre balansrisk: en specifik nivå kan nu få en regel den aldrig fick förut. Om granskaren bedömer detta som riskabelt kan punkten strykas utan att övriga påverkas.
- **Status:** GODKÄND

## Fria idéer för framtiden (ej med i byggplanen)

Högrisk eller för stora för en körning. Ingen av dessa är godkänd och de ska inte byggas utan separat granskning.

- **Checkpoint inom bana (A1-055).** Risk Medel-Hög. Flagga ca 50 % in; vid död återställ position men behåll fiskar. Kräver omarbetning av `levelStartRef` (2658-2661), liv/poäng/mynt (A1-045b) och mål-/bosskontroller. Börja med "Fortsätt från bana X efter boss" som enklaste variant, med lokal nyckel `shadow_paw_checkpoint`. 
  - **Status:** FÖRESLAGEN
  - **Risk:** Hög (tills den avgränsats)
- **Update/render-delning med interpolation (A1-061, A1-068, A1-063).** Flytta ritning ut ur `simulate()` (ca 3420-5930), flytta banslutslogik (5557-5586) till update, ersätt `Date.now()` med frame-räknare. Största tekniska vinsten för 120/144 Hz och svaga telefoner, men rör ca 2500 rader. Bör ske i flera steg (1: bara flytta banslutslogiken; 2: dela ritning; 3: interpolation).
  - **Status:** FÖRESLAGEN
  - **Risk:** Hög
- **API-nyckeln i bundeln (A1-001, vite.config.ts:14-16).** Ta bort `define` och låt `getJerryTaunt` falla tillbaka på lokala repliker, alternativt proxy bakom serverlös funktion. Kräver beslut av ägaren om Gemini-funktionen ska finnas kvar (inga borttagna funktioner utan godkännande).
  - **Status:** FÖRESLAGEN
  - **Risk:** Hög
- **Dagens bana (A1-057).** Seedad bana med lokal rekordtavla `shadow_paw_daily_YYYYMMDD` och dagsstreak. Kräver att layout/fiende/hål-generering (113 `Math.random()` i filen, varav en del i `setupLevel` 1897-2345) byter till en lokal PRNG. B-018 lägger grunden.
  - **Status:** FÖRESLAGEN
  - **Risk:** Hög
- **Fler banregler (A1-074):** ISGLID (låg `friction`, 1791), VIND (konstant kraft), MÖRKER (vinjett), samt regelkort i 2 s vid start. Går att göra som en regel per körning efter B-018.
- **Fler uppgraderingar i B-016-poolen:** studsande skott, dubbel dash, längre sköld, poängbonus för "nästan"-träffar. Lägg till en i taget.
- **Kontoförmåner efter nivå 15 (A1-073):** nivå 20/25/30 (t.ex. startsköld, dubbelhoppsfönster), kosmetiska mynt-sänkor (svansspår, partiklar), prestationslista (A1-044).
- **Mobil:** porträttläge/kompakt HUD, safe-area, minst 12 px text (A1-062), auto-sikte på touch (A1-053), haptik per händelse (A1-077).
- **HUD-render (A1-076):** memoisera HUD eller skriv direkt till DOM via refs; uppdatera bara vid värdeförändring.
- **Ljud och känsla:** distinkt ljud/färgläge per uppgradering, kort "ghost"-skugga av bästa tidigare körning (skuggmekanik som unik identitet), "nästan"-effekt vid 1 liv kvar (pulserande kant, ingen blinkande flash för ljuskänsliga: respektera `reduceMotion`).
- **Retention utan mörka mönster:** veckovisa uppdrag som aldrig förfaller med straff, en "mitt bästa"-historik på startskärmen (sista 5 körningarna lokalt).
- **Tekniskt:** lägg `typecheck`-skript i `package.json` (A1-013), inga nya beroenden behövs eftersom `typescript` redan finns som devDependency.

---
Omgång 3: B-013...B-018 godkända av orkestratören å ägarens vägnar 2026-10-20 (ägarens uttryckliga förhandsgodkännande i chatten). Punkterna under "Fria idéer" är högrisk och förblir FÖRESLAGEN.
