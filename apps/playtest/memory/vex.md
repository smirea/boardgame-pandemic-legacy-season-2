# Memory

May won. June is next, rationing 6. May was the first of three games with 10 extra relief cubes. June is the second. One bonus game remains after June.

Stay Knox. Exposure 2/7, no scar. Helmsman: first Drive or Ferry is free, even after another action. Record Keeper: hand 8. Foreman: a land line costs 1 cube. A sea lane still costs 2 and may cross only one region boundary. Scout: recon without a supply center. Laborer: a center is 4 cards plus 2 cubes. The key is `buildCenter:a+b+c+d:true`.

Sol's Immunologist has Record Keeper and Architect (a center with 1 fewer card). Make Supplies still comes from the reserve. Sable has Courier: deliver to an adjacent city. She can give any card in the same location. I can take one from her with `share:<card>:seat-3:false`. That costs an action.

Do not end a turn in a plague city or a forsaken city. Infested stays after Restore. Entering mid-turn does not scratch.

Forsaken, pop 0: Jacksonville, San Francisco, Denver, Cairo, Mexico City. Cairo and Mexico City fell to 0 at the May game end. I did not restore them. Restore costs 2 and they stay infested.

Centers that do not come back: Lagos, Istanbul, São Paulo. Permanent: Washington (pop 8) and London (pop 8). Lagos recon still wants 5 different yellows and a center. Cairo recon wants 4 different blacks. On the grid the blacks are only Istanbul, Tripoli, and Cairo. Moscow is black and off grid. Scout does not create a fourth black city.

Europe is open. Paris is on the grid, linked to London, pop 2. Off grid: Frankfurt (blue, pop 2), St. Petersburg (blue port, pop 1), Moscow (black, pop 1). Lines off the grid: Paris–Frankfurt, Istanbul–Frankfurt, Istanbul–St. Petersburg, and a sea lane from London to St. Petersburg.

After May: Lagos pop 4, Istanbul 5, São Paulo 2, London 8, Paris 2. I do not know the population rule. Washington did not gain.

The lost haven was not found. Farwater is on the grid and is not it. The May rumor is a lit platform further east.

Inoculate is free for anyone, only in the city, only on an infection card. The real key looks like `inf-london.33`. Ignore a key that names a city card. Stored cards stay out for the year. Both São Paulo cards and both Lima cards are stored, so do not armor those cities. Also stored: Jacksonville x2, Denver, Bogotá, London, Atlanta, Lagos x2, Washington, New York x2. Lagos had 3 infection cards, so one remains. Check `decks` before stripping a city.

Well Stocked removes nothing if the city has 2 or more cubes. It is on `inf-washington.14` and `inf-london.33`. At 1 cube it does not block. Rebirth on Tripoli still needs population 4. Tripoli is 1.

A drawn infection card for a forsaken city was skipped into the Game End area until next game. Jacksonville's card was not drawn and stayed in the deck. I do not trust the skip. Keep a cube on a forsaken city until that rule is confirmed.

Do not empty the stockpile at setup. Skip cities whose infection cards are all stored. Extras go on the highest odds, not on Washington or London. `wait` during setup returns at once, so do not confirm until their words are actually on the table.

At rationing 6, name two Quiet Nights, Resilience, Card Swap, Surplus, and Supply Drop. Surplus has still never been played. The id last time was `surplus.226`.

Win is 3 objectives, every starred one included. Recon can put a city on the grid by itself. Paris did, and that finished Connect. Shuttle flies between havens and supply centers. Card Swap: the player who plays it picks both cards. Quiet Night skips that player's own infect step, if played before their first flip. It does not skip the next player.

The rate track is 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5. Three epidemics have passed. The next one moves the rate onto the second 3. A cube spent on a line returns to the stockpile. Produce system fills havens and centers, scratches one box, and the card is gone for that game. `produce.200` has 1 use left.

Search cards still live: bogota.85, lima.89, santiago.93 (discard, 1 box), paris.100 (discard, 1 box). The player discard does not come back unless the deck runs out, which is a loss.

Never saw a legal key for replace, retrieve, freeEdge, removeHollow, shield, cordon, skip, or rename. Rename is lobby only.
