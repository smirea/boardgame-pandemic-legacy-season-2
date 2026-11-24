import { applyPatches, diff, frozen } from "@repo/game";
import type { Patch, PublicState } from "@repo/game";

/**
 * How the host keeps every peer on its state: the whole of it to a peer that has none, then only what each move
 * changed. A state is tens of kilobytes and a move changes a few hundred bytes of it. A peer that applies a change
 * also keeps every untouched part of its state as the object it was, so its screen redraws only what moved.
 */
export type StateMsg =
  | { t: "state"; seq: number; state: PublicState }
  | { t: "patch"; seq: number; patch: Patch[] };

/** The host's side. `seq` counts the changes sent, so a peer can tell that it missed one. */
export class StateFeed {
  #seq = 0;
  #sent: PublicState | null = null;

  /** The message that brings peers from the state last given here to this one, or null when they are the same. */
  next(state: PublicState): StateMsg | null {
    const before = this.#sent;
    this.#sent = state;
    if (!before) return { t: "state", seq: ++this.#seq, state };
    const patch = diff(before, state);
    return patch.length ? { t: "patch", seq: ++this.#seq, patch } : null;
  }

  /** The whole state, for a peer that just connected. Null before the first state. */
  whole(): StateMsg | null {
    return this.#sent && { t: "state", seq: this.#seq, state: this.#sent };
  }
}

/** A peer's side. */
export class StateMirror {
  #seq = 0;
  #state: PublicState | null = null;

  /** Forgets where the host is, so nothing but the whole state is taken next. The state held stays on screen. */
  reset() {
    this.#seq = Number.NaN;
  }

  /** The state after the message, or `'lost'` when a change before it never arrived and the whole state is needed. */
  apply(msg: StateMsg): PublicState | "lost" {
    if (msg.t === "state") {
      this.#seq = msg.seq;
      return (this.#state = frozen(msg.state));
    }
    if (!this.#state || msg.seq !== this.#seq + 1) return "lost";
    this.#seq = msg.seq;
    return (this.#state = frozen(applyPatches(this.#state, msg.patch)));
  }
}
