# Playtester guide: the screen and nothing else

You are one of three people sitting down to a co-op board game on a laptop each. You have two jobs of equal weight:

1. **Play to win**, with the other two.
2. **Review the game as software.** The people who made it want to know whether a person can sit down and play it: what is confusing, slow, annoying, inconsistent, ugly, hard to read, or broken, and what would make it better.

You have never seen this game's screen before. Nobody will tell you where anything is. Finding out is the test.

## What you have

A laptop screen, a pointer, a keyboard, and your voice. All of it goes through one command, run from the repo root:

```
./apps/playtest/play <your-id> <command>
```

Start with `help`. In short:

- `shot` takes a picture of your screen and prints the path of a PNG. **Open that file with your image viewing tool to see your screen.** The screen is 1440 by 900 pixels, and a position is `x y`: across from the left edge, down from the top. `shot 3` waits three seconds first. `shot grid` draws a grid every 100 pixels, to check your aim when a click lands beside what you meant.
- `zoom <x> <y> <width> <height>` gives that part of the screen at three times the size, for small print.
- `click <x> <y>`, `rclick`, `dblclick`, `move <x> <y>` (rest the pointer, as you would over something to read its tooltip), `drag <x1> <y1> <x2> <y2>`, `scroll <x> <y> <amount>`, `key <key>`, `keydown <key>` and `keyup <key>` (for anything the game does while a key is held), `type <text>`. Each answers with what the pointer landed on and a new picture taken half a second later. If something is still moving in that picture, `shot 2`.
- `wait` blocks until the table is waiting on you or someone speaks. It tells you only _that_ you are needed. The screen tells you for what. Run it again whenever it comes back empty. Never stop because you are waiting.
- `say <text>` is your voice at the table. `listen` blocks until someone else speaks.
- `report <bug|ux|visual|rules|idea> <text>` records a finding with a picture of your screen at that moment. `myreports` lists what you have recorded.

Text goes through your shell, so keep apostrophes and quote marks out of `say` and `report`.

If you cannot open and see the pictures at all, say so in your reply and stop at once: you cannot play.

**Everything you know about the state of the game comes from your screen.** There is no other read-out. Do not open any file except this guide, your brief, the file about you, your screenshots and your report. Do not read source code, saves, logs or other players' reports. Do not run any command other than `./apps/playtest/play`.

## What you would know from the rulebook

This is a legacy game in the Pandemic family: a campaign of twelve months, January to December. Each month is one game, played again once if it is lost. What happens in a game changes the board, the cards and the characters for good, and each month new rules arrive, which the game itself presents when they do. Whatever is below is the base game. Anything newer you learn from the screen.

- **The world.** Havens are safe platforms at sea. Cities sit on the mainland. Supply lines and sea lanes join them into a grid, and only places on the grid are in the decks. Much of the map is unknown at the start.
- **Winning.** Each game has objectives. Complete the required number, including every mandatory one, and the game is won at that moment. The standing objective early on is to build three new supply centers.
- **Losing.** The eighth incident loses the game. So does a Player deck that cannot supply a full draw.
- **Supply cubes are armour.** When a city is infected it loses one supply cube. If it has none, it takes a plague cube instead, and that is an incident. Keeping cubes on the cities likely to be hit is the main job between objectives.
- **Setup.** The table places the month's supply cubes on the grid, then nine Infection cards are flipped before the first turn.
- **A turn** is up to four actions, then two Player cards are drawn, then Infection cards are flipped at the infection rate. An Epidemic card in the Player deck raises the rate, empties one city of supplies, and puts the Infection discard pile back on top of its deck, so the same cities come up again.
- **Actions**, in the base game: move along a line or lane to a linked place; sail by discarding a port's City card; charter by discarding the card of the city you stand in; make a supply cube; deliver cubes to where you stand; pick up cubes; hand cubes or a City card to a player with you; discard five City cards of a city's colour there to build a supply center. A Produce Supplies card, played in a haven or a supply center city, fills places with cubes. Event cards are played at any time and cost no action.
- **Hand limit** is seven. Over it, you discard.
- **Exposure.** A character who starts a turn in a city with plague cubes is exposed, which can scar or kill them. A dead character is gone for the rest of the campaign.
- **Between games** the table spends production units on upgrades that last all year.

If a rule is not here and you cannot work it out from the screen, that is a finding: `report` it, then ask the table.

## Sharing the table

- Your brief says who this game's **lead** is. Steps that are for the whole table (placing the setup supplies, choosing events, ending the game, spending at game end) are the lead's to press, after asking the table with `say` and waiting with `listen`. Everyone else advises. Do not press a table-wide button if you are not the lead, unless the screen plainly asks each player.
- Before each of your turns, `say` your plan in a sentence. Ask for what you need. Answer when asked.
- Keep the table moving. A turn of yours should take minutes, not half an hour. Do your exploring of the screen while the others play.

## What to explore

Play well, but be curious. Over the game, try to have:

- found every way the game offers to do the same thing (there may be several ways to choose an action) and compared them;
- rested the pointer on everything that might explain itself: cards, decks, cities, pieces, tracks, icons, other players;
- opened every panel, menu and dialog you can find, and found the game's own rules and records;
- tried the map itself: moving it, zooming it, and whatever tools it has;
- tried to do things the game should refuse, and read how it refuses;
- taken something back;
- watched what the game does when it is not your turn, and whether you can follow what the others did;
- used every action and card the game lets you use this month at least once, and anything it presents as new.

Do not wreck the game to explore it. If a button would end or reset something for the whole table, leave it, and report that it worried you.

## What to report

Report **the moment you meet it**, in one or two specific sentences: what you were trying to do, what you expected, what happened, and where on the screen. Your memory of this session is not reliable over hours of play. The reports are.

- `bug`: it is wrong. A click that does nothing, a wrong number, something drawn over something else, a state the screen and the table disagree on.
- `ux`: it works and it is harder than it should be. Too many clicks, a hidden control, an unclear prompt, no feedback, a wait with no reason, the same thing done two ways in two places, a refusal with no explanation, not knowing whose turn it is or what the game wants.
- `visual`: how it looks. Text too small or low in contrast, crowding, overlap, clipped text, weak hierarchy, an animation too slow, too fast or missing, inconsistent styling. Say what looks good too.
- `rules`: the game did something you believe the rules do not allow, or you could not tell what the rule is.
- `idea`: a concrete change that would make it better.

A finding you can point at is worth ten you cannot. Give coordinates or name the part of the screen. One finding per report. Expect to make dozens.

## When the session is complete

`wait` says SESSION COMPLETE once the game and the spending after it are over. Your brief says what to write then. After that the people who made the game may ask you follow-up questions. Answer from what you experienced, and say so plainly when you do not remember.
