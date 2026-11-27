/**
 * Lifts a copy of `from` off the page and carries it, in an arc, onto `to`, which pulses as it lands. A target
 * larger than the piece (a panel, the map) takes it at its centre, shrunk, as if it went in; a smaller one takes
 * it at its own size. The original stays where it was, so the caller hides it for the flight.
 */
export function flyTo(
  from: HTMLElement,
  to: Element,
  { delay = 0, duration = 1100 } = {},
): Promise<void> {
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  const into = end.width > start.width * 1.5 && end.height > start.height * 1.5;
  // A piece shown zoomed out (a pile fitted to its box, or a piece scaled on the table) is copied at its own size and
  // shrunk to how it looks.
  const zoom = from.offsetWidth ? start.width / from.offsetWidth : from.currentCSSZoom || 1;
  const fly = into
    ? Math.min(0.3, 48 / start.width)
    : Math.min(end.width / start.width, end.height / start.height);
  const dx = end.left + end.width / 2 - (start.left + start.width / 2);
  const dy = end.top + end.height / 2 - (start.top + start.height / 2);
  const width = start.width / zoom;
  const height = start.height / zoom;

  const ghost = from.cloneNode(true) as HTMLElement;
  Object.assign(ghost.style, {
    position: "fixed",
    top: `${start.top + (start.height - height) / 2}px`,
    left: `${start.left + (start.width - width) / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
    margin: "0",
    zIndex: "var(--z-flight)",
    pointerEvents: "none",
    transform: "none",
    transition: "none",
    fontSize: getComputedStyle(from).fontSize,
  });
  document.body.append(ghost);
  const at = (x: number, y: number, size: number, turn: number) =>
    `translate(${x}px, ${y}px) scale(${size * zoom}) rotate(${turn}deg)`;
  const flight = ghost.animate(
    [
      { transform: at(0, 0, 1, 0), opacity: 1, filter: "drop-shadow(0 0 0 rgb(0 0 0 / 0))" },
      {
        transform: at(0, -14, 1.06, -3),
        filter: "drop-shadow(0 0.8rem 1rem rgb(0 0 0 / 0.45))",
        offset: 0.2,
      },
      { transform: at(dx * 0.5, dy * 0.5 - 70, (1 + fly) * 0.55, 5), offset: 0.6 },
      {
        transform: at(dx, dy, fly, 0),
        opacity: into ? 0 : 1,
        filter: "drop-shadow(0 0 0 rgb(0 0 0 / 0))",
      },
    ],
    { duration, delay, easing: "cubic-bezier(0.5, 0, 0.25, 1)", fill: "both" },
  );
  return new Promise((resolve) => {
    const done = () => {
      ghost.remove();
      resolve();
    };
    flight.onfinish = () => {
      to.animate([{ scale: "1" }, { scale: into ? "1.03" : "1.15" }, { scale: "1" }], {
        duration: 380,
        easing: "cubic-bezier(0.3, 1.6, 0.5, 1)",
      });
      done();
    };
    flight.oncancel = done;
  });
}

/** Where the table keeps each kind of thing, found by its `data-dest` mark, falling back down the list. */
export function destination(...names: string[]): Element | null {
  for (const name of names) {
    const found = document.querySelector(`[data-dest~="${name}"]`);
    if (found) return found;
  }
  return null;
}
