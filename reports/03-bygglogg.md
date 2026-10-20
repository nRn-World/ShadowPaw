# 03 - Bygglogg (Agent 3), varv 5

Branch `agents/build-20261020-r5b`. `npm run build` kördes efter varje punkt; alla gick igenom. Ingen punkt återställdes. Inget manuellt speltest utfört.

## B-025: Skuggpassage en gång per fiende och laser
- Ändring: `e.shadowPassed` / `h.shadowPassed` ersätter jämförelsen mot `game.dashId`; ny hjälptextrad om skuggpassage.
- Filer: `components/Views.tsx`
- Build: OK
- Begränsningar: `shadowDashId` används inte längre. Ingen belöning under sköld (oförändrat, dokumenterat).

## B-026: Seedade kort, inget Extra liv vid 5 liv
- Ändring: `perkOffer` använder `mulberry32` seedad på körning, nivå och antal valda kort; `BONUS_LIFE` filtreras bort i bonusfallbacken vid >= 5 liv.
- Filer: `components/Views.tsx`
- Build: OK
- Begränsningar: Filtret gäller endast bonusfallbacken (som i planen).

## B-027: Fokusfälla och fokusåterställning
- Ändring: `trapTab` på pausdialog och banresultat; effekt som sparar och återställer fokus när dialog öppnas/stängs. Ingen `inert`, ingen ny Escape.
- Filer: `components/Views.tsx`
- Build: OK
- Begränsningar: Ej testat med tangentbord i webbläsare.

## B-028: Landningsljud och pitchvariation
- Ändring: `jitter`/`pitch` i `tone()`; jitter på hopp, skott, nära-miss; mynt delar en pitchfaktor; ny `playLand`, anropas vid landning när `impactSpeed > 4`.
- Filer: `services/AudioEngine.ts`, `components/Views.tsx`
- Build: OK
- Begränsningar: Ingen haptik. Ljudet ej lyssnat på.

## B-029: Banregel Skuggflöde
- Ändring: ny regel SHADOWFLOW för roll 0,30-0,45 (nivå >= 3, ej var 5:e), dash-cooldown `min(22, perk-värde)`, HUD-chip via `ruleStyle`-uppslagning (cyan).
- Filer: `components/Views.tsx`
- Build: OK
- Begränsningar: Regeln kan även hamna på Speed Run-banor (som planen tillåter). Bossbanor (nivå % 5) har ingen regel.

## B-030: Auto-sikte på touch-skjutknappen
- Ändring: `autoAim` väljer närmaste fiende framför katten (<= 450 px horisontellt, <= 140 px vertikalt, `e.x > -500`); touchknappen skjuter dit, annars rakt fram. Tangentbord/mus oförändrade.
- Filer: `components/Views.tsx`
- Build: OK
- Begränsningar: Bossar ingår inte. Ej testat med touch.
