---
project: a/bg-pandemic-2
gc: agent-t3-worktree gc --repo .
teardown: agent-t3-worktree teardown
ship: pr-ship --merge
---

Repo config for the global `task-orchestrator` skill (`~/code/ai-files/skills/task-orchestrator/`). Its `scripts/check-config.ts` validates this file.

# Orchestrator

- `AGENTS.md` holds the architecture and product rules. The decision docs are `docs/mechanics/` (the rules of the game, with `coverage.md` and `open-questions.md`) and `docs/playtest/` (what real play has reached, `tour.md` above all).
- Most tasks arrive from the game's Feedback editor (Alt+Cmd+click, or Menu › Give feedback, then Share › ProcrastiMate) with an annotated image and `feedback.json`. The JSON names each tagged component's `file:line`, and its `Game` context gives the phase, month, attempt, turn, active player, and pending decisions. `procrastimate images` downloads both.
- Natural areas:
  - the rules and content: `packages/game` (the XState machine, `reject`, content, saves, recordings). A rule change also touches `docs/mechanics/` and often `apps/playtest`.
  - the board: `apps/ui/src/lib/board` (Threlte scene, chart, fog, city markers, pieces).
  - the HUD: `apps/ui/src/lib/hud` (`Game.svelte`, seats, dock, top bar, choosers, lobby, briefing).
  - cards: `apps/ui/src/lib/cards`, checked at `/debug/cards`.
  - replays: `apps/ui/src/lib/replay` and `routes/replay`.
  - networking: `packages/net`, `apps/ui/src/lib/session`, and the signal Worker in `apps/signal`.
  - the playtest lab: `apps/playtest`.
- `Game.svelte` is the one screen. Tasks that restructure its layout go in one job; a fix inside one HUD component is its own job.
- Clients a job can cover: the browser on a laptop only. There is no mobile layout.
- Usual shared work: a new field in the game state, a change to `content/world.ts` (rerun `apps/ui/scripts/gen-geometry.ts`), a new command in the machine that the UI and the bot both use.
- Human-only tasks: a real game between several browsers on different machines, and a judgement on how the game feels to play.
- Known shared failures: none yet.

# Worker

## Setup

- `AGENTS.md` is the rulebook: read it first, then the `docs/mechanics/` pages your task touches.
- Your worktree builds from the `.env` defaults on its own ports. It has no `PROCRASTIMATE_TOKEN`, so its Feedback editor has no ProcrastiMate entry; you never need one.

## Verification

- Rules: `bun test` (the pre-commit hook runs the whole suite), and the playtest lab where a mechanic needs real play: `./apps/playtest/lab coverage` must stay at 227 of 227.
- UI: `bun run dev` in your worktree and drive the real screen with T3's preview tools at a laptop width. `window.DEBUG` loads and sets state.
- Stored data: there is no backwards compatibility while the game is in development, so new state needs no default for old saves (`parseSave` refuses them).
- Before the PR: `bun run lint:ci`, `bun run typecheck`, `bun run test`, and `bun run build`, as CI does.

## After the merge

- A merge deploys: CI's `deploy` job ships `apps/signal` (the signal Worker and the built game at https://pandemic-legacy-s2.stf.lol) on every push to master once the checks pass. Watch that run after your merge and fix it if it fails. A change that needs a new Worker secret also needs `bun run secrets:push`.
