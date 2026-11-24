import { LocalStorage } from "./createLocalStorage";
import { debugIdFromSearch } from "./debugId";
import type { Mode } from "./session/session.svelte.ts";

export const DEBUG_ID = typeof location === "undefined" ? null : debugIdFromSearch(location.search);
const namespace = `legacy${DEBUG_ID ? `-DEBUG_ID=${DEBUG_ID}` : ""}`;

export const LS = new LocalStorage<{
  playerId: string | null;
  name: string;
  passphrase: string;
  /** The mode to resume after a reload, cleared when the player leaves. */
  mode: Mode | null;
  /** The host's campaign save: plain `{ phase, world }` JSON. */
  save: unknown;
  /** The host's current-turn undo stack, kept alongside `save` so a reload does not drop Undo. */
  undo: unknown[];
  debugSnapshot: unknown;
  /** Named saves to return to (`DEBUG.checkpoint`), newest last. */
  checkpoints: { name: string; save: unknown }[];
  /** What the host's table has drawn on the map, by player. Kept apart from `save`: it is not game state. */
  drawings: Record<string, unknown[]>;
  /** The host's recording of the game in progress, played back at `/replay`. */
  record: unknown;
  replay: { speed: number; panel: boolean; bubbles: boolean };
  /** The studio stage's game (`/debug/studio`), kept apart from the campaign so a reload resumes it. */
  studio: unknown;
  studioView: { viewport: { width: number; height: number }; panel: boolean };
  /** Audio mixer volumes, mute and voice acting toggle. */
  audio: unknown;
}>({
  namespace,
  getDefaults: () => ({
    playerId: null,
    name: "",
    passphrase: "",
    mode: null,
    save: null,
    undo: [],
    debugSnapshot: null,
    checkpoints: [],
    drawings: {},
    record: null,
    replay: { speed: 1, panel: true, bubbles: true },
    studio: null,
    studioView: { viewport: { width: 1440, height: 810 }, panel: false },
    audio: null,
  }),
});
