# Open questions

This file originally tracked unconfirmed facts, source conflicts, and inferred defaults before the physical components were archived. Every component, card, sticker, dossier door, package, rulebook page, and the full board has now been extracted and verified directly in [docs/assets/](../assets/README.md).

## Q-1. Formerly missing sources — RESOLVED

All items below are now verified directly from the component scans in [docs/assets/](../assets/README.md):

- **Rule sticker text (slots A–W and action slots J–Q):** 100% mapped and verified across [docs/assets/dossiers/folder-1/](../assets/dossiers/folder-1/) and [docs/assets/packages/](../assets/packages/):
  - Page 6: **A** (Forsaken Cities, Door A)
  - Page 8: **B** (Setup stockpile bonus caches, Package 6), **C** (Setup Hollow Men Gather staging, Package 2), **D** (6+3 Setup Infection, Door D)
  - Page 9: **E** (Stretched Too Thin Epidemic table, Door E)
  - Page 10: **F** (Infested city start-of-turn exposure, Door F), **G** (Hollow Men exit exposure, Package 2), **H** (Shuttle Flight, Package 4)
  - Page 11: **I** (Inoculate free action, Package 6)
  - Page 12 (New Actions): **J** (Establish Supply Line, Door J), **K** (Chart Sea Lane, Door K), **L** (Search, Door L), **M** (Monitor, Door M), **N** (Build Shelter, Package 3), **O** (Build Satellite Tower & Transmit, Package 7), **P** (Broadcast Misinformation, Door P), **Q** (Self-Infect, Door Q)
  - Page 13: **R** (Epidemic Infect from Package 6, Door R)
  - Page 14: **S** & **T** (Hollow Men Gather resolution & draw/Epidemic rules, Package 2)
  - Page 15: **U** (Hollow Men figure exhaustion loss, Door U)
  - Page 20: **V** (Game End step a: Sheltered cities skip b & c, Package 3), **W** (Game End step c: Hollow Men -1 population, Package 2)
- **Board print values:** Verified directly on [board.json](../assets/board/board.json):
  - Projected supplies & required objectives: Prologue `1★ / 36`, Jan `2★ / 36`, Feb `2★ / 33`, Mar `3★ / 30`, Apr `3★ / 27`, May `3★ / 24`, Jun `3★ / 21`, Jul `3★ / 18`, Aug `3★ / 15`, Sep `3★ / 12`, Oct `2★ / 8`, Nov `1★ / 4`, Dec `1★ / 0`.
  - Infection Rate track (8 spaces): `[2, 2, 2, 3, 3, 4, 4, 5]`.
  - Incident track: `0..7` then Skull (loss on 8th incident).
  - Production Units table: `1–10: 3`, `11–16: 4`, `17–24: 5`, `25–33: 6`, `34–42: 7`, `43+: 8`, `+1` for win.
  - Starting board: all 9 cities and 3 havens start at population **3**; exact **17** starting sea lanes (including NY–Jacksonville and Mediterranean Haven–Istanbul; no Tripoli–Istanbul).
- **Packages (1–8), Dossiers (69 doors), and Legacy Deck (84 cards):** 100% extracted and cross-verified in [docs/assets/](../assets/README.md).
- **Final scoring table & rating tiers:** Confirmed on `12-08` through `12-12`: 50/early win, 30/late win, +1/pop on grid, +100 delivery, +25/lab on board, -5/forsaken city on grid. Both outcome branches share 5 score tiers: `851+`, `701–850`, `551–700`, `401–550`, `≤400`.
- **Publisher card misprints:** On three Player cards, the top-right compass icon disagrees with the authoritative board map sticker: **Hong Kong** (`P3-12b`) and **Shanghai** (`P3-14b`) omit the anchor on their cards but are ports on Door `56`; **Utopia** (`P8-03b`) prints an anchor on its card but is inland (`×`) on Package 8's map sticker.

## Q-2. Formerly conflicting sources — RESOLVED

| Topic                                        | Resolution (verified from `docs/assets/`)                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which unlock gives Inoculate & Package 6     | **Eastern Pacific lost haven** (Door `60` → first arrival opens **Package 6**: Inoculate Rule I, Rule B, Area 10 `+15`, 15 new Supply cubes, 3 Portable Antiviral Labs). Searching Buenos Aires land (`P5-03b`) discovers OPAL and opens Doors `18` (Immunologist) & `20` (→ Doors `61`, `30`, `13`).          |
| Jade lab effect                              | **Both are true.** Searching Johannesburg (`P7-11b`) opens Doors `46` (Scientist) **and** `20` (→ Door `13` Breakthroughs, where JADE caps Epidemic step 2 removal at **1** Supply cube).                                                                                                                      |
| Hollow Men per city                          | Max **3**; an attempted **4th** figure instead drops the city's population by 1 (Rule S, Package 2).                                                                                                                                                                                                           |
| Packages with Hollow Men                     | **Package 2** (24 figures + 4 Gather), **Package 3** (+4 Gather), **Package 8** (+4 Gather) = 12 Gather cards total. No "Hollow Men Assemble" cards exist.                                                                                                                                                     |
| Monitor result                               | Discard all 4 drawn Player cards in any order (ignoring Epidemics), then scratch 1 Frequency Scanner box (`08-04`): `9.2` → Door `52`, `11.88` → Door `43`, `9.31` → take 2 non-Epidemic cards from the top of the Player discard pile, the other 7 boxes → take 1 (each scratched box shows one card or two). |
| Supply cube total vs `+15` bonuses           | Base box has 36 Supply cubes; **Package 6** adds **15 new physical Supply cubes** (51 total in box) and Area 10 `+15`; Door `11` (Indian Ocean haven) adds Area 11 `+15` (pulling from reserve).                                                                                                               |
| Chart Sea Lane source                        | **End of March (`03-06b`)**, Doors `K` and `24` (base cost: **2** Supply cubes). Package 5 (South America) instead gives abilities Facilitator, Foreman, and Outrider.                                                                                                                                         |
| Who may use Lockdown during an Epidemic      | Printed text: _"If this card is in the Infection discard pile, any player may discard a Player card to destroy this card at any time."_ Community/designer consensus allows using it between Epidemic step 2 and step 3.                                                                                       |
| Hollow Men exposure on another player's turn | Printed text (Rule G / Area 15): _"Whenever you leave a location with 1 or more Hollow Men, get exposed."_ Any movement counts.                                                                                                                                                                                |

## Q-3. Formerly unclosed arithmetic — RESOLVED

- **Supply cubes:** 36 base + 15 new physical cubes inside Package 6 = **51** total Supply cubes.
- **Epidemic-count table (Door E, Stretched Too Thin):** Exact printed brackets: `≤36 → 5`, `37–44 → 6`, `45–51 → 7`, `52–57 → 8`, `58–62 → 9`, `63+ → 10` (making that many piles in setup step 7, using the 5 base Epidemics + 5 extra Epidemics `03-07`..`03-11`).
- **Starting populations:** All 9 starting cities AND all 3 starting havens start at population **3** (`9 × 3 = 27` starting Infection cards).

## Q-4. Remaining edge-case rulings (unprinted on cards/stickers)

All physical counts and card texts are now confirmed (24 Hollow Men figures, 6 Shelter figures, 5 Permanent Shelter stickers, 6 Satellite Tower figures, 4 Permanent Satellite Tower stickers, 6 Permanent Supply Center stickers, 21 Infested stickers, 4 Carrier scar stickers, 5 starting jobs, 8 starting abilities, 3×1-box / 3×2-box / 2×3-box Produce Supplies, Portable Antiviral Lab = discard while Making Supplies for +3 Supply cubes, Shelter Rule V skips BOTH Plague step b and Hollow Men step c, all 3 Turning Points exact, companions stay on their City card permanently).

Only these genuine FAQ-level edge-case rulings remain outside printed card text:

- **Haven outbreak chaining:** Whether a haven at 3 Plague cubes chains an outbreak. Default: no (only cities outbreak; havens still receive Plague cubes from adjacent outbreaks).
- **Towers and shelters in havens / max per city:** Whether a haven can hold a satellite tower or shelter, and whether a city can hold more than one. Default: cities only, max 1 of each structure per city.
- **Carrier entering havens:** Carrier scar (`Door 27`/`32`) reads _"To enter a city, you must discard a card matching its color."_ Default: entering a haven requires no card.
- **Impossibility of objectives:** Relayed designer guidance: if an objective becomes strictly impossible, completing all remaining possible objectives wins the game.

## Q-5. Design notes for an original campaign

- Every mechanic and number in this catalogue is now verified from primary assets (`docs/assets/`). Where this repo's own game engine makes deliberate simplifications or original design choices, those are documented explicitly in [coverage.md](coverage.md).
