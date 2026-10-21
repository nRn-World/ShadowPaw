# Agentflöde för ShadowPaw

Tre agenter arbetar i serie. Filer i denna mapp är överlämningen mellan dem.

| Steg | Agent | Läser | Skriver |
|------|-------|-------|---------|
| 1 | `agent1-analyst` | hela projektet | `01-analys.md` |
| 2 | `agent2-ideas` | `01-analys.md` + koden | `02-idéer.md` |
| 3 | `agent3-builder` | `02-idéer.md` (endast GODKÄNDA) | koden + `03-bygglogg.md` |

## Godkännande
Ägaren har förhandsgodkänt punkter som tjänar `VISION.md` och har låg/medelhög risk; Agent 2 märker dem `Status: GODKÄND`.
Högriskpunkter förblir `FÖRESLAGEN` tills ägaren ändrar dem. Agent 3 bygger bara GODKÄNDA punkter.
Allt arbete samlas på branchen `agents/auto` med en enda öppen pull request mot `main`. Ingenting går direkt till `main`.

## Köra om
Starta om flödet när som helst: Agent 1 skriver över `01-analys.md`, och så vidare. Historik finns i git.

## Fyrstegsflöde (gäller från omgång 4)
| Steg | Agent | Uppgift | Skriver |
|------|-------|---------|---------|
| 1 | `agent1-analyst` | Går igenom all kod, granskar förra omgången och kommer på nya idéer | `01-analys.md` |
| 2 | `agent2-ideas` | Analyserar Agent 1:s rapport och bestämmer vad Agent 3 ska bygga | `02-idéer.md` |
| 3 | `agent3-builder` | Bygger godkända punkter | koden + `03-bygglogg.md` |
| 4 | `agent4-verifier` | Kontrollerar att allt är byggt utan fel | `04-verifiering.md` |

Hittar Agent 4 fel (`Resultat: UNDERKÄND`) skickas felrapporten till alla agenter och omgången börjar om med rättning (högst 3 varv, därefter revertas de felande punkterna).
Hittar Agent 4 inga fel (`Resultat: GODKÄND`) pushas grenen och en pull request öppnas och mergas, så att uppdateringar går live direkt efter varandra. Blockeras mergen av en behörighetskontroll lämnas PR:en öppen.
