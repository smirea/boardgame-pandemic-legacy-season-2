# Campaign 1: three Grok players, January to December

The record of the first full playtest campaign. Run `campaign-1`, seed 20261115, config `apps/playtest/configs/campaign.json`. Players: Vex (high-risk, ruthless), Sol (safe, risk-averse), Kit (opportunistic), all `grok-4.7-build-fast` at medium effort, each in a browser tab, one game per session, with a memory file carried between games.

Each game below has the result, the story, the parity verdict against the research, what the players reported, and what was fixed.

## January, first attempt: lost

**Table.** Vex as Hazard (Instructor, Northwatch), lead. Sol as Reed (Farmer, Midsea). Kit as Joss (Laborer, Southreach).

**Story.** Four cubes went on each of the nine cities. Jacksonville took three opening infections and Reed spent the early turns restocking it. The first epidemic stripped London. Joss collected blue cards in Washington, built the first supply center there as a Laborer (four cards and two cubes), and reconned North America: Chicago joined the grid and five more cities appeared off it. Reed built the second center in São Paulo with five yellow cards, two handed over by Hazard. Plague then settled in Cairo, Istanbul, Tripoli, Jacksonville and Washington. With the third center two cards away in Cairo, an epidemic hit empty Tripoli and the eighth incident ended the game on turn 18.

**Highlights.**

- First recon of the year: North America, opened by the players in January, a month before its forced deadline.
- The table argued over Quiet Night twice, then played it at the worst moment and watched it skip the wrong step (see findings).
- Game end: Jacksonville, Istanbul, Tripoli and Cairo each lost 1 population. 3 production units bought Helmsman for Hazard and Well Stocked on a Cairo Infection card.

**Parity.** All four checks against the research timeline passed: 2 objectives required, Build 3 supply centers (mandatory) and Recon a region in play, 36 cubes. Legacy card 01-01 was read at setup and 01-02 at game end, both in January. The recon opened North America and unlocked Supply Line and Search, as the research schedules.

**Findings and fixes.** 34 reports.

| Finding                                                                                                 | Kind        | Fix                                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Second Wind was accepted during the Infect step, left the hand, and did nothing                         | Engine bug  | Refused outside the action step. The step is now part of play legality, so the option list and the refusal agree. Test added. |
| Quiet Night played at the start of an Infect step did not skip it and skipped the next player's instead | Engine bug  | Played before the first flip, it skips the step it is played in. After a flip it waits for the next. Tests added.             |
| Shop showed every purchase at cost 1; Helmsman charged 2                                                | Lab bug     | Each option shows its own cost and what it does.                                                                              |
| Events and shop items had no description                                                                | Lab gap     | Card and upgrade text is shown beside every option.                                                                           |
| The active player saw only `undo` while another player was over the hand limit                          | Lab gap     | The view now says who the game is waiting on and warns against undoing.                                                       |
| Re-sending the same event picks said "REFUSED: host state did not change"                               | Lab wording | Says nothing changed.                                                                                                         |
| Epidemic chance looked wrong (33% with 4 in 32 cards)                                                   | Not a bug   | The deck is stacked in piles with one epidemic each, so the odds follow the pile. The view and guide now explain it.          |
| Infection rate stayed 2 after the first epidemics                                                       | Not a bug   | The track is 2, 2, 2, 3. The view now prints the track with a marker.                                                         |
| Pick Up and Transfer cost no action                                                                     | Not a bug   | Free actions in the research rules. Guide corrected.                                                                          |
| Local Produce not offered in an ordinary city                                                           | Not a bug   | Both modes need a haven or supply center. Guide corrected.                                                                    |
| Search, Supply Line and Shuttle were not offered                                                        | Not a bug   | They unlock later (Search and Supply Line with the first region). Guide corrected.                                            |
| Cities at no risk showed no percentage                                                                  | Lab gap     | Shows 0%.                                                                                                                     |
| New region's City cards appeared in the discard pile                                                    | Not a bug   | The research rule: new cards enter through the discard piles.                                                                 |
