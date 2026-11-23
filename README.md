# Pandemic Legacy: Season 2

A co-op legacy board game for two to four friends, played in the browser on a 3D world map. Full rules, printed story, voice-acted narrative sequences, procedural sound effects, and adaptive ambient music. One player hosts and owns the campaign. Everyone else connects straight to the host over WebRTC. There is no game server.

```sh
bun install            # also installs the git hooks
bun run env:generate   # after editing .env or .env.local
bun run dev            # UI at http://boardgame-pandemic-legacy-season-2.localhost
```

## Play

- **On one screen.** Open the UI and choose "Play on this screen", or go to `/debug/game`. This runs the real game with every seat on one client and no networking, so one person can play a whole campaign. The table turns each turn to seat the active character at the bottom right.
- **With friends.** `bun run dev` starts a signaling Worker too. One player hosts and the others join with the same passphrase. Everyone is seated as they arrive, and the game starts when all have pressed Ready for the same one. A browser that arrives mid-game picks an open seat, and Vacate my seat in the menu frees yours.

The passphrase is `DEV_SIGNAL_SECRET` (`pandemic`). The dev page reaches the Worker at `/signal` on its own address, so a browser on another machine plays through whatever host name serves the page. The Worker only introduces players to the host; game traffic goes peer to peer over WebRTC. A build (`bun run build`, the playtest lab) uses `SIGNAL_URL` instead, and `packages/net/README.md` has the steps to deploy the Worker on the Cloudflare free plan.

To try several players in one browser, give each tab its own identity with `?DEBUG_ID=alice`, `?DEBUG_ID=bob`.

## Layout

- `packages/game`: the rules. An XState machine owns the phases, pure functions own the rules, and `content/` holds the map, cards and the Legacy deck. No browser APIs.
- `packages/net`: the P2P library. A host, peers, a reliable lane for game messages and a lossy lane for cursors.
- `apps/signal`: the Cloudflare Worker used only to connect players.
- `apps/playtest`: the playtest lab, where AI players run the campaign in real browser tabs.
- `apps/ui`: the SvelteKit SPA. `lib/board` is the 3D board, `lib/hud` the screen around it, `lib/session` the bridge between the actor and the network.
- `docs/mechanics`: the rules catalogue the engine was built from, and `coverage.md`, which lists what is built, partly built, or missing.

## Things to know

- **Saves.** The host's browser stores the campaign as plain `{ phase, world }` JSON. Every player holds the full state, so anyone can export a backup from the menu. Only the host can import one.
- **Changing the map.** Edit `packages/game/src/content/world.ts`, then run `apps/ui/scripts/gen-geometry.ts`. It regenerates board positions and the city pairs players may join with a supply line or sea lane.
- **Checking the rules.** `bun test` runs the rule tests and plays a full campaign with a random bot, checking that every command is legal and every invariant holds after it. `CAMPAIGNS=200 bun test packages/game/src/bot.test.ts` plays more seeds.
- **Cards.** City cards have no hand-made art. `apps/ui/src/lib/cards/mapArt.ts` draws each one from the map data: a crop around the city with a pin on it. `/debug/cards` shows every generated Player and Infection card.
- **Console helpers.** `window.DEBUG.getState()`, `saveState()`, `loadState()` and `setState(save)` are available while a game is open.
- **The canonical save.** The menu loads our own campaign at the September lobby (`packages/game/src/canonical-save.json`). Tests and tools build a lobby of any month with `campaignAt(month)` in `packages/game/src/scenarios.ts`, for reaching late mechanics without playing nine months.
- **Playing a whole campaign with AI players.** `apps/playtest/README.md` covers the lab: configs, saves, player memories, and the parity report.
- **Replaying a game.** The host records every game as it is played. The menu saves the recording to a file, and `/replay` plays one back on the real game screen, step by step.

`AGENTS.md` lists the stack, conventions and product principles.
