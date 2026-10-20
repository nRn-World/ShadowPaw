# 02 - Idéer och byggplan (Agent 2), omgång 5

Datum: 2026-10-20. Branch `agents/build-20261020-r5`. Underlag: `reports/01-analys.md` (omgång 5), `reports/VISION.md`, samt kodläsning av `components/Views.tsx` (7001 rader) och `services/AudioEngine.ts`. Inget har byggts eller körts av mig. Alla punkter har `- **Status:** FÖRESLAGEN`; endast ägaren/orkestratören ändrar dem.

## Bedömning av Agent 1:s rapport

Stämmer (verifierat mot koden):
- **A1-090 (skuggdash-exploit)**: korrekt. `shadowPass` (Views.tsx:2548-2566) triggas när `e.shadowDashId !== game.dashId` (3264); `dashId` ökar vid varje dash (2525) och fienden försvinner aldrig, så samma patrullerande fiende ger +100 poäng, +10 XP, combo och (Skuggjägare) +1 skott var 45:e bildruta (30 med Snabb dash). Samma mönster för lasrar (3481-3487, `h.shadowDashId`).
- **A1-091**: korrekt. Fiendepassage kräver `!invincible` (3264) och laserblocket ligger inuti `if (!game.player.invincible)` (3476), så under sköld/osårbarhet ges ingen belöning. Det är fördelaktigt som regel (hindrar att Startsköld + dash blir en belöningsmaskin), så jag föreslår att dokumentera, inte ändra.
- **A1-094 (rerolla kort)**: korrekt. `perkOffer` (2696-2706) använder `Math.random()` i `useMemo` på `[levelSummary, chosenPerks]`; `BONUS_LIFE` (250, tillämpas 1986) filtreras inte vid 5 liv. `runSeedRef` (1699) och `mulberry32` (1345) finns redan och kan återanvändas.
- **A1-097**: korrekt. Dialogerna (6528, 6546) har fokusflytt men ingen fokusfälla.
- **A1-117**: korrekt. `tone()` (AudioEngine.ts:8-30) saknar slump och det finns inget landningsljud.
- **A1-123/A1-053**: korrekt. Touch-skjutknappen (6690) anropar `fireBullet()` utan mål, så skottet går rakt i `facing`-riktningen (2798-2801). `isTouchDevice` finns (1769).
- **A1-105**: korrekt. `game.rule` har bara MOON och GOLDRUSH (2456-2468); slumptalsintervallen 0,45-0,73 respektive >=0,73 lämnar 0-0,45 ledigt.

Fel eller föråldrat:
- **A1-118 (landningsdamm)**: delvis föråldrat. Landningsdamm och squash finns redan (Views.tsx:3216-3229). Det som saknas är landningsLJUD och haptik/pitch. B-028 avgränsas därför till ljud.
- **Nummerförvirring**: i orkestratörens instruktion kallas korterbjudandet "A1-092", men i rapporten är det **A1-094**; A1-092 är stomp-under-dash. Planen hänvisar till rapportens ID.
- **A1-091 "överväg dash genom movingSaw"**: avråds. Det skulle göra dashen för stark utan speltest.
- **Överdrift**: "obegränsad ammunition" (A1-090) kräver Skuggjägare-kortet; utan det är det poäng/XP-farm. Allvarlighet Medel är dock rimlig.
- A1-099 (`node -e require`) är osäkert och ej verifierat; tas inte med.

## Byggplan

Regler för alla punkter: ingen ändring av sparformat (endast nya nycklar om nödvändigt; inga behövs här), inga nya beroenden, inga borttagna funktioner eller banor, `npm run build` ska gå igenom. Radnummer gäller före byggstart och förskjuts när tidigare punkter byggs; sök på funktionsnamn.

### B-025: Skuggpassage en gång per fiende och laser (stoppa farmning)
- **Bakgrund:** A1-090 (Medel), A1-091.
- **Ändring:**
  1. I fiendeloopen (`game.enemies.forEach`, ca 3239-3272): ändra villkoret på rad 3264 från `e.shadowDashId !== game.dashId` till `!e.shadowPassed`, och sätt `e.shadowPassed = true` (behåll gärna `e.shadowDashId`-raden eller ta bort den). Resultat: en skuggpassage per fiende och bana. Dashen fortsätter vara ofarlig mot fienden (grenen `if (game.player.dashing > 0)` ändras inte), bara belöningen uteblir vid upprepning.
  2. I hazard-loopen (ca 3476-3488): samma sak för lasrar, `h.shadowPassed` i stället för `h.shadowDashId !== game.dashId`.
  3. Skuggjägarens skott (`shadowPass`, ca 2553) behöver ingen separat ändring eftersom en passage nu ger högst 1 skott per fiende; det är därmed även högst 1 skott per dash.
  4. A1-091: behåll regeln (ingen belöning under sköld). Lägg en rad i "Hur man spelar" (ca 675, efter raden "Dash - snabb burst...") som säger att skuggpassage genom fiender och lasrar ger poäng en gång per hinder och inte räknas medan sköld är aktiv.
  5. Flaggorna lever på fiende- och hazardobjekten, som skapas på nytt av `setupLevel` vid varje bana och varje "Starta om bana", så ingen extra återställning behövs.
- **Berörda filer:** `components/Views.tsx` (fiendeloop ca 3262-3272, hazard-loop ca 3481-3488, hjälptext ca 675). Funktion `shadowPass` (2548) oförändrad.
- **Verifiering:** `npm run build`. Kodgranskning: sök `shadowDashId` och bekräfta att inga kvarvarande jämförelser mot `game.dashId` finns för belöning. Manuellt: dasha två gånger genom samma patrullerande fiende; endast första ger "SKUGGA!". Dasha genom en annan fiende; ger poäng. Dash genom aktiv laser ger fortfarande ingen skada. Starta om banan; passagen fungerar igen.
- **Risk:** Låg.
- **Status:** GODKÄND

### B-026: Seedade uppgraderingskort och inget Extra liv vid fulla liv
- **Bakgrund:** A1-094 (rapportens ID; orkestratören kallar det A1-092).
- **Ändring:**
  1. I `perkOffer` (`useMemo`, ca 2696-2706): ersätt `Math.random()` med `const rng = mulberry32(runSeedRef.current ^ Math.imul((levelSummary?.runLevel || 1) + 1, 2654435761) ^ Math.imul(chosenPerks.length + 1, 40503));` och använd `rng()` i blandningen. Samma bana, samma antal valda kort och samma körning ger då alltid samma tre kort, så omstart av banan ger ingen gratis reroll. Efter ett val ändras `chosenPerks.length`, så kortsetet byts som i dag.
  2. Filtrera bort `BONUS_LIFE` när `gameRef.current?.lives >= 5` (gäller bonusfallbacken, ca 2699): `left = BONUS_PERKS.filter(pk => pk.id !== 'BONUS_LIFE' || (gameRef.current?.lives ?? 0) < 5)`. Listan blir aldrig tom eftersom två andra bonuskort finns kvar.
  3. Kontrollera att `useMemo`-beroendena fortfarande räcker; `gameRef` är en ref och behöver inte ligga i beroendena (behåll eslint-kommentaren).
- **Berörda filer:** `components/Views.tsx` (`perkOffer` ca 2696-2706; `mulberry32` ca 1345 och `runSeedRef` ca 1699 återanvänds, inga nya).
- **Verifiering:** `npm run build`. Manuellt: avsluta en bana, notera de tre korten, pausa/"Starta om bana"/klara banan igen; samma kort erbjuds. Välj ett kort; nya kort visas. Med 5 liv och tom vanlig pool erbjuds inte Extra liv.
- **Risk:** Låg.
- **Status:** GODKÄND

### B-027: Fokusfälla och fokusåterställning i pausdialog och banresultat
- **Bakgrund:** A1-097 (och A1-081 kvarstående del).
- **Ändring:**
  1. Lägg en liten hjälpfunktion `trapTab(e: React.KeyboardEvent<HTMLElement>, root: HTMLElement | null)` nära fokus-effekterna (ca 2709-2722) som vid `Tab`/`Shift+Tab` samlar `button:not([disabled]), [tabindex]:not([tabindex="-1"])` i `root`, och loopar fokus mellan första och sista (anropar `preventDefault`).
  2. Koppla `onKeyDown={e => trapTab(e, pauseDialogRef.current)}` på pausdialogens `div` (ca 6528) och motsvarande på banresultatets `div` (ca 6546).
  3. Spara `document.activeElement` när dialogen öppnas (i de två befintliga effekterna) och återställ fokus till det (eller `document.body`) i effektens cleanup när dialogen stängs. Spelet styrs via window-tangentlyssnare, så detta ska inte påverka spelinput.
  4. Escape i pausdialogen hanteras redan (2761, `togglePause`); lägg ingen ny Escape-hantering i banresultatet (det skulle kunna hoppa över uppgraderingsval).
  5. Lägg inte till `inert`.
- **Berörda filer:** `components/Views.tsx` (ca 2709-2722, 6528, 6546).
- **Verifiering:** `npm run build`. Manuellt med tangentbord: pausa med Escape; Tab och Shift+Tab stannar kvar bland dialogens knappar; Fortsätt återger spelet och tangenterna fungerar. Samma i banresultatet; uppgraderingskorten nås med Tab och Enter. Space och piltangenter ska inte trigga spelet under paus (oförändrat beteende).
- **Risk:** Låg.
- **Status:** GODKÄND

### B-028: Landningsljud och pitchvariation i ljudmotorn
- **Bakgrund:** A1-117, A1-082 (kvar), delvis A1-118.
- **Ändring:**
  1. `services/AudioEngine.ts`, `tone()` (rad 8-30): lägg till valfritt fält `jitter?: number` (andel, t.ex. 0,05). När satt multipliceras `from` och `to` med `1 + (Math.random() * 2 - 1) * jitter`. Standard 0, så befintliga ljud oförändrade.
  2. Sätt `jitter: 0.05` på `playJump` (63), `playCoin` (båda tonerna ska ha SAMMA faktor; beräkna faktorn en gång i funktionen och skicka som `shift`, eller låt `tone` ta ett färdigt `pitch`-fält), `playShoot` (127) och `playNearMiss` (111).
  3. Ny metod `public static playLand(strength = 0.5)`: kort lågt dunk, t.ex. `tone({ type: 'sine', from: 180, to: 70, duration: 0.09, gain: 0.05 + 0.1 * clamp(strength,0,1) })` med `jitter: 0.04`.
  4. `Views.tsx` landningsblocket (ca 3216-3229, `if (!wasOnGround)`): anropa `AudioEngine.playLand(Math.min(1, impactSpeed / 14))` endast när `impactSpeed > 4` så att små steg inte spammar. Ingen haptik tillagd.
- **Berörda filer:** `services/AudioEngine.ts` (tone, playJump, playCoin, playShoot, playNearMiss, ny playLand), `components/Views.tsx` (ca 3216-3229).
- **Verifiering:** `npm run build`. Manuellt/kodgranskning: hopp och mynt låter lätt varierat, landning efter högt fall ger dunk, vanlig löpning på platt mark ger inget landningsljud, mute och volym fungerar som förut. Kontrollera att `Math.max(20, ...)`-skyddet i `tone` fortfarande gäller efter jitter.
- **Risk:** Låg.
- **Status:** GODKÄND

### B-029: Tredje banregel "Skuggflöde" (dash laddas dubbelt så snabbt)
- **Bakgrund:** A1-105 (rapportens förslag till fler banregler), bygger på Skuggdash (A1-085) för unik identitet.
- **Ändring:**
  1. I regelblocket i `setupLevel` (ca 2455-2468): lägg en tredje gren `else if (roll >= 0.30 && roll < 0.45)` med `(game as any).rule = 'SHADOWFLOW'` och `pushToast(game, 'SKUGGFLÖDE: dashen laddas snabbt', '#67e8f9')`. Befintliga intervall (MOON >= 0,73; GOLDRUSH 0,45-0,73) ändras inte, så banor som redan har en regel behåller den. Några banor som tidigare saknade regel får Skuggflöde; det är avsiktligt.
  2. I `triggerDash` (ca 2526): `p.dashCooldown = game.rule === 'SHADOWFLOW' ? 22 : (game.perks?.includes('FAST_DASH') ? 30 : 45);`. Med Snabb dash tar man det lägre värdet: använd `Math.min` av de två.
  3. HUD-chipen (ca 6406-6412): utöka villkoren så att `stats.rule === 'SHADOWFLOW'` ger text `Skuggflöde` och en cyan kantfärg (`border-cyan-300/40`, `text-cyan-200`); befintliga två regler får samma utseende som idag. Skriv gärna en tydlig `ruleLabel`/`ruleStyle`-uppslagning i stället för kapslade ternärer.
  4. Skuggflöde gäller bara på banor där regeln redan är aktiv i dag (nivå >= 3, inte bossbanor, ej "Speed Run" behöver inte uteslutas).
  5. Eftersom B-025 gör belöningen engångs per hinder blir snabb dash en rörelsefördel, inte en poängmaskin.
- **Berörda filer:** `components/Views.tsx` (`setupLevel` regelblock ca 2455-2468, `triggerDash` ca 2519-2526, HUD ca 6406-6412). `stats.rule` skrivs redan från `game.rule` (ca 6220).
- **Verifiering:** `npm run build`. Kodgranskning: `rule`-värdet SHADOWFLOW påverkar endast dash-cooldown. Manuellt: hitta en bana (nivå >= 3) med Skuggflöde via toast och HUD-chip; dashen laddas om på ca 22 bildrutor; MOON och GOLDRUSH-banor är oförändrade. Starta om en bana ger samma regel (regeln är seedad via `runSeedRef`).
- **Risk:** Låg.
- **Status:** GODKÄND

### B-030: Auto-sikte på touch-skjutknappen
- **Bakgrund:** A1-123 / A1-053.
- **Ändring:**
  1. Ny hjälpfunktion nära `fireBullet` (ca 2786), t.ex. `autoAim(game)`, som bland `game.enemies` (levande, `e.x > -500`) väljer den närmaste fienden framför katten i `facing`-riktningen inom 450 px horisontellt och 140 px vertikalt, mätt från kattens centrum, och returnerar `{ x: e.x + e.width / 2 - game.scrollX, y: e.y + e.height / 2 }` (skärmkoordinat, samma konvention som `targetX` i `fireBullet`, rad 2795) eller `null`.
  2. Skjutknappens `holdProps` (ca 6690): ersätt `fireBullet()` med `fireBullet(...)` som anropar `autoAim` och skickar `null, null` om inget mål finns (då skjuter katten rakt framåt som idag). Gäller endast touchknappen; tangentbord och mus (2782, 2878) ändras inte.
  3. Bossar ingår inte (de har egen träffzon); begränsning kan skrivas i en kommentar.
  4. Ingen ny inställning krävs. Frivilligt för senare: växel i inställningar.
- **Berörda filer:** `components/Views.tsx` (`fireBullet` ca 2786-2812, skjutknapp ca 6687-6694).
- **Verifiering:** `npm run build`. Manuellt i webbläsare med mobilemulering (pointer: coarse): skjut mot en fiende på en något högre/lägre plattform och träffa den; utan fiende i konen skjuter katten rakt fram; tangentbord/mus oförändrat; ammunition dras som förut (`game.ammo--`). Kontrollera att kulan inte kan skjutas bakåt eftersom endast mål framför katten väljs.
- **Risk:** Låg-Medel (påverkar balans på mobil något: lättare att träffa; ingen risk för sparad data).
- **Status:** GODKÄND

## Fria idéer för framtiden

Högrisk eller för stora för en enskild granskning. Ingen av dessa ska byggas utan separat godkännande av ägaren.

### F-001: Seedad banlayout, Dagens bana och dagsstreak
- **Bakgrund:** A1-057 steg 1, A1-109. Kräver att `setupLevel` byter alla `Math.random()` (120 träffar i Views.tsx) mot lokal seedad PRNG (`mulberry32` finns redan).
- **Risk:** Hög (ändrar bangenerering för alla banor och balans).
- **Status:** FÖRESLAGEN
- **Notering:** Ge `Math.random()`-sekvensen i enstaka delsystem (partiklar, väder) fortsatt fritt flöde; seeda enbart layout, fiender, hinder och fisk.

### F-002: Spöke (ghost-körning)
- **Bakgrund:** A1-100. Kräver F-001 och F-004. Inspelning av position per 3:e bildruta per bana/seed.
- **Risk:** Hög
- **Status:** FÖRESLAGEN

### F-003: Checkpoints och "Fortsätt från bana X"
- **Bakgrund:** A1-110, A1-055, A1-095. Berör livscykel, poängräkning och mynt-golvet (`coinFloorRef`).
- **Risk:** Hög
- **Status:** FÖRESLAGEN

### F-004: Dela update och render med interpolation
- **Bakgrund:** A1-061/A1-120. Ritning sker idag inne i `simulate()`. Förutsättning för spöke, enhetstester och 120 Hz.
- **Risk:** Hög
- **Status:** FÖRESLAGEN

### F-005: PWA med offline
- **Bakgrund:** A1-122, A1-099. Manifest, service worker, cache av ca 35 MB ljud; kräver att `Sounds/` flyttas till `public/` och test av Pages-bas `./`.
- **Risk:** Hög (cachefel kan låsa användare vid gammal version).
- **Status:** FÖRESLAGEN

### F-006: Dela upp Views.tsx (7001 rader)
- **Bakgrund:** A1-014. Börja med att lyfta ut ren logik (`RUN_PERKS`, `mulberry32`, kombo- och poängberäkning) till `services/` med enhetstester, därefter vyer en i taget.
- **Risk:** Hög
- **Status:** FÖRESLAGEN

### F-007: Skuggläge (ljus/skugga-växling) och skuggmynt
- **Bakgrund:** A1-101, A1-102. Ny kärnmekanik; kräver speltest. Efter B-025 finns en balanserad skuggpassage att bygga vidare på.
- **Risk:** Medel-Hög
- **Status:** FÖRESLAGEN

### F-008: Nya fiendetyper med regler (spegelfiende, drönare, skuggfiende) och bossfaser
- **Bakgrund:** A1-103, A1-104, A1-098. Fiendetyp väljs med `Math.floor(Math.random()*3)` (ca 2205) och ritas i en kedja `e.type === 0/1/2` (ca 5033-5110+); en ny typ kräver ny ritning, beteende och balans. Rekommendation: börja med en `ENEMY_TYPES`-tabell när F-006 påbörjats.
- **Risk:** Medel-Hög
- **Status:** FÖRESLAGEN

### F-009: Achievements, rotera veckomål, kosmetika med mynt som sänka
- **Bakgrund:** A1-112, A1-113, A1-114. Nya nycklar i `ProgressContext` (sparformatet får inte brytas; endast tillägg). Ingen tvingande återkomst, inga timers som straffar.
- **Risk:** Medel
- **Status:** FÖRESLAGEN

### F-010: Adaptiv musik, slow-motion och skugglik post-processing
- **Bakgrund:** A1-116, A1-118 (slowMo, kamera), A1-119. Prestandarisk på mobil; gör valbart via inställning.
- **Risk:** Medel
- **Status:** FÖRESLAGEN

### F-011: Prestandaläge och offscreen-cache
- **Bakgrund:** A1-121, A1-125, A1-063. Bör föregås av mätning på låg-end-mobil.
- **Risk:** Medel
- **Status:** FÖRESLAGEN

---
Varv 5: B-025...B-030 godkända av orkestratören å ägarens vägnar 2026-10-20 (ägarens uttryckliga förhandsgodkännande i chatten). Punkterna under "Fria idéer" är högrisk/medel-hög och förblir FÖRESLAGEN.
