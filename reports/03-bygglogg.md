# 03 - Bygglogg (Agent 3), varv 6

Branch: `agents/build-20261020-r6b`. Alla sex punkter byggda, en commit per punkt, `npm run build` OK efter varje. Ingen push/fetch gjord.

## B-031: SHADOWFLOW/FAST_DASH och liv i perkOffer
- Ändring: dash-cooldown beräknas multiplikativt (45 / 30 FAST_DASH / 22 SHADOWFLOW / 18 båda, golv 18). `levelSummary` får `lives`; `perkOffer` läser `levelSummary?.lives`; `eslint-disable`-raden borttagen.
- Filer: `components/Views.tsx`.
- Build: OK.
- Begränsningar: ej speltestat i webbläsare.

## B-032: Fiendetyper
- Ändring: typ 1 (råtta) från bana 4: 24 frames röd förvarning ("!" + ring, stadig färg vid reduceMotion), utfall 14 frames (fart 4-5,5 px/frame, klampad till plattformen), cooldown 150. Typ 2 från bana 3: hopp om max 16 px var 90:e frame (fasförskjutet via startposition). Typ 0 och bana 1-2 (för typ 1/2) oförändrade. Kollisionsreglerna orörda.
- Filer: `components/Views.tsx` (fiendeloop, fiendeutritning).
- Build: OK.
- Begränsningar: antagandet att typ 1 = råtta och typ 2 = hoppare följer planen/ritkoden; balans ej speltestad. Under dash/invincible startar inget utfall. Hoppfas använder egen räknare per fiende (`hopT`) eftersom ingen global frameräknare finns.

## B-033: ISGLID och SKUGGJAKT
- Ändring: nya regler i intervallen 0.18-0.30 (friction 0.92) och 0.08-0.18 (dubbla skuggpoäng) i samma roll; HUD-etiketter Isglid/Skuggjakt; befintliga trösklar oförändrade.
- Filer: `components/Views.tsx`.
- Build: OK.
- Begränsningar: HUD-kedjans sista fallback är fortfarande "Månsvävning" (alla kända regler har nu egen gren).

## B-034: Skuggpassager i statistik, w3, prestationer
- Ändring: `shadowPassesInLevel` räknas i `shadowPass`, summeras via `runStatsRef`/`persistRunSummary`; `stats.shadowPasses?` (valfri) och `applyRunResults.shadowPasses`; veckouppdrag `w3` (migreras in i befintliga sparfiler); `ACHIEVEMENTS` (10 st) med nya `shadow_10`, `shadow_100`, `level_10`; lista i QuestsView.
- Filer: `components/Views.tsx`, `context/ProgressContext.tsx`, `types.ts`.
- Build: OK.
- Begränsningar: namn/beskrivningar på de sju gamla prestationerna är mina formuleringar. Befintliga sparfiler startar `shadowPasses` från 0. tsc har fortsatt de kända förhandsfelen (import.meta.env, `rule`-typen).

## B-035: Skins Umbra/Guldtass och nästan-indikator
- Ändring: SKINS `umbra` (shadow_10) och `gold` (level_10), upplåsning i GameOver-effekten. En rad på GameOver med närmaste olåsta mål (fisk, fiender, boss, kombo, skuggpassager, banor), beräknad från snapshot (`statsBefore`, `skinsBefore`) så att inget dubbelräknas. Spelfiguren använder redan `skin.color/accent`.
- Filer: `components/Views.tsx`.
- Build: OK.
- Begränsningar: "närmast" jämför råa tal över olika enheter. Ingen hint på butikskorten (valfritt, hoppades över). `reachedLevel` flyttades upp i komponenten för att undvika TDZ.

## B-036: Juice, hit-stop, stigande ton, haptik
- Ändring: `haptic(kind)` ersätter de nio inline-anropen med samma längder, plus `haptic('land')` (6 ms, impactSpeed > 6). `playShadowPass(chain)` höjer tonen 6 % per länk (max 6, kedja bryts efter 120 frames utan passage). Hit-stop 3 frames vid skuggpassage och 2 vid stomp via befintlig `game.hitStop`, av vid reduceMotion.
- Filer: `components/Views.tsx`, `services/AudioEngine.ts`.
- Build: OK.
- Begränsningar: ej testat på mobil/ljud i webbläsare. Kedjetimern räknar ned i `simulate` (pausas under hit-stop).
