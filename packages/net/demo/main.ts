import {
  createHost,
  createWebRtcTransport,
  joinHost,
  peerId,
  type ConnectionStatus,
  type NetErrorCode,
  type PeerId,
  type PeerInfo,
} from "../src/index.ts";

export type DemoMsg = { kind: "seq"; n: number } | { kind: "blob"; text: string };
export type Cursor = { x: number; y: number };

export type DemoState = {
  role: "host" | "peer";
  selfId: PeerId;
  status: ConnectionStatus;
  statuses: ConnectionStatus[];
  peers: PeerInfo[];
  rosters: PeerInfo[][];
  received: { msg: DemoMsg; from: PeerId }[];
  cursors: Record<string, Cursor>;
  cursorUpdates: number;
  errors: NetErrorCode[];
};

const parseMsg = (raw: unknown): DemoMsg => {
  const value = raw as DemoMsg;
  if (value?.kind === "seq" && Number.isInteger(value.n)) return { kind: "seq", n: value.n };
  if (value?.kind === "blob" && typeof value.text === "string")
    return { kind: "blob", text: value.text };
  throw new Error("Not a demo message");
};

const parsePresence = (raw: unknown): Cursor => {
  const value = raw as Cursor;
  if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)) throw new Error("Not a cursor");
  return { x: value.x, y: value.y };
};

const params = new URLSearchParams(location.search);
const required = (key: string) => {
  const value = params.get(key);
  if (!value) throw new Error(`Missing ?${key}=`);
  return value;
};
const role = required("role") === "host" ? "host" : "peer";
const selfId = peerId(required("id"));

const session = (role === "host" ? createHost : joinHost)<DemoMsg, Cursor>({
  selfId,
  name: params.get("name") ?? selfId,
  transport: createWebRtcTransport({ signalUrl: required("signal"), secret: required("secret") }),
  parseMsg,
  parsePresence,
});

const state: DemoState = {
  role,
  selfId,
  status: session.status,
  statuses: [session.status],
  peers: session.peers,
  rosters: [],
  received: [],
  cursors: {},
  cursorUpdates: 0,
  errors: [],
};

const $ = (id: string) => document.getElementById(id)!;

const render = () => {
  $("status").textContent = `${role} ${selfId}: ${state.status}`;
  $("peers").replaceChildren(
    ...state.peers.map((peer) => {
      const li = document.createElement("li");
      li.textContent = `${peer.name} (${peer.id})${peer.connected ? "" : " offline"}`;
      return li;
    }),
  );
  $("cursors").replaceChildren(
    ...Object.entries(state.cursors).map(([id, cursor]) => {
      const el = document.createElement("div");
      el.className = "cursor";
      el.style.left = `${cursor.x}px`;
      el.style.top = `${cursor.y}px`;
      el.textContent = id;
      return el;
    }),
  );
};

const log = (text: string) => {
  const li = document.createElement("li");
  li.textContent = text;
  $("log").append(li);
};

session.on("status", (status) => {
  state.status = status;
  state.statuses.push(status);
  render();
});
session.on("peers", (peers) => {
  state.peers = peers;
  state.rosters.push(peers);
  for (const peer of peers) if (!peer.connected) delete state.cursors[peer.id];
  render();
});
session.on("message", (msg, from) => {
  state.received.push({ msg, from });
  log(msg.kind === "seq" ? `#${msg.n} from ${from}` : `${msg.text.length} chars from ${from}`);
});
session.on("presence", (cursor, from) => {
  state.cursors[from] = cursor;
  state.cursorUpdates++;
  render();
});
session.on("error", (error) => {
  state.errors.push(error.code);
  log(`error ${error.code}: ${error.message}`);
});

document.addEventListener("pointermove", (event) =>
  session.sendPresence({ x: event.clientX, y: event.clientY }),
);
window.addEventListener("pagehide", () => session.close());

/** Deterministic text so a receiver can check a big payload without it crossing the test harness. */
const makeText = (size: number, seed: number) => {
  const chars: string[] = [];
  for (let i = 0; i < size; i++) chars.push(String.fromCharCode(33 + ((i * 31 + seed) % 90)));
  return chars.join("");
};

Object.assign(globalThis, {
  demo: {
    state,
    send: (msg: DemoMsg, to?: string) =>
      session.send(msg, to === undefined ? undefined : peerId(to)),
    sendSeq(count: number, to?: string) {
      for (let n = 0; n < count; n++)
        session.send({ kind: "seq", n }, to === undefined ? undefined : peerId(to));
    },
    sendBlob(size: number, seed: number, to?: string) {
      session.send(
        { kind: "blob", text: makeText(size, seed) },
        to === undefined ? undefined : peerId(to),
      );
    },
    hasBlob: (size: number, seed: number, from: string) => {
      const expected = makeText(size, seed);
      return state.received.some(
        (r) => r.from === from && r.msg.kind === "blob" && r.msg.text === expected,
      );
    },
    seqFrom: (from: string) =>
      state.received.flatMap((r) => (r.from === from && r.msg.kind === "seq" ? [r.msg.n] : [])),
  },
});

render();
