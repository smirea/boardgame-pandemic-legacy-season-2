# Legacy progression

This file defines every mechanic that enters after January's setup. The rulebook does not contain this material. Almost all of it comes from community sources, so most sections carry **[C]**. Tags are the same as in [core-rules.md](core-rules.md): **[R]** rulebook, **[C]** community, **[I]** inferred.

The original game hides its content in a numbered Legacy deck, 8 sealed packages, and 6 cardboard dossiers with numbered and lettered doors. For the engine, treat each of these as a named bundle of unlocks with a trigger. The original's package numbers and door ids appear only where a reader needs them to cross-check a source.

## L-0. How content unlocks [R] [C]

An unlock is one of:

- A Legacy deck card read in setup or at Game End step 2 ([C-11](core-rules.md#c-11-legacy-deck-r)).
- A recon that opens a package ([L-1](#l-1-recon-and-new-regions-r-c)).
- A search result that names a door or package ([L-5](#l-5-search-c)).
- A Turning Point card that triggers at game end ([L-13.3](#l-133-turning-points-c)).
- A frequency box scratched by Monitor ([L-10.3](#l-103-monitor-and-the-frequency-scanner-c)).
- Completing an objective whose card names a reward door.

Any unlock can add these kinds of content:

- **Rule sticker.** Fills one of the lettered slots A to W in the rulebook. Takes effect at once [C, designer ruling].
- **Action sticker.** Adds an action to the rulebook's new-actions page (slots J to Q) and to each player's reference card.
- **Map sticker.** Adds a region of cities, routes, and printed text to the board.
- **Cards.** City and Infection cards for new cities, Event cards, objectives, Turning Points, companions, enemy cards.
- **Pieces.** Structures and enemy figures.
- **Game-end upgrade stickers.** New abilities, improvements, scars, permanent-structure stickers.
- **Story text.** No rules effect. Out of scope.

An engine can model the whole campaign as an ordered list of unlock bundles plus a set of conditional triggers. [interactions.md](interactions.md) lists them.

## L-1. Recon and new regions [R] [C]

### L-1.1 Recon resolution [R]

See [C-5.9.1](core-rules.md#c-591-recon-r) for the action. On success, open the named package. The package usually holds a recon report card, a map sticker, new City and Infection cards, rule and action stickers, an Unrationed Event card as the explorer's reward, and other content [C].

### L-1.2 Regions and their packages [C]

| Package | Region                     | Opened by                                                  | Cities added (count) | Main new mechanics                                                                  |
| ------- | -------------------------- | ---------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| 1       | North America              | Recon at Washington                                        | 6                    | Establish Supply Line, Search                                                       |
| 2       | Middle East and South Asia | Recon at Cairo                                             | 6                    | Hollow Men                                                                          |
| 3       | East Asia                  | Recon at a South Asia city (Kolkata), route revealed later | 9                    | Shelters, more Hollow Men cards, the Plan                                           |
| 4       | Europe                     | Recon at London                                            | 4                    | Shuttle Flight                                                                      |
| 5       | South America              | Recon at São Paulo                                         | 4                    | Chart Sea Lane                                                                      |
| 6       | (not a region)             | First lab discovery                                        | 0                    | Inoculate and card storage ([L-6](#l-6-package-6-inoculate-and-the-stored-cards-c)) |
| 7       | Africa                     | Recon at Lagos                                             | 5                    | Satellite Towers, Transmit                                                          |
| 8       | Utopia                     | Completing November's plan, or forced in December          | 1                    | Final-month content                                                                 |

The column "Main new mechanics" reflects which package delivered a rule in at least one logged campaign. The exact package for Chart Sea Lane and Shuttle Flight is not certain. In one log they arrived through the Legacy deck at a month end instead [C]. See [open-questions.md](open-questions.md).

City names per region, for lookup [C]: North America has Chicago, Denver, Atlanta, Los Angeles, Mexico City, and San Francisco. South America has Buenos Aires, Santiago, Lima, and Bogotá. Europe has Paris, Frankfurt, St. Petersburg, and Moscow. Africa has Kinshasa, Khartoum, Dar es Salaam, Johannesburg, and Antananarivo. The Middle East and South Asia set has Baghdad, Tehran, Riyadh, Delhi, New Mumbai, and Kolkata. East Asia has Jakarta, Hong Kong, Shanghai, Osaka, Seoul, Tokyo, Manila, Bangkok, and Ho Chi Minh City. Two late locations are Wellington and Lake Baikal.

### L-1.3 A region joins the board, not the grid [R] [C]

- Place the map sticker. It reveals cities, red region boundary lines, printed recon routes, and sometimes a printed connection.
- Revealed cities are not on the grid until a supply line or sea lane connects them ([C-1](core-rules.md#c-1-concepts-and-vocabulary-r)). Some packages auto-connect one city with a printed line [C].
- Record each new city in the campaign's city list. The rulebook's list has 52 rows. 9 are filled at the start [R].

### L-1.4 When a city joins the grid [C]

| Timing                     | City card                     | Infection card(s)                                                   |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Already connected at setup | Shuffled into the Player deck | Shuffled into the Infection deck                                    |
| Connected during a game    | Into the Player discard pile  | Into the Game End area. Joins the Infection deck at Game End step 3 |
| Not connected              | Stays in the reserve          | Stays in the reserve                                                |

A new city starts with the population printed on the map. The number of Infection cards a city has equals its printed starting population [C]. Cities differ in how many City cards they have.

### L-1.5 Perimeter reports force unexplored regions [C]

Some months open with a Legacy card called a perimeter report. It checks whether a given region's package or door has been opened. If not, the group scratches a box and the content is opened for them. The penalty for a forced opening:

- The explorer's Unrationed Event card from that package is destroyed instead of awarded.
- The forced recon does not count toward a "recon a new area" objective.
- Some reports carry a harsher penalty. In June, a Europe region still unexplored triggers a door that ruins a European city (Frankfurt). Logs report that city ending forsaken [C].

Deadlines seen in logs [C]:

| Month opened | Region or content forced                         |
| ------------ | ------------------------------------------------ |
| February     | North America (auto-connects one city)           |
| March        | South America (a nudge only, per one log)        |
| May          | A lost haven door                                |
| June         | Europe, with the city-ruin penalty               |
| July         | Africa                                           |
| August       | Middle East and South Asia                       |
| September    | A second lost haven door                         |
| October      | East Asia                                        |
| November     | An intelligence report with optional scratch     |
| December     | Utopia (Package 8), if the Plan was not finished |

An engine should model a perimeter report as: `if (!opened(X)) { scratch(box); open(X, { penalty }) }`.

## L-2. Establish Supply Line [C]

- **Unlocks.** North America package (or the February perimeter report).
- **Action.** Costs 1 action plus 2 supply cubes from the character card.
- **Precondition.** The pawn is in a city on the grid. The target is a revealed city.
- **Effect.** Draw a permanent supply line between the two cities. The cities are now adjacent. If the target was off the grid, it joins the grid now ([L-1.4](#l-14-when-a-city-joins-the-grid-c)).
- **Geometry limits.** The line is straight. It may not cross water, unexplored map, another city, or another supply line. It may not end at a haven [C].
- **Persistence.** Permanent. There is no rule to erase a line.
- **Modifiers.** A companion reduces the cube cost by 1 while held. A scar raises it by 1.

## L-3. Forsaken and infested cities [C]

### L-3.1 Trigger [C]

January's Legacy cards add a Turning Point. Its condition: any city has population 0 at game end. When it triggers, it opens content that adds rule sticker A (forsaken rules), a board reminder sticker, and the infested rule. Before that, population 0 has no special rule.

### L-3.2 Forsaken city rules [C]

A city at population 0 is forsaken.

- **Infection.** When its Infection card is drawn, at setup, in an Epidemic, or in a turn's Infect step, do not infect it. Put the card in the Game End area and draw a replacement. The replacement counts as the draw. The card returns to the deck at Game End step 3.
- **Actions in it.** Only Drive or Ferry to leave. No other action, and no free action, may be taken while in a forsaken city. That includes Recon, Search, Deliver Supplies, and Build Supply Center.
- **Arriving.** Pawns may enter by Drive, Ferry, Sail, and Charter Boat. One log reports that shuttle flights cannot use it.
- **Events.** Events are not actions and still work. Other characters may move a pawn in or out.
- **Supply center already there.** Stays.
- **Restoring.** Costs 2 production units to raise to population 1. A restored city is no longer forsaken.
- **Production units.** A forsaken city does not count toward the cities-on-grid total.
- **Havens.** A haven can reach population 0. It never becomes forsaken or infested. It stays usable [C].

### L-3.3 Infested cities [C]

- A city that becomes forsaken also becomes infested. Mark it with a sticker.
- Some map stickers place cities that are already infested. Some search results infest a city.
- Infested is permanent. Restoring the population does not remove it.
- A character that starts its turn in an infested city gains an exposure, as if the city held a Plague cube.
- A shelter in the city prevents this exposure ([L-11](#l-11-shelters-c)).
- A companion card exists that stops exposure from infested cities.

## L-4. Stretched too thin, epidemic count [C]

- **Unlocks.** Legacy deck at the end of March.
- **Rule.** The number of Epidemic cards in setup step 7 depends on how many City cards are in the Player deck. Count only City cards. Events, Produce Supplies, and Epidemics do not count. Cards stored in Package 6 are not in the deck.
- **Table.** The exact printed table was not found. Data points from logs: 36 cards give 5, 44 give 6, 49 give 7, 53 give 8, 55 give 8, about 75 give 10. A table consistent with every data point [I]:

| City cards in the Player deck | Epidemics |
| ----------------------------- | --------- |
| 36 or fewer                   | 5         |
| 37 to 44                      | 6         |
| 45 to 52                      | 7         |
| 53 to 60                      | 8         |
| 61 to 68                      | 9         |
| 69 or more                    | 10        |

- **Pile split.** Setup step 7 splits the deck into as many piles as there are Epidemics [I]. The board's Infection Rate track has room for 10 epidemics [C].

## L-5. Search [C]

- **Unlocks.** North America package.
- **Action.** Costs 1 action.
- **Precondition.** The pawn is in a city. The player holds that city's City card, and the card has an unscratched search box. Some City cards have 0 boxes, some 1, some 2.
- **Effect.** Scratch one box and follow the text under it at once. The City card stays in hand [C]. It remains a normal City card for every other use.
- **Two-box cards.** One box is marked land and the other sea. Each search scratches one. Both may be done, even in one game, as two actions.
- **One-time.** A box resolves once, ever. A companion revealed by a search persists.
- **Objective.** "Perform 2 searches" counts searches done in that game.
- **Modifiers.** A companion makes searches free of action cost. An ability lets a player search with a card taken from the discard pile. A scar forces a discard after searching.

### L-5.1 Range of search results [C]

Each result is one of these kinds. The engine needs a typed effect for each:

| Kind              | Example behavior                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Supplies          | Add 2 or 3 cubes to this city, from the stockpile or from the reserve. Move 4 cubes from reserve to stockpile. |
| Actions           | Gain 1 or 2 actions this turn.                                                                                 |
| Card retrieval    | Take 1 card from the Player discard pile. Give 1 card to any player anywhere.                                  |
| Infection control | Move 1 Infection card from the discard pile to the Game End area.                                              |
| Enemy control     | Remove up to 2 Hollow Men figures from the board.                                                              |
| Map               | Draw a free supply line or sea lane from this city.                                                            |
| Discovery         | Open a door that reveals a lost haven or a lab. If already revealed, gain 1 action instead.                    |
| Companion         | Gain a companion card ([L-5.2](#l-52-companions-c)).                                                           |
| Penalty           | Mark this city infested.                                                                                       |
| Story only        | No effect.                                                                                                     |

### L-5.2 Companions [C]

- A companion is a Player card revealed by a search. It enters the finder's hand.
- It counts toward the hand limit.
- Some companions give a passive effect while held. Examples: Build Supply Center needs 1 fewer card, a supply line costs 1 fewer cube, a satellite tower costs 1 fewer cube, searches are free, no exposure from infested cities.
- Some are spent. Examples: play at any time to remove 1 Plague cube from your location, remove all Plague cubes from one location, place a shelter anywhere, remove 1 Hollow Man. One counts as 2 unique red cards for Recon.
- A companion persists in later games. Treat it as a Player card that is shuffled in like an Unrationed Event. Whether a spent companion is discarded or destroyed varies by card [I].

## L-6. Package 6, inoculate, and the stored cards [C]

- **Unlocks.** Finding the first lab (a search in Buenos Aires) opens Package 6 in two logs. A third log credits the Pacific lost haven with the inoculate action. See [open-questions.md](open-questions.md).
- **Package contents.** The Inoculate free action, a storage rule, 3 Portable Antiviral Lab cards, and a sticker for a permanent +15 supply bonus [C].
- **Inoculate (free action).** Take 1 Player card or 1 Infection card whose city matches the pawn's current city from its discard pile. Put it into Package 6. No per-turn limit.
- **Capacity.** Package 6 holds up to 30 Player cards and up to 30 Infection cards.
- **Persistence.** Stored cards stay out of play across games until a rule brings them back.
- **Hollow Men Gather cards** may not be stored [C, designer ruling].
- **Payback.** In September, rule sticker R makes Epidemics draw from Package 6 ([L-9.5](#l-95-new-epidemic-infect-step-c)).
- **Portable Antiviral Lab cards.** 1 goes to the finder's hand and 2 to the Player discard pile. They then stay in the Player deck as Player cards. The exact effect was not recovered [C].

## L-7. Chart Sea Lane [C]

- **Unlocks.** End of March (Legacy deck) in two logs, tied to South America.
- **Action.** Costs 1 action plus supply cubes. The base cube cost was not recovered. A scar adds 1 cube. An ability removes the cost, once per turn.
- **Precondition.** The pawn is in a port on the grid. The target is a revealed port, havens included.
- **Effect.** Draw a permanent sea lane. The ports are adjacent. A city off the grid joins it.
- **Geometry limits.** The lane may not cross land, another sea route, unexplored map, or a city. It may cross at most 1 red region line. Lanes have no width and may curve [C]. A designer ruling says a strait route around the southern tip of South America still counts as crossing the red line there [C].
- **Events.** A Rationed Event draws a free lane that ignores the red line limit.

## L-8. Shuttle Flight [C]

- **Unlocks.** The Europe package in two logs.
- **Action.** Costs 1 action.
- **Effect.** Move from a haven or a supply center city to any other haven or supply center city on the grid. Any combination of the two kinds.
- **Restriction.** Logs report that a forsaken city cannot be a shuttle endpoint, even with a supply center [C].

## L-9. Hollow Men [C]

An enemy faction. They are plastic figures placed on cities.

- **Unlocks.** The Middle East package (recon at Cairo, forced by August).
- **Components.** A pool of Hollow Men figures (count not recovered). 4 Hollow Men Gather cards at first. The East Asia package adds 4 more. December adds Hollow Men Assemble cards.

### L-9.1 Gather cards [C]

- At setup, Gather cards start in the Infection discard pile, not the deck. They reach the deck at the first Intensify step. If one appears during setup infection, discard it and flip a replacement [C].
- When a Gather card is flipped in an Infect step, it does not count toward the infection rate. Draw the next card. That city gets 1 Hollow Man figure instead of a normal infection, and that draw counts toward the rate. Consecutive Gather cards keep drawing.
- The Hollow Man placement removes no supply cube, places no Plague cube, and records no incident. Infection card improvements on the next card do not stop it.
- Gather cards go to the Infection discard pile after use.
- If an Epidemic's bottom draw is a Gather card, discard it with no effect and continue to Intensify [C, single source].
- A city can hold up to 3 figures. If a 4th would be placed, do not place it. Reduce that city's population by 1 instead [C]. One log applies the penalty on the 3rd. The FAQ and a second log support the 4th.
- A Hollow Man in a city does not block normal infections there.

### L-9.2 Exposure from leaving [C]

A character gains 1 exposure whenever its pawn leaves a location that holds 1 or more Hollow Men figures.

- Any movement counts, whoever moves the pawn and on whichever turn. The game ending does not count.
- Sail and Charter Boat count as leaving the start location only.
- A shelter in that location prevents this exposure.
- This stacks with the start-of-turn exposure.

### L-9.3 Removing and moving Hollow Men [C]

- Search results, companions, and the Saboteur ability remove figures.
- Broadcast Misinformation moves them ([L-10.4](#l-104-broadcast-misinformation-c)).

### L-9.4 New setup infection [C]

- **Unlocks.** September Legacy deck. Replaces setup step 4 (rule sticker D).
- **Rule.** Flip 9 Infection cards. Resolve the first 6 as normal setup infections. For each of the last 3, place 1 Hollow Man on that city instead.
- Forsaken cards are still replaced as in [L-3.2](#l-32-forsaken-city-rules-c).

### L-9.5 New epidemic infect step [C]

- **Unlocks.** September Legacy deck. Replaces Epidemic step 2 (rule sticker R). Reminder stickers go on the Epidemic cards.
- **Rule.** Draw the Infection card from Package 6 instead of from the bottom of the Infection deck. Remove all supply cubes from that city. Place no Plague cube. The card then goes to the Infection discard pile, so Intensify returns it to the deck.
- If Package 6 holds no Infection cards, draw the bottom card of the Infection deck as before.
- If the drawn city is forsaken, put its card in the Game End area and draw a replacement before Intensify.
- One log reports that a lab discovery changes this step to remove only 1 cube instead of all [C, single source].

### L-9.6 Hollow Men supply loss [C]

- **Unlocks.** September Legacy deck (likely rule sticker U, the loss-condition slot [I]).
- **Rule.** If a Hollow Man must be placed and the figure supply is empty, the game is lost at once.

### L-9.7 Hollow Men at game end [C]

- At Adjust Population, a location with 1 or more Hollow Men loses 1 population. Plague cubes and Hollow Men together still cost only 1.
- A supply center offsets the loss as usual.
- A shelter in the city prevents the Hollow Men loss [C].

## L-10. Satellite towers [C]

- **Unlocks.** The Africa package (recon at Lagos, forced by July).
- **Components.** 6 tower pieces.

### L-10.1 Build Satellite Tower [C]

- Costs 1 action plus 2 supply cubes from the character card.
- Places a tower in the current city. One tower per city [I].
- A companion reduces the cube cost by 1.
- Towers are temporary unless made permanent at game end ([L-12](#l-12-new-game-end-purchases-c)).

### L-10.2 Transmit [C]

- Costs 1 action.
- Precondition: the pawn is in a city with a tower.
- Effect: give 1 City card whose color matches the tower city's color to any player anywhere.

### L-10.3 Monitor and the frequency scanner [C]

- **Unlocks.** August Legacy deck, with a Frequency Scanner card that has 10 scratch boxes labeled with frequencies.
- **Action.** Costs 1 action. The pawn is in a city with a tower.
- **Effect.** Reveal the top 4 Player cards and discard them all. An Epidemic revealed this way is discarded with no effect. Then scratch one unscratched frequency box of the player's choice and follow its text.
- **Limit.** Each box can be scratched once. After 10 uses the action is gone for the campaign.
- **Rewards.** Frequency boxes hold rewards such as a hidden recon route (the East Asia route), new improvement options, or nothing. The July objective "Triangulate Signals" hints at the 3 best frequencies.

### L-10.4 Broadcast Misinformation [C]

- **Unlocks.** October Legacy deck.
- **Action.** Costs 1 action. The pawn is in a city with a tower.
- **Effect.** Move 1 Hollow Man from a city of the tower city's color to an adjacent location. Havens are valid destinations.
- **Use.** October's objective needs 3 Hollow Men in havens ([L-13.1](#l-131-objectives-by-month-c)).

## L-11. Shelters [C]

- **Unlocks.** The East Asia package (recon at Kolkata, forced by October).
- **Build Shelter.** Costs 1 action. Discard 1 City card of the current city's color. Place a shelter in that city. Any card of the color works, not only that city's card [C].
- **Effect.** No character in that city gains exposure from starting a turn there (Plague cubes, infested) or from leaving it (Hollow Men). At game end the city does not lose population from Hollow Men.
- **Count.** Logs mention running out after 5 [C].
- **Other sources.** A companion and a Rationed Event place shelters for free. A later character job builds shelters.

## L-12. New game-end purchases [C]

These options enter during the campaign and extend [C-12.4](core-rules.md#c-124-spend-production-units-r).

| Purchase                   | Cost        | Enters          | Rule                                                                                                                                                                                                                                                 |
| -------------------------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permanent supply center    | 3           | End of February | Sticker on a city with a supply center. Supply center at every setup. Cannot move. Still +1 population per game end. 6 stickers.                                                                                                                     |
| Permanent satellite tower  | 3           | July            | Tower present at every setup.                                                                                                                                                                                                                        |
| Permanent shelter          | 2           | October         | Shelter present at every setup.                                                                                                                                                                                                                      |
| New abilities              | 1 to 3 each | Most months     | See [L-16.2](#l-162-abilities-c).                                                                                                                                                                                                                    |
| New City improvements      | 1 to 2 each | Several months  | Counts as 2 or 3 of its color for building. Counts as any color for building and Recon. Counts as red for building and Recon.                                                                                                                        |
| New Infection improvements | 1 to 2 each | April and later | Destroy from the discard pile. If the city holds 2 or more cubes, remove none. Rebirth, which mostly neutralizes the card while the city's population stays high. A card that lets a player stop further infection draws this turn when it is drawn. |

A permanent supply center does not count toward "build 3 new supply centers" [C].

Free upgrades: August's Legacy deck grants a few production units that must go to character abilities [C].

## L-13. Objectives, perimeter reports, turning points [C]

### L-13.1 Objectives by month [C]

The board prints the required count per month. Mandatory objectives must be among the completed ones.

| Month         | Required | Objectives in play (M = mandatory)                                                                                    |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| January       | 2        | Build 3 new supply centers (M). Recon a region (M).                                                                   |
| February      | 2        | Build 3 new supply centers (M). Recon a new area. Connect 2 new cities to the grid.                                   |
| March         | 3        | February's set, plus Access a lost haven, plus Perform 2 searches.                                                    |
| April to June | 3        | Same set [C].                                                                                                         |
| July          | 3        | Adds Triangulate Signals: towers in 3 cities of different colors. Its reward door opens, then the card is destroyed.  |
| August        | 3        | Same set.                                                                                                             |
| September     | 3        | "Recon a new area" is destroyed. Recon East Asia (M) is added.                                                        |
| October       | 2        | Build 3 new supply centers (M). Defect the Hollow Men (M): 3 Hollow Men in havens. Optional objectives are destroyed. |
| November      | 1        | Complete the Plan (M). Every earlier objective is destroyed.                                                          |
| December      | 1        | Deliver the Sample (M). The Plan cards are destroyed.                                                                 |

Objective details:

- **Build 3 new supply centers.** Built during this game. Any colors.
- **Connect 2 new cities.** Cities that join the grid during this game, by a supply line, a sea lane, or a recon. Cities added by a Legacy instruction do not count [C].
- **Access a lost haven.** A pawn reaches a lost haven (reading of logs) [I].
- **Perform 2 searches.** Two search actions this game.
- **Defect the Hollow Men.** Progress carries from the early to the late October attempt.
- **Complete the Plan.** 4 separate recons at Shanghai. Costs reported: 5 unique red, 4 unique black, 3 unique blue, 3 unique yellow. Each recon is tracked. Progress carries over.
- **Deliver the Sample.** See [L-14.3](#l-143-december-deliver-the-sample-c).
- Objectives use tracking tokens on printed tracks.

### L-13.2 Lost havens [C]

- 3 lost havens exist: one in the Pacific, one in the Indian Ocean, one east of Australia.
- A sea search in certain nearby cities reveals the first two. A recon from Jakarta reveals the third.
- A revealed haven joins the grid when a sea lane reaches it. Players name it.
- First arrival opens a door. The reported rewards include a permanent +15 cubes added to every future stockpile, and extra actions on that turn.
- The third lost haven has a recon route to the Topaz lab ([L-14.1](#l-141-labs-c)).

### L-13.3 Turning points [C]

| Enters         | Condition (checked at Game End step 3) | Effect                                                                         |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| January        | Any city at population 0               | Forsaken and infested rules enter ([L-3](#l-3-forsaken-and-infested-cities-c)) |
| October        | Not recovered                          | Not recovered                                                                  |
| Early campaign | The group has lost 4 games in a row    | A catch-up bonus of about 10 extra supply cubes per game for a few games       |

## L-14. Labs, Utopia, and December [C]

### L-14.1 Labs [C]

4 labs exist. Each found lab scores at campaign end. Coordinates for most labs arrive on a reserve card. A search confirms each one.

| Lab   | Location     | Found by                        | Reported unlocks                                                                                                                                                           |
| ----- | ------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opal  | Buenos Aires | Land search                     | Package 6 (inoculate), a character with Make Supplies from the reserve                                                                                                     |
| Jade  | Johannesburg | Search                          | A character with a once-per-turn "destroy the Infection card of this city from the discard pile". One log adds a gentler Epidemic infect step.                             |
| Topaz | Wellington   | Recon from the third lost haven | Any player may discard a City card of the drawn city's color to prevent one supply cube removal. Cannot be used if the city has no cubes. A character who builds shelters. |
| Pearl | Lake Baikal  | Reached in December             | The Deliver the Sample rules                                                                                                                                               |

### L-14.2 Utopia [C]

- Package 8 adds Utopia as a city on the grid. Its population is 8. It has 8 Infection cards.
- If the group earned it (finished November's Plan), the Utopia cards are shuffled into the Infection deck and an Unrationed Event is awarded. If Package 8 was forced, the cards start in the Infection discard pile, and the event is lost. Whether later setup steps shuffle them in is disputed.
- A supply line from Utopia reaches Lake Baikal.

### L-14.3 December, deliver the sample [C]

- **Objective.** Carry a sample from Pearl (Lake Baikal) to Jade (Johannesburg). Johannesburg must hold a supply center when the carrier arrives.
- **Self-infection.** A character at Pearl injects themself. Scratch exposure boxes one at a time until a scar or a skull appears. A skull kills the character, and someone else must try. Haven workers cannot take scars, so they cannot carry.
- **Carrier scar.** On a scar, the character takes the Carrier scar. It covers 2 slots and cannot be covered by any later sticker.
- **Carrier movement.** The carrier moves only by Drive or Ferry. No other effect may move the carrier (abilities, Events, flights). To enter a city, the carrier discards a City card of that city's color. Entering a haven needs no card.
- **Win.** The carrier reaches Johannesburg while it holds a supply center.
- **Fate.** The carrier dies at the end of that game, win or lose.
- **Extra pressure.** December adds Hollow Men Assemble cards to the Infection deck.

## L-15. Campaign end and final scoring [C] [I]

Run after December's last game. A Legacy card says to run Game End step 4 first, then score.

Score components. Point values are inferred from four published score breakdowns that all reconcile exactly [I]:

| Component                           | Points                 |
| ----------------------------------- | ---------------------- |
| Each month won in the early attempt | 50                     |
| Each month won in the late attempt  | 30                     |
| Total population                    | 1 per population point |
| Sample delivered                    | 100                    |
| Each lab found                      | 25 (max 4 labs, 100)   |
| Each forsaken city                  | minus 5                |

The Legacy deck has two scoring branches. One applies if the sample was delivered and one if not. Both map the total to a rating tier.

Reported totals cluster from about 430 to 915.

## L-16. New characters, abilities, and scars [C]

### L-16.1 Characters found during the campaign [C]

These fill the 5 blank character cards. Each has a fixed job and home.

| Job                   | Effect summary                                                                                     | Found       |
| --------------------- | -------------------------------------------------------------------------------------------------- | ----------- |
| Immunologist          | Make Supplies takes cubes from the reserve, not the stockpile                                      | Opal lab    |
| Captain               | Discard any City card to move between any two ports on a sea route                                 | End of June |
| Sanitation Officer    | Free action. Discard 2 Player cards to take 1 City or Produce Supplies card from the discard pile. | End of June |
| Scientist             | Once per turn, free action. Destroy the Infection card of the current city from the discard pile.  | Jade lab    |
| Vector Control Expert | Build a shelter in the current location                                                            | Topaz lab   |

### L-16.2 Abilities [C]

Abilities are stickers bought with production units. Ones seen in logs:

| Ability              | Effect summary                                                                      |
| -------------------- | ----------------------------------------------------------------------------------- |
| Architect            | Build Supply Center with 1 fewer card                                               |
| Helmsman             | One free Drive or Ferry per turn                                                    |
| Record Keeper        | Hand limit plus 1                                                                   |
| Courier              | Deliver Supplies to an adjacent location                                            |
| Broker               | Discard a City card to take a same-color City card from the discard pile            |
| Scout                | Recon without a supply center                                                       |
| A recon discount     | Recon with 1 fewer card                                                             |
| Lookout              | Search using a City card taken from the discard pile                                |
| Navigator            | Chart Sea Lane costs no cubes, once per turn                                        |
| Investigator         | Swap a City card in hand for any City card in the discard pile                      |
| Saboteur             | As an action, discard a City card to remove 1 Hollow Man from a city of that color  |
| Smuggler or Supplier | Place a cube from the reserve on a city matching a card in hand                     |
| Unnamed in logs      | Take any card from a player in the same location                                    |
| Unnamed in logs      | Discard any City card to move from a haven or supply center to anywhere on the grid |
| Others named in logs | Runner, Facilitator, Foreman, Outrider, Soldier                                     |

### L-16.3 Scars [C]

Scar stickers enter in several months. Examples: Recon needs 1 extra card. Supply line costs 1 more cube. Sea lane costs 1 more cube. Discard a card after searching. A general penalty sticker. The December Carrier scar.

## L-17. New Player card types [C]

| Type                   | Rule                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Rationed Event         | Chosen up to the rationing level. Discarded after use. New ones arrive most months.                                |
| Unrationed Event       | Always in the deck. Destroyed after use. Usually an explorer's reward. Destroyed unused if its package was forced. |
| Companion              | From searches. See [L-5.2](#l-52-companions-c).                                                                    |
| Portable Antiviral Lab | From Package 6. Stays in the Player deck.                                                                          |

Event effects range over: move any pawn anywhere, skip the next Infect step, remove up to 2 cards of one city from the Infection discard pile, look at and reorder the top Infection cards, add cubes to a city, swap cards between two players, extra actions this turn, draw the top 4 Player cards and keep the City cards, a free sea lane, place free shelters, remove Plague cubes from a city, move reserve cubes into the stockpile, put an ability over a scar.

## L-18. New Infection card types [C]

| Type                  | Rule                                  |
| --------------------- | ------------------------------------- |
| City Infection card   | One per point of starting population. |
| Hollow Men Gather     | See [L-9.1](#l-91-gather-cards-c).    |
| Hollow Men Assemble   | December. Exact text not recovered.   |
| Utopia Infection card | 8 cards for Utopia.                   |
