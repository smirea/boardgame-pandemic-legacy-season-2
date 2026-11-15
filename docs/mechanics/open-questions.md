# Open questions

This file lists what this catalogue could not confirm, where sources conflict, and which rulings are inferred. Each item names the section it affects and a proposed engine default. Because the user's game uses an original theme and campaign, many of these are design decisions rather than facts to recover.

## Q-1. Sources not found

- **Rule sticker text.** The rulebook has 23 rule sticker slots (A to W) and 8 action slots (J to Q). No source transcribes the stickers. The mapping from letter to rule is known for only a few: A covers forsaken cities (FAQ), D replaces setup infection, R replaces the Epidemic infect step. E is probably the epidemic-count rule, U probably the Hollow Men loss condition, and W probably the Hollow Men population step. B, C, F to Q, S, T, and V are unmapped. Affects [L-0](legacy-progression.md#l-0-how-content-unlocks-r-c).
- **Board print values.** The per-month supply track, the per-month required-objective count, the per-space Infection Rate values, and the Incident track length are printed on the board. The board is not in the rulebook PDF in readable form. Values in this catalogue come from campaign logs.
- **Package and dossier contents.** No complete list exists. The catalogue rebuilds them from two full campaign logs, one partial log, and forum threads.
- **Legacy deck text.** Not transcribed anywhere found. The month timeline in [L-13.1](legacy-progression.md#l-131-objectives-by-month-c) is rebuilt from logs.
- **Final scoring table.** The point values in [L-15](legacy-progression.md#l-15-campaign-end-and-final-scoring-c-i) are inferred. Four published breakdowns on BoardGameGeek reconcile exactly with 50 per early win, 30 per late win, 1 per population point, 100 for the sample, 25 per lab, and minus 5 per forsaken city. No source prints the table. The rating tiers are unknown.
- **The publisher's PDF link.** The Z-Man Games rulebook URL failed its TLS certificate check. The same PDF was read from a retailer mirror. A transcription site was used to read text that the PDF layout garbled.
- **Errata.** No official errata list was found. A German translation error exists for the shelter cost (the English color-match wording is correct).

## Q-2. Conflicts between sources

| Topic                                        | Source A                                                   | Source B                                                     | Default                                                       |
| -------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Which unlock gives Inoculate                 | Opal lab opens Package 6 (two logs)                        | The Pacific lost haven (one log)                             | Opal opens Package 6                                          |
| Jade lab effect                              | Gives the Scientist character (one log)                    | Changes Epidemic infect to remove only 1 cube (another log)  | Both may be true. Treat the second as unconfirmed.            |
| Hollow Men per city                          | Penalty on the 4th figure (FAQ, one log shows 3 in a city) | Penalty on the 3rd (one log)                                 | Max 3, penalty on the 4th                                     |
| Package with Hollow Men                      | Package 2 (rulebook route, two logs)                       | Package 8 (one log, likely a numbering slip)                 | Package 2                                                     |
| Monitor result                               | All 4 cards discarded (FAQ, two logs)                      | One log reports gaining a card                               | Discard all 4. The gained card was likely a frequency reward. |
| Supply track                                 | January 33, minus 3 per month (one log)                    | 36 cubes in the box, but two +15 bonuses push December to 30 | See Q-3                                                       |
| Chart Sea Lane source                        | End of March Legacy deck (one log)                         | After the South America recon (another log)                  | Tie it to the South America package                           |
| Who may use Lockdown during an Epidemic      | Allowed between Infect and Intensify (most posters)        | Not allowed, the Epidemic must finish (some)                 | Allow it                                                      |
| Hollow Men exposure on another player's turn | Any movement counts (most posters)                         | Only on your own turn (a minority reading)                   | Any movement counts                                           |

## Q-3. Arithmetic that does not close

- The box has 36 supply cubes. A stockpile of 33 plus +15 bonuses would exceed 36. Either packages add cubes, or the bonus pulls from a cube pool not recorded here. Default: give the engine an unbounded cube pool and enforce only the stockpile count.
- The epidemic-count table in [L-4](legacy-progression.md#l-4-stretched-too-thin-epidemic-count-c) fits six data points but is not printed anywhere found. Its band edges are a guess.
- The starting population of each of the 9 cities is not confirmed. Their sum is 27 if each city has one Infection card per point of population.

## Q-4. Rules with no ruling

- Whether a haven at 3 Plague cubes chains an outbreak. Default: no.
- Whether a haven can hold a satellite tower or shelter. Default: no, both name cities.
- Whether a city can hold more than 1 tower or shelter. Default: no.
- The base cube cost of Chart Sea Lane. Default: 2, matching Establish Supply Line.
- The supply counts of Hollow Men figures and shelters. Default: 16 figures, 5 shelters (guess).
- The full effect of Portable Antiviral Lab cards.
- The Hollow Men Assemble card effect in December.
- The second and later Turning Point conditions.
- The complete list of starting job stickers. Five are confirmed by two logs.
- How many check boxes each Produce Supplies card has. The FAQ mentions three.
- Whether a spent companion is discarded or destroyed.
- What "access a lost haven" requires (a pawn arriving, or a connection).
- Whether the shelter blocks only Hollow Men population loss, or also Plague cube loss. Logs say Hollow Men only.
- Whether the Carrier scar's card cost applies to havens. One forum answer says no, because it names cities.

## Q-5. Inferred rulings in this catalogue

- [C-3](core-rules.md#c-3-setup-r) step 5 holds the epidemic-count rule.
- [L-4](legacy-progression.md#l-4-stretched-too-thin-epidemic-count-c) piles match the epidemic count.
- [L-12](legacy-progression.md#l-12-new-game-end-purchases-c) permanent tower and shelter counts are unknown.
- [L-13.1](legacy-progression.md#l-131-objectives-by-month-c) April to June keep March's set.
- [L-15](legacy-progression.md#l-15-campaign-end-and-final-scoring-c-i) point values.
- [K-3.4](components.md#k-34-tracks-and-areas-on-the-board-r-c) supply track values.
- [L-5.2](legacy-progression.md#l-52-companions-c) companions persist like Unrationed Events.

## Q-6. Design notes for an original campaign

- The original's month-by-month content is story-gated. An original campaign can keep the same mechanic order (supply lines and search first, then sea lanes and epidemic scaling, then flights, then the enemy faction, then towers, then shelters, then the endgame) without copying any content.
- Every number above that is marked [I] or listed here is a tuning knob. Expose it as configuration.
