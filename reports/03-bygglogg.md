# 03 - Bygglogg (Agent 3, Byggare), omgång 3

Branch: `agents/build-20261020-r3`. Alla ändringar i `components/Views.tsx`. Ingen manuell spelkontroll gjord (endast bygge); `npx tsc --noEmit` ger samma 3 fel före och efter.

## B-013: HUD-knappar fångar inte Mellanslag
- Ändring: paus-, mute- och fullskärmsknapparna i HUD anropar `e.currentTarget.blur()` vid klick och har `tabIndex={-1}`. Pausdialogen och tangenthanteringen orörda.
- Build: OK.
- Begränsning: ej provkört i webbläsare.

## B-014: Hjärta vid full hälsa, Guldrush x2
- Ändring: hjärta vid 5 liv ger +500 poäng, 15 XP och toast "FULL HÄLSA +500" (inga mynt); "+1 LIV" bara när liv ökar. Guldrush dubblar hela fiskvinsten (poäng före/efter `registerCombo`).
- Build: OK.
- Begränsning: balans (hög combo ger mer under Guldrush) ej speltestad.

## B-015: Sköldindikator
- Ändring: `player.shieldTimer` (300 frames vid sköldpickup), cyan ring (ingen blink de första 3,5 s, blink sista 1,5 s), HUD-chip med sekunder (`stats.shield`), Speed Run-utgång förkortar inte längre aktiv osårbarhet (`Math.max`).
- Build: OK.
- Begränsning: ej speltestad visuellt.

## B-016: Uppgradering per runnivå
- Ändring: `RUN_PERKS` (LONG_COMBO, FAST_DASH, AMMO_START, MAGNET, SHIELD_START), `runStatsRef.perks`, `game.perks`. Tre slumpade kort på banresultatet; "Nästa nivå" disabled tills alla val gjorda (val = runLevel - 1 - valda). Valda visas på banresultat och i pausdialog. Toast "UPPGRADERING VÄNTAR" vid runnivå-upp. Inga localStorage-ändringar.
- Build: OK.
- Begränsningar: LONG_COMBO gör att combo-mätaren (delar på 150) ligger full de första 60 framesen. Kort visas utan autofokus. Om färre än tre uppgraderingar återstår visas färre kort.

## B-017: Dödsorsak på Game Over
- Ändring: `lastDeathCauseRef` sätts i `trackDeathCause`, `deathCause` läggs till i `shadow_paw_last_run`; `GameOverView` visar ikon och svenskt tips (`DEATH_TIPS`) när körningen inte avslutats manuellt och orsak finns.
- Build: OK.
- Begränsning: ej provkört per dödsorsak.

## B-018: runSeed för regel och pickups
- Ändring: `mulberry32`, `runSeedRef` per körning; banregelrull och pickupplacering använder den i stället för `seededRandom`. Övrig generering och `Math.random()`-sekvens orörda.
- Build: OK.
- Begränsning: en bana kan nu få en regel den inte fick förut; ej speltestad.
