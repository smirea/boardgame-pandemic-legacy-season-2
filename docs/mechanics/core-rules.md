# Core rules

This file defines the base game as it stands at the start of the campaign (January), before any legacy content enters. Later changes live in [legacy-progression.md](legacy-progression.md).

Confidence tags appear on each section heading:

- **[R]** Confirmed from the official rulebook.
- **[C]** Taken from community sources (FAQ compilations, forum rulings, campaign logs).
- **[I]** Inferred by this catalogue. Treat as a default, not a fact.

Section ids such as `C-4.2` are stable. [interactions.md](interactions.md) points at them.

## C-1. Concepts and vocabulary [R]

- **Location.** A node on the board. Each location is either a city or a haven. A rule that names "city" never applies to a haven, and the reverse holds.
- **Port.** A location marked with an anchor. Only ports can be the start or end of the sea movement actions. Every haven is a port.
- **Haven.** An offshore base. Havens are never infected directly by Infection cards because no Infection card names a haven. Havens have a population.
- **Supply line.** A land edge between two cities. None exist at the start. Players draw them during the campaign.
- **Sea lane.** A water edge between two ports. A chain of sea lanes is a sea route.
- **Adjacent.** Two locations joined directly by one supply line or one sea lane.
- **The grid.** Every location from which a path of supply lines and sea lanes reaches one of the starting havens. A revealed but unconnected city is not on the grid. Its cards stay out of the decks, and outbreaks cannot reach it.
- **Supply cube.** The good resource (gray). Lives on locations, on character cards, in the per-game stockpile, or in the reserve.
- **Plague cube.** The bad resource (green). There is no way to remove one except card effects that say so. 8 exist in the box.
- **Incident.** Any placement of a Plague cube. Each one advances the Incident marker by 1. The marker never moves back.
- **Stockpile.** The per-game pool of supply cubes. Its size is set each month by the board's supply track.
- **Reserve.** Out-of-play storage in the box for cards, stickers, and spare cubes.
- **Population.** An integer 0 to 8 on every location. Bands, used only as labels: 6 to 8 recovering, 3 to 5 surviving, 2 struggling, 1 falling, 0 forsaken.

## C-2. Campaign structure [R]

- The campaign has 12 months, January through December. A non-scoring prologue comes first.
- Each month allows up to two games. Call them the early attempt and the late attempt.
- Win the early attempt: advance to the next month.
- Lose the early attempt: replay the same month with the same rules and objectives, including anything the Legacy deck added after the loss.
- Lose the late attempt: advance to the next month anyway.
- December also has two attempts. The campaign ends after December resolves, win or lose. Then final scoring runs ([L-15](legacy-progression.md#l-15-campaign-end-and-final-scoring-c-i)).
- Total games played: 12 minimum, 24 maximum, plus prologue games.

### C-2.1 Rationing level [R]

- An integer from 0 to 10. It starts at 4 for the prologue and for January.
- After a win: rationing level minus 2 (floor 0).
- After a loss: rationing level plus 2 (cap 10).
- During setup the group picks this many Rationed Event cards from all Rationed Events in the reserve.
- If the group discovers it broke a rule in a way that made a game too hard, it may raise the level for the next game. Too easy, lower it. This is a manual override the engine can expose as a setting.

### C-2.2 Prologue [R]

- Played any number of times before January. No permanent changes happen.
- Uses its own two prologue cards (`00-01` and `00-02`). `00-02` holds the prologue mandatory objective: build 3 supply centers, any colors.
- Prologue exceptions (`00-01b`): do not open the Legacy deck; characters cannot get exposed; Recon is unavailable; System-Wide Production is unavailable when playing Produce Supplies cards; do not perform Game End steps.
- When ready to begin the campaign, destroy `00-01` and `00-02`, open the Legacy deck, and start January.

### C-2.3 What persists and what resets [R]

Persists between games:

- Stickers on the board, cards, characters, and rulebook.
- Writing (character names, haven names, place of death, drawn supply lines and sea lanes).
- Scratched boxes (exposure tracks, search boxes, check boxes).
- Destroyed components.
- Opened packages and dossier doors, and the contents now in the reserve.
- Card positions that a rule makes persistent, such as cards stored in Package 6 ([L-6](legacy-progression.md#l-6-package-6-inoculate-and-the-stored-cards-c)).

Resets every game:

- All pieces on the board (cubes, supply centers, temporary towers and shelters, pawns, enemy figures).
- Hands, decks, discard piles, the Incident marker, the Infection Rate marker, tracking tokens.

## C-3. Setup [R]

Run the steps in this order. Later rule stickers replace or fill some steps. The placeholder steps are noted.

1. **Set up the board.**
   1. Put supply cubes into the stockpile equal to this month's value on the supply track. Put the rest in the reserve.
   2. (Rule sticker **B** slot: later adds stockpile bonuses printed to the right of the supply track — Area 10 `+15` from Package 6 and Area 11 `+15` from Door 11.)
   3. Collect from the reserve every card that goes on the board. Turning Point cards go to the Game End area. Objective cards go to the objectives area.
   4. (Rule sticker **C** slot: later places all Hollow Men Gather cards into the Infection discard pile, Area 16.)
   5. Put the Plague cube pool beside the board. Put the Incident marker on space 0. Put the Infection Rate marker on the leftmost "2" space. Put a tracking token on space 0 of every track printed on an objective.
   6. Put the supply center pieces beside the board.
2. **Read the Legacy deck** ([C-11](#c-11-legacy-deck-r)). Read cards one at a time until a PAUSE or STOP card.
3. **Supply the grid.** Players distribute every cube in the stockpile onto locations on the grid. Any number per location, including zero. Havens may receive cubes.
4. **Infect the grid.** Shuffle the Infection deck. Flip 9 cards one at a time. For each, infect that city once with the setup rule: remove 1 supply cube, or if it has none, place 1 Plague cube and advance the Incident marker. Setup infection never causes an outbreak in practice because a city can hold at most as many setup Plague cubes as it has cards flipped [C]. Put flipped cards in the Infection discard pile. Rule sticker **D** (September, Door D) later replaces this step ([L-9.4](legacy-progression.md#l-94-new-setup-infection-r)).
5. (Rule sticker **E** slot: filled at the end of March by Door E, _Stretched Too Thin_, setting the Epidemic count from the number of City cards in the Player deck; see [L-4](legacy-progression.md#l-4-stretched-too-thin-epidemic-count-r).)
6. **Prepare the Player deck and deal.**
   1. The group picks Rationed Event cards equal to the rationing level. Unrationed Event cards in the reserve always go in and do not count toward the limit.
   2. Shuffle the chosen Events, all Produce Supplies cards, and all City cards of cities on the grid. Deal face up: 2 players get 4 cards each, 3 players get 3, 4 players get 2.
7. **Add epidemics.** Split the remaining Player deck into 5 face-down piles as equal as possible. Shuffle 1 Epidemic into each. Stack them with smaller piles at the bottom.
8. **Select characters.** Each player picks a living character and a pawn color, and places the pawn at that character's home haven. If no living character is free, the player uses a haven worker ([C-9.5](#c-95-haven-workers-r)).
9. **Begin play.** Pick a pawn at random. That player goes first. Play goes clockwise. The first player is not fixed across games [R].

Player count is 2 to 4. A solo player runs 2 or more characters by community convention [C]. The player count may change between games [C].

## C-4. Turn structure [R]

Each turn has four steps in order:

1. Check for exposure ([C-4.1](#c-41-check-for-exposure-r)).
2. Do up to 4 actions, plus any number of free actions ([C-5](#c-5-actions-r), [C-6](#c-6-free-actions-r)).
3. Draw 2 Player cards ([C-7](#c-7-drawing-player-cards-r)).
4. Infect cities ([C-8](#c-8-infection-r)).

Then the player on the left takes the next turn.

### C-4.1 Check for exposure [R]

If the active character starts the turn in a location with 1 or more Plague cubes, the character gains 1 exposure ([C-9.2](#c-92-exposure-r)). The cube count does not matter. Later rules add more exposure sources ([L-3.3](legacy-progression.md#l-33-infested-cities-c), [L-9.2](legacy-progression.md#l-92-exposure-from-leaving-c)).

### C-4.2 Action economy [R]

- A turn has 4 actions. Each listed action costs 1 unless it is a free action.
- The same action may be repeated.
- One action must finish before the next starts.
- Free actions happen only during the active player's own action step: before, between, or after paid actions. They cannot interrupt another action. Example: you cannot pick up cubes at an intermediate port during a Sail.
- A character's job and abilities can modify how an action works.
- Discards from actions go to the Player discard pile.

### C-4.3 Ability activation rule [R]

An ability, whether on a card or a character, may be activated only if all of it can be carried out. Paying a cost for an effect that does nothing is illegal. Example: you cannot play a card that adds supplies when the stockpile is empty, just to discard it.

An ability costs an action only if its text says so ("as an action") [C, designer ruling].

## C-5. Actions [R]

All actions available in January. Each costs 1 action.

| Id    | Action              | Preconditions                                                                                                 | Effect                                                                                                                                             |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-5.1 | Drive or Ferry      | A supply line or sea lane joins the current location to the target.                                           | Move the pawn to the adjacent location. No card needed.                                                                                            |
| C-5.2 | Sail                | Discard a City card. Both the current location and that card's city are ports. A sea route joins them.        | Move the pawn to the card's city. Intermediate ports are not entered or left [C, designer ruling].                                                 |
| C-5.3 | Charter Boat        | Discard the City card of the current city. The current city and the target are ports. A sea route joins them. | Move the pawn to any location on that sea route network, havens included.                                                                          |
| C-5.4 | Make Supplies       | The stockpile has at least 1 cube. Any location.                                                              | Move 1 cube from the stockpile to the character card. No limit on cubes held.                                                                      |
| C-5.5 | Produce Supplies    | Discard a Produce Supplies card. The pawn is in a haven or a city with a supply center.                       | Choose one mode. See [C-5.5.1](#c-551-produce-supplies-modes-r).                                                                                   |
| C-5.6 | Deliver Supplies    | The character holds cubes.                                                                                    | Move any number of cubes from the character card to the current location. A location with Plague cubes may receive cubes.                          |
| C-5.7 | Share Knowledge     | Both pawns are in the same city. The card is that city's City card. Both players agree.                       | Give that card to the other player, or take it from them. Only City cards move. A haven has no City card, so this action never works in a haven.   |
| C-5.8 | Build Supply Center | Discard 5 cards of the current city's color. The city has no supply center.                                   | Place a supply center in the city. If all pieces are on the board, move one from another city instead. Max 1 per city. Lasts the rest of the game. |
| C-5.9 | Recon               | Not available in the prologue. See [C-5.9.1](#c-591-recon-r).                                                 | Open the package named on the route.                                                                                                               |

Sail and Charter Boat never cross land.

### C-5.5.1 Produce Supplies modes [R]

- **Local Production.** Fill the current haven or supply center city up to its population with cubes from the stockpile. If it already holds at least its population, add none. No box is checked. The card goes to the Player discard pile and returns next game.
- **System-Wide Production.** Fill every haven and every supply center city on the grid up to its population. Check one box on the card. When the last box is checked, destroy the card. The player must still stand in a haven or supply center.
- If the stockpile runs short, place what exists in any order the player chooses.
- Cubes never come from the reserve for this action.

### C-5.9.1 Recon [R]

Some board locations print a recon route, which is a card cost and a package number. To Recon:

- Unless the route says otherwise, the pawn must be in that city and the city must hold a supply center.
- Discard the cards the route shows, all in one action.
- A star symbol means any city of that color.
- A letter symbol means each discarded card of that color must be a different city.
- Then open the named package and follow its contents ([L-1](legacy-progression.md#l-1-recon-and-new-regions-r-c)).

Routes printed on the January board ([R], read from the rulebook board diagram):

| City       | Cost            | Package |
| ---------- | --------------- | ------- |
| Washington | any 3 blue      | 1       |
| Cairo      | 4 unique black  | 2       |
| London     | 4 unique blue   | 4       |
| São Paulo  | any 4 yellow    | 5       |
| Lagos      | 5 unique yellow | 7       |

Recon is legal for any route the player can pay, whether or not an objective asks for it [C]. Some unique-card routes are impossible in January because the grid has fewer cities of that color than the route demands [C].

## C-6. Free actions [R]

| Id    | Free action       | Effect                                                                                                                               |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| C-6.1 | Pick Up Supplies  | Move any number of cubes from the current location to the character card.                                                            |
| C-6.2 | Transfer Supplies | Give any number of cubes to, or take any number from, another character in the same location. Taking needs that player's permission. |

Free actions are unlimited per turn, and only on your own turn [R].

## C-7. Drawing Player cards [R]

1. If the Player deck holds fewer than 2 cards when the draw step begins, the game ends in a loss. Never reshuffle the discard pile.
2. Draw the top 2 cards together.
3. Resolve each Epidemic drawn ([C-7.1](#c-71-epidemic-r)). It does not enter the hand and is not replaced.
4. Apply the hand limit ([C-7.3](#c-73-hand-limit-r)).

### C-7.1 Epidemic [R]

Resolve in order:

1. **Increase.** Advance the Infection Rate marker 1 space. It does not move past the last space. The rate value never exceeds 5.
2. **Infect.** Draw the bottom card of the Infection deck. Remove every supply cube from that city to the stockpile. Do not place a Plague cube, even if the city had no cubes. Put the card in the Infection discard pile. Cubes held on character cards are not touched. Rule sticker R replaces this step later ([L-9.5](legacy-progression.md#l-95-new-epidemic-infect-step-c)).
3. **Intensify.** Shuffle only the Infection discard pile and put it on top of the Infection deck.

If 2 Epidemics are drawn together, resolve all three steps once, then again. Discard Epidemics to the Player discard pile. The normal Infect step of the turn still follows.

### C-7.2 Event cards [R]

- Playing an Event is not an action.
- Any player may play an Event at any time, on any turn, except between drawing a card and fully resolving it. A card whose text grants a specific timing window is the exception [C, designer ruling].
- This game plays it more openly for an Epidemic: once its player has started it, any Event may be played between its steps (see [coverage.md](coverage.md), Built differently).
- The player who plays it decides how it is used.
- A Rationed Event goes to the Player discard pile. An Unrationed Event is destroyed after use.
- No Event may be played after the game has ended. Win and loss are immediate ([C-10](#c-10-game-end-r)).

### C-7.3 Hand limit [R]

- Standard limit: 7 cards. Abilities can raise it.
- The limit applies at all times. Whenever a hand exceeds it (after resolving any drawn Epidemics), its owner immediately discards cards or plays Event cards until the hand fits.
- Produce Supplies cards may be discarded to meet the limit. Playing one for its effect costs an action, so it cannot be used to shed a card during the draw step [C].
- Hands are face up. Players may inspect the reserve and both discard piles at any time. They may not look into either deck unless an ability allows it.

## C-8. Infection [R]

At the end of every turn, flip Infection cards from the top of the Infection deck, one at a time, equal to the current infection rate. Infect the named city for each.

### C-8.1 Infect a city [R]

1. If the city has at least 1 supply cube, return 1 cube to the stockpile. Done.
2. Otherwise, if the city has fewer than 3 Plague cubes, place 1 Plague cube and record an incident ([C-8.2](#c-82-incidents-r)).
3. Otherwise (no cubes, already 3 Plague cubes), do not place a 4th cube. An outbreak occurs ([C-8.3](#c-83-outbreaks-r)).
4. Discard the Infection card.

A city with 3 Plague cubes and at least 1 supply cube just loses a cube [C].

Rule stickers **S** and **T** (Package 2) add Hollow Men Gather resolution and draw/Epidemic rules to this section ([L-9.1](legacy-progression.md#l-91-gather-cards-r)).

### C-8.2 Incidents [R]

- Every Plague cube placed anywhere, for any reason, advances the Incident marker 1 space.
- The marker never moves backward, even if a card removes Plague cubes.
- When the marker reaches the last space (the skull), the game ends in a loss at once. Community sources put this at the 8th incident, matching the 8 Plague cubes in the box [C].

### C-8.3 Outbreaks [R]

When city X outbreaks:

1. For every location adjacent to X, havens included, remove 1 supply cube if it has one. Otherwise place 1 Plague cube and record an incident.
2. A neighbor that would get a 4th Plague cube does not. It is queued to outbreak after the current outbreak finishes (a chain reaction).
3. During one Infection card's resolution, no Plague cube is placed on a location that has already outbroken during that resolution. Supply cubes can still be removed from it again [C].
4. An outbreak itself does not advance the Incident marker. Only placed cubes do.

Havens can receive Plague cubes from outbreaks. Whether a haven at 3 Plague cubes chains is not stated. The common reading is that only cities outbreak, so a 4th cube on a haven is not placed [C].

### C-8.4 Infection deck exhaustion [R]

If a card must be drawn and the Infection deck is empty, reshuffle the Infection discard pile into a new deck and advance the Infection Rate marker 1 space. If this happens mid-Infect step, keep drawing at the old rate for the rest of that step.

## C-9. Characters [R]

### C-9.1 Creation [R]

The box has 10 blank Character cards. Before the prologue, create 5:

1. Choose a job sticker and place it in the job box.
2. Choose a portrait sticker.
3. Write a name and an age.
4. Choose one of the starting havens as home.

The other 5 card blanks get filled by characters found during the campaign. Those come with a fixed job and home [C].

A character card holds:

- Name, age, home location, place of death (blank).
- One job (a sticker in the job slot).
- A row of empty slots for abilities and scars. Each slot takes one sticker.
- An exposure track of 7 scratch-off boxes. Under each box: nothing, a scar symbol, or a skull. The layout differs per card and is hidden until scratched.
- A count of supply cubes held. Unlimited.

All 5 starting job stickers ([docs/assets/base/occupations/](../assets/base/occupations/)) [R]:

| Job            | Effect summary                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Administrator  | Once on your turn, as an action, move a pawn to any other pawn.                                                                 |
| Radio Operator | Whenever you do the Transfer Supplies free action, you may give or take Supply cubes from a player in any location.             |
| Laborer        | When doing Build Supply Center, spend 2 Supply cubes from your Character card to build with 1 fewer City card (4 instead of 5). |
| Farmer         | Once on your turn, when doing Make Supplies, you may immediately do Deliver Supplies as a free action.                          |
| Instructor     | Once on your turn, as an action, give any 1 Player card to a player in your location (only give, not take).                     |

### C-9.2 Exposure [R]

When a character gains an exposure, scratch the leftmost unscratched box.

- Empty box: no effect.
- Scar symbol: the character gains a scar ([C-9.3](#c-93-scars-r)).
- Skull: the character dies ([C-9.4](#c-94-death-r)).

Each exposure source resolves separately. A character can gain more than one exposure in a turn [C].

### C-9.3 Scars [R]

Choose any available scar sticker from the reserve. Place it in an empty slot, or over a job, or over an ability. Never over another scar. A covered job or ability no longer works. Scar effects are penalties (example: a recon needs 1 extra card of the same color). New scar stickers arrive through the campaign.

### C-9.4 Death [R]

1. Write the place of death on the card. The character can never be played again.
2. Discard the dead character's hand. Return its cubes to the stockpile.
3. The player loses any remaining actions this turn but still does the draw step and the Infect step.
4. The player picks another living, unused character and places the pawn at its home. If none is available, the player uses a haven worker placed at any haven on the grid.

If death happens during a move, community practice records it at the location being left [C].

### C-9.5 Haven workers [R]

4 haven worker cards exist. A haven worker:

- Starts at any haven.
- Has no job, abilities, or upgrades. Cannot take scars.
- On gaining an exposure, discards its hand and loses any remaining actions. Its next turn starts at any haven.

### C-9.6 Character choice between games [R]

Any living character may be played each game. Players need not keep the same character.

## C-10. Game end [R]

### C-10.1 Win [R]

The game is won the instant the group has completed the month's required number of objectives, including every mandatory one. Play stops at once, even mid-turn or mid-outbreak.

- The board shows the required count per month.
- Objectives not completed in a game may be pursued in later games unless a card destroys them.
- Progress on an objective resets between the early and late attempt, unless the objective card says progress carries over [C].
- If an objective becomes truly impossible, the group wins by completing every objective that is still possible, even if that is fewer than the required count [C, relayed designer guidance].

### C-10.2 Loss [R]

The game is lost the instant any of these happens:

- The Incident marker reaches the last space.
- A player must draw 2 Player cards and the deck holds fewer than 2.
- (Rule sticker U slot. Later fills with another loss condition, see [L-9.6](legacy-progression.md#l-96-hollow-men-supply-loss-c).)

### C-10.3 After every game, win or lose [R]

1. Return all City and Infection cards from hands and discard piles to their decks.
2. Run the Game End steps ([C-12](#c-12-game-end-steps-r)).
3. Apply the calendar result ([C-2](#c-2-campaign-structure-r), [C-2.1](#c-21-rationing-level-r)).
4. Clear every piece from the board. Stickers stay.

## C-11. Legacy deck [R]

- 82 cards in a fixed order. Never shuffled, never looked through. Each card carries a month-and-sequence id such as `01-001`.
- During setup step 2, draw and read cards one at a time until a card marked PAUSE or STOP.
- PAUSE: stop until the current game ends. Read on during Game End step 2.
- STOP: stop until setup of the next month.
- Legacy cards never go back. Repeating a month does not replay them.
- Cards can carry conditional instructions ("if X has not happened, do Y"), checkboxes to scratch, and dossier or package openings.

## C-12. Game End steps [R]

Run after every game, win or lose, in this order.

### C-12.1 Adjust population [R]

1. Step a (Rule sticker **V** slot, Package 3): cities with a **Shelter** skip steps b and c (no population loss from Plague cubes or Hollow Men).
2. Step b: every location with 1 or more Plague cubes loses 1 population. Only 1, however many cubes.
3. Step c (Rule sticker **W** slot, Package 2): every location with 1 or more Hollow Men figures loses 1 population. A location with both Plague cubes and Hollow Men still loses only 1 total.
4. Step d: every city with a supply center gains 1 population.
5. A location that would both lose and gain 1 stays the same.
6. Population stays within 0 to 8.

### C-12.2 Check the Legacy deck [R]

If the top card is a PAUSE card's continuation, read on until the next PAUSE or STOP.

### C-12.3 Resolve the Game End area [R]

1. Shuffle any Infection cards in the Game End area into the Infection deck.
2. Check each Turning Point card in the area. If its condition was met, follow it. Resolve triggered cards from the lowest number to the highest. Untriggered cards return to the reserve until the next game. There are no Turning Points in January's setup or in the prologue.

### C-12.4 Spend production units [R]

Count cities on the grid. Havens, forsaken cities, and unconnected cities do not count [C]. Look up units:

| Cities on the grid | Production units |
| ------------------ | ---------------- |
| 1 to 10            | 3                |
| 11 to 16           | 4                |
| 17 to 24           | 5                |
| 25 to 33           | 6                |
| 34 to 42           | 7                |
| 43 or more         | 8                |

Add 1 if the game was won. Units form one group pool. Unspent units are lost.

Purchases available from the start [R]:

| Purchase                   | Cost                        | Rule                                                                                                                                                  |
| -------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Character ability          | printed next to the sticker | Place on any created, living character, even one who did not play. Use an empty slot. Never over a scar, a job, or another ability.                   |
| City card improvement      | printed next to the sticker | Place on a plain City card with an empty improvement slot (search cards and Utopia have no slot). The city must be on the grid. One sticker per slot. |
| Infection card improvement | printed next to the sticker | Same rules on an Infection card (except Utopia). Shaped differently from City improvements.                                                           |
| Population +1              | 1 per step                  | Any location that is not forsaken. Several steps may be bought at once. Place only the final value sticker. Max 8.                                    |
| Restore forsaken city to 1 | 2                           | A forsaken city returns to population 1.                                                                                                              |

Cards are referred to by the city they name. Plain City cards and non-Utopia Infection cards have 1 improvement slot; search City cards and Utopia cards have none.

Infection card improvements apply whenever that card is drawn: during setup infection, during an Epidemic's Infect step, and during every turn's Infect step [R].

Starting upgrades in the box ([docs/assets/base/upgrades/](../assets/base/upgrades/)) [R]:

- **Character abilities (8):** Architect (3), Helmsman (3), Courier (3), Supplier (3), Broker (2), Coordinator (2), Record Keeper (1), Runner (1). See [L-16.2](legacy-progression.md#l-162-abilities-r).
- **City card improvements (4):** Foundations ×3 (1 PU each: counts as 2 cards of its color for Build Supply Center), Infrastructure ×1 (2 PU: counts as 3 cards of its color for Build Supply Center).
- **Infection card improvements (4):** Lockdown ×2 (1 PU each: if in the Infection discard pile, any player may discard a Player card to destroy this card at any time), Well Stocked ×2 (1 PU each: if there are 2 or more Supply cubes in this city when drawn, remove none).

## C-13. Clarifications [R]

- Supply cubes have no per-location cap. Population only caps Produce Supplies [R].
- Cubes spent by an effect go back to the stockpile unless the effect says otherwise [R].
- Stockpile cubes left at game end go back to the reserve. Nothing carries over [R].
- A supply center in a city with Plague cubes is unaffected. The two only offset at game end [C].
- A destroyed card is gone for every future game [R].
- New rule stickers take effect the moment they are revealed, even mid-game [C, designer ruling].
- Package contents can be used as soon as the package opens, unless the package says otherwise [C].
