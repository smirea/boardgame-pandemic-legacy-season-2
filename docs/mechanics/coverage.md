# Engine coverage

How `packages/game` covers the 170 interactions in [interactions.md](interactions.md). Numbers refer to that file. Anything not listed below is implemented to the catalogue.

## How it is checked

- `mechanics.test.ts` and `rules.test.ts` drive the real machine. Between them every action, job, ability, scar, event, companion, card improvement, purchase, objective, and campaign rule has at least one test.
- `campaign.test.ts` plays full campaigns with a random bot and checks invariants after every command: no card in two places, cube totals conserved, piece counts never negative, deck bookkeeping in step. The bot never wins, so it proves the game cannot get stuck or corrupt its state. It does not prove a rule is right.
- `apps/ui/e2e/october.ts` plays a whole October game through the built UI in a headless browser: lobby, setup, every turn, the game-end spending step, and the next game's setup.
- An independent review and a three-player playtest each found rule or UI bugs after earlier passes. Those are fixed and have regression tests. Expect more of that kind.

Content is authored for this project where the sources had no data: 12 events, 9 companions, 17 abilities, 5 scars, 4 Infection card improvements, search results per city, the ten Monitor rewards, and the Legacy deck as 24 functional cards (two per month) that unlock each mechanic in the month the sources report.

## Built differently

| #   | Interaction             | What the engine does                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43  | Supply line geometry    | A line is straight. Legal city pairs are precomputed by `apps/ui/scripts/gen-geometry.ts` from the coastline the board draws: over land apart from a small tolerance for lakes and coarse coasts, and clear of other cities. At play time a line may not cross another supply line or unexplored map. Unexplored map is the ground nearest to an unrevealed location (`nearestLocation`). |
| 45  | Sea lane geometry       | Legal port pairs are precomputed the same way. At play time a lane may not cross another sea lane or unexplored map, and may cross at most one region line. Crossings are tested on the straight chord between the ports, though a drawn lane may curve. Region lines are where `regionAt` changes, the same partition the board draws.                                                   |
| 13  | Picking Rationed Events | The first N are preselected. The group swaps picks before confirming.                                                                                                                                                                                                                                                                                                                     |
| 49  | Monitor rewards         | All ten frequencies do something: three open content, six keep 1 or 2 of the cards Monitor just revealed, one is empty. Which frequency does what is this project's choice.                                                                                                                                                                                                               |
| 104 | Impossible objectives   | The group marks an objective impossible by clicking it. The remaining objectives then decide the win. The engine does not judge impossibility itself.                                                                                                                                                                                                                                     |
| 115 | Triangulate reward      | Completing it removes the objective and the briefing names the three Monitor frequencies that open content.                                                                                                                                                                                                                                                                               |
| 121 | Shelters at game end    | A shelter cancels the population loss from Plague cubes as well as from Hollow Men. The prose catalogue (L-9.7, L-11) says Hollow Men only. The photographed rule sticker in `data/legacy-timeline.json` (unlock 27) says both steps are skipped, and the engine follows the sticker.                                                                                                     |
| 126 | October turning point   | Folded into the Defect objective, which opens its reward the moment a Hollow Man stands in each of 3 different havens.                                                                                                                                                                                                                                                                    |
| 96  | Haven worker exposure   | The worker returns to its home haven at once, instead of choosing any haven at its next turn.                                                                                                                                                                                                                                                                                             |

## Partly built

| #      | Interaction                      | Gap                                                                                                   |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 38, 54 | Share Knowledge and taking cubes | The other player's agreement is not asked for. Undo covers a mistake.                                 |
| 36     | Produce with a short stockpile   | The engine takes a priority order. The UI does not offer it yet and fills the current location first. |
| 142    | Character creation               | Name, job and home. No age or portrait.                                                               |

## Not built

Nothing from the catalogue is left unbuilt. Two things rest on thin sources and are this project's reading:

- **The Jade lab's gentler Epidemic.** One campaign log reports it. Finding the lab makes an Epidemic remove 1 cube from the struck city instead of all of them.
- **Seven abilities the sources name.** Investigator and Supplier have described effects, and the two effects that logs describe without a name are given to Facilitator and Runner. Foreman, Outrider and Soldier are named in logs with no effect recorded, so their effects are authored here: a cheaper supply line, no exposure when leaving Hollow Men, and removing a Hollow Man from your own location.

## Known gaps from the campaign review

A month-by-month review of the content pack against the research (November 2026) found sixteen differences. Ten are fixed and tested in `mechanics.test.ts` under "parity gaps found by the static review". These are left as they are:

- **Lima's printed route to the eastern Pacific haven** (one source). The haven is found by a sea search at Los Angeles or San Francisco, or by the May perimeter report.
- **Extra permanent supply center stickers in May.** The count is not recorded. The limit stays at 6.
- **A forced region can leave a city off the grid.** Utopia joins only through Shanghai and Jakarta only through Kolkata. If the players never connected those, the forced city is revealed but still needs a supply line.
- **August's free ability units in the UI.** The engine and the playtest lab let the group spend them at setup, as the research says. The game screen still offers them at game end only.
- **The losing-streak turning point** would count prologue losses. The prologue never records a result, so this cannot happen in play.

## UI simplifications

- Actions that pay with cards (Build Supply Center, Recon) pick the cheapest legal payment for the player.
- Deliver and Pick Up offer "all" or "one".
- Every client holds the full state. The UI simply does not show deck order or unscratched boxes.
- A prompt is offered only to whoever it belongs to. Shared prompts ("any player may discard") show each player their own cards, and the player whose turn it is may pass.
