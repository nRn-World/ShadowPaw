# Vision för ShadowPaw

Ägarens mål (2026-10-20): agenterna ska ständigt förbättra spelet så att det blir **unikt, modernt och ett spel man vill komma tillbaka till**.

## Designmål
- **Unikt:** egen identitet (neon-cyberpunk, katt med personlighet). Mekaniker som inte finns i vanliga plattformsspel: t.ex. skuggmekanik, kombosystem, risk/belöning.
- **Modernt:** snabb och mjuk känsla (60 fps), juicy feedback (partiklar, screen shake, ljud, haptik på mobil), polerad UI, PWA/offline, bra mobilstöd.
- **Beroendeframkallande på ett schysst sätt:** "en runda till"-känsla genom tydlig progression, snabba omstarter, dagliga utmaningar, achievements, upplåsbara skins/förmågor, mastery-kurva, high scores. Inga mörka mönster: ingen pay-to-win, inga lurande timers, inga tvingande annonser.

## Spelregler för agenterna
- En liten, verifierbar förbättring per körning hellre än en stor och riskabel.
- Spelet måste alltid gå att bygga (`npm run build`) och starta.
- Bevara befintliga banor, sparad progress (ProgressContext) och ljud om inte en punkt uttryckligen ändrar dem.
- Inga hemligheter eller API-nycklar i klientkoden.
