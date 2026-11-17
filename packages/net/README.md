# @repo/net

Peer-to-peer networking for a small co-op game in the browser. One player hosts and owns the game state. Every other player connects straight to the host over WebRTC data channels, and the host relays what players need to see of each other. A tiny Cloudflare Worker (`apps/signal`) only introduces players when they connect or reconnect. Game traffic never touches it.

Each connection has two lanes:

- A reliable, ordered lane for game messages (`send`). Messages of any size are split into 16 KiB frames and put back together on arrival.
- A lossy, unordered lane for cursors (`sendPresence`). It sends only the newest value, at most `presenceHz` times a second, and drops a value instead of queueing it when the lane is backed up.

## Use it

```ts
import { createHost, createWebRtcTransport, joinHost, peerId } from '@repo/net';

const transport = createWebRtcTransport({ signalUrl: 'https://net-signal.example.workers.dev', secret });
const options = {
	selfId: peerId(localStorage.playerId), // persist it so a reload rejoins as the same player
	name: 'Ada',
	transport,
	parseMsg: (raw: unknown) => GameMsg.parse(raw), // throw on bad input
	parsePresence: (raw: unknown) => Cursor.parse(raw),
};

const session = isHost ? createHost<GameMsg, Cursor>(options) : joinHost<GameMsg, Cursor>(options);

session.on('peers', peers => {
	if (session.role === 'host') session.send({ type: 'state', state: actor.getSnapshot() }); // a player joined or returned
});
session.on('message', (msg, from) => actor.send({ ...msg, from }));
session.on('presence', (cursor, from) => drawCursor(from, cursor));
session.on('status', status => setOnline(status === 'connected'));
session.on('error', error => console.warn(error.code, error.message));

window.addEventListener('pointermove', e => session.sendPresence({ x: e.clientX, y: e.clientY }));
```

Tests and other in-process code use `createMemoryTransport()` instead. One instance stands in for the whole network: pass it to the host and every peer. `drop(id)` cuts a player's link and `setCongested(id, true)` backs up their lossy lane.

## Behavior

- `peers` carries the full roster, host included, in the same order on every client. A player who drops stays in the list with `connected: false`.
- A peer that loses the host goes to `reconnecting` and retries with backoff until `close()`. A host reload is just another reconnect: the peers rejoin when the host is back. A host that dies without closing (crash, lost network) is noticed in about 6 seconds, which is Chrome's ICE consent timeout plus the reconnect.
- `send` from a peer always goes to the host. A message sent while the link is down is dropped, so disable game actions unless `status` is `connected`.
- Every value from the wire passes through `parseMsg` or `parsePresence`. A value that fails is dropped and reported as an `error` event with code `invalid-message` or `invalid-presence`.
- These `error` codes are fatal and close the session: `host-taken` (another player is hosting), `unauthorized` (wrong secret), and `replaced` (the same `selfId` connected from a newer tab, which wins).
- Bad options throw from `createHost`, `joinHost`, and `createWebRtcTransport`, not at the first send.

## Run the signaling Worker locally

```sh
cd apps/signal
bun x wrangler dev --var SIGNAL_SECRET:dev-secret
```

It listens on `ws://127.0.0.1:8787`. To try it by hand, start the demo page with `bun run demo` from this package. It prints a host URL and a peer URL. Open each in its own browser window, and change `id` for every extra peer.

## Deploy the Worker on the free plan

The free Workers plan covers this. Durable Objects with SQLite storage are free up to 100,000 requests a day. An idle hibernating WebSocket costs nothing, and 20 incoming WebSocket messages count as one request. A connection used about 6 signaling messages in the local end-to-end run, and real networks add a few more ICE candidates. The host also sends one keepalive every 30 seconds, which the Worker answers without waking the Durable Object. A long evening of play stays under a hundred requests.

1. Sign in to Cloudflare: `cd apps/signal && bun x wrangler login`.
2. Deploy the Worker: `bun run deploy`. Wrangler prints the URL, `https://net-signal.<your-subdomain>.workers.dev`.
3. Set the shared secret. Generate a long random string with `openssl rand -base64 32`, then run `bun x wrangler secret put SIGNAL_SECRET` and paste it. Until you set it, every connection fails with HTTP 500.
4. Check the Worker: `curl -i https://net-signal.<your-subdomain>.workers.dev/` returns `426 Expected a WebSocket upgrade`.
5. Give the game the URL as `signalUrl` and the same string as `secret`.

The secret travels in the WebSocket URL, because browsers cannot set headers on a WebSocket. Anyone who can read this Worker's logs in your Cloudflare account can see it. Rotate it with `wrangler secret put` if it leaks.

Most home networks connect with Cloudflare's STUN server alone. If a player sits behind a strict corporate or mobile NAT, pass a TURN server in `iceServers`.
