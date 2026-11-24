import type { Covered } from "#lib/board/types.ts";
import { reconciler } from "#lib/reconcile.ts";

type Sides = { low: { left: number; right: number }; high: { left: number; right: number } };

/** The elements whose panels lie over the board, and `layout`, read so the panels are found again when it changes. */
export type PanelSource = {
  readonly stage: HTMLElement | null | undefined;
  readonly leftColumn: HTMLElement | null | undefined;
  readonly rightColumn: HTMLElement | null | undefined;
  readonly goals: HTMLElement | null | undefined;
  readonly layout: unknown;
};

/**
 * Where the panels over the board sit. `covered` is each one's box, in pixels from the stage's corner, so the fitted
 * view keeps cities out from under them. `sides` is how far the side columns' panels reach in beside the floating
 * hand (`low`) and beside the objectives (`high`), so each stays between them however wide they grow. Only the panels
 * at its own height count: the Actions panel stands mid-side, and the hand has the room under it. Call it while a
 * component is being set up: it keeps an effect.
 */
export function measurePanels(source: PanelSource) {
  let covered = $state.raw<Covered[]>([]);
  let sides = $state.raw<Sides>({ low: { left: 0, right: 0 }, high: { left: 0, right: 0 } });
  const sameCovered = reconciler<Covered[]>();
  const sameSides = reconciler<Sides>();

  $effect(() => {
    void source.layout;
    const { stage, leftColumn, rightColumn, goals } = source;
    // `bind:this` hands back null, not undefined, once a column leaves the screen.
    const columns = [leftColumn, rightColumn].filter(
      (column): column is HTMLElement => column instanceof HTMLElement,
    );
    if (!stage) return void (covered = []);
    // Whatever follows the stage when no hand is dealt, such as between games, is not a panel over the board.
    const dock = stage.nextElementSibling?.classList.contains("dock-layer")
      ? stage.nextElementSibling
      : null;
    // The columns run the full height but only their panels cover the board, so the panels are what is measured.
    const panels = [
      ...columns.flatMap((column) => [...column.children]),
      ...[goals, dock].filter((element) => element instanceof HTMLElement),
    ];
    // A box drawn outside its element, like the dock's cards above its frame, still covers the board.
    const extent = (element: Element) => {
      const boxes = [element, ...element.children].map((child) => child.getBoundingClientRect());
      const left = Math.min(...boxes.map((box) => box.left));
      const top = Math.min(...boxes.map((box) => box.top));
      const right = Math.max(...boxes.map((box) => box.right));
      const bottom = Math.max(...boxes.map((box) => box.bottom));
      return { left, top, width: right - left, height: bottom - top };
    };
    const measure = () => {
      const origin = stage!.getBoundingClientRect();
      const next = panels.map((panel) => {
        const box = extent(panel);
        return {
          x: box.left - origin.x,
          y: box.top - origin.y,
          width: box.width,
          height: box.height,
          // The Actions panel stands mid-side over the board and grows a column rather than hide a row, so
          // the board always makes room for all of it, as it does for the spending sheet stepped aside.
          firm: panel.classList.contains("actions-slot") || panel.matches('[data-testid="upkeep"]'),
        };
      });
      const reach = (
        column: HTMLElement | null | undefined,
        side: "left" | "right",
        top: number,
        bottom: number,
      ) =>
        column instanceof HTMLElement
          ? Math.max(
              0,
              ...[...column.children].map((child) => {
                const box = child.getBoundingClientRect();
                if (box.bottom <= top || box.top >= bottom) return 0;
                return side === "left" ? box.right - origin.left : origin.right - box.left;
              }),
            )
          : 0;
      const band = (top: number, bottom: number) => ({
        left: reach(leftColumn, "left", top, bottom),
        right: reach(rightColumn, "right", top, bottom),
      });
      const reached = {
        low: band(dock instanceof HTMLElement ? extent(dock).top : origin.bottom, Infinity),
        high: band(
          -Infinity,
          goals instanceof HTMLElement ? extent(goals).top + extent(goals).height : origin.top,
        ),
      };
      // A new array restarts the camera's glide even when nothing moved, and a glide under a click reads as a drag,
      // so each is kept as the object it was while it holds the same numbers.
      covered = sameCovered(next);
      sides = sameSides(reached);
    };
    // A measure moves the floating hand, so it waits a frame rather than run inside the observer's own delivery.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    for (const element of [stage, ...panels]) observer.observe(element);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
  return {
    get covered() {
      return covered;
    },
    get sides() {
      return sides;
    },
  };
}
