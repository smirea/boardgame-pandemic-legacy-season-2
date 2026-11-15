# Player guide

You are one of the players in a year-long co-op campaign. The year runs January to December. Each month is one game, or two if the first is lost. What happens in one game changes the board for every later game. You play the whole year, one game per session, and your memory file is what carries over.

## How you play

Everything goes through one command, run from the repo root:

```
./apps/playtest/play <your-id> <command>
```

`<your-id>` is in your brief. Start every session with `help`, then `status`.

The loop is short:

1. `wait` blocks until the game needs you or someone speaks. Run it again whenever it says it is still waiting. Never stop because you are waiting.
2. `status` shows the whole table. `options` lists every command you may send, by exact key. `board` shows the map.
3. `do <key> <key> ... why: <one sentence>` sends commands in order and stops at the first that fails. Copy keys exactly from `options`. Card ids look like `paris.12`. **End every `do` with `why:` and your reason**, such as `do drive:london deliver:2 why: London is at 0 cubes and 46% to be hit`. The whole game is recorded and replayed later, and your reason is shown beside the moves it explains. A `do` with no reason leaves a hole in the record.
4. `say <text>` talks to the other players. Keep it short and useful: plans, requests for a card, warnings. Table talk is recorded with the game too.
5. `report <bug|rules|ux|idea> <text>` records anything that looks wrong, confusing, or missing. Report the moment you see it.

One player is the lead for each game. Only the lead sends setup and game-end commands. Your brief says whether that is you.

## The game

**Winning and losing.** A game is won the moment the required number of objectives is complete, with every objective marked `*` among them. An objective that can no longer be completed (a region already revealed in an earlier game) is dropped automatically and shows as `[-]`. Then the rest decide the win, even if that is fewer than the required number. Supply centers do not survive into the next game unless they were made permanent. It is lost at 8 incidents, or when the Player deck cannot supply a full draw, or later in the year when the Hollow Men figures run out. Losing is normal. A lost month is replayed once, then the year moves on.

**The board.** Havens are safe platforms at sea. Cities sit on the mainland. A location is on the grid when a chain of supply lines and sea lanes joins it to a haven. Only grid cities are in the decks.

**A turn** has three steps.

1. Up to 4 actions.
2. Draw 2 Player cards. An EPIDEMIC moves the infection rate one step along its track (the track starts 2, 2, 2, 3, so the number does not rise every time), strips every cube from one city, and puts the Infection discard pile back on top of its deck, so the same cities come up again.
3. Flip Infection cards equal to the infection rate. Each one hits a city. If the city has supply cubes it loses one. If it has none it takes a Plague cube, which is an incident. A city with 3 Plague cubes outbreaks into its neighbours.

Cubes never leave the game. A cube an infection removes goes back to the stockpile, and so does every cube you spend on a supply line, a tower or a Laborer's build. `makeSupplies` takes them out again.

So supply cubes are armour. Your main job between objectives is keeping cubes on the cities most likely to be hit. `status` lists the trouble spots with their odds.

**Hand limit** is 7. Over it, you must discard, and the game waits until you do, even on another player's turn. `wait` tells you when that is you.

**Epidemic odds.** The Player deck is stacked in equal piles with one epidemic in each. The chance in `status` follows the pile being drawn, so it is not simply epidemics divided by cards.

**Event timing.** Quiet Night skips the next Infect step. Played before the first flip of an Infect step, that is the step it skips. Second Wind can only be played during the action step. When an Epidemic strikes while someone holds Resilience, the game pauses before the reshuffle so it can be played on the city that was just hit.

**Exposure.** Starting your turn in a city with Plague cubes exposes your character. So does leaving a location that holds Hollow Men. A shelter in the location prevents both. Each exposure scratches one box on your character: nothing, a scar (a permanent penalty), or death. A dead character is gone for the rest of the campaign and you pick or make another.

## Actions

Each costs 1 action unless `options` shows another cost. `options` is the truth about what you can do right now: an action that is not listed is either not unlocked yet this year or not legal where you stand.

- `drive:<city>`: move along a supply line or sea lane to a linked location.
- `sail:<card>`: discard a port City card to sail to that port along your sea lanes.
- `charter:<card>:<port>`: discard the card of the city you stand in to sail to any port on your sea lanes.
- `shuttle:<location>`: fly between havens and supply center cities on the grid. Unlocks later in the year.
- `makeSupplies`: take 1 cube from the stockpile onto your character.
- `deliver:<count>`: put cubes from your character on your location.
- `pickUp:<count>` and `transfer:...`: move cubes between the location, you, and a player who is with you. Both are free actions: they cost nothing, any number of times, on your own turn.
- `produce:<card>:<mode>`: discard a Produce Supplies card. Both modes need you to stand in a haven or a supply center city. `local` fills your location up to its population from the stockpile. `system` fills every haven and supply center city and scratches one of the card's two boxes. Either way the card goes to the discard pile for the rest of this game and comes back next game. The boxes last all year: when both are scratched the card is destroyed for good.
- `share:<card>:<seat>:<true|false>`: give (`true`) or take (`false`) the card of the city you both stand in. An Instructor may give any card, so `options` lists more when one is involved.
- `buildCenter:<cards>`: discard 5 City cards of the city's colour to build a supply center there. Three new ones in a game is the standing objective.
- `establishLine:<city>`: unlocks with the first region you reveal and stays unlocked for the rest of the year. Spend cubes from your character to draw a supply line to a neighbouring revealed city. That joins it to the grid.
- `chartLane:<port>`: the same over water, once it is unlocked.
- `recon:<route>:<cards>`: at a marked city with a supply center, discard the listed cards to reveal a whole new region. `board` marks where recon is possible and what it costs.
- `search:<card>:<box>`: unlocks with the first region you reveal and stays unlocked. Holding a city's card while standing in that city, scratch one of the card's search boxes. Only some City cards have boxes. A card that has them shows `(2 search boxes)` after its name, and `options` then lists the search. Finds range from supplies to new places to nothing.
- `buildShelter`, `buildTower`, and others appear in `options` as the year unlocks them. The Legacy briefing at the start of a game says what is new.

Event cards and companions in your hand are played with `play:...` keys at any time, even on another player's turn. They cost no action.

## Between games

After a game ends the lead opens the game-end step. Cities change population. The group gets production units to spend on upgrades that last all year: abilities for characters, improved cards, more population, permanent structures. `options buy` lists what is for sale. Tell the lead what you want and why.

## What we need from you

This run exists to prove the whole game works. Play to win, but also:

- Try what is new. When a briefing unlocks an action, use it at least once.
- Use different characters, jobs and abilities over the year. Your brief lists what nobody has tried yet.
- When something refuses to work, contradicts the briefing, or leaves you unsure what the rule is, `report` it. Say what you expected and what happened.
- Do not read or edit any file except your memory file, your report file, and this guide. Do not look at the game's source.
