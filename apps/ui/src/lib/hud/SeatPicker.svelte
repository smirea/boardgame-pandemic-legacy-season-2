<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import type { SeatId } from "@repo/game";
  import { fly } from "svelte/transition";
  import type { Place } from "./seats.ts";

  type Open = { seat: SeatId; place: Place; name: string; color: string };
  type Arrow = Open & { d: string; head: string };

  let {
    stage,
    seats,
    onpick,
  }: { stage: HTMLElement; seats: Open[]; onpick: (seat: SeatId) => void } = $props();

  let prompt = $state<HTMLElement | null>(null);
  let arrows = $state.raw<Arrow[]>([]);

  /** Runs from the prompt's corner nearest the seat, bending to arrive level with the seat's inner edge. */
  function arrow(open: Open, from: DOMRect, to: DOMRect, origin: DOMRect): Arrow {
    const left = open.place === "tl" || open.place === "bl";
    const top = open.place === "tl" || open.place === "tr";
    const sx = (left ? from.left + 18 : from.right - 18) - origin.left;
    const sy = (top ? from.top : from.bottom) - origin.top;
    const ex = (left ? to.right + 14 : to.left - 14) - origin.left;
    const ey = to.top + Math.min(to.height / 2, 56) - origin.top;
    const c1 = [sx, sy + (ey - sy) * 0.75];
    const c2 = [sx + (ex - sx) * 0.35, ey];
    const length = Math.hypot(ex - c2[0]!, ey - c2[1]!) || 1;
    const [ux, uy] = [(ex - c2[0]!) / length, (ey - c2[1]!) / length];
    const size = 11;
    const head = [
      [ex, ey],
      [ex - ux * size - uy * size * 0.6, ey - uy * size + ux * size * 0.6],
      [ex - ux * size + uy * size * 0.6, ey - uy * size - ux * size * 0.6],
    ]
      .map((point) => point.join(","))
      .join(" ");
    return { ...open, d: `M${sx},${sy} C${c1.join(",")} ${c2.join(",")} ${ex},${ey}`, head };
  }

  // The corners fly in and the side columns resize, so the arrows follow their targets for a moment after anything
  // here changes size or a seat is taken, and then rest: a loop that never ends keeps the page drawing.
  const FOLLOW_MS = 900;
  $effect(() => {
    const open = seats;
    const at = prompt;
    let frame = 0;
    let until = 0;
    const draw = () => {
      const origin = stage.getBoundingClientRect();
      const from = at?.getBoundingClientRect();
      arrows = from
        ? open.flatMap((seat) => {
            const target = stage.querySelector<HTMLElement>(`[data-place=${seat.place}]`);
            return target ? [arrow(seat, from, target.getBoundingClientRect(), origin)] : [];
          })
        : [];
      frame = performance.now() < until ? requestAnimationFrame(draw) : 0;
    };
    const follow = () => {
      until = performance.now() + FOLLOW_MS;
      frame ||= requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(follow);
    observer.observe(stage);
    if (at) observer.observe(at);
    follow();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });
</script>

<svg class="arrows" aria-hidden="true">
  {#each arrows as entry, index (entry.seat)}
    <g style:--seat={entry.color} style:--i={index}>
      <path d={entry.d} pathLength="1" />
      <polygon points={entry.head} />
    </g>
  {/each}
</svg>

<div
  class="prompt"
  role="dialog"
  aria-label="Pick a seat"
  bind:this={prompt}
  in:fly={{ y: 16, duration: 260 }}
  data-testid="seat-picker"
  {@attach feedback("Seat picker", () => ({ open: seats.map((open) => open.seat) }))}
>
  {#if seats.length}
    <strong>Pick a seat</strong>
    <span>This browser has no seat at the table yet. Take an open one to play.</span>
    <div class="choices">
      {#each seats as open (open.seat)}
        <button style:--seat={open.color} onclick={() => onpick(open.seat)}
          ><i></i>{open.name}</button
        >
      {/each}
    </div>
  {:else}
    <strong>Every seat is taken</strong>
    <span>You are watching. A player can give you theirs with Vacate my seat in the menu.</span>
  {/if}
</div>

<style>
  .arrows {
    position: absolute;
    inset: 0;
    z-index: calc(var(--z-hud) - 1);
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  path {
    fill: none;
    stroke: var(--seat);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    filter: drop-shadow(0 0 4px rgb(0 0 0 / 0.7));
    animation: draw 700ms calc(200ms + var(--i) * 120ms) cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  polygon {
    fill: var(--seat);
    opacity: 0;
    filter: drop-shadow(0 0 4px rgb(0 0 0 / 0.7));
    animation: appear 200ms calc(820ms + var(--i) * 120ms) forwards;
  }

  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes appear {
    to {
      opacity: 1;
    }
  }

  .prompt {
    position: absolute;
    top: 50%;
    left: calc((var(--left, 0px) + 100% - var(--right, 0px)) / 2);
    z-index: calc(var(--z-hud) + 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
    max-width: 22rem;
    padding: 1rem 1.3rem 1.1rem;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--panel-solid);
    box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 0.55);
    text-align: center;
    translate: -50% -50%;
  }

  strong {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 400;
    line-height: 1;
  }

  span {
    color: var(--muted);
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.3rem;
  }

  button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--seat);
    border-radius: 3px;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 150ms ease;
  }

  button:hover {
    background: color-mix(in srgb, var(--seat) 25%, transparent);
  }

  button i {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--seat);
  }
</style>
