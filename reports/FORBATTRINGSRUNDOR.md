# Förbättringsrundor (ständig förbättring av ShadowPaw)

Ägarens önskemål (2026-11-03): *"gå in här varje 10:e minut och kom på något som
gör att spelet ännu bättre – fria händer, bygg och ändra precis vad du vill"*.

## Så fungerar en runda

1. **Läs** aktuell kod och föregående rundas rad i tabellen nedan.
2. **Välj en liten, verifierbar förbättring** från kön (eller en ny, bättre idé).
   En sak i taget: hellre en polerad mekanik än fem halva.
3. **Bygg** med `VISION.md` som kompass: unikt, modernt, juicy, schysst retention.
   Befintliga banor, sparad progress och ljud ska aldrig gå sönder.
4. **Verifiera** med `npm run verify:round` (enhetstester för Neon-skift,
   `tsc --noEmit`, översättningskontroll och produktionsbygge).
5. **Logga** rundan i tabellen och fyll på kön med minst en ny idé.

Spelet har dessutom en **inbyggd 10-minutersrytm**: `services/neonShift.ts` roterar
en ny, alltid positiv bonus var tionde minut. Den är deterministisk (ingen server,
ingen nätverksförfrågan, ingen ändring av sparfiler) och fryses när en nivå
startar så att en bana aldrig ändras mitt i ett hopp. Menyn visar aktivt skift
och nedräkning till nästa.

> Praktisk notis: en agent kan inte väcka sig själv på en timer i chatten. Varje
> gång ägaren hör av sig (eller skriver "igen"/"nästa runda") körs en ny runda
> enligt protokollet ovan. Spelet självt fortsätter ändå att bjuda på något nytt
> var 10:e minut via Neon-skiftet.

## Genomförda rundor

| Runda | Datum | Vad som blev bättre | Filer | Verifiering |
|-------|-------|---------------------|-------|-------------|
| R1 | 2026-11-03 | **Skuggkraft & Skuggsprängning** – nästan-träffar laddar en mätare (5 steg). Full mätare gör nästa dash till en chockvåg som rensar fiender på skärmen, stoppar fiendeprojektiler, skadar bossen, ger poäng/XP/mynt, kort osårbarhet, partikelring, eget ljud och haptik. Skada halverar laddningen = risk/belöning. Ny HUD-mätare, ny prestation `shadow_burst` och nytt skinn `Nebula`. Bossens segerbelöning flyttades till en delad hjälpfunktion så att både skott och sprängning ger samma utdelning. | `components/Views.tsx`, `services/AudioEngine.ts`, `i18nStrings.ts` | `npm run verify:round` OK |
| R1 | 2026-11-03 | **Neon-skift** – sex roterande bonusar var 10:e minut (snabbare dash, lättare gravitation, dubbel skuggladdning, extra mynt, extra ammo, längre kombo). Menykort med nedräkning, HUD-chip, rad i nivåintroduktionen och handbok. Alltid bonusar, aldrig straff, inga FOMO-timers. | `services/neonShift.ts`, `components/Views.tsx`, `i18nStrings.ts` | 400 fönster testade i `scripts/verify-round.mjs` |
| R1 | 2026-11-03 | **Rundverktyg** – `npm run verify:round` kör enhetstester + typkontroll + översättningskontroll + bygge i ett kommando. Ny CI-workflow kör samma kontroll på feature branches och PR:er; Vite tillåter genererade preview-värdar så spelet går att provspela direkt. | `scripts/verify-round.mjs`, `package.json`, `.github/workflows/quality.yml`, `vite.config.ts` | OK |

## Kö inför kommande rundor

Låg risk först. Inget här är påbörjat.

| Prio | Idé | Varför det gör spelet bättre | Risk |
|------|-----|-----------------------------|------|
| 1 | **Spökkatt / race mot dig själv**: spela in bästa rundans positioner per nivå och rita en halvtransparent katt som kör bredvid. Kräver **deterministiska banor** (seedad `Math.random` i `setupLevel`), vilket i sig gör banor inlärningsbara och gör dagens "Dagens runda" till en riktig utmaning. | Största möjliga "en runda till"-känsla och en tydlig mastery-kurva. | Medel |
| 2 | **Riktig daglig utmaning**: fast seedat banlayout + lokal daglig topplista och streak, i stället för att bara hoppa till en slumpad nivå. | Ger en anledning att komma tillbaka varje dag. | Medel |
| 3 | **Prestationer som toast i spelet** i stället för först på Game Over. | Omedelbar belöning precis när man gör något häftigt. | Låg |
| 4 | **Autosikte v2**: bossar som mål, ledande skott på rörliga fiender, kontroll mot väggar, valbart i inställningar. | Mobilspelare får samma chans som tangentbordsspelare. | Medel |
| 5 | **Skuggfiende** på var fjärde nivå: tåler bara skuggsprängning/dash, skott går igenom. | Ger den nya mekaniken ett tydligt syfte och tvingar fram variation. | Låg |
| 6 | **Fler prestationer, skins och "nästan mål"-indikatorer** ("12 fisk kvar till Frost"). | Synlig progression för mycket lite kod. | Låg |
| 7 | **Adaptiv musik + fps-vakt**: musiken följer combo, partikeltätheten sänks automatiskt vid låg fps. | Jämn 60 fps och modernare ljudbild på svaga mobiler. | Medel |
| 8 | **Touch-inställningar**: knappstorlek, vänsterhandsläge, gester för dash. | Mobilen är halva spelbasen. | Medel |
| 9 | **CI på pull requests** med `verify:round` + enhetstester för `registerCombo`/`mulberry32`. | Fångar regressioner innan de når spelare. | Låg |
| 10 | **Prestanda**: dela upp 550 kB-bundlen med dynamiska importer (3D-preview, butik) och versionssäkra service workerns cache. | Snabbare första laddning och färre offline-buggar. | Medel |

## Regler från VISION.md som alltid gäller

- En liten, verifierbar förbättring per runda.
- `npm run build` och `npm run typecheck` ska alltid vara gröna.
- Bevara banor, sparad progress (`ProgressContext`) och ljud.
- Inga mörka mönster: ingen pay-to-win, inga lurande timers, inga tvingande annonser.
- Inga hemligheter eller API-nycklar i klientkoden.
- Nya spelartexter läggs in på alla fem språk i `i18nStrings.ts`.
