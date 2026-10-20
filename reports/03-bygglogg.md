# 03 - Bygglogg (Agent 3), omgång 4

Branch: `agents/build-20261020-r4`. Byggordning: B-021, B-020, B-019, B-022, B-023, B-024. Alla byggda; `npm run build` OK efter varje punkt. Ingen push gjord. Inga nya beroenden, inget befintligt sparformat ändrat (enda nya lagring: `shadow_paw_hint_rotate` i sessionStorage).

## B-021 Starta om bana betalar inte ut mynt två gånger
- Ändring: ny `coinFloorRef`; `awardCoins` betalar bara ut mynt över tidigare utbetalt antal för samma bana. Förklarande text i pausdialogen.
- Filer: `components/Views.tsx`. Build: OK.
- Begränsning: banresultatets mynt (`coinsThisLevel`) räknar försökets mynt, inte enbart utbetalda.

## B-020 Fler uppgraderingar, bonuskort, Startsköld
- Ändring: RUN_PERKS 5 till 12 poster (LONG_COMBO_2, GREEDY, SWIFT_PAW, AMMO_START_2, SHIELD_START_2 + SHADOW_HUNTER som lades till i B-019-steget) med `requires`-filter. Startsköld 5 s (gäller även bossbanor, `Math.max` mot befintlig timer); Startsköld II +3 s. Bonuskort (BONUS_AMMO/POINTS/LIFE) när poolen är slut; sparas som `ID#n` i `runStatsRef.perks` och tillämpas en gång i `setupLevel` (återtillämpas vid omstart av banan, inte på senare banor).
- Filer: `components/Views.tsx`. Build: OK.
- Begränsning: balans ej speltestad. Bonuspoäng/liv vid omstart räknas om från banstart (avsiktligt).

## B-019 Skuggdash
- Ändring: under dash (`p.dashing > 0`) skadar fiender och aktiva lasrar inte; första passagen per dash ger +100 poäng via `registerCombo`, 10 XP, "SKUGGA!"-text, pulsring, partiklar, ljud och haptik. Efterbilder (`game.dashGhosts`, 6 st). Nytt `AudioEngine.playShadowPass()`. Perk SHADOW_HUNTER (dubbel poäng, +1 skott). Hål, bossprojektiler och bosskontakt påverkas inte.
- Filer: `components/Views.tsx`, `services/AudioEngine.ts`. Build: OK.
- Begränsning: stomp av fiende under pågående dash ger skuggpassage i stället för stomp. Balans ej speltestad.

## B-022 Fiskmagnet, combo-mätare, ljud
- Ändring: MAGNET drar fisk inom 120 px (lerp 0,12, glimtpartiklar, hänsyn till reduceMotion); `game.comboWindow` ger korrekt `comboFrac`; musik dämpas till 30 % vid paus/banresultat (`dimmed`-parameter); nya `playHeart`, `playShield`, `playPerkPick`; HUD-chip med upp till 6 uppgraderingsikoner (title/aria-label).
- Filer: `components/Views.tsx`, `services/AudioEngine.ts`. Build: OK.
- Begränsning: perk-chip visar inte bonuskort; ej manuellt provat i webbläsare.

## B-023 Tillgänglighet
- Ändring: `tabIndex={-1}` borttaget från paus-/mute-/helskärmsknapp; Mellanslag stoppas på dessa (keydown/keyup) och ignoreras som hopp när målet är en knapp; aria-label/title på helskärm och alla touchknappar; `role="dialog" aria-modal` på banresultat och paus; fokus flyttas till första kortet/"Nästa nivå" resp. "Fortsätt"; kort har aria-label; dold `aria-live`-rad (sköld/uppgraderingsval).
- Filer: `components/Views.tsx`. Build: OK.
- Känt fel som rättades i B-024: ett mellanslag försvann i klasserna för hopp-, dash- och skjutknappen (`bg-.../20backdrop-blur-md`); rättat i B-024-committen.
- Begränsning: Mellanslag-beteende kan skilja i Firefox (se plan); ingen fokusfälla i dialogerna.

## B-024 Mobil: safe-area och text
- Ändring: `env(safe-area-inset-*)` på rotcontainer och touchrad (rotscale orörd); `text-[9px]/[10px]` till `text-[11px]` i PlayingView; avvisbar porträttbanner (44 px stängknapp, sessionStorage `shadow_paw_hint_rotate`, bara touch + porträtt); uppgiftskort `grid-cols-3` med mindre text (11 px).
- Filer: `components/Views.tsx`. Build: OK.
- Begränsning: ej testat i DevTools; små texter i andra vyer (meny, butik) orörda; kortens text kan bli trång på mycket smala skärmar.

Bygget visar endast befintliga TS-fel (`game.rule`, `import.meta.env`) utanför punkternas ändringar.
