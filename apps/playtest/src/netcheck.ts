#!/usr/bin/env bun
import { botCommand } from "@repo/game";
import type { Save } from "@repo/game";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";
import { actionSave, sleep, WINDOW_ARGS } from "./bench.ts";

/*
 * A table of real browsers over real WebRTC: one hosts, the rest join, everyone moves a pointer over the board, and
 * commands are sent from every seat in turn. It checks that every browser ends on the host's state after each
 * command, a peer's reload and the host's reload, and reports how long a command takes to reach everyone, how much
 * each browser sent and received, and how smoothly a peer drew meanwhile. It needs a dev server with its signal
 * Worker (`bun run dev`).
 *
 *   ./apps/playtest/src/netcheck.ts --url http://127.0.0.1:6390 --peers 5
 */

const { values: flags } = parseArgs({
  options: {
    url: { type: "string", default: "http://boardgame-pandemic-legacy-season-2.localhost:6190" },
    secret: { type: "string", default: "pandemic" },
    peers: { type: "string", default: "3" },
    month: { type: "string", default: "7" },
    steps: { type: "string", default: "60" },
    /** Lets no browser connect directly, so the run proves the TURN relays the signal Worker hands out. */
    relay: { type: "boolean", default: false },
    width: { type: "string", default: "1440" },
    height: { type: "string", default: "810" },
  },
});
const PEERS = Number(flags.peers);
const STEPS = Number(flags.steps);

type Traffic = {
  sent: Record<string, { n: number; bytes: number }>;
  got: Record<string, { n: number; bytes: number }>;
};
type Probe = { frames: number[]; last: number; on: boolean };
type Sketch = { strokes: Record<string, number>; points: number; pings: number };
declare const window: Window & {
  DEBUG?: {
    getState(): unknown;
    setState(state: unknown): void;
    send(command: unknown): string | null;
    connection(): { status: string; peers: number; fatal: string | null };
    sketch(): Sketch;
    fetchRecord(): Promise<string | null>;
  };
  __traffic: Traffic;
  __routes: () => Promise<string[]>;
  __probe: Probe;
};

/** Counts every frame each data channel carries, by its label, and how long each animation frame took. */
const INSTRUMENT = (relayOnly: boolean) => {
  const Native = RTCPeerConnection;
  const made: RTCPeerConnection[] = [];
  globalThis.RTCPeerConnection = new Proxy(Native, {
    construct(target, [config]: [RTCConfiguration?]) {
      const connection = new target(
        relayOnly ? { ...config, iceTransportPolicy: "relay" } : config,
      );
      made.push(connection);
      return connection;
    },
  });
  /** How each open connection reaches the other side: `host` and `srflx` are direct, `relay` goes through TURN. */
  window.__routes = async () => {
    const routes: string[] = [];
    for (const connection of made) {
      if (connection.connectionState !== "connected") continue;
      const stats = [...(await connection.getStats()).values()] as Record<string, string>[];
      const pair = stats.find(
        (entry) => entry["type"] === "candidate-pair" && entry["state"] === "succeeded",
      );
      const local = stats.find((entry) => entry["id"] === pair?.["localCandidateId"]);
      routes.push(local?.["candidateType"] ?? "unknown");
    }
    return routes;
  };
  const traffic: Traffic = (window.__traffic = { sent: {}, got: {} });
  const tally = (side: Traffic["sent"], label: string, size: number) => {
    const lane = (side[label] ??= { n: 0, bytes: 0 });
    lane.n++;
    lane.bytes += size;
  };
  const sizeOf = (data: unknown) =>
    typeof data === "string"
      ? data.length
      : ((data as ArrayBuffer | ArrayBufferView).byteLength ?? 0);
  const send = RTCDataChannel.prototype.send;
  RTCDataChannel.prototype.send = function (this: RTCDataChannel, data: never) {
    tally(traffic.sent, this.label, sizeOf(data));
    return send.call(this, data);
  };
  const create = RTCPeerConnection.prototype.createDataChannel;
  RTCPeerConnection.prototype.createDataChannel = function (
    this: RTCPeerConnection,
    ...args: Parameters<typeof create>
  ) {
    const channel = create.apply(this, args);
    channel.addEventListener("message", (event) =>
      tally(traffic.got, channel.label, sizeOf(event.data)),
    );
    return channel;
  };
  const probe: Probe = (window.__probe = { frames: [], last: 0, on: false });
  const tick = (now: number) => {
    if (probe.on && probe.last) probe.frames.push(now - probe.last);
    probe.last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const hash = (text: string) => createHash("sha1").update(text).digest("hex").slice(0, 10);

const browser = await chromium.launch({
  headless: false,
  args: [...WINDOW_ARGS, "--disable-background-timer-throttling"],
});

type Tab = { name: string; context: BrowserContext; page: Page; errors: string[] };
async function open(name: string, host: boolean): Promise<Tab> {
  const context = await browser.newContext({
    viewport: { width: Number(flags.width), height: Number(flags.height) },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(INSTRUMENT, flags.relay);
  const page = await context.newPage();
  const tab: Tab = { name, context, page, errors: [] };
  page.on("pageerror", (error) => tab.errors.push(error.message));
  await page.goto(`${flags.url}/`);
  await page.locator("[data-testid=passphrase]").fill(flags.secret!);
  await page.locator(`[data-testid=${host ? "host" : "join"}]`).click();
  await page.waitForFunction(() => Boolean(window.DEBUG), null, { timeout: 30_000 });
  return tab;
}

const stateOf = (tab: Tab) =>
  tab.page.evaluate(() => JSON.stringify(window.DEBUG?.getState() ?? null));
const connection = (tab: Tab) => tab.page.evaluate(() => window.DEBUG?.connection() ?? null);

const failures: string[] = [];
const check = (ok: boolean, text: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${text}`);
  if (!ok) failures.push(text);
};

/** Waits until every tab holds the host's state, and returns how long that took, or null if it never happened. */
async function converged(host: Tab, tabs: Tab[], timeout = 10_000): Promise<number | null> {
  const started = performance.now();
  while (performance.now() - started < timeout) {
    const want = hash(await stateOf(host));
    const have = await Promise.all(tabs.map(async (tab) => hash(await stateOf(tab))));
    if (want !== hash("null") && have.every((value) => value === want))
      return performance.now() - started;
    await sleep(15);
  }
  // What each browser holds when they never agreed, which is where to start looking.
  for (const tab of [host, ...tabs]) {
    const text = await stateOf(tab);
    const state = JSON.parse(text) as {
      phase: string;
      world: { game: { log: unknown[] } | null };
    } | null;
    console.log(
      `     ${tab.name}: ${JSON.stringify(await connection(tab))} state ${hash(text)} ${state?.phase} log ${state?.world.game?.log.length}`,
    );
  }
  return null;
}

const tabs: Tab[] = [];
try {
  // Everyone arrives in the lobby of a new campaign, where each browser is seated as it joins.
  const host = await open("host", true);
  tabs.push(host);
  const joinStarted = performance.now();
  const peers = await Promise.all(
    Array.from({ length: PEERS }, (_, index) => open(`peer${index + 1}`, false)),
  );
  tabs.push(...peers);
  const joined = await converged(host, peers, 30_000);
  check(
    joined !== null,
    `${PEERS} peers joined and hold the host's state (${((performance.now() - joinStarted) / 1000).toFixed(1)} s)`,
  );
  const seated = async () => (JSON.parse(await stateOf(host)) as Save).world.table.seats.length;
  for (
    const started = performance.now();
    (await seated()) < PEERS + 1 && performance.now() - started < 5000;
  )
    await sleep(50);
  check(
    (await seated()) === PEERS + 1,
    `everyone was seated in the lobby as they arrived (${await seated()} seats)`,
  );
  check((await converged(host, peers, 5000)) !== null, `and every browser shows the same table`);

  // The host loads a game under way, which restarts it, and the peers follow it there.
  const save = actionSave(Number(flags.month));
  await Promise.all([
    host.page.waitForEvent("load"),
    host.page.evaluate((next) => window.DEBUG!.setState(next), save),
  ]);
  await host.page.waitForFunction(
    (phase) => (window.DEBUG?.getState() as Save | null)?.phase === phase,
    save.phase,
    {
      timeout: 30_000,
    },
  );
  const followed = await converged(host, peers, 30_000);
  check(followed !== null, `after the host loaded a save, every peer followed it into that game`);
  const routes = await host.page.evaluate(() => window.__routes());
  check(
    routes.length === PEERS && (!flags.relay || routes.every((route) => route === "relay")),
    `the host reaches its ${PEERS} peers by: ${routes.join(", ")}`,
  );
  const seen = await connection(host);
  check(
    seen?.peers === PEERS + 1,
    `the host counts ${PEERS + 1} players connected (${seen?.peers})`,
  );
  for (const tab of tabs) await tab.page.waitForSelector(".anchor[data-city]", { timeout: 60_000 });
  await sleep(5000);

  // Everyone keeps a pointer moving over the board for the whole run, as a table of people would.
  let moving = true;
  const wander = async (tab: Tab, phase: number) => {
    for (let step = 0; moving; step++) {
      const x = Number(flags.width) / 2 + Math.sin(step / 11 + phase) * 380;
      const y = Number(flags.height) / 2 + Math.cos(step / 7 + phase * 2) * 170;
      await tab.page.mouse.move(x, y).catch(() => {});
      await sleep(16);
    }
  };
  const wandering = tabs.map((tab, index) => wander(tab, index * 1.7));

  const watched = peers[0]!;
  await Promise.all(
    tabs.map((tab) =>
      tab.page.evaluate(() => {
        window.__traffic.sent = {};
        window.__traffic.got = {};
        window.__probe.frames = [];
        window.__probe.on = true;
      }),
    ),
  );
  // How busy the watched peer's main thread is, to tell a slow page from a graphics card shared by every window here.
  const cdp = await watched.context.newCDPSession(watched.page);
  await cdp.send("Performance.enable");
  const busy = async () => {
    const { metrics } = (await cdp.send("Performance.getMetrics")) as {
      metrics: { name: string; value: number }[];
    };
    const of = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? 0;
    return of("ScriptDuration") + of("RecalcStyleDuration") + of("LayoutDuration");
  };
  const busyBefore = await busy();
  const runStarted = performance.now();
  const rng = { seed: 11 };
  const latencies: number[] = [];
  let stuck = 0;
  for (let step = 0; step < STEPS; step++) {
    const state = JSON.parse(await stateOf(host)) as Save;
    if (!state.phase.startsWith("playing")) break;
    const command =
      state.world.campaign.briefing.length > 0
        ? ({ type: "ACK_BRIEFING" } as const)
        : botCommand(state.world, state.phase, rng, 4);
    const sender = tabs[step % tabs.length]!;
    const before = hash(JSON.stringify(state));
    const refused = await sender.page.evaluate((next) => window.DEBUG!.send(next), command);
    if (refused) {
      check(false, `step ${step}: ${sender.name} was refused ${command.type}: ${refused}`);
      continue;
    }
    const started = performance.now();
    // The host's state must move, then everyone must hold it.
    while (hash(await stateOf(host)) === before && performance.now() - started < 5000)
      await sleep(5);
    const took = await converged(host, peers, 5000);
    if (took === null) stuck++;
    else latencies.push(performance.now() - started);
    await sleep(350);
  }
  const seconds = (performance.now() - runStarted) / 1000;
  const busyShare = ((await busy()) - busyBefore) / seconds;
  check(
    stuck === 0,
    `every browser held the host's state after each of ${latencies.length + stuck} commands (${stuck} did not)`,
  );
  const hostRecord = await host.page.evaluate(() => window.DEBUG!.fetchRecord());
  const peerRecord = await watched.page.evaluate(() => window.DEBUG!.fetchRecord());
  check(
    hostRecord !== null && peerRecord === hostRecord,
    `a peer saving the game's recording gets the host's (${peerRecord?.length ?? 0} bytes)`,
  );
  const sorted = latencies.toSorted((a, b) => a - b);
  console.log(
    `     command to everyone: median ${sorted[Math.floor(sorted.length / 2)]?.toFixed(0)} ms, p95 ${sorted[Math.floor(sorted.length * 0.95)]?.toFixed(0)} ms, worst ${sorted.at(-1)?.toFixed(0)} ms (includes the check's own polling)`,
  );
  for (const tab of [host, watched]) {
    const traffic = await tab.page.evaluate(() => window.__traffic);
    const line = (side: Traffic["sent"]) =>
      Object.entries(side)
        .map(
          ([lane, total]) =>
            `${lane} ${(total.bytes / 1024 / seconds).toFixed(1)} KB/s in ${(total.n / seconds).toFixed(0)} frames/s`,
        )
        .join(", ") || "nothing";
    console.log(`     ${tab.name} sent ${line(traffic.sent)}; received ${line(traffic.got)}`);
  }
  const frames = (await watched.page.evaluate(() => window.__probe.frames)).toSorted(
    (a, b) => a - b,
  );
  console.log(
    `     ${watched.name} drew ${frames.length} frames in ${seconds.toFixed(0)} s: ${frames.filter((ms) => ms > 25).length} over 25 ms, ${frames.filter((ms) => ms > 50).length} over 50 ms, worst ${frames.at(-1)?.toFixed(0)} ms, with its main thread ${(busyShare * 100).toFixed(0)}% busy`,
  );

  moving = false;
  await Promise.all(wandering);

  // The last Infection card may still be playing out, and it moves the camera. A line is drawn on the board, so one
  // drawn before the camera settles is elsewhere on the screen by the time the eraser comes for it.
  const cityAt = (tab: Tab) =>
    tab.page.evaluate(() => {
      const box = document.querySelector(".anchor[data-city]")!.getBoundingClientRect();
      return `${box.x.toFixed(1)},${box.y.toFixed(1)},${box.width.toFixed(1)}`;
    });
  for (const tab of [host, watched]) {
    let still = 0;
    for (let last = "", tries = 0; still < 4 && tries < 120; tries++) {
      const now = await cityAt(tab);
      still = now === last ? still + 1 : 0;
      last = now;
      await sleep(250);
    }
    check(still >= 4, `${tab.name}'s board came to rest before anyone drew on it`);
  }

  // The host draws on the map with the pen held, a peer adds a line, pings and erases, and everyone sees the same.
  const sketches = () =>
    Promise.all(tabs.map((tab) => tab.page.evaluate(() => JSON.stringify(window.DEBUG!.sketch()))));
  // A ping lasts ten seconds and is not sent to a browser that joins later, so `lines` leaves pings out.
  const agree = async (what: (sketch: Sketch) => boolean, timeout = 3000, lines = false) => {
    for (
      const started = performance.now();
      performance.now() - started < timeout;
      await sleep(40)
    ) {
      const seen = (await sketches()).map((text) =>
        lines ? JSON.stringify({ ...(JSON.parse(text) as Sketch), pings: 0 }) : text,
      );
      if (seen.every((text) => text === seen[0]) && what(JSON.parse(seen[0]!) as Sketch))
        return true;
    }
    console.log(`     sketches: ${(await sketches()).join(" | ")}`);
    return false;
  };
  const scribble = async (tab: Tab, y: number) => {
    await tab.page.mouse.move(420, y);
    await tab.page.keyboard.down("f");
    await tab.page.mouse.down();
    for (let step = 1; step <= 40; step++)
      await tab.page.mouse.move(420 + step * 14, y + Math.sin(step / 3) * 40);
    await tab.page.mouse.up();
    await tab.page.keyboard.up("f");
  };
  await scribble(host, 330);
  check(
    await agree((sketch) => sketch.points > 10 && Object.keys(sketch.strokes).length === 1),
    `a line the host drew is on every map (${(JSON.parse((await sketches())[0]!) as Sketch).points} points)`,
  );
  const hostLines = Object.keys((JSON.parse((await sketches())[0]!) as Sketch).strokes);
  await scribble(watched, 450);
  check(
    await agree((sketch) => Object.keys(sketch.strokes).length === 2),
    `and so is a line a peer drew`,
  );
  const drawn = (JSON.parse((await sketches())[0]!) as Sketch).points;
  await watched.page.mouse.move(700, 300);
  await watched.page.keyboard.press("Tab");
  check(await agree((sketch) => sketch.pings === 1), `a peer's ping shows on every map`);
  await watched.page.keyboard.press("e");
  await watched.page.mouse.move(560, 250);
  await watched.page.mouse.down();
  for (let step = 1; step <= 20; step++)
    await watched.page.mouse.move(560 + step * 4, 250 + step * 12);
  await watched.page.mouse.up();
  await watched.page.keyboard.press("e");
  check(
    await agree(
      (sketch) =>
        sketch.points !== drawn && Object.values(sketch.strokes).some((count) => count > 1),
    ),
    `a peer's eraser cut the same piece out of everyone's lines`,
  );
  await watched.page.click("[data-testid=draw-clear]");
  check(
    await agree(
      (sketch) => JSON.stringify(Object.keys(sketch.strokes)) === JSON.stringify(hostLines),
    ),
    `a peer's Erase mine took its own lines off every map and left the host's`,
  );

  // A peer reloads and comes back to the same state, and to the drawings on the map.
  await watched.page.reload();
  await watched.page.waitForFunction(() => Boolean(window.DEBUG), null, { timeout: 30_000 });
  const back = await converged(host, peers, 20_000);
  check(
    await agree((sketch) => sketch.points > 10, 5000, true),
    `a peer that reloaded has the map's drawings`,
  );
  check(
    back !== null,
    `a peer that reloaded holds the host's state again (${back?.toFixed(0)} ms)`,
  );

  // The host reloads: every peer finds it again without being touched.
  const reloadStarted = performance.now();
  await host.page.reload();
  await host.page.waitForFunction(() => Boolean(window.DEBUG?.getState()), null, {
    timeout: 30_000,
  });
  let everyone = false;
  while (!everyone && performance.now() - reloadStarted < 40_000) {
    everyone = (await connection(host))?.peers === PEERS + 1;
    await sleep(100);
  }
  check(
    everyone,
    `after the host reloaded, all ${PEERS} peers reconnected (${((performance.now() - reloadStarted) / 1000).toFixed(1)} s)`,
  );
  const again = await converged(host, peers, 10_000);
  check(again !== null, `and hold its state`);
  check(
    await agree(
      (sketch) => JSON.stringify(Object.keys(sketch.strokes)) === JSON.stringify(hostLines),
      5000,
      true,
    ),
    `the host kept the map's drawings through its reload, and every map has them again`,
  );

  // The game goes on after both reloads.
  const state = JSON.parse(await stateOf(host)) as Save;
  if (state.phase.startsWith("playing")) {
    const command =
      state.world.campaign.briefing.length > 0
        ? ({ type: "ACK_BRIEFING" } as const)
        : botCommand(state.world, state.phase, rng, 4);
    const before = hash(JSON.stringify(state));
    await peers.at(-1)!.page.evaluate((next) => window.DEBUG!.send(next), command);
    await sleep(600);
    check(
      hash(await stateOf(host)) !== before,
      `a peer's command still reaches the host after the reloads`,
    );
    check((await converged(host, peers, 5000)) !== null, `and everyone holds the result`);
  }
  for (const tab of tabs)
    if (tab.errors.length)
      check(false, `${tab.name} page errors: ${[...new Set(tab.errors)].join(" | ")}`);
} finally {
  await browser.close();
}
console.log(failures.length ? `\n${failures.length} failed` : "\nall passed");
process.exit(failures.length ? 1 : 0);
