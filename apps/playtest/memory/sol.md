# Memory

October first (tour) lost when the Player deck ran out on turn 19. Centers 2/3, Hollow Men in havens 2/3, incidents 2/8. No Epidemics were in that deck. Next lobby is October second, rationing 6.

## People

Moss (char-2), me, Radio Operator, home Midsea, exposure 3/7. Helmsman in slot 1. Exhausted in slot 2: supply lines cost 1 more cube. Do not cover either.
Gale (char-1), Laborer, exposure 1/7, no scar. Built the London center.
Tarn (char-3), Instructor, Lookout, Insomniac (hand -1), Record Keeper (hand +1) in slot 2, Courier in slot 3. Exposure 3/7. Courier delivers to an adjacent city.
Administrator and Farmer were still open at the start of October. Do not create a character unless the brief says so.

## Board that carries

Permanent centers are full at 6. London is the one we added. Bogota's center was not made permanent and will be gone. Buenos Aires shelter is permanent. St. Petersburg and Bogota towers were not.
Seoul and Khartoum are forsaken and infested. Restore is 2, returns them to population 1, and they stay infested. Left undone on purpose: a forsaken city's infection card is set aside, so it cannot incident. Only Drive or Ferry works there.
Hollow Men in havens at game end cost Midsea and Southreach one population each. Plague cost Seoul and Khartoum a step, which is why they are forsaken. Centers gained a step: Washington, London, Cairo, Bogota, Johannesburg, Kolkata, Shanghai.
Wellington is on the grid, linked only to Coralhold. Coralhold recon is done.
Setup logged a Hollow Man on Kolkata. It was never on the board (issue 11). Trust `status` and `board`, not the setup line. Gather cards stay in the infection discard until an Epidemic. A deck with no Epidemics never places another figure.

## Rules that change a turn

Do not end a turn on a plague city. Infested still exposes you at the start of a turn even with no plague, unless a shelter is there or you hold Vector Control Technician. That companion worked: the second turn in Dar es Salaam did not expose me.
Technician, while held, makes a tower cost 1 cube instead of 2. Exhausted does not change towers.
Helmsman: the first Drive or Ferry of the turn costs no action. Shuttle still costs one.
Search does not spend the city card. A companion can put you over 7. Discard a city card you have already searched. Never discard a companion. The discard is `decide:discard:<seat>:<card>` and it locks every action until you do it.
Share only the card of the city you are both standing in. `share:<card>:<seat>:true` gives it.
Radio Operator transfer is free at any distance. `give=false` takes. `give=true` gives. Read the key. The old one is not the other direction.
Shield: discard a city card of the hit city's colour to keep the cube. If I have no card of that colour, `options decide` shows only skip. `decide:skip` closes the choice for the whole table, even when I am not the active player. If the city is at 0 and someone else might pay, `say` and `listen`. Do not skip. If every infection card of that city is already in the discard, the shield prevents nothing until the infection deck reshuffles.
System produce fills every haven and every supply center, havens with no infection cards included. One cube on a city stops one hit. Population does not cap a delivery. It caps produce.
One Quiet Night skips the next infect step. Played after the draw and before any flip, that is the current player's infect.
Reserve was 0 all game. Hidden Stockpile had no play key. Strategic Reserves could not move cubes. Do not count on either while the reserve is empty.
No apostrophe or quote in `say`, `why`, or `report`.

## How to spend

At most 6 permanent centers, and the option vanishes on the sixth. Unspent production units are lost. I want the infection deck blunted and cities kept off 0. Well Stocked is 1. Restore is 2 and leaves the city infested. A permanent center is 3. A permanent shelter is 2.
