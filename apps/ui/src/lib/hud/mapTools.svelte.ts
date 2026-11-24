import { eraseStrokesAlong } from "#lib/board/erase.ts";
import type { BoardPoint } from "#lib/board/projection.ts";
import type { CursorTool } from "#lib/board/types.ts";
import type { SessionView } from "#lib/session/session.svelte.ts";
import { untrack } from "svelte";

/** A pen point nearer the last one than this adds nothing a stroke would show. */
const PEN_STEP = 0.35;

/**
 * The pen, the eraser and the ping a player uses on the map. It turns pointer input on the board into strokes on
 * the session, which shares them with the table. Create it while a component is being set up: it keeps effects.
 */
export class MapTools {
  penHeld = $state(false);
  #eraserOn = $state(false);
  readonly #sessionNow: () => SessionView;
  readonly #enabled: () => boolean;
  /** Where the pointer is on the board now, when the board can tell. */
  readonly #pointerNow: () => BoardPoint | null;
  #lastPoint: BoardPoint | null = null;
  #stroke: { id: string; last: BoardPoint } | null = null;
  #strokeSeq = 0;
  #erasedAt: BoardPoint | null = null;

  readonly hasDrawings = $derived.by(() =>
    Object.values(this.#session.drawings).some((strokes) => strokes.length > 0),
  );
  readonly hasOwnDrawings = $derived(
    (this.#session.drawings[this.#session.player]?.length ?? 0) > 0,
  );
  readonly tool = $derived.by((): CursorTool | null =>
    !this.#enabled()
      ? null
      : this.penHeld
        ? "pen"
        : this.#eraserOn && this.hasDrawings
          ? "eraser"
          : null,
  );

  constructor(
    session: () => SessionView,
    enabled: () => boolean,
    pointerNow: () => BoardPoint | null,
  ) {
    this.#sessionNow = session;
    this.#enabled = enabled;
    this.#pointerNow = pointerNow;
    // With nothing left to erase, the eraser puts itself down.
    $effect(() => {
      if (!this.hasDrawings) this.#eraserOn = false;
    });
    // Picking a tool up or putting it down shows on everyone's screen at once, before the pointer next moves.
    $effect(() => {
      const tool = this.tool;
      untrack(() => {
        const point = this.where();
        if (point) this.#session.pointer(tool ? { ...point, tool } : point);
      });
    });
  }

  get #session() {
    return this.#sessionNow();
  }

  /** Where the pointer is on the board, or was when it last moved over it. */
  where() {
    return this.#pointerNow() ?? this.#lastPoint;
  }

  #nextId = () => `${Date.now()}-${++this.#strokeSeq}`;

  pointer(point: BoardPoint | null) {
    this.#lastPoint = point;
    const tool = this.tool;
    this.#session.pointer(point && tool ? { ...point, tool } : point);
  }

  holdPen() {
    this.#eraserOn = false;
    this.penHeld = true;
    this.#stroke = null;
  }

  releasePen() {
    this.drawEnd();
    this.penHeld = false;
  }

  toggleEraser() {
    this.#eraserOn = !this.#eraserOn;
  }

  /** Puts the eraser down. True when it was up. */
  dropEraser() {
    const held = this.#eraserOn;
    this.#eraserOn = false;
    return held;
  }

  drawStart = (point: BoardPoint) => {
    if (!this.penHeld || !this.#enabled()) return;
    this.#stroke = { id: this.#nextId(), last: point };
    this.#session.stroke(this.#stroke.id, point);
  };

  drawMove = (point: BoardPoint) => {
    const stroke = this.#stroke;
    if (!this.penHeld || !stroke || !this.#enabled()) return;
    if (Math.hypot(point.x - stroke.last.x, point.z - stroke.last.z) < PEN_STEP) return;
    stroke.last = point;
    this.#session.stroke(stroke.id, point);
  };

  drawEnd = () => {
    this.#stroke = null;
  };

  #erase(point: BoardPoint, radius: number) {
    if (!this.#enabled()) return;
    for (const [owner, strokes] of Object.entries(this.#session.drawings)) {
      const result = eraseStrokesAlong(strokes, this.#erasedAt, point, radius, this.#nextId);
      if (result.changed) this.#session.redraw(owner, result.strokes);
    }
    this.#erasedAt = point;
  }

  eraseStart = (point: BoardPoint, radius: number) => {
    this.#erasedAt = null;
    this.#erase(point, radius);
  };

  eraseMove = (point: BoardPoint, radius: number) => this.#erase(point, radius);

  eraseEnd = () => {
    this.#erasedAt = null;
  };

  clear = () => {
    this.#stroke = null;
    this.#erasedAt = null;
    this.#session.clearMyDrawings();
  };

  ping() {
    const point = this.where();
    if (point) this.#session.ping(point);
  }

  /** The window lost focus mid-stroke: the keys that were held will not be seen released. */
  letGo() {
    this.drawEnd();
    this.eraseEnd();
    this.penHeld = false;
  }
}
