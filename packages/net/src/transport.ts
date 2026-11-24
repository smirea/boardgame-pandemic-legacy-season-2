import type { NetError, PeerId } from "./types.ts";

/**
 * The largest frame a transport must carry. 16 KiB is the size every browser pair exchanges over SCTP without
 * fragmentation trouble; the session chunks anything bigger.
 */
export const MAX_FRAME_BYTES = 16 * 1024;

export type Lane = "reliable" | "lossy";

export type LinkHandlers = {
  frame: (lane: Lane, frame: Uint8Array) => void;
  /** The remote side went away. Not called for a local `close()`. */
  close: () => void;
};

/** One host-to-peer connection with an ordered reliable lane and an unordered lossy lane. */
export interface Link {
  readonly remoteId: PeerId;
  sendReliable(frame: Uint8Array): void;
  /** Returns false and drops the frame when the lane is backed up or closed. */
  sendLossy(frame: Uint8Array): boolean;
  close(): void;
}

export type ListenHandlers = {
  /** A peer finished connecting. Return the handlers for its frames. */
  link: (link: Link) => LinkHandlers;
  status: (status: "connected" | "reconnecting") => void;
  fail: (error: NetError) => void;
};

export interface Transport {
  listen(selfId: PeerId, handlers: ListenHandlers): { close(): void };
  /** Resolves once both lanes are open. Rejects with a fatal NetError, or anything else to mean "retry". */
  connect(selfId: PeerId, handlers: LinkHandlers, signal: AbortSignal): Promise<Link>;
}
