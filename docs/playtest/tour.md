# Tour games: the parts of the year the campaign did not reach

Campaign 2 played January to December and touched 181 of the 227 mechanics the playtest lab tracks. The other 46 sat on paths that group never took: two recons, most of the searches and their companions, two jobs, four abilities, two scars, half of the Plan, an outbreak, and a death by exposure. Unit tests covered them. No player had played them.

Four tour games closed that. The same three Grok players (Vex, Sol, Kit) played staged games through the real app, one browser tab each. A stage arranges the table once, on the first action step: pawns, hands, a few cubes, the top of a deck. Every move after it is a player's command, checked by the engine like any other. `apps/playtest/README.md` describes how stages work.

```sh
./apps/playtest/lab coverage campaign-2 tour-october tour-november ui-january tour-searches
```

```
Runs: campaign-2 (16 games, 9 won), tour-october (1 games, 0 won), tour-november (2 games, 1 won), ui-january (1 games, 0 won), tour-searches (1 games, 0 won).
227 of 227 tracked mechanics happened in recorded play.
First seen in tour-october (27): action:sabotage, action:broker, action:destroyInfection, play:medic, play:purifier, play:shelterWright, play:marksman, decide:replace, decide:freeEdge, decide:shield, bundle:coral-sea, bundle:new-zealand, bundle:jade, found:companion:medic, found:companion:purifier, found:companion:shelterWright, found:companion:marksman, abilityInPlay:broker, abilityInPlay:saboteur, abilityInPlay:facilitator, search:companion, search:freeEdge, freeEdge:land, infect:outbreak, exposure:skull, log:death, command:WAIVE_OBJECTIVE.
First seen in tour-november (7): action:facilitate, job:scientist, job:vectorControl, bundle:plan-red, bundle:plan-blue, objective:plan, exposure:worker.
First seen in ui-january (0): none.
First seen in tour-searches (12): found:companion:builder, found:companion:lineman, found:companion:rigger, found:companion:tracker, found:companion:fieldSurgeon, scar:lineExtraCube, scar:smallHand, abilityInPlay:lookout, search:stockpile, search:nothing, search:infest, freeEdge:sea.
Never seen in recorded play (0): none.
Invariant and schedule problems (0):
```

The count comes from the recordings, not from the lab's running tally. `lab coverage` replays every recorded state change of the named runs through the audit.

The catalogue grew while this was done. It started at 182 keys: every action, event and companion play, decision, purchase, job, bundle, Legacy card, objective, infection outcome and exposure outcome. The first two tours filled it. Checking what it left out found twelve more things no game had touched, so the catalogue now also counts each companion found, each scar taken, each ability held by a seated character, each kind of search result, and both kinds of free line: 227 keys. A fourth tour game played the twelve.

What the catalogue still does not count: each of the 39 search boxes by city (it counts the 11 kinds of result), and the effect of each ability in use (it counts that a seated character held it). `mechanics.test.ts` covers those one by one.

## The games

| Run           | Game                     | Result        | What it played for the first time                                                                                                                                                                                                            |
| ------------- | ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tour-october  | October                  | Lost, turn 16 | Coral Sea and New Zealand recons, the Topaz shield, the Jade lab, a free supply line, Medic, Marksman, Purifier, Shelter Wright, Sabotage, Broker, an outbreak, a death and its replacement, the Scientist's free action, a waived objective |
| tour-november | November, first attempt  | Lost, turn 15 | The Scientist and the Vector Control Expert as played jobs, Facilitate, the blue Plan step, a haven worker taking a dead character's seat, the worker's exposure                                                                             |
| tour-november | November, second attempt | Won, turn 3   | Plan steps carried over from a lost game, the red Plan step, the Plan completed, Utopia earned                                                                                                                                               |
| tour-searches | October                  | Lost, turn 19 | Lineman, Builder, Tracker, Rigger and Field Surgeon found and each changing a cost while held, the scars Injured and Burdened, a Lookout search from the discard pile, a free sea lane, and the stockpile, infest and empty search results   |

The replays page plays each game back with the players' reasons and table talk. The notes on each game are in `apps/playtest/notes/`, one file per run.

## What the stages changed

Both stages keep the engine's invariants. Cubes moved onto the board come out of the reserve, and each staged plague cube counts as the incident that would have put it there. Both tour decks have no Epidemics, because the campaign played Epidemics many times and a tour game needs its turns for the rare parts. The October deck is cut to 30 cards so the game ends in about four rounds.

The first November game was lost one turn before the last Plan recon. The stage had promised a board at 3 cubes per city and the reserve ran out long before that. The second attempt needed no help: three Plan steps had carried over, and the fourth won the game.

## What the players found

Forty-two reports across the four tour games. None was a rule the engine got wrong. All were things the game did without saying so:

- A companion card changed the board and wrote nothing to the log.
- After a death, the log named the replacement as the one who died.
- A hand-limit discard and a passed choice left no line in the log.
- System-wide Produce did not say where the cubes went or which sites went without.
- Briefings did not explain a lab, read a found job as a new rule, called a haven off the grid when its sea lane arrived with it, and did not say where an earned Rationed Event goes.
- Supply Drop and Stock Up were refused with an empty reserve and gave no reason.
- Monitor's log said it discarded a card the player had kept.

Each is fixed, with tests in `machine.test.ts` where the engine changed.

## A whole game by clicks

Run `ui-january` (`apps/playtest/configs/ui-january.json`) put all three players on the click-only harness with a new campaign. They may only `look` at the screen and `click`, `type`, `choose` and `tap` on it, which the lab turns into real mouse and keyboard input in their own tab. They played January from the empty lobby to the next lobby: 133 commands, every one sent by a click, none by key. The game was lost on turn 12.

It found what keyed play cannot:

- Seat drop-downs were local to each browser, so every player saw a different table. Seats are game state now.
- Nothing could be pressed on your own turn until you found the claim button. The screen now asks "Who do you play?".
- With a hand over the limit after the first card of a draw, the screen blocked both Draw and Discard. The engine allowed the second draw all along. The buttons now ask the engine.

Each fix was checked by clicking: the seat change and the prompt on two networked tabs through the lab, the draw in a browser against the dev server. The notes are in `apps/playtest/notes/ui-january.json`.
