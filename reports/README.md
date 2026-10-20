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
