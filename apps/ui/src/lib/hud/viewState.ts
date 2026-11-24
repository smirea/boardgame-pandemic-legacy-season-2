import { getContext, onDestroy, setContext } from "svelte";

type Part = { read: () => unknown; write: (value: never) => void };

/**
 * The view state the panels of one game screen keep for themselves: an open tab, a half-filled form. Each panel
 * registers what it keeps under a name, so the screen can be written down whole and put back (`Game.svelte`'s
 * `ui()` and `applyUi()`). A value for a panel that is not on screen yet waits until the panel appears.
 */
export class ViewState {
  #parts = new Map<string, Part>();
  #waiting = new Map<string, unknown>();

  register(name: string, part: Part) {
    this.#parts.set(name, part);
    if (this.#waiting.has(name)) {
      (part.write as (value: unknown) => void)(this.#waiting.get(name));
      this.#waiting.delete(name);
    }
    return () => {
      if (this.#parts.get(name) === part) this.#parts.delete(name);
    };
  }

  read(): Record<string, unknown> {
    return Object.fromEntries([...this.#parts].map(([name, part]) => [name, part.read()]));
  }

  write(values: Record<string, unknown>) {
    this.#waiting = new Map(Object.entries(values));
    for (const [name, part] of this.#parts) {
      if (!this.#waiting.has(name)) continue;
      (part.write as (value: unknown) => void)(this.#waiting.get(name));
      this.#waiting.delete(name);
    }
  }
}

const KEY = Symbol("view-state");

export const provideViewState = () => setContext(KEY, new ViewState());

/**
 * Registers what a panel keeps for itself. `read` returns it as plain JSON and `write` puts such a value back.
 * Outside a game screen, as on `/debug/cards`, it does nothing.
 */
export function keep<T>(name: string, read: () => T, write: (value: T) => void) {
  const state = getContext<ViewState | undefined>(KEY);
  if (state) onDestroy(state.register(name, { read, write }));
}
