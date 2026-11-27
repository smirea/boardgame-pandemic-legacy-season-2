import type { Command, Phase, PlayerId, World } from "@repo/game";
import { inFeedback, modalOpen, onButton, typing } from "#lib/keys.ts";
import type { Covers } from "./covers.ts";
import type { MapTools } from "./mapTools.svelte.ts";
import type { createTurnAdmin } from "./turnAdmin.svelte.ts";

/** What the game's keys read and do, given by the screen that owns it. */
export type KeySource = {
  readonly world: World;
  readonly phase: Phase;
  readonly canUndo: boolean;
  /** This browser plays the seat whose turn it is. */
  readonly canAct: boolean;
  readonly spectator: boolean;
  readonly player: PlayerId;
  readonly tools: MapTools;
  readonly admin: ReturnType<typeof createTurnAdmin>;
  readonly covers: Covers;
  /** The first of these that has something to put away does so, and Escape goes no further. */
  readonly escapes: (() => boolean)[];
  /** Puts down whatever is half-chosen and closes the Menu. */
  cancel(): void;
  toggleHotkeys(): void;
  fitMap(): void;
  send(command: Command): void;
  toast(text: string): void;
};

/**
 * The game's keyboard: Space moves the turn on, Z undoes, F draws, R fits the whole map in view, E toggles the eraser,
 * Tab pings the map, ? opens the shortcuts and Escape closes or cancels. Every key is left alone while it belongs to
 * something else: a field being typed in, the feedback editor, a focused button, a dialog.
 */
export function createGameKeys(source: KeySource) {
  function escape(event: KeyboardEvent) {
    if (source.escapes.some((put) => put())) return true;
    // A dialog that Escape closes, the last one opened first. A key typed into one of its fields is the field's.
    if (!typing(event) && source.covers.closeTop()) return true;
    const vote = source.world.table.undoVote;
    if (vote && (!vote.by || vote.by === source.player)) {
      source.send({ type: "CANCEL_UNDO_VOTE", player: source.player });
      return true;
    }
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.classList.contains("focus-only")
    )
      document.activeElement.blur();
    source.cancel();
    return false;
  }

  function onkeydown(event: KeyboardEvent) {
    if (inFeedback(event)) return;
    if (event.key === "Escape" && escape(event)) return;
    if (typing(event) || event.metaKey || event.ctrlKey || event.altKey) return;
    const { spectator, tools, admin, world } = source;
    const game = world.game;
    if (event.key === "?" && !spectator) {
      event.preventDefault();
      source.toggleHotkeys();
      return;
    }
    if (event.key === "Tab" && !spectator && !modalOpen()) {
      event.preventDefault();
      if (!event.repeat) tools.ping();
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "f" && !event.repeat && !spectator && !modalOpen()) {
      tools.holdPen();
      return;
    }
    // As the top bar's button it replaced did, R fits the map under a dialog too, so Show board can look at all of it.
    if (key === "r" && !event.repeat) {
      source.fitMap();
      return;
    }
    if (key === "e" && !event.repeat && !spectator && tools.hasDrawings && !modalOpen()) {
      tools.toggleEraser();
      return;
    }
    // A held key repeats thirty times a second: one press is one undo, one card, one step.
    if (!game || modalOpen() || event.repeat) return;
    const focused = event.composedPath()[0];
    const onFocusOnly =
      focused instanceof HTMLButtonElement && focused.classList.contains("focus-only");
    // Z is nobody else's key, so it undoes even with the button just clicked still focused, such as the action's own.
    if (key === "z" && source.canUndo && source.canAct) {
      if (onFocusOnly) focused.blur();
      return source.send({ type: "UNDO", by: source.player });
    }
    // Space on a focused button already presses it.
    if (key !== " " || (onButton(event) && !onFocusOnly)) return;
    if (onFocusOnly) focused.blur();
    // The cards that open a game are anyone's to flip.
    if (admin.opening) {
      event.preventDefault();
      if (admin.action && !admin.action.busy) admin.action.onclick();
      return;
    }
    if (!source.canAct) return;
    event.preventDefault();
    if (admin.epidemic) return admin.start();
    // Space is the desk's next click: a card, an Epidemic's step, or Done.
    if (source.phase !== "playing.actions") {
      if (admin.action && !admin.action.busy) admin.action.onclick();
      return;
    }
    // Space moves the turn on at every other step, so a press meant for a deck can land here. It ends a turn
    // that is spent, and never throws away actions: those go by the End actions button.
    if (game.actionsLeft === 0) source.send({ type: "END_ACTIONS", seat: game.active });
    else
      source.toast(
        `${game.actionsLeft} action${game.actionsLeft === 1 ? "" : "s"} left. Click End actions to end your turn early.`,
      );
  }

  return {
    onkeydown,
    onkeyup(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "f" && !typing(event)) source.tools.releasePen();
    },
    onblur: () => source.tools.letGo(),
  };
}
