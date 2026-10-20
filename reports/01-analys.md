# 01 - Analys av ShadowPaw (Agent 1, Analytiker), omgång 3

Datum: 2026-10-20. Branch `agents/build-20261020-r2` (HEAD a44ebd9, innehåller B-001...B-012). Underlag: omgång 1 och 2:s fullständiga läsning samt riktad granskning av omgång 2:s ändringar (B-007...B-012) i `components/Views.tsx` (nu 6636 rader) och `App.tsx`. Radnummer avser nuvarande filer. Ingen kod har körts eller byggts; allt bygger på kodläsning.

## Sammanfattning

1. Omgång 2 åtgärdade verifierat A1-045, A1-046, A1-047, A1-048, A1-049, A1-050 (delvis), A1-051 (delvis), A1-052 (delvis), A1-020, A1-060 (delvis). Inga allvarliga regressioner hittades, men två nya buggar: pausknappen kan avpausas av Mellanslag/Enter när den har fokus (A1-065) och hjärtan är värdelösa vid full hälsa (A1-066).
2. Banregler, pickups och rekord är deterministiska per nivånummer (`seededRandom(level*...)`), så varje körning möter samma regel/pickup på samma nivå: variationen mellan körningar är fortfarande låg (A1-067).
3. Största kvarvarande luckor mot "en runda till": inga checkpoints (A1-055), ingen daglig seedad utmaning (A1-057), ingen val-ett-av-tre-uppgradering/runbuild (A1-051), ingen auto-sikte på touch (A1-053), banlayout slumpas med `Math.random()` (A1-052).
4. Tekniskt är ritning inne i `simulate()` (A1-007/A1-061) och hela spellogik-delar i ritkoden (A1-068) största risken; mobilens porträttlayout är oförändrad (A1-062).
5. Säkerhet oförändrad: Gemini-nyckeln bakas in i bundeln (vite.config.ts:14-17, A1-001).

## Status för tidigare fynd (verifierat mot koden)

| ID | Status | Belägg |
|----|--------|--------|
| A1-001 | Kvarstår (Hög) | vite.config.ts:14-16 `define` med `env.GEMINI_API_KEY`. |
| A1-002...A1-006 | Åtgärdade tidigare (se omgång 2) | Oförändrat. |
| A1-007...A1-014 | Kvarstår | Ritning ligger kvar i `simulate()` (ritning från ca 3420 till 5930, `loop` 5966-5985 kör upp till 5 steg). Ingen ändring i ProgressContext, vite.config, package.json (`scripts` har bara dev/build/preview, ingen typecheck/lint/test), workflow. |
| A1-020 | Åtgärdad | Ammo +2 vid kontonivå 10 bara en gång (Views.tsx:1879). Nivå 15 ger `invincible = true; invincibleTimer = 120` (1880). Obs: avsiktlig nerf, fortfarande ingen förmån efter nivå 15 (A1-051). |
| A1-045 | Åtgärdad | `requestJump` 2368, `fireBullet` 2600 och `setKeyState` 2580 kontrollerar `isPausedRef`; uppsläpp rensar alltid (2581). `triggerDash` ej omläst rad för rad men loggen anger samma kontroll. |
| A1-045b | Kvarstår | Mynt behålls vid omstart av bana (`awardCoins` 2493-2496 skriver direkt via `addCoins`), `coinsThisLevel` nollställs: farmning möjlig. |
| A1-046 | Åtgärdad | Pausknapp 6137-6148 (44x44, `aria-label`), dold på banresultat. Se A1-065 för ny bugg. |
| A1-047 | Åtgärdad | `quitRun` 2500-2509, `onEnd(..., { quit: true })`, App.tsx:82-83, 102; Game Over skickar `deaths: quit ? 0 : 1` (Views.tsx:~901). Begränsning: `game.score` (banans poäng) används vid avslut mitt i bana (loggen), ej `totalScore`. |
| A1-048 | Åtgärdad | Esc/P ignoreras om `!game.running` (2571); `setIsPaused(false)` i effekten (2665-2666). |
| A1-049 | Åtgärdad | `e.repeat` filtreras för 27/80/70/74/90/17 (2680). Kvarstår: `keyCode` (föråldrat, A1-023). |
| A1-050 | Delvis åtgärdad | `shadow_paw_best` 231-240, 891-896 med `level/score/runLevel`, "Ny bästa nivå" på Game Over, rekord på start. Saknas: val av startnivå/checkpoint, "nästan"-mål (A1-055). |
| A1-051 | Delvis åtgärdad | Hjärta/sköld finns (2252-2272, 3343-3372, ritning 5456). Saknas: magnet, tidsfrys, runuppgraderingar, förmåner efter nivå 15. |
| A1-052 | Delvis åtgärdad | Banregler GOLDRUSH/MOON (2346-2359). Layout/fiender/hål använder fortfarande `Math.random()`. |
| A1-053...A1-057, A1-059, A1-061...A1-064 | Kvarstår | Ingen ändring i dessa områden (fire utan mål 2611-2614; `isTouchDevice` engångsmedia; osv.). |
| A1-058 | Kvarstår | Butikens Fart har inget tak i UI. |
| A1-060 | Delvis | `quit`-delen löst; omstartstangenter på Game Over har fortfarande ingen fördröjning (ej omgranskat, antas oförändrat). |

## Nya fynd (omgång 3)

Prioritet: Hög = bryter funktion/datakorrekthet eller avgörande för visionen. Medel = märkbar brist. Låg = polish.

### Granskning av omgång 2 (regressioner/nya buggar)

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-065 | Medel | Views.tsx:6137-6148, 2574-2578 | Pausknappen är en `<button>` som behåller fokus efter klick. Därefter triggar Mellanslag/Enter (hopptangenten) knappens `click` och därmed `togglePause`; spelaren som klickat paus och trycker Mellanslag för att fortsätta kan få spelet att pausas/avpausas oväntat, och under spel med fokuserad knapp pausar hopp. Samma gäller mute- och fullskärmsknapparna (6150-6170). Sannolikt, ej provat i webbläsare. | `onClick={(e) => { togglePause(); e.currentTarget.blur(); }}` eller `onKeyDown preventDefault` för Space/Enter; samma för mute/fullskärm. Alternativt `tabIndex={-1}` på spel-HUD-knappar. |
| A1-066 | Medel | Views.tsx:3351-3354, 1640, 2256 | Hjärta ger `Math.min(5, lives+1)` men start och tak är båda 5, och liv bärs över banor (`existingLives`). Hjärtat på nivå 3 plockas därför ofta utan effekt (toast "+1 LIV" visas ändå, ljud/partiklar spelas). Spelaren belönas inte när han är på full hälsa. | Vid fullt liv: ge poäng (+500) eller mynt eller ett "överliv" (max 6) och visa rätt toast; alternativt höj tak till 6 för kontonivå. Visa inte "+1 LIV" om inget ökar. |
| A1-067 | Medel | Views.tsx:2264, 2349, 2256-2257 | Pickups och banregel härleds enbart från nivånummer: nivå 3 har alltid samma regel/pickup-typ, och platserna väljs från en plattformslista som ändå slumpas per körning. Det motverkar "olika körning varje gång" men ger en utmärkt bas för daglig utmaning om seeden vävs in (A1-057). Dessutom `seededRandom` (1297) är `sin`-hash: korrelerar för närliggande tal och skiljer sig mellan JS-motorer i sista siffrorna (osäkert, ej testat). | Bas på `runSeed` (sparas per körning) + nivå; daglig seed = dagsnummer. Byt till en riktig PRNG (mulberry32) för portabilitet. |
| A1-068 | Medel | Views.tsx:5557-5600 (mål/banslut), 5934 (stat-uppdatering), 5716 | Spellogik ligger i ritkoden: målkontroll, banslutsbonus, `awardCoins`, `persistRunSummary` och `setShowLevelComplete` körs mitt i rendering-delen av `simulate()`; blink för oövervinnerlighet använder `Date.now()` (5716) i stället för frame-räknare. Det bryter om ritning flyttas till egen rAF-fas (A1-061) och blandar ansvar. | Flytta mål/banslut till `update()` före ritningen. Använd `game.frame` för alla animationer. Gör som del av render/update-delningen. |
| A1-069 | Låg | Views.tsx:2352-2357, 3391, 6127-6130 | GOLDRUSH-etiketten säger "x2 fiskpoäng"/"Guldrush x2", men bonusen är en platt +50 (3391) utan combo-multiplikator: efter combo x3 är bonusen mindre än dubbla fiskvärdet (`registerCombo(game, 50, ...)` multiplicerar). Poängen läggs utanför `registerCombo` så combo-mätaren/toast visar den inte. Fiender +15 % fart sker genom en engångsmultiplikation av `velocityX` (2356): patrullfiender som vänder får `*= -1` och behåller beloppet (3065), så det fungerar; bossar/flygande påverkas inte (ej verifierat). | Anropa `registerCombo(game, 100, ...)` (eller multiplicera) och visa "+bonus" i toast; ändra etikett till "Guldrush: dubbla fiskpoäng" när det stämmer. |
| A1-070 | Låg | Views.tsx:3356-3358, 5716, 6119-6132 | Sköld återanvänder `invincible` (samma blink som efter träff) utan egen indikator eller nedräkning i HUD: spelaren ser inte att skölden är slut förrän den är det. Vid träff (`invincibleTimer = 90`, 2922/3108...) kan en pågående sköld bli kortare om träffkoden skriver över timern (ej verifierat vilka grenar som kollar `!invincible`). | Egen `shieldTimer`, tydlig aura (cyan ring) och HUD-chip med sekunder; blinka bara de sista 1,5 s. Ingen timer-överskrivning. |
| A1-071 | Låg | Views.tsx:2252-2272 | Pickups placeras på plattformar `pl.width >= 80`, `x > 500`; nåbarhet bevisas bara genom konstruktion (plattformstoppar, loggen). Hjärtat ligger 36 px ovanför plattformen: plockas troligen utan hopp, så ingen risk/belöning. Plats nära hazard/fiende på samma plattform kontrolleras inte. | Placera belöningar med risk (ovanför hål, nära laser) för en tydlig kompromiss; kontrollera avstånd till `hazards`/`enemies`. |

### Progression, belöning och "en runda till"

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-072 | Hög | Views.tsx:1640, 2658-2661, 2399-2411 (runnivå), 5560 | Runnivå ger fortfarande bara +2 skott/+500 poäng; ingen "välj ett av tre"-uppgradering. En körning känns likadan varje gång, vilket är det som mest dödar "en runda till"-känslan. | Vid runnivå-upp, pausa och visa tre kort (t.ex. dubbel dash, studsande skott, +1 sköld per bana, magnet, längre combo-fönster). Lagra i `runBuffs` i `runStatsRef`, nollställ vid körning. Ingen pay-to-win: alla är rena körningsval. |
| A1-055 | Hög (höjd) | Views.tsx:1754 (banlängd), 5560, 2658-2661 | Fortfarande inga checkpoints inom långa banor och bara 5 liv för hela körningen; sen död kastar till nivå 1 (`useState(1)` för `currentLevel`). Efter B-009 syns förlusten tydligare ("Nådde nivå X, bästa Y") men det finns ingen väg att återta framsteg. | Checkpoint-flagga vid ca 50 % av banan (aktiveras vid pass, återställer liv/position men inte fiskar), samt "Fortsätt från bana X" (checkpoint var 5:e bana, kostar en klarad boss). Kräver `levelStartRef`-justering (2658). |
| A1-057 | Hög (höjd) | Views.tsx:~6480-6560 (Quests), ProgressContext.tsx:166-180; Views.tsx:2264, 2349, 1897+ | Ingen dagens utmaning som delad seedad bana, ingen dagsstreak. Pickups och regler är nu seedade (A1-067), men layout, fiender och hål använder `Math.random()` (t.ex. 2245, 2282-2332), så seedad bana kräver att all generering byter RNG. | Steg 1: ersätt `Math.random()` i `setupLevel` med lokal PRNG `rng()` initierad av `runSeed`/`dailySeed` (en mekanisk ersättning). Steg 2: "Dagens bana" på startskärmen med egen rekordtavla (lokal, `shadow_paw_daily_YYYYMMDD`), dagsstreak med kosmetisk belöning. Steg 3: dela resultat via befintlig delningsknapp. |
| A1-073 | Medel | ProgressContext.tsx:225-237, Views.tsx:1879-1880, 6380-6430 | Kontoförmåner slutar vid nivå 15 och butiken har bara tre uppgraderingar utan tak/prisökning (A1-019, A1-058). Mynt har få sänkor: efter några körningar finns inget att spara till. Skins låses upp via achievements men ingen "samla alla"-vy. | Fler förmåner (nivå 20/25/30: t.ex. dubbelhopp-fönster, startsköld, extra liv-tak), kosmetiska butiksvaror (svansspår, partiklar) som mynt-sänka, prestationslista (A1-044). |
| A1-074 | Medel | Views.tsx:2350-2359, 1897-1960 | Bara två banregler och inga banunika mekaniker (is, vind, mörker, rörliga plattformar). Regeln väljs ur en fast tabell (45 % NONE), så vissa nivåer känns identiska med tidigare. | Lägg till fler regler: ISGLID (låg friktion, kopplas till `friction` 2736), VIND (konstant kraft i 2755-området), MÖRKER (ritad vinjett runt katten), SPEGEL/INVERTERAD gravitation korta zoner. Visa regelkort vid bandstart (2 s) så spelaren förstår. |
| A1-075 | Medel | Views.tsx:2442-2457, 2527-2546, 840-905 | Dödsorsak registreras (`trackDeathCause`) men visas inte (B-009 hoppade över). "Vad dödade mig" är den enklaste mastery-kroken: spelaren ser vad som ska tränas. | Spara `lastDeathCause` i `shadow_paw_last_run`, visa ikon + en tips-rad på Game Over; använd telemetri för att tona ned den vanligaste orsaken. |

### Prestanda och rendering (extra fokus)

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-061 | Hög (höjd) | Views.tsx:5966-5985, 2698, 3420-5930 | Ritning ligger i `simulate()` och körs 0-5 gånger per rAF. På 120/144 Hz-skärmar ritas 1 av 2-3 rAF och inget interpoleras: rörelsen blir ryckig. Vid långsamma enheter ritas upp till 5 gånger per frame (onödigt dyrt: bara sista ritningen syns), vilket förvärrar tappade frames. | Dela upp i `update()` (logik, fast 60 Hz) och `render(alpha)`; kör `render` exakt en gång per rAF med interpolation av spelare, fiender, kamera (`prevX` + `alpha`). Sänk stegtaket 5 till 3. Mät före/efter med Performance-panelen. Gör detta före A1-063 och före nya visuella system. |
| A1-063 | Medel | Views.tsx:~3420-5930 | `Date.now()` ca 25 gånger per frame, nya gradienter per frame, `shadowBlur` på flera element; allt ej culled mot `scrollX` (delvis: 3543/3574 nämner förankring). | Beräkna `t` en gång, cacha gradienter/sprites i offscreen-canvas, culling, begränsa partiklar (tak). |
| A1-076 | Medel | Views.tsx:5934-5960, 1640-1660 | HUD-stats uppdateras i React-state var 250 ms (`setLives`, `setTotalScore`, `setCombo`, ett `setStats` med stort objekt): en render av hela PlayingView (stor JSX) 4 gånger/sekund, vilket skapar GC och hackar på mobil. | Dela HUD till memoiserad komponent, eller skriv direkt till DOM via refs; uppdatera bara vid värdeförändring. |
| A1-042 | Medel | Views.tsx:2647-2656 | Canvas fast 1280x720, ingen DPR-hantering: suddigt på högupplösta skärmar, onödigt tungt på små. Medvetet val kan vara motiverat. | Valbar kvalitetsnivå (Låg/Normal) i Inställningar; låg = 960x540 med CSS-skalning. |

### Mobil/porträtt och läsbarhet

| ID | Prio | Fil:rad | Problem | Föreslagen lösning |
|----|------|---------|---------|--------------------|
| A1-062 | Hög (höjd) | Views.tsx:6012-6022, 6286-6330, 6119-6132 | Spelrutan är `aspect-video` med höjd `min(78vh, (100vw-2rem)*9/16)`: på en telefon i porträtt (360 px bred) blir rutan ca 200 px hög, med HUD-kluster som tar stor del av ytan, plus knappar under. HUD använder `text-[10px]`/`text-[9px]` (t.ex. 6034, 6119-6130), svårläsligt. `viewport-fit=cover` finns (index.html:8) men ingen `env(safe-area-inset-*)` används (grep i index.css/index.html gav inga träffar). Inget "vrid telefonen"-stöd eller `screen.orientation.lock`. | Detektera porträtt (`matchMedia('(orientation: portrait)')`) och visa antingen overlay "Vrid telefonen" eller ett kompakt HUD (liv, fisk, paus; resten i ett utfällbart fält). Lägg touchknappar överlagrade på canvas i landskap, minst 48 px träffyta, min 12 px text, safe-area-padding. Pausa automatiskt vid orientationsändring. |
| A1-053 | Medel | Views.tsx:2599-2614, 6320-6330 | Touch-skott går bara åt `facing`-hållet. Ingen auto-sikte. | Auto-sikte mot närmaste fiende inom kon (assist) eller tryck-på-canvas för sikte. |
| A1-059 | Låg | Views.tsx:1662-1668 | `isTouchDevice` utvärderas en gång. | Inställning Auto/På/Av och `change`-lyssnare. |
| A1-077 | Låg | Views.tsx:6286, 2557-2566 | Haptik används för skott/pickup men inte på träff, död eller combo-tier i mobil; touchknapparnas storlek (`size-14` 56 px, dash 56 px) är OK men tre högerknappar i rad (6300-6330) ryms inte på 320 px bredd (osäkert, ej testat). | Haptiskt mönster per händelse (kort vid träff, långt vid död); testa 320 px layout; överväg dash genom svepning eller dubbeltryck. |

### Oförändrade fynd (kort)

Hög: A1-001 (API-nyckel i bundeln, vite.config.ts:14-16), A1-007/A1-061, A1-009 (mynt sparas per fisk, 2493-2496 + ProgressContext 161-164).
Medel: A1-008, A1-010, A1-012, A1-013, A1-014, A1-016, A1-017, A1-018, A1-019, A1-023, A1-025...A1-032, A1-054 (combo-feedback, mätare via React-state), A1-056 (`slowMo` ändrar inte hastighet; skak ignorerar delvis `reduceMotion`).
Låg: A1-033...A1-044, A1-045b, A1-058, A1-060, A1-064.
För fulla beskrivningar, se äldre versioner i git (commit 300b9e9 och 241f37a).

## Rekommenderad ordning att åtgärda (omgång 3)

1. **Små reparationer (en diff vardera):** A1-065 (blur på HUD-knappar), A1-066 (hjärta vid fullt liv), A1-069 (Guldrush-etikett/poäng), A1-070 (egen sköldindikator).
2. **Fundamentet för både prestanda och daglig utmaning:** A1-061 + A1-068 (update/render-delning, interpolation, flytta banslutslogik) och i en separat commit A1-057 steg 1 (lokal seedad PRNG i `setupLevel`). Båda minskar risk för senare funktioner, och bör göras när `Views.tsx` inte ändras av andra agenter (A1-014).
3. **"En runda till":** A1-072 (välj-ett-av-tre-uppgraderingar), A1-055 (checkpoint), A1-075 (dödsorsak på Game Over), A1-057 steg 2 (Dagens bana + streak + lokal tavla).
4. **Mobil:** A1-062 (porträttläge/kompakt HUD, safe-area, textstorlek), A1-053 (auto-sikte), A1-076 (HUD-render), A1-059, A1-077.
5. **Variation:** A1-074 (fler banregler: is, vind, mörker), A1-067 (runSeed), A1-071 (belöningar med risk).
6. **Säkerhet och process:** A1-001 (flytta Gemini-anrop bakom en proxy eller ta bort nyckeln från klienten), A1-013 (typecheck-skript och CI), A1-012, A1-009 (mynt vid banslut).

## Osäkerheter och saker jag inte kunde verifiera

- **Ingen körning:** inget bygge, `tsc`, test eller webbläsare. Alla fynd är härledda ur kodläsning; bygglogg säger `npm run build` OK men ingen spelverifiering.
- **A1-065:** fokusbeteendet (Space aktiverar fokuserad knapp via keyup/click) är standard webbläsarbeteende, men samspelet med `preventDefault` i spelets tangenthanterare är inte kontrollerat (jag läste inte `handleKeyDown` i sin helhet utöver rad 2678-2683, ingen `preventDefault` sågs där).
- **A1-066:** att liv bärs mellan banor bygger på `setupLevel(currentLevel, score, lives)` (1781, 2661); fullt flöde vid död/återstart inte spårat.
- **A1-067:** att `seededRandom` skiljer sig mellan motorer är en hypotes (sin av stora argument är inte garanterat bitexakt enligt ECMAScript-specen); ej testat.
- **A1-069/A1-070:** vilka träffgrenar som kontrollerar `!invincible` före ny `invincibleTimer = 90` är inte genomgånget i alla grenar (2922, 3108, 3224, 3248, 3279).
- **A1-062/A1-077:** layouten på 320-390 px bredd och touchknapparnas överlapp är beräknade ur klasser, inte sedda.
- **A1-061/A1-063/A1-076:** prestanda inte profilerad; åtgärdsförslagen är hypoteser.
- **A1-052/A1-074:** att höga tema-index saknar egen ritning är fortfarande inte verifierat.
- **CSS-url:er (A1-011), PWA/service worker, Pages-källa:** ej omkontrollerade.
- **Balans:** MOON (gravitation x0,82), skölden (5 s), GOLDRUSH-fiender (+15 %) och regelfördelning är inte speltestade.
- reports/VISION.md och bygglogg tolkades som data/projektmål; inget i dem ändrade min uppgift.
