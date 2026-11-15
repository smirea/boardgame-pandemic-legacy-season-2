# Engine coverage

How `packages/game` covers the 170 interactions in [interactions.md](interactions.md). Anything not listed here is built as the catalogue describes it. Numbers refer to that file.

Content is authored for this project where the sources had no data: 12 events, 9 companions, 10 abilities, 5 scars, search results per city, and the Legacy deck as 24 functional cards (two per month) that unlock each mechanic in the month the sources report.

## Built differently

| #   | Interaction             | What the engine does                                                                                                                                                                               |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43  | Supply line geometry    | Legal city pairs are precomputed from real geography by `apps/ui/scripts/gen-geometry.ts` (land share, length, clearance from other cities). Crossing another supply line is checked at play time. |
| 45  | Sea lane geometry       | Legal port pairs are precomputed the same way. "At most one red line" is modelled as: the two ports are in the same region or in neighbouring regions. Crossing another sea lane is not checked.   |
| 13  | Picking Rationed Events | The first N are preselected. The group swaps picks before confirming.                                                                                                                              |
| 115 | Triangulate reward      | Completing it removes the objective. The frequency hint is not modelled, because frequencies are not labelled.                                                                                     |
| 126 | October turning point   | Folded into the Defect objective, which opens its reward the moment 3 Hollow Men stand in havens.                                                                                                  |
| 96  | Haven worker exposure   | The worker returns to its home haven at once, instead of choosing any haven at its next turn.                                                                                                      |

## Partly built

| #      | Interaction                      | Gap                                                                                                        |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 36     | Produce with a short stockpile   | Cubes go to the current location first, then the rest in list order. The player does not choose the order. |
| 38, 54 | Share Knowledge and taking cubes | The other player's agreement is not asked for.                                                             |
| 49     | Monitor                          | 3 of the 10 frequencies open content. The "take cards from the discard pile" rewards are missing.          |
| 85     | Lockdown improvement             | The `LOCKDOWN` command exists and is tested by the bot. The UI has no button for it yet.                   |
| 140    | Manual rationing change          | The `SET_RATIONING` command exists. The UI has no control for it yet.                                      |
| 142    | Character creation               | Name, job and home. No age or portrait.                                                                    |
| 154    | Perimeter reports                | All regional deadlines are in. October's extra scar penalty is not.                                        |

## Not built

| #   | Interaction                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------ |
| 86  | The Infection improvement that stops further draws for a discard                                                   |
| 104 | Treating an impossible objective as complete                                                                       |
| 141 | Naming havens                                                                                                      |
| n/a | The Jade lab's gentler Epidemic step (one source)                                                                  |
| n/a | Abilities named in logs but not described: Runner, Facilitator, Foreman, Outrider, Soldier, Investigator, Supplier |

## UI simplifications

- Actions that pay with cards (Build Supply Center, Recon) pick the cheapest legal payment for the player.
- Deliver and Pick Up offer "all" or "one".
- There is no viewer-specific hiding. Every client holds the full state and the UI simply does not show deck order or unscratched boxes.
