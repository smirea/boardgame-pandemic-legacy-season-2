# Engine coverage

How `packages/game` covers the 170 interactions in [interactions.md](interactions.md). Numbers refer to that file. Anything not listed below is implemented to the catalogue.

## How it is checked

- `packages/game/src/machine.test.ts` drives the real machine. Every action, job, ability, scar, event, companion, card improvement, purchase, objective, and campaign rule has at least one test.
- `packages/game/src/bot.test.ts` plays a full campaign with a random bot (`CAMPAIGNS=200` plays more seeds) and checks invariants after every command: no card in two places, cube totals conserved, piece counts never negative, deck bookkeeping in step. The bot never wins, so it proves the game cannot get stuck or corrupt its state. It does not prove a rule is right.
- Three AI players played the whole year, then four staged tour games for the branches that campaign did not take, and one whole game by clicks alone. Counted from the recordings (`./apps/playtest/lab coverage campaign-2 tour-october tour-november ui-january tour-searches`), all 227 mechanics the lab tracks have happened in play: every action, event, companion, decision, purchase, job, bundle, Legacy card, objective, scar, ability held, kind of search result, infection outcome and exposure outcome. `docs/playtest/campaign-2.md` and `docs/playtest/tour.md` have the detail.
- An independent review and a three-player playtest each found rule or UI bugs after earlier passes. Those are fixed and have regression tests. Expect more of that kind.

Content is authored for this project where the sources had no data: 12 events, 9 companions, 17 abilities, 5 scars, 4 Infection card improvements, search results per city, the ten Monitor rewards, and the Legacy deck as 24 functional cards (two per month) that unlock each mechanic in the month the sources report.

## Built differently

| #   | Interaction             | What the engine does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43  | Supply line geometry    | Legal city pairs and the course of each line are precomputed by `apps/ui/scripts/gen-geometry.ts` from the coastline the board draws. A line takes the largest gentle arch that keeps over land, apart from a small tolerance for lakes and coarse coasts, and clear of other cities; some run straight. At play time a line may not cross another supply line or unexplored map, tested on that course (`routeCourse`). Unexplored map is the ground nearest to an unrevealed location (`nearestLocation`), weighed by the location's `groundWeight`: Paris claims less, so the Bay of Biscay, Iberia and the western Mediterranean are not its ground.                    |
| 45  | Sea lane geometry       | Legal port pairs are precomputed the same way. A lane keeps to the sea: a gentle arch where open water allows, else the shortest single Bézier sweep or a smooth curve around the coasts. Panama and Suez are closed. At play time a lane may not cross another sea lane or unexplored map, and may cross at most one region line, all tested on the course the board draws. Region lines are where `regionAt` changes, the same partition the board draws. The starting lanes are laid out together: none crosses, runs alongside or over a port of another, and each keeps a board unit clear of ground hidden at the start, so none is drawn over fog (`board.test.ts`). |
| 13  | Picking Rationed Events | The first N are preselected. The group swaps picks before confirming.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 49  | Monitor rewards         | All ten frequencies do something: three open content, six keep 1 or 2 of the cards Monitor just revealed, one is empty. Which frequency does what is this project's choice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 104 | Impossible objectives   | The group marks an objective impossible by clicking it. The remaining objectives then decide the win. The engine does not judge impossibility itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 115 | Triangulate reward      | Completing it removes the objective and the briefing names the three Monitor frequencies that open content.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 121 | Shelters at game end    | A shelter cancels the population loss from Plague cubes as well as from Hollow Men. The prose catalogue (L-9.7, L-11) says Hollow Men only. The photographed rule sticker in `data/legacy-timeline.json` (unlock 27) says both steps are skipped, and the engine follows the sticker.                                                                                                                                                                                                                                                                                                                                                                                       |
| 126 | October turning point   | Folded into the Defect objective, which opens its reward the moment a Hollow Man stands in each of 3 different havens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 96  | Haven worker exposure   | The worker returns to its home haven at once, instead of choosing any haven at its next turn.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

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

## Campaign review

A month-by-month review of the content pack against the research (November 2026) found sixteen differences. Twelve are fixed and tested in `machine.test.ts`. The last two fixed were the sea route from Lima to the eastern Pacific haven, which now arrives with South America, and August's free ability units, which the game screen now offers during setup.

One of the sixteen was not a difference in play: the losing-streak turning point would count prologue losses, but the prologue never records a result.

The rest are places where the research does not settle the rule. The engine's reading is recorded here so it is a decision, not an omission:

- **Permanent supply center stickers.** The research says May adds more stickers and gives no count for either batch. The engine has one limit of 6 for the whole year.
- **A forced region's printed line.** A region opened by a perimeter report arrives with its printed line (Jakarta to Kolkata, Utopia to Shanghai). The research calls those cities "connected" and "on the grid". The engine draws the line, and the city is on the grid only if the other end is, which is how every other line works.
- **Europe's forced month.** One source forces Europe in June with Frankfurt ruined, the other records no forced date. The engine follows the first.

## Rules audit

An independent audit (November 2026) checked all 170 interactions against the engine and proved each defect with a test: 135 correct, 12 declared here, 6 the research cannot decide, and 17 wrong or partial, which came down to 13 defects. Twelve are fixed, with tests in `mechanics.test.ts` under "defects found by the rules audit":

- A draw that cannot be made loses the game. Scavenge and Monitor need 4 Player cards left.
- An Epidemic respects the improvement on the card it strikes with (Well Stocked, Rebirth).
- No Event may be played while a drawn card is still being resolved. Resilience during an Epidemic is the exception its text grants.
- An Epidemic also waits before the reshuffle when a Lockdown card is in the discard pile.
- Taking the sample needs two free slots for the Carrier scar.
- A city emptied mid-game by a fourth Hollow Man is infested at once.
- Monitor keeps only cards it revealed.
- The hand limit waits until both cards of the draw are in hand.
- A game seats 2 to 4, and a haven worker only when no living character is free.
- Population is bought in whole steps.
- A game result records who played.

The thirteenth was not a defect: **Triangulate needs blue, yellow and black**. The prose catalogue shortens this to "three different colours". The objective text recorded in `data/legacy-timeline.json` names those three colours, and the engine follows it.

## Checked against a real campaign table

A Tabletop Simulator save of a group's campaign, between July and August, was read piece by piece (November 2026): every card, sticker, token, bag and pen stroke. Where the table shows a rule or a count the research did not have, the engine now follows the table. Names and wording stay this project's own.

- **Character cards.** The ten Character cards have fixed exposure layouts (`pack.characterCards`), dealt from a shuffled pool. A new character takes the next unused card, and none can be made once all ten are in use. The box that kills is anywhere from the 4th to the 7th.
- **Player cards per city.** A city outside the starting grid has one Player card per point of its starting population. Lima starts at 1 and the eastern Pacific haven at 3.
- **Sticker stock.** Abilities, card improvements, permanent structures and scars are counted stickers. Buying one or taking a scar removes it from the box. Fifteen scars are in the box from the first game, ten of them new: Wasteful, Landsick, Fixated, Rattled, Squeamish, Frail, Haunted, Grasping, Exacting and Wary.
- **Abilities.** Eleven abilities are in the box from the first game (`pack.startingAbilities`). May's report adds Lookout, Scout and Smuggler. Costs follow the table: Helmsman 3, Courier 3, Supplier 3, Outrider 3, Facilitator 2, Foreman 2, Coordinator 2, Runner 1, Smuggler 1, Record Keeper 1. Outrider is the recon discount and Surveyor leaves Hollow Men without exposure. Supplier moves a stockpile cube, once per turn. Facilitator is once per turn. Lookout takes the discard pile card into hand before searching. Two are new: Coordinator (free, pull a pawn from an adjacent location) and Smuggler (an action, discard a City card to put a reserve cube there).
- **Jobs.** The Instructor gives a card once per own turn and only gives. The Captain's crossing is a free action. The Radio Operator transfers at a distance only on their own transfer.
- **Events.** The Rationed Events in the box from the start are Airlift, Quiet Night, Resilience and Handout. January adds Card Swap, Spread Out, Cleanse and Forecast, February Cache, Encore and Second Wind (now 3 actions), June Mass Inoculation and Open Waters (the active player's own free lane, from their port). Each region's explorer reward is its own Unrationed Event: Purge for North America, Stock Up (8 cubes) for South America, Exile for Europe, Antidote for Africa, Mentor for the Middle East. Antidote holds a drawn Epidemic open until the table plays it or passes. Mass Inoculation, like Resilience, may wait on an Epidemic's reshuffle. Supply Drop is gone.
- **The eastern Pacific haven.** South America no longer reveals it, May's report does, with its sea route from Lima. Reaching it brings Inoculate, storage, 15 more stockpile cubes and three Surplus cards that stay in the Player deck and are played after Make Supplies for 3 more cubes.
- **Card improvements.** April's improvement is Cordon, two of them at 1 unit each. Rebirth arrives with East Asia instead.

## UI simplifications

- Actions that pay with cards (Build Supply Center, Recon) pick the cheapest legal payment for the player.
- Deliver and Pick Up offer "all" or "one".
- Every client holds the full state. The UI simply does not show deck order or unscratched boxes.
- A prompt is offered only to whoever it belongs to. Shared prompts ("any player may discard") show each player their own cards, and the player whose turn it is may pass.
