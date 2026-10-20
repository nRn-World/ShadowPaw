Resultat: GODKÄND

Omverifiering varv 2 av varv 6 (branch agents/build-20261020-r6b, bas agents/build-20261020-r6).

## Kontroller
- build: `npm run build` OK (35 moduler, JS 420,36 kB).
- tsc: 3 fel efter, 3 fel före. Basen mättes med en tillfällig `git worktree add` på agents/build-20261020-r6, som är borttagen (`git worktree list` visar bara huvudträdet). Samma tre fel: `import.meta.env` (App.tsx:118) och `rule`-typen på två ställen i Views.tsx. Inga nya. F-001 (shadowChain/shadowChainTimer) är rättat.
- diff-granskning: ändrade filer är Views.tsx, ProgressContext.tsx, AudioEngine.ts, types.ts och rapporterna. package.json och package-lock.json är oförändrade. Ingen node_modules eller dist är incheckad. Inga hemligheter eller API-nycklar i diffen.
  - Sparformat/migrering (B-034): ProgressContext läser sparfilen med `...defaultProgress`, och `stats` slås ihop med defaults. `shadowPasses` är valfritt och alla läsningar använder `|| 0`. Kvartsmigreringen lägger bara till w3 om den saknas och rör inte de befintliga uppdragen. Den är idempotent eftersom den kollar `some(id==='w3')`. Inga nycklar eller format är ändrade. Gamla sparfiler behåller mynt, skins, uppdrag och progress. Fel i JSON ger defaults, som förut.
  - Fiender (B-032): typ 0 går samma väg som förut. Råttan (typ 1, bana 4 och uppåt) har 24 frames förvarning med röd cirkel och "!". Utfallet är 14 frames och högst 5,5 px per frame, klämt till plattformen. Utfallet startar inte om katten är dashande eller osårbar, och det har 150 frames cooldown. Typ 2 (bana 3 och uppåt) hoppar högst 16 px och återgår till `baseY`, så stomp och skott fungerar. Bossar är en separat kodväg och påverkas inte. Stomp- och skadelogiken är oförändrad.
  - Banregler (B-033): ISGLID (roll 0,18–0,30) och SKUGGJAKT (0,08–0,18) tar bara tidigare lediga intervall. MOON, GOLDRUSH, SHADOWFLOW, miniEvent och Speed Run är oförändrade. Gränsen bana 3 och uppåt samt `level % 5 !== 0` finns kvar. Friktion 0,92 (förut 0,85) gäller bara på mark och farten är fortfarande klämd till `p.speed`, så banan kan inte bli omöjlig. HUD-etiketter finns för båda reglerna. SKUGGJAKT dubblar bara poängen. Dash-cooldown för SHADOWFLOW är 22 (samma som förut) men blir 18 med FAST_DASH (förut 22), en liten buff.
  - Skins/achievements (B-035): Umbra låses upp via `shadowPasses >= 10` (shadow_10) och Guldtass via nivå 10 (level_10), med idempotenta `unlockSkin`/`unlockAchievement`. Utrusta-knappen är avstängd för låsta skins. "Närmaste mål" använder snapshots (`statsBefore`/`skinsBefore`) tagna före `applyRunResults`, så ingen dubbelräkning sker. Allt använder `|| 0`, och `lastRun` har fallback `{}`, så saknad data kraschar inte. Mål som redan är uppnådda eller har upplåst skin filtreras bort, och tom lista ger `null`.
  - Juice (B-036): `haptic()` kontrollerar `settings.haptics && navigator.vibrate`. Hit-stop sätts bara när `!reduceMotion` och bara om ingen hit-stop redan pågår (2–3 frames), och `simulate()` räknar ner den varje frame, så spelet kan inte frysa permanent. Bossens hit-stop (rad 3151) respekterar inte reduceMotion, men det var så förut. Kedjan nollställs via `shadowChainTimer` (120 frames), startvärdena är 0 och `game` skapas per bana. Ljudet går via `tone()` (faktor 1,06^kedja, max 6), så mute och volym är opåverkade.
  - Regressioner: perkOffer använder nu `levelSummary.lives`, som finns i den enda `setLevelSummary`-anropet, så uppgraderingsval och bonuskortskön fungerar. Paus, Game Over och fokusfälla ligger utanför diffen. Dash/skuggpassage en gång per hinder (`dashId`) och magnet är orörda. Tillgänglighet: reduceMotion respekteras för nya effekter.
- smoke-test: `npx vite preview` gav HTTP 200 på startsidan och på /assets/index-BY_DCRBc.js. Servern stoppades med kill på exakt PID (1566). En annan, ej min, vite-process på port 4399 (PID 1200) lämnades orörd.

## Fel
Inga.

## Obekräftat
- Playwright eller annan headless-webbläsare finns inte installerad. Därför ingen konsolfelsläsning eller laddning med en gammal localStorage-fixture. Migreringen är bara granskad statiskt.
- Spelkänsla och banbarhet (råttans utfall, hopp, ISGLID-friktion) är inte provspelade, bara granskade i koden.
- `importProgressCode` kör ingen w3-migrering direkt. Den läggs till vid nästa mount. Det är ofarligt men inte spelat.
- Basens tsc-fel jämfördes på felkod och fil (radnummer skiljer pga ändrade rader).
