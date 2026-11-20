# Legacy progression

This file defines every mechanic that enters after January's setup. Every package, door, card, sticker, cost, and count below is verified directly against the physical component scans in [docs/assets/](../assets/README.md). Tags as in [core-rules.md](core-rules.md): **[R]** verified from official rulebook or primary component scans in `docs/assets/`, **[C]** community/FAQ ruling.

Note on anchors: heading tags carry `[R]` where verified from primary assets; existing cross-references in [interactions.md](interactions.md) match section numbers `L-0` through `L-18`.

## L-0. How content unlocks [R]

An unlock is one of:

- A Legacy deck card read in setup or at Game End step 2 ([C-11](core-rules.md#c-11-legacy-deck-r)).
- A recon that opens a package or map door ([L-1](#l-1-recon-and-new-regions-r)).
- A search result that names a door ([L-5](#l-5-search-r)).
- First arrival of a pawn at a revealed location (Eastern Pacific haven → Package 6; Indian Ocean haven → Door 11; Lake Baikal → Door 22).
- A Turning Point card that triggers at Game End ([L-13.3](#l-133-turning-points-r)).
- A frequency box scratched by Monitor ([L-10.3](#l-103-monitor-and-the-frequency-scanner-r)).
- Completing an objective whose card names a reward door (`07-03` Triangulate Signals → Door 35).

Any unlock can add:

- **Rule sticker.** Fills one of the lettered slots `A` to `W` in the rulebook (including action slots `J` to `Q`), or board sticker Areas `10` to `16`. Takes effect at once [C, designer ruling].
- **Action overlay.** Placed on each player reference card (`Doors 23, 24, 25, 37, 38, 39` and Packages `3, 4, 6, 7`).
- **Map sticker.** Adds a region of cities, routes, red region lines, recon boxes, or lost havens to the board.
- **Cards.** City and Infection cards, Rationed/Unrationed Events, Portable Antiviral Labs, objectives, Turning Points, Hollow Men Gather cards, Frequency Scanner, Plan cards.
- **Pieces.** Supply cubes (+15 in Package 6), Hollow Men (24), Satellite Towers (6), Shelters (6).
- **Game-end upgrade stickers.** Character abilities, City/Infection improvements, scars, permanent-structure stickers, lab markers.

## L-1. Recon and new regions [R]

### L-1.1 Recon resolution [R]

See [C-5.9.1](core-rules.md#c-591-recon-r) for the action. On success, open the named package or door. Region packages hold a recon report card, new City and Infection cards, an Unrationed Event card (explorer's reward), sticker cards, and sometimes miniatures, and their report opens the associated map and rule doors.

### L-1.2 Regions and their packages [R]

| Package | Region                     | Opened by                                                                  | Doors opened by report | Cities added | Main new mechanics                                                                                                          |
| ------- | -------------------------- | -------------------------------------------------------------------------- | ---------------------- | -----------: | --------------------------------------------------------------------------------------------------------------------------- |
| 1       | North America              | Recon at Washington (any 3 blue, SC); forced Feb (`02-01`)                 | `66, J, 23, L, 39`     |            6 | Establish Supply Line (`J`), Search (`L`), 3 scars (_Weak, Impatient, Exhausted_), _Decontamination Kit_                    |
| 2       | Middle East and South Asia | Recon at Cairo (4 unique black, SC); forced Aug (`08-01`)                  | `62, 53, F, 14`        |            6 | 24 Hollow Men, 4 Gather cards, Rules `C, G, S, T, W`, Areas `15, 16`, _Renewal_                                             |
| 3       | East Asia                  | Recon at Kolkata (5 unique black, SC, via Door `52`); forced Oct (`10-01`) | `56, 63`               |            9 | 6 Shelters, Build Shelter (`N`), Rule `V`, 5 Perm. Shelters, 2 Rebirth, 4 Gather, _An Incomplete Plan_, _Biodome Prototype_ |
| 4       | Europe                     | Recon at London (4 unique blue, SC); forced Jun (`06-01`, +Door `21`)      | `64`                   |            4 | Shuttle Flight (`H`), _Relocation_                                                                                          |
| 5       | South America              | Recon at São Paulo (any 4 yellow, SC); forced Apr (`04-01`)                | `67, J, 23, L, 39`     |            4 | Abilities _Facilitator, Foreman, Outrider_, _Strategic Reserves_ (+ `J`/`L` if still sealed)                                |
| 6       | Eastern Pacific Haven      | First pawn arrival at Door `60` haven                                      | —                      | 0 (+1 haven) | 15 new Supply cubes, Area 10 `+15`, Rule `B`, Inoculate (`I`), card storage, 3 _Portable Antiviral Labs_                    |
| 7       | Africa                     | Recon at Lagos (5 unique yellow, SC); forced Jul (`07-01`)                 | `57, F, 14`            |            5 | 6 Satellite Towers, Build Tower & Transmit (`O`), 4 Perm. Towers, _TOPAZ Experimental Vaccine_                              |
| 8       | Utopia                     | Completing all 4 steps of _The Plan_ (`11-05`); forced Dec (`12-01`)       | `61` (Lake Baikal)     |  1 (+Baikal) | Utopia (pop 8, 1 Player / 8 Infection cards), 4 Gather cards, _Riot Control_, first-arrival trigger for Door `22`           |

City roster per region:

- **North America (6):** Chicago (blue, inland, 2), Denver (blue, inland, 2), San Francisco (blue, port, 2), Atlanta (blue, inland, 1), Los Angeles (yellow, port, 1), Mexico City (yellow, inland, 1).
- **South America (4):** Buenos Aires (yellow, port, 2), Bogotá (yellow, inland, 2), Lima (yellow, port, 1), Santiago (yellow, inland, 1).
- **Europe (4):** Paris (blue, inland, 2), Frankfurt (blue, inland, 2), St. Petersburg (blue, port, 1), Moscow (black, inland, 1).
- **Africa (5):** Kinshasa (yellow, inland, 1, infested), Khartoum (yellow, inland, 1, infested), Dar es Salaam (yellow, port, 2, infested), Johannesburg (blue, inland, 2), Antananarivo (black, port, 2).
- **Middle East & South Asia (6):** Baghdad (black, inland, 2, infested), Riyadh (black, inland, 2), Tehran (black, inland, 1), Delhi (black, inland, 1, infested), New Mumbai (black, port, 2, infested), Kolkata (black, port, 1, infested).
- **East Asia (9, all red ports, pop 1):** Jakarta, Bangkok, Ho Chi Minh City, Manila (infested), Hong Kong, Shanghai (infested), Seoul, Osaka (infested), Tokyo (infested).
- **Late locations (3):** Utopia (red, inland, 8), Wellington (Door `51`, blue, port, 2, no cards), Lake Baikal (Door `61`, red, inland, 1, no cards).

### L-1.3 A region joins the board, not the grid [R]

- Place the map sticker(s). They reveal cities, red region boundary lines, printed recon routes, and one printed connection into the new region.
- Each region package auto-connects one entry city: Chicago (P1), Buenos Aires (P5), Paris (P4), Kinshasa (P7), Baghdad (P2), Jakarta (P3), Utopia (P8). All other revealed cities stay off the grid until connected by a supply line or sea lane.

### L-1.4 When a city joins the grid [R]

| Timing                     | City card(s)                  | Infection card(s)                                                    |
| -------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| Already connected at setup | Shuffled into the Player deck | Shuffled into the Infection deck                                     |
| Connected during a game    | Into the Player discard pile  | Into the Game End area (joins the Infection deck at Game End step 3) |
| Not connected              | Stays in the reserve          | Stays in the reserve                                                 |

Every expansion city (other than Utopia, Wellington, and Lake Baikal) has Player cards and Infection cards equal to its printed starting population (1/1 or 2/2). **Package 8 exception:** when Utopia connects, its 8 Infection cards and 4 Gather cards go directly into the **Infection discard pile** (not Game End), and its Player card (plus _Riot Control_, if not forced) goes to the Player discard pile.

### L-1.5 Perimeter reports force unexplored regions [R]

At step 2 of the first setup each month, a STOP card checks whether a door/condition is open. If not, scratch its box and apply the fallback (no objective credit; the package's Unrationed Event is destroyed):

| Card    | Month     | Condition checked                           | Forced effect                                                                                               |
| ------- | --------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `02-01` | February  | Door `66` (North America) sealed            | Open Package 1; destroy _Decontamination Kit_.                                                              |
| `03-01` | March     | Door `67` (South America) sealed            | Scratch box 1: warning to Recon South America (nothing forced; box 2 is a decoy).                           |
| `04-01` | April     | Door `67` (South America) sealed            | Open Package 5; destroy _Strategic Reserves_.                                                               |
| `05-01` | May       | Door `60` (Eastern Pacific) sealed          | Open Door `60` and place the haven on the board (not yet accessed; does not open Package 6).                |
| `06-01` | June      | Door `64` (Europe) sealed                   | Open Package 4; destroy _Relocation_; then open Door `21` (**destroys Frankfurt** & its cards permanently). |
| `07-01` | July      | Door `57` (Africa) sealed                   | Open Package 7; destroy _TOPAZ Experimental Vaccine_.                                                       |
| `08-01` | August    | Door `62` (Middle East) sealed              | Open Package 2; destroy _Renewal_.                                                                          |
| `09-01` | September | Door `65` (Indian Ocean) sealed             | Open Door `65` and place the haven on the board (not yet accessed; does not open Door `11`).                |
| `10-01` | October   | Doors `56` & `63` (East Asia) not both open | Open Package 3; add a scar to **1** character selected for this game; destroy _Biodome Prototype_.          |
| `11-01` | November  | Hollow Men have not yet defected            | Open Door `17` (→ Door `58` wall gap); add a scar to **2** characters selected for this game.               |
| `12-01` | December  | _The Plan_ not completed                    | Open Package 8; destroy _Riot Control_.                                                                     |

## L-2. Establish Supply Line [R]

- **Unlocks.** Package 1 or Package 5 (Doors `J` and `23`).
- **Action.** Costs 1 action plus **2** Supply cubes from the character card.
- **Precondition.** The pawn is in a city on the grid. The target is another revealed city.
- **Effect.** Draw a straight permanent supply line center-to-center between the two cities. If the target was off the grid, it joins the grid now ([L-1.4](#l-14-when-a-city-joins-the-grid-r)).
- **Geometry limits.** Must be straight; may not cross water, unexplored area, another city, a destroyed city (Door `21`), or another supply line; may not end at a haven. Sail and Charter Boat cannot use supply lines.
- **Modifiers.** _Foreman_ ability (P5) and _Logistics Expert_ companion (Denver) each reduce the cost by 1 cube; _Exhausted_ scar (P1) increases it by 1 cube.

## L-3. Forsaken and infested cities [R]

### L-3.1 Trigger [R]

January setup adds Turning Point #1 (`01-06`, _Forsaken Cities_). At the first Game End where ≥1 city has population 0, open Doors `A` and `12` (and destroy `01-06`). Door `A` immediately opens Door `50` (21 green rat Infested stickers), which opens Doors `F` and `14` if still sealed.

### L-3.2 Forsaken city rules [R]

A city at population 0 is forsaken:

- **Infestation.** Immediately becomes infested (mark with a rat sticker from Door `50`; if all 21 stickers are gone, no new cities become infested).
- **Infection.** Whenever its Infection card is drawn (setup, Epidemic, or turn Infect step), do not infect it; place the card in the Game End area and draw a replacement.
- **Actions in it.** Only Drive/Ferry to leave; no other action and no free action may be taken there.
- **Events.** Events are not actions and still work.
- **Restoring.** Costs **2** production units to raise to population 1 (no longer forsaken, but stays infested).
- **Production units.** Forsaken cities do not count toward connected cities on the grid.
- **Havens.** A haven can reach population 0 without becoming forsaken or infested.

### L-3.3 Infested cities [R]

- Unlocks via Package 2, Package 7, or Door `50` (Doors `F` and `14`).
- Beginning your turn in an infested city exposes you once. A Plague cube in the same city does **not** cause a second exposure.
- Infested is permanent (restoring population does not remove it).
- _Susceptible_ scar (Door `48`): exposes twice instead of once when starting in an infested city.
- Prevented by a Shelter ([L-11](#l-11-shelters-r)) or holding the _Vector Control Technician_ companion (Delhi).

## L-4. Stretched too thin, epidemic count [R]

- **Unlocks.** End of first March game (`03-06`, Door `E`, plus 5 extra Epidemic cards `03-07`..`03-11`).
- **Rule.** In setup step 5, count City cards in the Player deck (excluding Events, Produce Supplies, Portable Antiviral Labs, Epidemics, destroyed cards, and cards stored in Package 6). Set aside that many Epidemics and make that many piles in step 7:

| City cards in the Player deck | Epidemics (and piles) |
| ----------------------------- | --------------------: |
| 36 or fewer                   |                     5 |
| 37 to 44                      |                     6 |
| 45 to 51                      |                     7 |
| 52 to 57                      |                     8 |
| 58 to 62                      |                     9 |
| 63 or more                    |                    10 |

## L-5. Search [R]

- **Unlocks.** Package 1 or Package 5 (Doors `L` and `39`).
- **Action.** Costs 1 action. While in the city matching a City card in your hand that has an unscratched search box, scratch 1 box and resolve it immediately. Keep the City card in hand (unless scarred with _Impatient_, P1, which forces discarding it).
- **Two-box cards.** Marked `SEARCH THE LAND:` and `SEARCH THE SEA:`; each takes 1 action.
- **Modifiers.** _Operative_ companion (St. Petersburg land) makes Search free while held; _Lookout_ ability (Door `31`) lets you take the matching City card from the Player discard pile into hand and search it once.

### L-5.1 Complete search table [R]

- **North America (P1):** Chicago (+2 stockpile cubes to Chicago), Denver (Companion _Logistics Expert_: Establish Supply Line -1 cube while held), Atlanta (move 1 Infection discard to Game End), Los Angeles (land: 4 reserve cubes to stockpile; sea: open Door `60`, or +1 action if open), Mexico City (Companion _Scout_: action, discard a City card incl. this to take same-color City card from discard), San Francisco (land: 3 reserve cubes to SF; sea: open Door `60`, or +1 action if open).
- **South America (P5):** Buenos Aires (land: OPAL lab → open Doors `18` & `20`; sea: 3 reserve cubes to BA), Santiago (open Door `50` if sealed & infest Santiago), Lima (land: Companion _Herbalist_: play at any time to remove 1 Plague cube from your location; sea: open Door `60`, or +1 action if open), Bogotá (take 1 card from Player discard to hand).
- **Europe (P4):** Paris (Companion _Engineer_: Build Supply Center -1 card while held, may spend this card), Frankfurt (Companion _Messenger_: free action, move Supply cubes from an adjacent location to yours while held), St. Petersburg (land: Companion _Operative_: Search is free while held; sea: free sea lane from St. Petersburg), Moscow (give 1 Player card from hand to another player).
- **Africa (P7):** Kinshasa (Companion _Technician_: Build Satellite Tower -1 cube while held), Khartoum (give 1 Player card from hand to another player), Dar es Salaam (land: free supply line from Dar es Salaam; sea: open Door `65`, or +1 action if open), Johannesburg (JADE lab → open Doors `46` & `20`), Antananarivo (land: Companion _Containment Specialist_: play to remove all Plague cubes from 1 grid location; sea: open Door `65`, or +1 action if open).
- **Middle East (P2):** Baghdad (+2 actions), Tehran (remove up to 2 Hollow Men from the board), Riyadh (take 1 Player card from discard to hand), Delhi (Companion _Vector Control Technician_: no infested start-of-turn exposure while held), New Mumbai (land: +1 action; sea: open Door `65`, or +1 action if open), Kolkata (no search box).
- **East Asia (P3):** Jakarta (Companion _Builder_: play at any time to place a shelter on 1 grid city), Hong Kong (Companion _Structural Engineer_: while held, Build Shelter may discard a City card of any color), Shanghai (story only, no game effect), Osaka (Companion _Local Resistance_: play at any time to remove 1 Hollow Man anywhere on grid), Seoul (free sea lane from Seoul), Tokyo (Companion _Spies_: counts as 2 unique red cards for Recon). Bangkok, Ho Chi Minh City, Manila have no search boxes.
- **Utopia (P8):** Utopia (Companion _Informant_: play at any time to move up to 4 Utopia Infection cards from Infection discard to Game End).

### L-5.2 Companions [R]

A companion is printed permanently under the scratched search box of its City card — it is **not** a separate card. While intact, it remains on that City card across games. Passive companions apply while the card is held; playable companions (_Herbalist_, _Containment Specialist_, _Builder_, _Local Resistance_, _Informant_) are played from hand (discarded to Player discard, never destroyed) and return in future games like normal City cards.

## L-6. Package 6, inoculate, and stored cards [R]

- **Unlocks.** First pawn arrival at the **Eastern Pacific lost haven** (Door `60`, revealed by sea search in Los Angeles, San Francisco, or Lima, or forced in May by `05-01`).
- **Package contents (`P6-01b`).**
  - **15 new physical Supply cubes** added immediately to the stockpile (bringing the box total to 51).
  - **Area 10 `+15` marker** and **Rule sticker B** (_Hidden Supply Cache_): add every bonus beside the stockpile chart at each future setup.
  - **Rule sticker I (_Inoculate_):** free action while in a city — take 1 Player card or 1 Infection card matching your current city from its discard pile and store it inside Package 6 (max 30 Player cards and max 30 Infection cards; Hollow Men Gather cards may not be stored; stored cards may be inspected but not improved). Blocked by _Fear of Needles_ scar (Door `48`).
  - **3 _Portable Antiviral Lab_ cards (`P6-02b`..`04b`):** 1 goes to the arriving player's hand, 2 to the Player discard pile. They remain in the Player deck permanently. While doing _Make Supplies_, discard 1 from hand to take **3 additional Supply cubes** from the stockpile onto your character.
- **Payback.** In September (`09-03`), Door `R` and Door `55` make Epidemic step 2 draw a random Infection card from Package 6. _Rehab Nurse_ (Door `28`) can retrieve stored City cards.

## L-7. Chart Sea Lane [R]

- **Unlocks.** End of first March game (`03-06`, Doors `K` and `24`).
- **Action.** Costs 1 action plus **2** Supply cubes from the character card.
- **Precondition.** Pawn is in a port on the grid; target is another revealed port (havens included).
- **Effect.** Draw a permanent sea lane (may curve; may not cross land, unexplored map, cities, or another sea lane; may cross **at most 1 red region line**). Connecting a new city moves its cards as in [L-1.4](#l-14-when-a-city-joins-the-grid-r).
- **Modifiers.** _Navigator_ ability (Door `29`): once per turn, Chart Sea Lane costs 0 cubes. _Disoriented_ scar (Door `47`): costs 1 extra Supply cube. _Expeditionary Voyage_ Rationed Event (`06-05`): free Chart Sea Lane ignoring the red region line limit.

## L-8. Shuttle Flight [R]

- **Unlocks.** Package 4 (Europe, Rule sticker `H`).
- **Action.** Costs 1 action: move from a haven or supply center to any other haven or supply center on the grid.
- **Modifiers.** _Fear of Flying_ scar (Door `48`): must discard a Player card (if you have one) when doing Shuttle Flight. Cannot be taken from a forsaken city (only Drive/Ferry is allowed there).

## L-9. Hollow Men [R]

- **Unlocks.** Package 2 (Middle East, forced by August `08-01`).
- **Components.** **24** Hollow Men miniatures (Package 2) and **12** _Hollow Men Gather_ cards (4 in Package 2, +4 in Package 3, +4 in Package 8). No "Hollow Men Assemble" cards exist.

### L-9.1 Gather cards [R]

- **Setup (Rule C / Area 16):** Place all Hollow Men Gather cards in the **Infection discard pile** at setup so they shuffle onto the top of the Infection deck at the first Epidemic Intensify.
- **Resolution (Rule S):** When a Gather card is drawn during Infect Cities, keep drawing until a City Infection card is drawn (discarding any consecutive Gather cards). Place **1** Hollow Man on that city instead of normal infection (no cube removed, no Plague cube, no incident, Infection card improvements do not apply). If the city already has **3** Hollow Men, do not place a 4th; instead drop its population by **1** (prevented by a Shelter).
- **Rate & Epidemics (Rule T):** Gather cards do not count toward the infection rate (only the city card drawn after them counts). A Gather card drawn during Epidemic step 2 is discarded with no effect.

### L-9.2 Exposure from leaving [R]

- **Rule G / Area 15 (_Cornered!_):** Whenever a character leaves a location with ≥1 Hollow Men figure (by any movement, on any turn), they gain 1 exposure. Sail and Charter Boat count as leaving only the starting location.
- **Mitigation:** Prevented by a Shelter in the city left, or by _Soldier_ ability (Door `29`: discard a City card matching the color of the city left).

### L-9.3 Removing and moving Hollow Men [R]

- Removed by Tehran search (up to 2), _Local Resistance_ companion (Osaka, 1 anywhere), and _Saboteur_ ability (Door `28`, discard matching-color City card to remove 1 from a city of that color).
- Moved by _Broadcast Misinformation_ (Door `P`, [L-10.4](#l-104-broadcast-misinformation-r)) and _Misinformation Specialist_ ability (Door `28`).

### L-9.4 New setup infection [R]

- **Unlocks.** September setup (`09-03`, Doors `D` and `Y`).
- **Rule D:** Flip 9 Infection cards (skipping forsaken cities). Resolve the first **6** as normal setup infections; on the last **3**, place 1 Hollow Man on each city instead.

### L-9.5 New epidemic infect step [R]

- **Unlocks.** September setup (`09-03`, Doors `R` and `55` _"It's wearing off"_).
- **Rule R:** Draw a random Infection card from **Package 6** (or the bottom of the Infection deck if Package 6 has none). Remove all Supply cubes from that city (no Plague cube), then discard the card to the Infection discard pile.
- **Jade breakthrough (Door `13`):** Once JADE is discovered (Johannesburg), Epidemic step 2 removes **at most 1** Supply cube instead of all Supply cubes.

### L-9.6 Hollow Men supply loss [R]

- **Unlocks.** September setup (`09-03`, Door `U`).
- **Rule U:** You lose the game immediately if you must place a Hollow Man figure and none remain in the 24-figure supply.

### L-9.7 Hollow Men at game end [R]

- **Rule W (Game End step c):** Every location with ≥1 Hollow Men loses 1 population (combined Plague + Hollow Men still loses at most 1). Skipped if the city has a Shelter (Rule V, Game End step a).

## L-10. Satellite towers [R]

- **Unlocks.** Package 7 (Africa, forced by July `07-01`). **6** tower miniatures + **4** Permanent Satellite Tower stickers (3 PU each).

### L-10.1 Build Satellite Tower [R]

- **Rule O:** Costs 1 action + **2** Supply cubes from character card to place a tower in your current city (move an existing tower if all 6 are out). _Technician_ companion (Kinshasa) reduces cost by 1 cube.

### L-10.2 Transmit [R]

- **Rule O:** Costs 1 action while at a satellite tower: give 1 City card matching the tower city's color to any player anywhere on the board.

### L-10.3 Monitor and the frequency scanner [R]

- **Unlocks.** August setup (`08-03` opens Doors `M` & `25`; `08-04` is the Frequency Scanner).
- **Action (Rule M):** Costs 1 action at a satellite tower. Draw the top 4 Player cards (ignoring any Epidemics), discard all 4 in any order, then scratch 1 unscratched box on `08-04`. Retires once all 10 boxes are scratched.
- **Exact Frequency Scanner (`08-04`) outcomes:**
  - **`9.2`** → Open Door `52` (_Transmissions Decoded_: places the Kolkata Recon sticker — 5 unique black cards at a Kolkata SC to open Package 3).
  - **`11.88`** → Open Door `43` (_Transmissions Decrypted_: adds 1 _Decryption Key_ City card improvement, 1 PU — wild color for Recon & Build Supply Center).
  - **`8.24, 8.81, 9.1, 9.31, 9.58, 9.75, 10.31, 10.57` (8 boxes)** → White square: take **1 or 2** non-Epidemic cards from the top of the Player discard pile into your hand.
  - (Door `35` from _Triangulate Signals_ hints `9.2`, `9.31`, and `11.88`.)

### L-10.4 Broadcast Misinformation [R]

- **Unlocks.** October setup (`10-03`, Doors `P` and `37`).
- **Action (Rule P):** Costs 1 action at a satellite tower: move 1 Hollow Man from a city matching your current city's color to an adjacent location (including havens) containing fewer than 3 Hollow Men.

## L-11. Shelters [R]

- **Unlocks.** Package 3 (East Asia, forced by October `10-01`). **6** shelter miniatures + **5** Permanent Shelter stickers (2 PU each).
- **Build Shelter (Rule N):** Costs 1 action + discard 1 City card matching your current city's color (or any color while holding _Structural Engineer_, Hong Kong). Relocate a shelter if all 6 are placed.
- **Protection (Rule N & Rule V):** Characters in or leaving a sheltered city are never exposed; sheltered cities skip **both** Game End step b (Plague) and step c (Hollow Men) population loss and suffer no population loss from a 4th Hollow Man.
- **Other sources:** _Biodome Prototype_ (P3, up to 3 shelters), _Builder_ companion (Jakarta, 1 shelter), _Mobile Shelters_ Rationed Event (`10-07`, 2 shelters), _Vector Control Expert_ job (Door `41`, action: add a shelter to your location with no card).

## L-12. New game-end purchases [R]

| Purchase                  | Cost |       Copies | Enters                                                | Rule                                                                                                                                                |
| ------------------------- | ---: | -----------: | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permanent supply center   |    3 |            6 | End of Feb (3, Door `34`) + End of May (3, Door `36`) | Place on a city that held an SC this game; starts with an SC each game; does not count for _Build 3 new SCs_.                                       |
| Permanent satellite tower |    3 |            4 | Package 7 (Africa)                                    | Place on a city with a tower this game; starts with a tower each game.                                                                              |
| Permanent shelter         |    2 |            5 | Package 3 (East Asia)                                 | Place on a city with a shelter this game; starts with a shelter each game.                                                                          |
| Rebirth (Infection)       |    1 |            2 | Package 3 (East Asia)                                 | If this city has population ≥ 6 when drawn for normal infection, do not infect it.                                                                  |
| Broken Link (Infection)   |    1 |            3 | End of Apr (2, Door `42`) + End of Sep (1, Door `33`) | After discarding this card during turn Infect, any player may discard a Player card to stop drawing Infection cards this turn (not setup/Epidemic). |
| Lockdown (Infection)      |    1 | +1 (3 total) | End of Sep (Door `33`, +2 base)                       | Discard any Player card while in Infection discard to destroy this card at any time.                                                                |
| Decryption Key (City)     |    1 |            1 | Door `43` (Frequency `11.88`)                         | Counts as a City card of any color for Recon or Build Supply Center.                                                                                |
| Local Operatives (City)   |    1 |            2 | End of Oct (Door `45`)                                | Counts as both red and its original color.                                                                                                          |
| New character abilities   |  1–3 |           12 | Package 5, May (`31`), Aug (`29`), Oct (`28`)         | See [L-16.2](#l-162-abilities-r).                                                                                                                   |

**Free August upgrade (`08-02a`):** During August setup (before step 3), immediately spend up to **3** free production units on character abilities.

## L-13. Objectives, lost havens, and turning points [R]

### L-13.1 Objectives by month [R]

| Month     | Req | Objectives in play (M = mandatory)                                                                                                                                                      |
| --------- | --: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prologue  |   1 | Build 3 supply centers (`00-02`, M). Destroyed before January.                                                                                                                          |
| January   |   2 | Build 3 new supply centers (`01-04`, M). Recon North America (`01-05`, M, carries over to late Jan).                                                                                    |
| February  |   2 | Build 3 new supply centers (M). Recon 1 unknown region (`02-04`). Connect 2 new cities (`02-05`). (`01-05` destroyed.)                                                                  |
| March–Jun |   3 | February's set + Complete 2 searches (`03-04`) + Access a lost haven (`03-05`, destroyed at end of game when completed).                                                                |
| July–Aug  |   3 | Adds Triangulate signals (`07-03`: towers in blue, yellow, and black cities → opens Door `35` & destroys at end of game).                                                               |
| September |   3 | Destroys `02-04`. Adds Recon East Asia (`09-04`, M, carries over; auto-complete in Sep if already reconned).                                                                            |
| October   |   2 | Destroys `09-04`, `02-05`, `03-04`. Build 3 new supply centers (M) + Get Hollow Men to defect (`10-04`, M, ≥1 Hollow Man on 3 havens, carries over).                                    |
| November  |   1 | Destroys `01-04`, `10-04`. Complete the Plan (`11-04`, M): 4 Shanghai recons on `11-05` (no SC needed; 5 unique red, 4 unique black, 3 unique yellow, 3 unique blue; boxes carry over). |
| December  |   1 | Destroys `11-04`, `11-05`. Deliver the Sample (`12-04`, M): carrier in Johannesburg while Johannesburg has a supply center.                                                             |

### L-13.2 Lost havens [R]

1. **Eastern Pacific haven (Door `60`, pop 3):** Revealed by sea search in Los Angeles, San Francisco, or Lima (or forced in May `05-01`). First arrival names it and opens **Package 6**.
2. **Indian Ocean haven (Door `65`, pop 3):** Revealed by sea search in New Mumbai, Dar es Salaam, or Antananarivo (or forced in September `09-01`). First arrival names it and opens **Door `11`** (active player gains **4 actions**, moves up to 15 reserve cubes to stockpile, and places Area 11 `+15` marker for future setups).
3. **Coral Sea haven (Door `59`, ruined, pop 1):** Revealed by Recon at Jakarta (2 red cards, duplicates allowed, at SC). First arrival names it. Hosts Recon to New Zealand (2 red cards, duplicates allowed, **no SC needed** → opens Door `19`).

### L-13.3 Turning points [R]

| #   | Card    | Enters   | Condition (Game End step 3)                        | Effect                                                                                                                                 |
| --- | ------- | -------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `01-06` | January  | ≥1 city has population 0                           | Open Doors `A` and `12` (→ `50` → `F`, `14`) and destroy this card.                                                                    |
| 2   | `02-06` | February | Lost 4 games in a row                              | Scratch box: up to 3 times during setup step 1, cross out a `10` to move up to 10 reserve cubes into stockpile; destroy after 3rd use. |
| 3   | `10-05` | October  | ≥1 Hollow Man on 3 different havens at end of game | Open Door `17` (→ Door `58` wall gap to Utopia) and destroy this card.                                                                 |

## L-14. Labs, Utopia, and December [R]

### L-14.1 Labs [R]

Four labs exist (coordinate clues on `04-02b`). Finding either OPAL or JADE opens Door `20` (_You've Found Us_), which opens Doors `61` (Lake Baikal), `30` (4 Lab marker stickers), and `13` (Area 13 Breakthroughs legend); TOPAZ (Door `19`) also opens `61`, `30`, and `13` if still sealed.

| Lab   | City         | Found by                                | Doors opened                | Breakthrough effect (Door `13` / `22`) & Character                                                                                                                                                                        |
| ----- | ------------ | --------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPAL  | Buenos Aires | Land search (`P5-03b`)                  | `18, 20`                    | **Breakthrough:** +1 Supply cube when Making Supplies in a haven or supply center. **Character:** _Immunologist_ (Door `18`, Buenos Aires, age 37).                                                                       |
| JADE  | Johannesburg | Search (`P7-11b`)                       | `46, 20`                    | **Breakthrough:** Remove **at most 1** Supply cube during Epidemic step 2. **Character:** _Scientist_ (Door `46`, Johannesburg, age 35).                                                                                  |
| TOPAZ | Wellington   | Recon at Coral Sea haven (2 red, no SC) | `19` → `51, 41, 61, 13, 30` | **Breakthrough:** Discard a matching-color Player card to prevent 1 Supply cube removal from a just-drawn Infection card (needs ≥1 cube to save). **Character:** _Vector Control Expert_ (Door `41`, Wellington, age 42). |
| PEARL | Lake Baikal  | First pawn arrival at Lake Baikal       | `22` → `Q, 38, 27, 32`      | **Self-Infect** action (`Q`), 4 total _Carrier_ doses (Doors `27` & `32`).                                                                                                                                                |

### L-14.2 Utopia [R]

- Opened by completing _The Plan_ (`11-05`) or forced in December (`12-01`).
- Package 8 places Utopia (red, inland, pop 8, cannot be improved), opens Door `61` (Lake Baikal, red, inland, pop 1, no cards), puts Utopia's 1 Player card (and _Riot Control_ unless forced) into Player discard, and puts all **8 Utopia Infection cards** + **4 Hollow Men Gather cards** into the **Infection discard pile**.
- Connect Lake Baikal via supply line from Utopia; first arrival opens Door `22` (PEARL).

### L-14.3 December, deliver the sample [R]

- **Self-Infect (Door `Q` / `38`):** Action while in PEARL (Lake Baikal). Scratch exposure boxes one at a time until a scar symbol or skull appears. Skull kills the character. Scar grants one of the **4** double-slot _Carrier_ scars (Doors `27` & `32`; covers 2 slots, spare existing scars where possible; once all 4 doses are used, no more exist). Haven workers cannot take scars.
- **Carrier rules (Door `27`/`32`):** Pawn may move **only** via Drive/Ferry; to enter a city, must discard a card matching that city's color (havens need no card); at Game End, win or lose, destroy the character.
- **Win (`12-04`):** A carrier is in Johannesburg AND Johannesburg has a supply center.

## L-15. Campaign end and final scoring [R]

After Game End step 4 of a December win or second December loss, draw `12-05`, read `12-06` (failed) or `12-07` (delivered), and calculate score on `12-08`:

| Component                              |        Points |
| -------------------------------------- | ------------: |
| Each month won in the early attempt    |           +50 |
| Each month won in the late attempt     |           +30 |
| Total population of all grid locations |       +1 each |
| Sample delivered                       |          +100 |
| Each lab marker on the board           | +25 (max 100) |
| Each forsaken city on the grid         |            -5 |

**Ending tiers (`12-09`–`12-10` Did Not Deliver; `12-11`–`12-12` Delivered):** `851 and above`, `701–850`, `551–700`, `401–550`, `400 and below`.

## L-16. New characters, abilities, and scars [R]

### L-16.1 Characters found during the campaign [R]

| Job                   | Effect                                                                                             | Source          | Home / Age           |
| --------------------- | -------------------------------------------------------------------------------------------------- | --------------- | -------------------- |
| Immunologist          | When doing Make Supplies, may take Supply cube(s) from the reserve instead of the stockpile.       | Door `18`       | Buenos Aires, age 37 |
| Sanitation Officer    | Free action: discard 2 Player cards to take a City or Produce Supplies card from Player discard.   | Door `44` (Jun) | Player chooses       |
| Captain               | Free action: discard a City card to move between any two ports on the grid connected by sea route. | Door `49` (Jun) | Player chooses       |
| Scientist             | Once on your turn, free action: destroy an Infection card in discard matching your current city.   | Door `46`       | Johannesburg, age 35 |
| Vector Control Expert | Action: add a Shelter to your location (no card required).                                         | Door `41`       | Wellington, age 42   |

### L-16.2 Abilities [R]

Exact catalog of all **20** character abilities (8 starting + 12 unlocked; no "Surveyor" ability exists):

| Ability                   | Effect                                                                                                            | Cost | Source          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---: | --------------- |
| Architect                 | Build Supply Center with 1 fewer card.                                                                            |    3 | Start           |
| Helmsman                  | One free Drive/Ferry action each turn.                                                                            |    3 | Start           |
| Courier                   | Deliver Supplies may put Supply cubes into 1 adjacent location instead of current location.                       |    3 | Start           |
| Supplier                  | Once on your turn, as an action, move a Supply cube from stockpile to a city matching a card in hand (keep card). |    3 | Start           |
| Broker                    | Action: discard a City card to take a same-color card from Player discard.                                        |    2 | Start           |
| Coordinator               | Free action: move a pawn in an adjacent location to your location.                                                |    2 | Start           |
| Record Keeper             | Increase hand limit by 1 card.                                                                                    |    1 | Start           |
| Runner                    | Action: discard a City card while in a haven or supply center to move to any location on the grid.                |    1 | Start           |
| Outrider                  | Recon with 1 fewer card.                                                                                          |    3 | Package 5       |
| Facilitator               | Once on your turn, as an action, take any 1 Player card from a character in your location.                        |    2 | Package 5       |
| Foreman                   | Establish Supply Line costs 1 fewer Supply cube.                                                                  |    2 | Package 5       |
| Lookout                   | To do Search, may take matching City card from discard into hand, then search it once.                            |    2 | Door `31` (May) |
| Scout                     | May do Recon in a city without a supply center.                                                                   |    2 | Door `31` (May) |
| Smuggler                  | Action: discard a City card to take 1 Supply cube from reserve into the city matching the card.                   |    1 | Door `31` (May) |
| Investigator              | Once on your turn, as an action, discard a Player card to take a City card from Player discard.                   |    3 | Door `29` (Aug) |
| Soldier                   | Discard a City card matching the color of the city you are leaving to prevent Hollow Men exit exposure.           |    2 | Door `29` (Aug) |
| Navigator                 | Once on your turn, do Chart Sea Lane without spending Supply cubes.                                               |    1 | Door `29` (Aug) |
| Misinformation Specialist | Action: move a Hollow Man from your city to an adjacent city containing ≤2 Hollow Men.                            |    2 | Door `28` (Oct) |
| Saboteur                  | Action: discard a City card to remove 1 Hollow Man from a city matching that card's color.                        |    2 | Door `28` (Oct) |
| Rehab Nurse               | Action: discard 2 Player cards to take 1 City card of your choice from Package 6 into your hand.                  |    1 | Door `28` (Oct) |

### L-16.3 Scars [R]

Exact catalog of all **18 regular scars** (+ **4 Carrier** double-slot scars):

- **Base (9):** _Fastidious_ (Build SC +1 card), _Overcautious_ (cannot leave haven with 0 cubes if carrying any), _Regretful_ (leaving city with 0 cubes discards a card), _Bacillophobic_ (start turn on Plague cube: -1 action), _Hoarder_ (cannot deliver your last 2 cubes), _Obsessed_ (must end turn with odd hand size, else discard 1), _Demoralized_ (Epidemic returns all carried cubes to stockpile), _Xenophobia_ (Recon +1 card), _Insomniac_ (hand limit -1).
- **Package 1 (3):** _Weak_ (carry limit 3 cubes), _Impatient_ (discard searched card), _Exhausted_ (Establish Supply Line +1 cube).
- **Door `47` (End of Mar, 3):** _Missing the Sea_ (start turn inland: -1 action), _Embezzler_ (Make Supplies also moves 1 cube from stockpile to reserve), _Disoriented_ (Chart Sea Lane +1 cube).
- **Door `48` (End of Aug, 3):** _Susceptible_ (infested start exposes twice), _Fear of Needles_ (cannot Inoculate), _Fear of Flying_ (Shuttle Flight discards a Player card if able).
- **Doors `27` & `32` (4 total, Self-Infect only):** _Carrier_ (2 slots; Drive/Ferry only; discard matching color to enter city; die at Game End).

## L-17. Player card types & complete Event list [R]

- **Rationed Events (15 total):**
  - Base (4): _Resilient Population_ (1–2 matching city Infection discards to Game End, playable between Epidemic steps 2–3), _Airlift_ (move any 1 pawn anywhere), _Team Bravo_ (up to 2 stockpile cubes to any location), _One Quiet Night_ (skip next Infect Cities step).
  - End of Jan (`01-08`..`01-11`, 4): _Data Transfer_, _Dispersal_, _Drastic Measures_, _Extended Forecast_.
  - End of Feb (`02-08`..`02-10`, 3): _Hidden Stockpile_, _It Worked the First Time_, _Extended Time_ (+3 actions).
  - End of Jun (`06-04`..`06-05`, 2): _Inoculation Unit_ (up to 3 Infection discards to Package 6), _Expeditionary Voyage_ (free sea lane ignoring red lines).
  - End of Sep (`09-06`, 1): _Cautious Approach_ (draw next 4 Player cards, keep City cards, discard rest without effect).
  - End of Oct (`10-07`, 1): _Mobile Shelters_ (build 2 shelters anywhere on grid for free).
- **Unrationed Events (7 total, destroyed after use or if package forced):** _Decontamination Kit_ (P1), _Renewal_ (P2), _Biodome Prototype_ (P3), _Relocation_ (P4), _Strategic Reserves_ (P5), _TOPAZ Experimental Vaccine_ (P7), _Riot Control_ (P8).
- **Portable Antiviral Labs (3, Package 6):** Permanent Player cards; discard while Making Supplies for +3 Supply cubes.
- **Companions (11):** Printed under City card search boxes ([L-5.2](#l-52-companions-r)).

## L-18. Infection card types [R]

| Type                   | Count | Rule                                                                                              |
| ---------------------- | ----: | ------------------------------------------------------------------------------------------------- |
| City Infection cards   |    73 | 27 starting (3×9) + 46 expansion (1–2 per city matching starting population).                     |
| Utopia Infection cards |     8 | Package 8; cannot be improved; start in Infection discard when Utopia opens.                      |
| Hollow Men Gather      |    12 | 4 in P2 + 4 in P3 + 4 in P8; start in Infection discard at setup ([L-9.1](#l-91-gather-cards-r)). |
