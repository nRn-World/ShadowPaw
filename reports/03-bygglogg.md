# 03 - Bygglogg (Agent 3), omgång 2

Branch `agents/build-20261020-r2`, 2026-10-20. Alla sex godkända punkter byggda, en commit per punkt. `npm run build` OK efter varje punkt. Ingen manuell spelverifiering gjord (endast bygge); inga nätverksanslutna git-kommandon kördes.

## B-007 - Pausen stoppar all input
- Ändring: `requestJump`, `triggerDash`, `fireBullet` returnerar under paus. `setKeyState` ignorerar nedtryckningar under paus men uppsläpp rensar tangenten. `e.repeat` ignoreras för Esc/P och skott-tangenter. Touchkontrollerna tonas ner (opacity-40) under paus.
- Filer: components/Views.tsx
- Build: OK
- Begränsningar: touchknapparna är bara visuellt nedtonade, själva blockeringen sker i logiken.

## B-008 - Pausknapp, pausstate per bana, Avsluta körning
- Ändring: pausknapp (44x44) i HUD, dold på banresultat. `setIsPaused(false)` i byggeffekten; Esc/P ignoreras när `!game.running`. Ny `quitRun` sparar körningssammanfattning och anropar `onEnd(..., { quit: true })`; knappen i pausen heter "Avsluta körning". `App` lagrar `lastQuit`, `GameOverView` får `quit` (deaths 0, rubrik "Körning avslutad").
- Filer: components/Views.tsx, App.tsx
- Build: OK
- Begränsningar: vid frivilligt avslut mitt i bana används `game.score` (inte senaste banans totalScore) som poäng.

## B-009 - Bästa nivå och rekord
- Ändring: `level` tillagt i `shadow_paw_last_run`. Ny nyckel `shadow_paw_best` ({level, score, runLevel}), skrivs i GameOvers engångsblock. Game Over visar "Nådde nivå X" och "Ny bästa nivå!" med delta. Startskärmen visar "Bästa nivå · Bästa poäng" om värden finns. Defensiv parse.
- Filer: components/Views.tsx
- Build: OK
- Begränsningar: dödsorsak (valfri del) hoppades över.

## B-012 - Kontoförmåner nivå 10 och 15
- Ändring: dubbel ammo-bonus borttagen (nu +2, inte +4). Nivå 15 ger 2 s startskydd (`invincible = true`, timer 120); butikstexten kompletterad.
- Filer: components/Views.tsx
- Build: OK
- Begränsningar: avsiktlig nerf av ammo för kontonivå 10+ (flaggad för ägaren).

## B-010 - Pickups (hjärta, sköld)
- Ändring: `game.pickups` genereras efter all övrig generering med enbart `seededRandom` (hjärta på nivå delbar med 3, sköld på nivå >= 4, ej bossnivåer), på icke-markplattformar >= 80 bred. Plockning: +1 liv (max 5, `setLives`), eller 5 s sköld; toast, ljud, haptik, partiklar, skak bara om `!reduceMotion`. Ritas som pulserande glödande former. Ej räknade som fisk.
- Extra: `perfectLevel` ändrat från `===` till `>=` mot startliv, så att ett upplockat hjärta inte räknas som förlust.
- Filer: components/Views.tsx
- Build: OK
- Begränsningar: förlora ett liv och ta ett hjärta samma bana räknas fortfarande som perfekt. Nåbarhet verifierad bara genom konstruktion (plattformstoppar), inte i spel.

## B-011 - Banregler (Guldrush, Månsvävning)
- Ändring: `game.rule` väljs deterministiskt från nivå 3 (ej bossnivåer) via `seededRandom(level * 29.3)`: ca 45 % NONE, 28 % GOLDRUSH (+50 extra per fisk, fiender +15 % fart), 27 % MOON (gravitation x0,82, ej Speed Run eller LOW_GRAVITY-event; annars NONE). Toast vid start och tagg i HUD; `rule` i stats.
- Filer: components/Views.tsx
- Build: OK
- Begränsningar: tagg visas bredvid väderchipet (debug-raden med EVENT oförändrad). Omslagna MOON-rullningar blir NONE, så andelen NONE är något högre än 45 %.
