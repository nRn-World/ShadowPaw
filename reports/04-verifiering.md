Resultat: GODKÄND

Branch `agents/build-20261020-r4` (591d901), diff mot `agents/build-20261020-r3`. Ändrade filer: `components/Views.tsx`, `services/AudioEngine.ts` samt rapporterna. Ingen kod ändrad av Agent 4.

## Kontroller
- **Build:** `npm run build` OK (43 moduler, huvud-bundel `index-C1yOt4UH.js` 469 kB).
- **tsc:** 3 fel efter, 3 fel före (kört på basgrenen via tillfällig worktree, som är borttagen). Samma fel: `App.tsx(118)` `import.meta.env`, `Views.tsx(3632)` och `Views.tsx(6220)` `game.rule`. Inga nya fel.
- **Beroenden/filer:** `package.json` och `package-lock.json` oförändrade mot basen. `node_modules` och `dist` är gitignorerade och inte spårade. Inga nya hemligheter i diffen (träffen på "API-nyckeln" är endast text i rapporten, A1-001, känd sedan tidigare). `dist/assets/*.js` innehåller inga `AIza`-nycklar. `vite.config.ts` är orört (define av `GEMINI_API_KEY` finns kvar sedan före, redan rapporterat).
- **Smoke-test:** `npx vite preview`: startsida, JS och CSS ger HTTP 200. Playwright (Python) fanns: headless Chromium laddade sidan ("Shadow Paw: Kattens Räddning"), 0 konsolfel/varningar/pageerror. Servern stoppad.
- **Agent 3:s varningar:**
  - (a) Mellanslagen i touchknapparnas klasser: det rättades i B-024 (f1e86bd). Ingen `.../20backdrop`-sammanslagning finns kvar i diffen eller i koden (regex-sök i `components/*.tsx` och `App.tsx` utan träff).
  - (b) SHADOW_HUNTER: finns i `RUN_PERKS` (utan `requires`), ger 200 i stället för 100 poäng och +1 skott i `shadowPass`. OK.
  - (c) Dash + fiende: grenen `if (player.dashing > 0) {...} else if (!invincible) {...}` lämnar skade-/stomplogiken orörd när dash inte pågår. Skuggpassage är en gång per fiende och dash (`shadowDashId`). Aktiva lasrar ger passage utan skada under dash, och hål, bossprojektiler och bosskontakt påverkas inte. Kända begränsning (dokumenterad): stomp under pågående dash blir skuggpassage.
  - (d) Bonuskort `ID#n`: id:t lagras bara i `runStatsRef.perks` och `game.perks` i minnet (ref per PlayingView-instans, nollställs vid ny körning). Det skrivs inte till localStorage; `shadow_paw_last_run` innehåller inga perks. Effekten tillämpas via `perks.slice(bonusCommitted)` i `setupLevel`, `bonusCommitted` uppdateras i `commitLevelToRun`, så den återtillämpas vid omstart av banan men inte på senare banor. `perkTitle` hanterar `#n`-suffix, och `requires`-filtret fungerar eftersom bonus-id:n aldrig blandas med vanliga.
- **Regressioner mot omgång 1-3 (statiskt):** pausens logik är oförändrad (bara `aria-modal`, fokus, förklarande text; touchknapparna får `opacity-40` vid paus som förut). Uppgraderingsvalet fungerar som förut, med fler kort, `requires` och bonusfallback när poolen är tom (kön fastnar inte). Game Over och `deathCause` är orörda. Sparformat: enda nya nyckel är `shadow_paw_hint_rotate` (sessionStorage, i try/catch). `tabIndex={-1}` borttaget på HUD-knapparna; mellanslag stoppas på dem och ignoreras som hopp när målet är en knapp. Dash-/skjutkoden är i övrigt oförändrad.
- **B-021:** `awardCoins` betalar bara ut över tidigare utbetalt antal per bana (`coinFloorRef`), nollställs när banan byts. Logiken stämmer vid manuell genomgång.
- **B-022:** magnetens dragning använder 120 px och respekterar `reduceMotion`; `comboFrac` använder `comboWindow` (default 150 för gamla spel-objekt); musikdämpning 0,3 vid paus/banresultat.
- **B-023/B-024:** aria-label/title på alla touchknappar, dialogroller, `aria-live`-rad, safe-area-padding med `max(...)`, porträttbanner bara för touch + porträtt, text 11 px.

## Fel
Inga.

## Obekräftat
- Inget är spelat eller klickat i webbläsare: dash-passage, stomp utan dash, bonuskort vid omstart, fiskmagnet, paus på touch och fokus i dialoger är verifierade endast statiskt. Playwright-testet visade bara att startsidan laddas utan konsolfel.
- Balans (Girig katt, Startsköld 5 s, Skuggjägare) är inte speltestad.
- Mellanslag-beteende på fokuserad knapp i Firefox, safe-area på riktiga enheter och porträttbannerns utseende är ej testade. Kortens text på mycket smala skärmar kan bli trång (Agent 3 har påpekat det).
- Mindre observation (ej fel): perk-chipen i HUD visar inte bonuskort (dokumenterad begränsning).
