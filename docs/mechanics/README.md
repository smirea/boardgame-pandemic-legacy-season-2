# Mechanics catalogue

This is a functional spec of the mechanics of Pandemic Legacy: Season 2 (Z-Man Games, 2017). The engine for this repo's original co-op legacy game reuses these mechanics on its own theme, map, and campaign. Everything here is paraphrased. Nothing is transcribed from cards, stickers, or story text.

## Files

| File                                           | Contents                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [core-rules.md](core-rules.md)                 | The base game at the start of the campaign. Setup, turn, actions, infection, characters, game end steps, calendar. |
| [legacy-progression.md](legacy-progression.md) | Every mechanic that unlocks during the campaign, its trigger, and its interactions. Final scoring.                 |
| [components.md](components.md)                 | Component counts, deck composition, board graph, and the state each piece carries.                                 |
| [interactions.md](interactions.md)             | A numbered checklist of 170 interactions, each pointing at its rule. Start here to plan the engine.                |
| [open-questions.md](open-questions.md)         | Unconfirmed values, conflicts between sources, and inferred rulings with proposed defaults.                        |

Every section carries a confidence tag. **[R]** is confirmed by the official rulebook. **[C]** comes from community sources. **[I]** is inferred by this catalogue.

## The game loop on one page

The players run a few offshore havens after a plague. The world map starts mostly blank. Their job is to keep cities stocked with supply cubes so the plague never lands.

**Inverted infection.** Supply cubes are good. An Infection card removes 1 supply cube from its city. Only a city with no cubes gets a Plague cube. Every Plague cube placed is an incident. The 8th incident loses the game. Plague cubes are never removed by normal play. An Epidemic wipes all cubes from one city but places no plague. Outbreaks happen at 3 Plague cubes and strip cubes from neighbors first.

**A turn.** Check exposure (starting a turn on plague hurts). Take 4 actions: move by line or by sea, make and carry cubes, produce cubes at havens and supply centers, trade cards, build supply centers, recon. Draw 2 Player cards. Flip Infection cards equal to the infection rate.

**A game.** Win the moment the month's required objectives are done. Lose on the last incident, on an empty Player deck, or later on running out of enemy figures. Mid-game, the main card goal is 5 same-color City cards for a supply center, or a printed card set for a recon.

**Between games.** A location loses 1 population if plague or enemies are present and gains 1 for a supply center. A city at 0 is forsaken and infested for good. The group earns production units from the number of connected cities (3 to 8, plus 1 for a win). It spends them on character abilities, card improvements, population, and permanent structures. Rationing (0 to 10) sets how many chosen Event cards go in the next deck. It drops by 2 after a win and rises by 2 after a loss.

**The campaign.** 12 months, two attempts each. A win advances. A loss replays the month once, then advances anyway. The supply budget shrinks each month while the map grows. The Legacy deck adds rules in a fixed order:

1. January. Characters, supply centers, and recon only.
2. North America opens supply lines and searching.
3. A first forsaken city brings forsaken and infested rules.
4. March brings sea lanes and an epidemic count that grows with the deck.
5. Labs and lost havens bring card storage (inoculate) and supply bonuses.
6. Europe brings flights between bases.
7. The Middle East brings the Hollow Men enemy.
8. Africa brings satellite towers, then monitoring and enemy redirection.
9. East Asia brings shelters.
10. September turns stored cards against the players and seeds enemies at setup.
11. October asks the players to lure enemies into havens.
12. November is a four-part recon plan.
13. December is a one-way carry of a sample. The carrier dies.

**Scoring.** After December, the score adds points for each month won (more for an early win), total population, delivering the sample, and labs found. It subtracts points for forsaken cities.

## Sources

Read for this catalogue, all in November 2026:

- Official rulebook PDF, via a retailer mirror: `https://cdn.shopify.com/s/files/1/2546/6116/files/rules-pandemic-season-2.pdf`. The publisher's copy at `images.zmangames.com` failed its TLS check.
- Rulebook text transcription: `https://rulespal.com/pandemic-legacy-season-2/rulebook`
- 132 community FAQ rulings, each with a confidence label: `https://rulespal.com/pandemic-legacy-season-2/faq`
- Rules summary (flagged by its own author as partly inaccurate): `https://lehi-innovation.github.io/boardgame-rules/rules/pandemic-legacy-season-2/`
- Full campaign log (uborka.nu), prologue to December, 11 posts starting at `https://uborka.nu/2022/10/pandemic-legacy-season-two/`
- Full campaign log (pinkglitterpumpkins.com), prologue to late December, 19 posts listed at `http://www.pinkglitterpumpkins.com/home/tag/Pandemic+Legacy`
- Campaign notes, prologue to December: `https://maculifemoratus.wordpress.com/2021/02/13/notes-from-pandemic-legacy-season-2/`
- BoardGameGeek threads read through `api.geekdo.com`: "Final scores!" (1896292), "Compiled FAQ" (1807785), "Thoughts on December" (1882315), "End of December question" (1876779), "Compiled list of all player cards search effects" (1963885), "Did anyone win December late?" (3583842), "Cairo Recon Spoiler" (1904857), and about a dozen shorter rules threads.
- A session report blog: `http://hiewandboardgames.blogspot.com/2018/07/pandemic-legacy-season-2.html`
