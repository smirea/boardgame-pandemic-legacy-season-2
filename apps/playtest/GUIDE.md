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
3. `do <key> <key> ...` sends commands in order and stops at the first that fails. Copy keys exactly from `options`. Card ids look like `paris.12`.
4. `say <text>` talks to the other players. Keep it short and useful: plans, requests for a card, warnings.
5. `report <bug|rules|ux|idea> <text>` records anything that looks wrong, confusing, or missing. Report the moment you see it.

One player is the lead for each game. Only the lead sends setup and game-end commands. Your brief says whether that is you.

## The game

**Winning and losing.** A game is won the moment the required number of objectives is complete, with every objective marked `*` among them. It is lost at 8 incidents, or when the Player deck cannot supply a full draw, or later in the year when the Hollow Men figures run out. Losing is normal. A lost month is replayed once, then the year moves on.

**The board.** Havens are safe platforms at sea. Cities sit on the mainland. A location is on the grid when a chain of supply lines and sea lanes joins it to a haven. Only grid cities are in the decks.

**A turn** has three steps.

1. Up to 4 actions.
2. Draw 2 Player cards. An EPIDEMIC raises the infection rate, strips every cube from one city, and puts the Infection discard pile back on top of its deck, so the same cities come up again.
3. Flip Infection cards equal to the infection rate. Each one hits a city. If the city has supply cubes it loses one. If it has none it takes a Plague cube, which is an incident. A city with 3 Plague cubes outbreaks into its neighbours.

So supply cubes are armour. Your main job between objectives is keeping cubes on the cities most likely to be hit. `status` lists the trouble spots with their odds.

**Hand limit** is 7. Over it, you must discard.

**Exposure.** Starting your turn in a city with Plague cubes exposes your character. So does leaving a location that holds Hollow Men. A shelter in the location prevents both. Each exposure scratches one box on your character: nothing, a scar (a permanent penalty), or death. A dead character is gone for the rest of the campaign and you pick or make another.

## Actions

Each costs 1 action unless `options` shows another cost.

- `drive:<city>`: move along a supply line or sea lane to a linked location.
- `sail:<card>`: discard a port City card to sail to that port along your sea lanes.
- `charter:<card>:<port>`: discard the card of the city you stand in to sail to any port on your sea lanes.
- `shuttle:<location>`: fly between havens and supply center cities on the grid.
- `makeSupplies`: take 1 cube from the stockpile onto your character.
- `deliver:<count>`: put cubes from your character on your location.
- `pickUp:<count>` and `transfer:...`: move cubes between the location, you, and a player who is with you.
- `produce:<card>:local` fills your location up to its population from the stockpile. `produce:<card>:system` fills every haven and supply center city, and uses up one of the card's two boxes. You must stand in a haven or a supply center city.
- `share:<card>:<seat>:<true|false>`: give (`true`) or take (`false`) the card of the city you both stand in.
- `buildCenter:<cards>`: discard 5 City cards of the city's colour to build a supply center there. Three new ones in a game is the standing objective.
- `establishLine:<city>`: spend cubes from your character to draw a supply line to a neighbouring revealed city. That joins it to the grid.
- `chartLane:<port>`: the same over water, once it is unlocked.
- `recon:<route>:<cards>`: at a marked city with a supply center, discard the listed cards to reveal a whole new region. `board` marks where recon is possible and what it costs.
- `search:<card>:<box>`: holding a city's card while standing in that city, scratch one of its search boxes. Finds range from supplies to new places to nothing.
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
