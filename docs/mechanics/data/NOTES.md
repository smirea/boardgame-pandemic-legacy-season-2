# Board and timeline data: sources and notes

`board.json` and `legacy-timeline.json` are structured mechanics datasets for the engine. Havens use placeholder labels because players name them in play.

Every value, count, connection, population, card count, recon cost, and campaign unlock in both files is now **verified directly against the extracted physical game assets in [docs/assets/](../../assets/README.md)** (970 split images + 418 JSON sidecars from the English Tabletop Simulator Workshop mod `2236267539.json`), closing every `null` gap and resolving every conflict from the earlier community-log pass.

## What each file covers

`board.json` holds 12 regions, 52 locations (46 cities and 6 havens), and 62 routes:

- **Regions:** Exact recon spots, exact card costs (including Kolkata's 5 unique black cards from Door `52` and Coral Sea haven's 2 red cards with duplicates allowed and no supply center from Door `59`), and exact packages/doors opened.
- **Cities & Havens:** Verified colors, starting populations (including all 9 starting cities and 3 starting havens at population 3, all 4 South America cities, Wellington blue port pop 2, Utopia red inland pop 8, Lake Baikal red inland pop 1), authoritative map-sticker port flags, exact Player and Infection card counts, and printed infested markers.
  - Note on printed card misprints: Hong Kong (`P3-12b`) and Shanghai (`P3-14b`) omit the compass anchor on their Player cards but are ports on Door `56`; Utopia (`P8-03b`) prints an anchor on its Player card but is inland (`×`) on Package 8's map sticker. `board.json` uses the authoritative map stickers.
- **Routes:**
  - **17** sea lanes printed on the starting board (`startsEstablished: true`), verified directly on `docs/assets/board/board.jpg` (including New York–Jacksonville and Mediterranean Haven–Istanbul; Tripoli–Istanbul is not printed on the board).
  - **10** lines printed on region/city stickers (Washington–Chicago, São Paulo–Buenos Aires [sea], London–Paris, Lagos–Kinshasa, Cairo–Baghdad, Kolkata–Jakarta [sea], Jakarta–Coral Sea Haven [sea], Coral Sea Haven–Wellington [sea], Lima–Eastern Pacific Haven [sea], plus Shanghai–Utopia on the Package 8 overlay).
  - **35** additional player-drawn routes documented in campaign logs as examples of legal edges.

`legacy-timeline.json` holds:

- `constantTables`: Verified projected supplies (Prologue 36 through December 0), Production Units table (`1–10: 3` .. `43+: 8`, `+1` win), Infection Rate track (`[2, 2, 2, 3, 3, 4, 4, 5]`), and Incident track (`lossAt: 8`).
- `months`: Exact objectives, mandatory flags, required counts, and verified setup changes for all 12 months (keeping exact objective IDs expected by `apps/playtest/src/audit.ts`).
- `unlocks`: Complete verified unlock schedule from Prologue through December (`00-01`..`12-13`, Packages `1`–`8`, Doors `A`–`Z` and `11`–`67`), with zero inferred gaps or misattributed packages (Package 6 = Eastern Pacific Haven, OPAL = Doors `18` & `20`, JADE = Doors `46` & `20`, August free upgrade = 3 PU, no "Hollow Men Assemble" cards).
- `campaignEnd`: Exact final objective (`12-04`), exact scoring formula (`12-08`), and exact ending score tiers (`12-09`..`12-12`).
