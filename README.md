# Legacy

A co-op legacy board game for two to four friends, played in the browser on a 3D world map. It has the mechanics of Pandemic Legacy: Season 2 on generic geography and original art, with no story text. One player hosts and owns the campaign. Everyone else connects straight to the host over WebRTC. There is no game server.

```sh
bun install            # also installs the git hooks
bun run env:generate   # after editing .env or .env.local
bun run dev            # UI at http://boardgame-pandemic-legacy-season-2.localhost
```

## Play

- **On one screen.** Open the UI and choose "Play on this screen", or go to `/debug/game`. This runs the real game with every seat on one client and no networking.
- **With friends.** Start the signaling Worker, then one player hosts and the others join with the same passphrase.

```sh
cd apps/signal && bun x wrangler dev --var SIGNAL_SECRET:dev-secret
```

The Worker only introduces players to the host. `packages/net/README.md` has the steps to deploy it on the Cloudflare free plan. Set `SIGNAL_URL` to its address.

To try several players in one browser, give each tab its own identity with `?DEBUG_ID=alice`, `?DEBUG_ID=bob`.

## Layout

- `packages/game`: the rules. An XState machine owns the phases, pure functions own the rules, and `content/` holds the map, cards and the Legacy deck. No browser APIs.
- `packages/net`: the P2P library. A host, peers, a reliable lane for game messages and a lossy lane for cursors.
- `apps/signal`: the Cloudflare Worker used only to connect players.
- `apps/ui`: the SvelteKit SPA. `lib/board` is the 3D board, `lib/hud` the screen around it, `lib/session` the bridge between the actor and the network.
- `docs/mechanics`: the rules catalogue the engine was built from, and `coverage.md`, which lists what is built, partly built, or missing.

## Things to know

- **Saves.** The host's browser stores the campaign as plain `{ phase, world }` JSON. Every player holds the full state, so anyone can export a backup from the menu. Only the host can import one.
- **Changing the map.** Edit `packages/game/src/content/world.ts`, then run `apps/ui/scripts/gen-geometry.ts`. It regenerates board positions and the city pairs players may join with a supply line or sea lane.
- **Checking the rules.** `bun test` runs the rule tests and plays full campaigns with a random bot, checking invariants after every command. `CAMPAIGNS=200 bun test packages/game/src/campaign.test.ts` runs more.
- **Cards.** City cards have no hand-made art. `apps/ui/src/lib/cards/mapArt.ts` draws each one from the map data: a crop around the city with a pin on it. `/debug/cards` shows every generated Player and Infection card.
- **Console helpers.** `window.DEBUG.getState()`, `saveState()`, `loadState()` and `setState(save)` are available while a game is open.
- **Checking the network.** `packages/net/e2e/run.ts` drives three real browser pages through the local signaling Worker.

`AGENTS.md` lists the stack, conventions and product principles.
