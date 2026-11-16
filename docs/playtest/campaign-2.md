# Campaign 2: three Grok players, January to December

The first campaign played to the end. Run `campaign-2`, seed 20261115, config `apps/playtest/configs/campaign.json`. Players: Vex (high-risk, ruthless), Sol (safe, risk-averse), Kit (opportunistic), all `grok-4.7-build-fast` at medium effort, each in its own browser tab, one game per session, with a memory file carried between games.

Every game is recorded. The replays page plays each one back with the players' stated reasons, table talk and reports beside the moves, and the notes on each game:

```sh
./apps/playtest/lab review apps/playtest/configs/campaign.json
```

The notes themselves are in `apps/playtest/notes/campaign-2.json`.

## The year

| Month     | First attempt | Second attempt | What it opened                                                                         |
| --------- | ------------- | -------------- | -------------------------------------------------------------------------------------- |
| January   | Won, turn 18  |                | North America reconned. Supply Line and Search.                                        |
| February  | Won, turn 12  |                | Permanent supply centers.                                                              |
| March     | Lost, turn 16 | Lost, turn 9   | Eastern Pacific haven found and reached. First forsaken city. Sea Lanes.               |
| April     | Lost, turn 11 | Lost, turn 11  | South America forced. Opal lab, Inoculate, the Immunologist. Relief after four losses. |
| May       | Won, turn 15  |                | Europe reconned. Shuttle Flight.                                                       |
| June      | Won, turn 9   |                | Two new characters.                                                                    |
| July      | Won, turn 13  |                | Africa forced. Towers. Triangulate completed.                                          |
| August    | Won, turn 8   |                | Middle East forced. Hollow Men. Monitor.                                               |
| September | Won, turn 12  |                | Indian Ocean haven forced. East Asia reconned from Kolkata. Shelters.                  |
| October   | Lost, turn 14 | Won, turn 11   | Broadcast. The Hollow Men defect.                                                      |
| November  | Lost, turn 14 | Lost, turn 17  | The Plan begun: two of four recons.                                                    |
| December  | Won, turn 15  |                | Utopia forced. Pearl lab. The sample delivered.                                        |

16 games, 9 won and 7 lost. Final score 545.

## What the run showed

- **The schedule holds.** All 24 Legacy cards were read in their own month, at setup or game end as marked. Every month's objectives, required count and supplies matched the research timeline. The one difference the audit flagged, in August, was a one-time objective this group had already completed.
- **Mechanics reached in play.** 156 of 182 tracked mechanics happened at least once. Every action the campaign unlocked was used except Sabotage, Broker and Facilitate (abilities bought in December or never bought).
- **Not reached in play.** No character died and no city outbreaked. The Coral Sea haven, New Zealand, the Jade lab and the red and blue steps of the Plan were never opened, so the Topaz shield, the Scientist and Vector Control jobs, and the companions never appeared. These are covered by `mechanics.test.ts` only.
- **What the players found.** 232 reports over 16 games. About one in five was a real defect in the engine. The rest were the playtest's own text views or the rules as researched. Each game's notes list them with what was done.

## What was fixed along the way

Found by play: Quiet Night and Second Wind timing, Card Swap and Resilience options, every cube count and card payment, Captain, Runner, Courier and Sanitation Officer options, duplicate scars, the Carrier scar's slots, silent Lockdown, Cordon, Inoculate, Monitor and Scavenge, forsaken odds, briefings that did not say what was new.

Found by review: ten gaps in the month-by-month schedule, the rules for drawing supply lines and sea lanes, and twelve rule defects from an audit of all 170 interactions. `docs/mechanics/coverage.md` lists what is still built differently.
