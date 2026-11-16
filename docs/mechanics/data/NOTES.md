# Board and timeline data: sources and caveats

`board.json` and `legacy-timeline.json` are the structured data the engine loads. The prose rules catalogue lives one level up in `docs/mechanics/`. These files hold mechanics only: no story, flavor text, character names or card wording. Havens use generic labels because players name them in play.

## What each file covers

`board.json` holds 12 regions, 52 locations (46 cities and 6 havens) and 60 routes.

- Regions carry the recon spot, the card cost and the package or door it opens.
- Cities carry real coordinates, color, starting population, port status, card counts and printed infested markers. The infested markers are kept in `notes`.
- Havens use approximate open-ocean coordinates read from board photos.
- Routes come in three groups:
  - 16 sea lanes printed on the starting board (`startsEstablished: true`). Midsea sits west of Gibraltar and Istanbul is reached through Tripoli, so no two starting lanes cross or run together on this map.
  - 9 lines printed on region stickers or packages, which connect when the region opens.
  - 35 routes that players built in documented campaigns.

In the original game players draw every supply line and charted sea lane themselves. The third group is evidence of legal edges, not a fixed graph. The engine should build the graph from the Establish Supply Line and Chart Sea Lane rules in `legacy-timeline.json`, then check them against geography.

`legacy-timeline.json` has three parts.

- `months`: the objectives for each month, how many are needed to win, and setup changes such as stockpile size, perimeter-report deadlines and destroyed objectives.
- `unlocks`: 36 ordered entries. Each has a trigger, a source (package, door, rule sticker or Legacy card number), what it adds and what it retires. Region recons sit where a typical group meets them. Each region trigger also gives its forced deadline.
- `campaignEnd`: the final objective and the scoring formula.

## Sources read

Rules text:

- https://rulespal.com/pandemic-legacy-season-2/rulebook (full starting rulebook text, including the blank rule-sticker slots A to W)
- https://rulespal.com/pandemic-legacy-season-2/faq and its 132 answer pages under `/pandemic-legacy-season-2/faq/<slug>` (community and designer rulings, many spoilers)
- https://lehi-innovation.github.io/boardgame-rules/rules/pandemic-legacy-season-2/ (rules summary)
- https://board-game-rules.com/boardgames/pandemic-legacy-season-2/ (rules summary)

Campaign photo logs. These are the main evidence for hidden content. I read the card and sticker photos directly.

- Pink Glitter Pumpkins, 19 posts from the prologue through late December, for example http://www.pinkglitterpumpkins.com/home/2020/9/1/pandemic-legacy-season-two-early-january and http://www.pinkglitterpumpkins.com/home/2021/3/4/pandemic-legacy-season-two-late-december. Photos used: the starting board (supply track, recon spots and costs, printed sea lanes, populations), the North America, Europe, Africa, Middle East and East Asia region stickers, the Utopia wall sticker, and rule stickers A, C, E, G, J, K, M, N, O, P, S, T, V and W. Also Perimeter Reports, Right Now cards, New Priorities cards, objectives, Turning Point #3, the Frequency Scanner, The Plan, Deliver the Sample, Self-Infect, the Carrier scar and The Final Reckoning.

Campaign text logs:

- uborka.nu, January (part two) through December: https://uborka.nu/tag/pandemic-legacy/
- https://maculifemoratus.wordpress.com/2021/02/13/notes-from-pandemic-legacy-season-2/
- http://hiewandboardgames.blogspot.com/2018/07/pandemic-legacy-season-2.html
- https://steamcommunity.com/sharedfiles/filedetails/comments/2076752344 (Tabletop Simulator port comments; confirms Package 1 holds the Chicago cards)

Tried and unavailable:

- BoardGameGeek threads (Cloudflare challenge, and the XML API needs auth).
- The Z-Man rulebook PDF host (TLS certificate mismatch; not bypassed).
- daviau1.rssing.com (Cloudflare challenge).

## Conflicts and what I followed

- **Starting card counts.** The component list gives 36 City cards and 27 Infection cards for 9 starting cities, so 4 and 3 per city. Hiew's blog says 3 in each deck. I followed the component list.
- **Expansion city card counts.** One log reports 44 City cards after four new cities joined, which means 2 Player cards per new city on average. I used 2 for non-red cities. The Jakarta package card says "the Player card" and "the Infection card" in the singular, so Jakarta is 1 and 1. Two other logs say red cards are scarce. Red cities other than Jakarta are `null`. Atlanta has exactly 1 Infection card ("the one and only"). Packages say "Infection cards" in the plural for Paris, Buenos Aires and Baghdad, so expansion Infection counts are `null` apart from Atlanta, Jakarta and Utopia (8).
- **Chicago population.** uborka says 1, but the sticker photo shows 2. I followed the photo.
- **January stockpile.** macu says 33. The board track photo shows 36 for January and 33 for February, and the February card says "33 for February". I followed the board.
- **The +15 stockpile bonus.** The photo log got a "hidden supply cache" +15 sticker from Package 6 (the Opal lab). uborka credited +15 to the eastern Pacific lost haven, and macu credited the Lima-side haven. The final board photo shows two +15 stickers. I recorded +15 for the Opal package and +15 for the Indian Ocean haven (both well supported). The eastern Pacific haven bonus is marked as a single-report claim.
- **The Jade lab effect.** macu says it reduces the Epidemic Infect step to removing 1 cube. uborka says the find was only a new character. Both appear, with the Epidemic effect marked "one report".
- **Package numbers.** macu calls North America "box 3" and the photo log once calls the Middle East "package 8". The photographed cards settle it: North America is Package 1 (board text and the Tabletop Simulator comment), the Middle East is Package 2 (Perimeter Report and P2 card codes), East Asia is Package 3, Europe 4, South America 5, Opal 6, Africa 7 and Utopia 8.
- **The Package 8 reward.** uborka says a Rationed Event is lost when the package is forced. The photo log calls the reward an Unrationed Event. The data says "event card reward".

## Inferred, not observed

- **Starting sea lanes.** Read from one angled photo. Two lanes are low confidence (Washington to the Mediterranean haven, and Washington to the South Atlantic haven) and are marked `inferred`.
- **Haven coordinates.** Approximate, read from photos.
- **Region-sticker connections.** The anchor of each auto-connect line was read from line direction on the sticker: Chicago to New York, Baghdad to Cairo, Buenos Aires to Sao Paulo, Jakarta to Kolkata. The Paris to London and Kinshasa to Lagos lines are confirmed by play reports.
- **Production units per bracket.** The bracket bounds are legible (1-10, 11-16, 17-24, 25-33, 34-42, 43+). The unit values (3 to 8) are back-solved from reported totals and are marked `inferred`.
- **Infection rate track.** The spaces are uncertain. Only "starts at 2, caps at 5" comes from the rulebook.
- **Door 60** as the eastern Pacific haven's door. One Perimeter Report mention fits it.
- **Bogota's color** (yellow) is inferred from the rest of the South America sticker.

## Gaps (null in data)

- Starting populations for the four South America cities, Wellington and Lake Baikal. Colors for Wellington, Utopia and Lake Baikal. Player card counts for red cities other than Jakarta, and for Utopia, Wellington and Lake Baikal.
- The Kolkata recon cost: black cards of different cities, count unknown. The card count for the Coral Sea haven recon to New Zealand.
- What the Europe package's Unrationed Event does. What each Frequency Scanner box gives, apart from door 52 (the Kolkata recon spot) and card draws.
- Full rule-sticker coverage. Stickers B, F, H, I, Q and the effects of doors 23, 39, 47, 53, 14 and F are not documented beyond "new scars, abilities or events".
- Character jobs, abilities, scars and their costs. The sibling prose catalogue (`components.md`) owns those.
