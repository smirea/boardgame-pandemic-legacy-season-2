# Tour games: the parts of the year the campaign did not reach

Campaign 2 played January to December and touched 158 of the 182 mechanics the playtest lab tracks. The other 24 sat on paths that group never took: two recons, six searches, two jobs, three abilities, half of the Plan, an outbreak, and a death. Unit tests covered them. No player had played them.

Three tour games closed that. The same three Grok players (Vex, Sol, Kit) played staged games through the real app, one browser tab each. A stage arranges the table once, on the first action step: pawns, hands, a few cubes, the top of a deck. Every move after it is a player's command, checked by the engine like any other. `apps/playtest/README.md` describes how stages work.

```sh
./apps/playtest/lab coverage campaign-2 tour-october tour-november
```

```
Runs: campaign-2 (16 games, 9 won), tour-october (1 games, 0 won), tour-november (2 games, 1 won).
182 of 182 tracked mechanics happened in recorded play.
First seen in tour-october (17): action:sabotage, action:broker, action:destroyInfection, play:medic, play:purifier, play:shelterWright, play:marksman, decide:replace, decide:freeEdge, decide:shield, bundle:coral-sea, bundle:new-zealand, bundle:jade, infect:outbreak, exposure:skull, log:death, command:WAIVE_OBJECTIVE.
First seen in tour-november (7): action:facilitate, job:scientist, job:vectorControl, bundle:plan-red, bundle:plan-blue, objective:plan, exposure:worker.
Never seen in recorded play (0): none.
Invariant and schedule problems (0):
```

The count comes from the recordings, not from the lab's running tally. `lab coverage` replays every recorded state change of the named runs through the audit. That also corrected the campaign's own number: the lab had been restarted between games to pick up fixes and had missed both turning points, so the campaign's real count is 158, not 156.

## The games

| Run           | Game                     | Result        | What it played for the first time                                                                                                                                                                                                            |
| ------------- | ------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tour-october  | October                  | Lost, turn 16 | Coral Sea and New Zealand recons, the Topaz shield, the Jade lab, a free supply line, Medic, Marksman, Purifier, Shelter Wright, Sabotage, Broker, an outbreak, a death and its replacement, the Scientist's free action, a waived objective |
| tour-november | November, first attempt  | Lost, turn 15 | The Scientist and the Vector Control Expert as played jobs, Facilitate, the blue Plan step, a haven worker taking a dead character's seat, the worker's exposure                                                                             |
| tour-november | November, second attempt | Won, turn 3   | Plan steps carried over from a lost game, the red Plan step, the Plan completed, Utopia earned                                                                                                                                               |

The replays page plays each game back with the players' reasons and table talk, and the notes on each game are in `apps/playtest/notes/tour-october.json` and `apps/playtest/notes/tour-november.json`.

## What the stages changed

Both stages keep the engine's invariants. Cubes moved onto the board come out of the reserve, and each staged plague cube counts as the incident that would have put it there. Both tour decks have no Epidemics, because the campaign played Epidemics many times and a tour game needs its turns for the rare parts. The October deck is cut to 30 cards so the game ends in about four rounds.

The first November game was lost one turn before the last Plan recon. The stage had promised a board at 3 cubes per city and the reserve ran out long before that. The second attempt needed no help: three Plan steps had carried over, and the fourth won the game.

## What the players found

Thirty-one reports across the three games. None was a rule the engine got wrong. All were things the game did without saying so:

- A companion card changed the board and wrote nothing to the log.
- After a death, the log named the replacement as the one who died.
- A hand-limit discard and a passed choice left no line in the log.
- System-wide Produce did not say where the cubes went or which sites went without.
- Briefings did not explain a lab, read a found job as a new rule, called a haven off the grid when its sea lane arrived with it, and did not say where an earned Rationed Event goes.
- Supply Drop and Stock Up were refused with an empty reserve and gave no reason.

Each is fixed, with tests in `mechanics.test.ts` where the engine changed.
