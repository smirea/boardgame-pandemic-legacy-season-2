import { PEER_ID_PATTERN } from "./signal-protocol.ts";
import type { Transport } from "./transport.ts";

export type PeerId = string & { readonly __brand: "PeerId" };

export function peerId(value: string): PeerId {
  if (!PEER_ID_PATTERN.test(value))
    throw new TypeError(`Invalid peer id ${JSON.stringify(value)}: use 1-64 of [A-Za-z0-9_-]`);
  return value as PeerId;
}

export function createPeerId(): PeerId {
  return peerId(crypto.randomUUID());
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "closed";

export type PeerInfo = { id: PeerId; name: string; connected: boolean };

/**
 * Fatal codes end the session: `unauthorized` (wrong secret), `host-taken` (another client hosts), `replaced` (the same
 * selfId connected from a newer tab). The rest report a dropped frame and the session carries on.
 */
export type NetErrorCode =
  | "unauthorized"
  | "host-taken"
  | "replaced"
  | "invalid-message"
  | "invalid-presence"
  | "protocol";

export class NetError extends Error {
  override readonly name = "NetError";
  readonly code: NetErrorCode;

  constructor(code: NetErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }

  get fatal(): boolean {
    return this.code === "unauthorized" || this.code === "host-taken" || this.code === "replaced";
  }
}

export type SessionEvents<Msg, Presence> = {
  message: (msg: Msg, from: PeerId) => void;
  presence: (presence: Presence, from: PeerId) => void;
  /** Full roster, host included, same list on every client. */
  peers: (peers: PeerInfo[]) => void;
  status: (status: ConnectionStatus) => void;
  error: (error: NetError) => void;
};

export interface Session<Msg, Presence> {
  readonly role: "host" | "peer";
  readonly selfId: PeerId;
  readonly status: ConnectionStatus;
  readonly peers: PeerInfo[];
  /**
   * Host: broadcast, send to one peer, or broadcast to everyone but one (a relay of what that peer sent). Peer: always
   * goes to the host; `to` is rejected. Messages sent while the link is down are dropped, so gate game actions on
   * `status === 'connected'`.
   */
  send(msg: Msg, to?: PeerId | { except: PeerId }): void;
  /** Lossy. Coalesced to the latest value and rate limited. The host relays it to the other peers. */
  sendPresence(presence: Presence): void;
  on<E extends keyof SessionEvents<Msg, Presence>>(
    event: E,
    handler: SessionEvents<Msg, Presence>[E],
  ): () => void;
  close(): void;
}

export type SessionOptions<Msg, Presence> = {
  /** Stable across reloads; the caller persists it. */
  selfId: PeerId;
  name: string;
  transport: Transport;
  /** Boundary validation. Throws on bad input. */
  parseMsg: (raw: unknown) => Msg;
  parsePresence: (raw: unknown) => Presence;
  /** Default 30. */
  presenceHz?: number;
};
