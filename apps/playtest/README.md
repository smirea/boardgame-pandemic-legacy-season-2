# Playtest lab

Runs AI players through the real game, each in its own browser tab, and keeps a record of what the campaign revealed and exercised. Use it to check that the whole year plays from January to December.

## Run it

```sh
./apps/playtest/lab start apps/playtest/configs/campaign.json   # builds the app, opens the tabs, resumes the run's last save
./apps/playtest/lab brief                                       # writes one brief per player for the next game
./apps/playtest/lab parity                                      # writes runs/<run>/parity.md
./apps/playtest/lab replays                                     # prints the address of the replays page
./apps/playtest/lab review apps/playtest/configs/campaign.json  # serves a finished run's replays without starting a game
./apps/playtest/lab coverage campaign-2 tour-october            # what the named runs exercised, counted from their recordings
./apps/playtest/lab coverage ~/code/<repo>/apps/playtest/runs/*  # a path counts another checkout's runs
./apps/playtest/lab stop
```

`start --fresh` begins the run again and moves the old run folder aside with a timestamp. `lab watch` blocks until something needs an operator: the session ends, a player or the lab reports a problem, play stalls, or the lab dies. `start --no-build` skips the app build.

Then start one agent per player with the task "Read `apps/playtest/runs/<run>/briefs/<id>.md` and follow it". Each agent plays one game, writes a report, rewrites its memory file, and stops. Run `lab brief` again for the next game. The lab resumes where it stopped, so it can be restarted between games to pick up a fix.

Watch a live game from your own browser at the address `lab start` prints, with the passphrase from the config.

## How it is put together

- `src/daemon.ts` serves the built app, runs the signaling Worker, and opens one Chromium tab per player. The first player hosts. The others join over WebRTC, so every command a player sends crosses the real session and network code.
- `play <id> <command>` is the players' command line. `GUIDE.md` is what they are told about it.
- A player's harness is `api` or `ui`. With `api` they send commands by key (`do drive:london`), which the lab passes to `window.DEBUG.send` in their tab. With `ui` they may only `look`, `click`, `tap`, `choose`, `type` and `key`, which are real mouse and keyboard input. The lab reads what each click sent from the host tab's own recording, so a click-driven game is recorded as fully as a keyed one.
- Legality is never decided here. The lab lists options with the engine's `legalActions` and friends and checks every command with `reject`.
- `src/audit.ts` watches every state change. It runs the engine's invariants, checks each month's objectives and supplies against `docs/mechanics/data/legacy-timeline.json`, checks that each Legacy card is read in its own month, and counts which mechanics have happened.

## Config

`configs/campaign.json` sets the run name, the seed, the starting save or scenario, the ports, and the players. Each player has an id, a persona file, a memory file, a harness, and the model that plays it. Copy the file to try another table.

- `configs/ui-harness.json` is a two-player example on the click-only harness, starting from the October scenario. `configs/ui-january.json` plays January from a new campaign with all three players on it.
- `configs/tour-october.json`, `configs/tour-november.json` and `configs/tour-searches.json` are tour games (below).

`start` can also name a `stage` and a `coverage` list. `coverage` names earlier runs: what their recordings exercised counts as done, so the briefs list only what no run has reached yet.

## Tour games

A campaign plays one path through the year, so some of the game never comes up: the recon it skipped, the search nobody made, a death. A tour game puts the table next to those parts and lets the players play them.

`src/stages.ts` holds the scenarios and the stages. A scenario is a campaign save in a lobby (`tour-october` is a group that never searched Johannesburg or reconned the Coral Sea). A stage arranges the table once, on the first action step: it moves pawns, deals chosen hands, sets a few cubes and the top of a deck. It keeps the engine's invariants, and after it every move is a real command from a player. The stage also gives each seat a list, which the brief prints. `src/stages.test.ts` plays both lists through the engine, so a stage that no longer fits the rules fails there before any player is started.

`lab coverage <run> ...` replays the recordings of the named runs through the audit and prints what happened in play across all of them, what each later run added, and what no run has reached.

## What a run leaves behind

Everything is under `runs/<run>/`, which git ignores.

- `saves/latest.json` is rewritten after every state change. `saves/g03-m03a1-over.json` and its like are kept at each phase of each game. Any of them loads with `lab load <path>` or through the game's Menu.
- `journal.jsonl` has every command, refusal, log line, chat line and page error.
- `issues.jsonl` has what the players reported, each with a save of that moment.
- `records/g00.json` and its like are the recordings, one per game, written as the game is played. Each holds every state change with the command that caused it, who sent it, and the table talk, stated reasons (`why:`) and issue reports as timestamped notes.
- `parity.md` is the campaign report: each game against the research timeline, the Legacy deck schedule, mechanics exercised and not, and every problem found.
- `reports/` has each player's write-up of each game. `shots/` has a screenshot of the host tab at each phase.

Memory files live in `memory/` and are tracked, so a later run starts with what the players learned.

## Replays

The replays page lists every recorded game of the run and plays any of them back on the real game screen: step, scrub, jump by turn, or let it run. The side panel shows each move with the reason the player gave for it, the table talk around it, and what the game logged. `lab start` and `lab replays` print its address. With `bun run dev` running, `/debug/runs` lists every run that recorded a game and opens any of them in the same page. The app's server and the lab serve the recordings through the same `/api/runs` routes in `src/replays.ts`.

The operator's notes on each game (summary, story, highlights, rules check, findings and fixes) live in `notes/<run>.json`, keyed by game (`g00`, `g01`, and so on), and show in the page's Notes tab and games list. They are tracked in git. The recordings are not.
