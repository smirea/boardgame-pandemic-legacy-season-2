# Components

This file is the inventory of component types, with their counts and the state each one carries. It describes card types and the range of their effects. It does not transcribe individual cards. Tags as in [core-rules.md](core-rules.md).

## K-1. Box contents at the start [R]

| Component             | Count | Notes                                                        |
| --------------------- | ----- | ------------------------------------------------------------ |
| Board                 | 1     | Mostly empty world map. See [K-3](#k-3-board-and-graph-r-c). |
| Character cards       | 10    | Blank. 5 are created before the prologue.                    |
| Pawns                 | 4     | One per player color.                                        |
| Haven worker cards    | 4     | Fallback characters.                                         |
| Reference cards       | 8     | Player aids. Action stickers go on them.                     |
| Player cards          | 53    | 36 City, 5 Epidemic, 4 Rationed Event, 8 Produce Supplies.   |
| Infection cards       | 27    | For the 9 starting cities.                                   |
| Legacy cards          | 82    | Fixed order.                                                 |
| Prologue cards        | 2     | A story card and the prologue objective.                     |
| Dossiers              | 6     | Cardboard sheets with tear-off doors, numbered and lettered. |
| Numbered packages     | 8     | Sealed.                                                      |
| Sticker sheets        | 2     | Jobs, portraits, abilities, improvements, population values. |
| Supply cubes          | 36    | Gray.                                                        |
| Plague cubes          | 8     | Green.                                                       |
| Supply centers        | 9     | Pieces.                                                      |
| Infection Rate marker | 1     |                                                              |
| Incident marker       | 1     |                                                              |
| Tracking tokens       | 3     | For objective tracks.                                        |

Players supply a pen.

## K-2. Components added during the campaign [C]

| Component                               | Count                                                                     | Source                             |
| --------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| Map stickers                            | 1 per region, plus small stickers for lost havens and labs                | Packages and doors                 |
| City and Infection cards for new cities | About 37 more cities. Several City cards and 1 to 3 Infection cards each. | Region packages                    |
| Satellite towers                        | 6                                                                         | Africa package                     |
| Hollow Men figures                      | Not recovered                                                             | Middle East package                |
| Hollow Men Gather cards                 | 4, then 4 more                                                            | Middle East and East Asia packages |
| Hollow Men Assemble cards               | Not recovered                                                             | December                           |
| Shelters                                | Not recovered, about 5                                                    | East Asia package                  |
| Frequency Scanner card                  | 1, with 10 scratch boxes                                                  | August                             |
| Portable Antiviral Lab cards            | 3                                                                         | Package 6                          |
| Utopia Infection cards                  | 8                                                                         | Package 8                          |
| Plan cards                              | 1 or more                                                                 | East Asia package, November        |
| Permanent supply center stickers        | 6                                                                         | End of February and May            |
| Permanent tower and shelter stickers    | Not recovered                                                             | July and October                   |
| Rule stickers                           | 23 slots, A to W                                                          | Many sources                       |
| Action stickers                         | 8 slots, J to Q, on the rulebook's new-actions page                       | Many sources                       |
| Rationed Event cards                    | Several added most months                                                 | Legacy deck and doors              |
| Unrationed Event cards                  | About 1 per package, plus others                                          | Packages                           |
| Companion cards                         | 1 per companion search result                                             | Searches                           |
| Objective cards                         | About 10 over the campaign                                                | Legacy deck                        |
| Turning Point cards                     | At least 3                                                                | Legacy deck                        |
| Character cards for found characters    | Use the 5 spare blanks. Job stickers come from doors.                     | Labs, Legacy deck                  |
| Lab marker stickers                     | 4                                                                         | December                           |

When a supply count says "not recovered", the engine needs a value. See [open-questions.md](open-questions.md).

## K-3. Board and graph [R] [C]

### K-3.1 Starting graph [R]

- 3 starting havens, named by the players. All are ports.
- 9 starting cities, all ports: New York, Washington, Jacksonville, São Paulo, London, Istanbul, Tripoli, Cairo, Lagos.
- 12 starting locations in total, all on the grid.
- No supply lines exist. Every starting edge is a printed sea lane.
- Starting populations range from 1 to 3 per city. Their sum is 27, the number of starting Infection cards [I].

### K-3.2 Full graph [C]

| Region                     | Cities              | Notes                                        |
| -------------------------- | ------------------- | -------------------------------------------- |
| Start                      | 9                   | All connected                                |
| North America              | 6                   | One may auto-connect if forced               |
| South America              | 4                   |                                              |
| Europe                     | 4                   |                                              |
| Africa                     | 5                   | Some start infested [C]                      |
| Middle East and South Asia | 6                   | Kolkata hosts the East Asia recon route      |
| East Asia                  | 9                   | Mostly reached by sea lanes                  |
| Late locations             | 3                   | Utopia, Wellington, Lake Baikal              |
| Total cities               | about 46            | One log reports 44 connected with 2 left out |
| Havens                     | 3 start plus 3 lost |                                              |

The rulebook's city list has 52 rows [R]. The production table tops out at "43 or more" [R].

### K-3.3 Edges [R] [C]

| Edge type           | Joins      | Created by                                    | Persistent          |
| ------------------- | ---------- | --------------------------------------------- | ------------------- |
| Printed sea lane    | Two ports  | The board or a map sticker                    | Yes                 |
| Printed supply line | Two cities | Some map stickers                             | Yes                 |
| Drawn supply line   | Two cities | Establish Supply Line, search results, Events | Yes, written in pen |
| Drawn sea lane      | Two ports  | Chart Sea Lane, search results, Events        | Yes, written in pen |

Edges are undirected. Red region lines are board features that limit sea lanes ([L-7](legacy-progression.md#l-7-chart-sea-lane-c)).

### K-3.4 Tracks and areas on the board [R] [C]

| Board element             | State                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Objectives area           | Objective cards in play. Overflow goes beside the board.                                                                                        |
| Required-objectives track | One printed number per month [C]                                                                                                                |
| Supply track              | One printed cube count per month. Reported as 33 in January, falling by 3 each month to 0 in December [I]. Lost haven bonuses add +15 each [C]. |
| Infection Rate track      | Starts at the leftmost "2". Maximum rate 5. Room for 10 epidemics [C]. Exact per-space values not recovered.                                    |
| Incident track            | Starts at 0. The last space is a loss. Reported as 8 incidents to lose [C].                                                                     |
| Game End area             | Cards waiting for Game End step 3, and the production table                                                                                     |
| Supply cube stockpile     | Count of cubes this game                                                                                                                        |
| Map sticker zones         | Hidden regions, aligned by latitude and longitude                                                                                               |

## K-4. Card state [R] [C]

| Card                   | Static data                                               | Mutable state                                                                                                                                          |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| City card              | City, color, id                                           | 1 improvement slot (sticker or empty). 0, 1, or 2 search boxes (scratched or not). Destroyed flag. Location (deck, hand, discard, reserve, Package 6). |
| Infection card         | City, id                                                  | 1 improvement slot. Destroyed flag. Location (deck, discard, Game End area, reserve, Package 6).                                                       |
| Hollow Men Gather card | None                                                      | Location                                                                                                                                               |
| Epidemic card          | None                                                      | A reminder sticker after September                                                                                                                     |
| Produce Supplies card  | None                                                      | 1 to 3 check boxes [C] for System-Wide use. Destroyed when full.                                                                                       |
| Rationed Event         | Effect                                                    | Location (reserve, deck, hand, discard)                                                                                                                |
| Unrationed Event       | Effect                                                    | Location. Destroyed after use.                                                                                                                         |
| Companion              | Effect, passive or spent                                  | Location                                                                                                                                               |
| Objective card         | Rule, mandatory flag, track                               | Tracking token position. Completed this game. Carry-over progress if the card allows. Destroyed flag.                                                  |
| Turning Point card     | Condition, effect                                         | Triggered flag. Some have scratch boxes.                                                                                                               |
| Legacy card            | Id, text, PAUSE or STOP marker, conditional scratch boxes | Read flag. Scratched boxes.                                                                                                                            |
| Character card         | Job, home, exposure layout (7 boxes, hidden)              | Name, age, slots (ability, scar, or empty), boxes scratched, alive or dead, place of death                                                             |
| Frequency Scanner      | 10 frequency boxes                                        | Scratched boxes                                                                                                                                        |

## K-5. Location state [R] [C]

| Field                       | Cities                             | Havens             |
| --------------------------- | ---------------------------------- | ------------------ |
| Population                  | 0 to 8, persistent                 | 0 to 8, persistent |
| Port flag                   | Static                             | Always true        |
| Revealed and on-grid flags  | Persistent                         | Persistent         |
| Forsaken                    | Derived from population 0          | Never              |
| Infested                    | Persistent flag                    | Never              |
| Search content              | On the City card, not the location | None               |
| Printed recon route         | Some cities                        | One lost haven     |
| Supply cubes                | Per game                           | Per game           |
| Plague cubes (0 to 3)       | Per game                           | Per game           |
| Hollow Men figures (0 to 3) | Per game                           | Per game           |
| Supply center               | Per game, or permanent sticker     | No                 |
| Satellite tower             | Per game, or permanent sticker     | Not reported       |
| Shelter                     | Per game, or permanent sticker     | Not reported       |
| Lab marker                  | Persistent                         | No                 |

## K-6. Deck composition [R] [C]

### K-6.1 Player deck [R] [C]

Built every game from:

- City cards for every city on the grid, minus destroyed cards and cards stored in Package 6.
- Produce Supplies cards still intact (8 at the start).
- Rationed Events chosen up to the rationing level (0 to 10).
- Every Unrationed Event in the reserve.
- Companion cards and other persistent Player cards [I].
- Epidemics, 5 at the start, then by the table in [L-4](legacy-progression.md#l-4-stretched-too-thin-epidemic-count-c).

Logs report about 75 to 85 City cards when every city is connected [C].

### K-6.2 Infection deck [R] [C]

Built every game from:

- Infection cards for every city on the grid, minus destroyed cards and cards stored in Package 6.
- Hollow Men Gather and Assemble cards, which start in the discard pile ([L-9.1](legacy-progression.md#l-91-gather-cards-c)).
- Utopia cards in December ([L-14.2](legacy-progression.md#l-142-utopia-c)).

### K-6.3 Package 6 [C]

Two persistent piles, each capped at 30: stored Player cards and stored Infection cards.

## K-7. Cube pools [R] [C]

| Pool          | Rule                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Box total     | 36 supply cubes, 8 Plague cubes                                                                   |
| Reserve       | Cubes not in this game's stockpile. Some effects draw from it.                                    |
| Stockpile     | Set at setup from the supply track plus bonuses. Make Supplies and Produce Supplies draw from it. |
| On the board  | Any number per location                                                                           |
| On characters | Any number per character                                                                          |

Plague cubes are limited to 8 by the Incident track, so they never run out before the loss [I].
