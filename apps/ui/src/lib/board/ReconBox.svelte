<script lang="ts" module>
  const stop = (event: PointerEvent) => event.stopPropagation();
  // Svelte handles `onpointerdown` at the document, after the controls have already captured the pointer.
  const keepFromCamera = (node: HTMLElement) => {
    node.addEventListener("pointerdown", stop);
    return () => node.removeEventListener("pointerdown", stop);
  };
</script>

<script lang="ts">
  import { feedback } from "@stefan.inc/feedback-engine/svelte";
  import { T } from "@threlte/core";
  import { HTML } from "@threlte/extras";
  import { Tween } from "svelte/motion";
  import Beacon from "#lib/Beacon.svelte";
  import { CITY_COLOR } from "./CityMarker.svelte";
  import { reconHint } from "./hints";
  import type { BoardPoint } from "./projection";
  import { LAND_HEIGHT } from "./projection";
  import type { ReconBoxView } from "./types";

  type Props = {
    box: ReconBoxView;
    /** The route's city. */
    from: BoardPoint;
    /** Where the box is printed, out toward the region it reveals. */
    at: BoardPoint;
    /** False once the route is taken: the box fades with the fog it pointed into. */
    shown: boolean;
    /** Below 1 while the camera is zoomed out past the view the boxes were placed for. */
    scale: number;
    /** While the players aim at cities, the box lets a click through to a city it overlaps. */
    passive?: boolean;
    onrecon: () => void;
  };

  let { box, from, at, shown, scale, passive = false, onrecon }: Props = $props();

  /** The leader starts at the rim of the city's pieces. */
  const CLEAR_OF_CITY = 3.4;
  /** Just above the fog's lowest sheet, where the city names are printed. */
  const INK = LAND_HEIGHT + 0.2;

  const text = $derived(reconHint(box));
  const tint = $derived(CITY_COLOR[box.color]);
  const ink = new Tween(0, { duration: 1400 });
  $effect(() => {
    ink.target = shown ? 1 : 0;
  });
  const leader = $derived.by(() => {
    const dx = at.x - from.x;
    const dz = at.z - from.z;
    const span = Math.hypot(dx, dz);
    const length = Math.max(0, span - CLEAR_OF_CITY);
    const mid = CLEAR_OF_CITY + length / 2;
    const ux = dx / span;
    const uz = dz / span;
    return { x: from.x + ux * mid, z: from.z + uz * mid, length, angle: Math.atan2(-uz, ux) };
  });
</script>

{#if ink.current > 0.01}
  <T.Mesh
    position={[leader.x, INK, leader.z]}
    rotation={[-Math.PI / 2, 0, leader.angle]}
    renderOrder={4}
  >
    <T.PlaneGeometry args={[leader.length, 0.22]} />
    <T.MeshBasicMaterial color={tint} transparent opacity={0.8 * ink.current} depthWrite={false} />
  </T.Mesh>
{/if}

<!--
	The board prints each recon route beside its city as a box reaching into the unexplored region it opens. The box
	keeps one size on screen down to the fitted view's zoom and shrinks with the map past it, while its leader is
	inked on the chart. The camera controls
	listen on the element the box is drawn into and capture the pointer, which would turn a click into a drag.
-->
<HTML
  position={[at.x, INK, at.z]}
  center
  pointerEvents={shown ? "auto" : "none"}
  zIndexRange={[10, 5]}
>
  <!-- Threlte reads `pointerEvents` once, so passing clicks through while aiming is set here. -->
  <div class="zoom" style:scale style:pointer-events={passive ? "none" : null}>
    <div
      class="recon {box.state}"
      class:gone={!shown}
      style:--tint={tint}
      {@attach feedback(`Recon box: ${box.name}`, () => ({ ...box }))}
    >
      <button
        type="button"
        data-recon={box.route}
        data-state={box.state}
        disabled={box.state !== "ready" || !shown}
        aria-label="Recon {text.title}. {text.cost}. {text.where}.{text.status
          ? ` ${text.status}.`
          : ''}"
        onclick={onrecon}
        {@attach keepFromCamera}
      >
        <span class="head">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" fill="none" stroke-width="1.6" />
            <path d="M8 3.5 9.6 8 8 12.5 6.4 8Z" />
          </svg>
          <strong>{text.title}</strong>
        </span>
        <span class="cost">
          <span class="cards" aria-hidden="true">
            {#each { length: box.count } as _, index (index)}
              <i>{box.unique ? String.fromCharCode(65 + index) : "★"}</i>
            {/each}
          </span>
          <span>{text.cost}</span>
        </span>
        <span class="where">{text.where}</span>
        {#if box.state !== "idle" && text.status}
          <span class="status">{text.status}</span>
        {/if}
        {#if box.aimed && box.state === "ready" && shown}<Beacon />{/if}
      </button>
    </div>
  </div>
</HTML>

<style>
  .zoom {
    transform-origin: center;
  }

  .recon {
    transition:
      opacity 1.4s ease,
      scale 1.4s ease,
      filter 1.4s ease;
  }

  .recon.gone {
    opacity: 0;
    scale: 0.85;
    filter: blur(4px);
  }

  button {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    width: 12.5rem;
    padding: 0 0.55rem 0.45rem;
    border: 2px solid color-mix(in srgb, var(--tint) 80%, #2a2017);
    border-radius: 3px;
    background: color-mix(in srgb, var(--tint) 10%, #f1e8d3);
    box-shadow: var(--slip-shadow);
    color: var(--slip-ink);
    font-family: var(--font-ui);
    font-size: 0.72rem;
    line-height: 1.25;
    text-align: left;
    cursor: pointer;
    transition:
      translate 160ms ease,
      box-shadow 160ms ease,
      filter 300ms ease,
      opacity 300ms ease;
  }

  /* Takeable now: a halo in the route's colour, and it lifts under the pointer. */
  .ready button {
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--tint) 45%, transparent),
      var(--slip-shadow);
  }

  .ready button:hover,
  .ready button:focus-visible {
    translate: 0 -2px;
    outline: none;
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--tint) 60%, transparent),
      var(--slip-shadow);
  }

  .blocked button,
  .idle button {
    cursor: default;
  }

  .blocked button {
    filter: grayscale(0.9);
    opacity: 0.8;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0 -0.55rem 0.1rem;
    padding: 0.15rem 0.55rem;
    background: color-mix(in srgb, var(--tint) 80%, #2a2017);
    color: #f6efdf;
  }

  .head svg {
    flex: none;
    width: 0.85rem;
    height: 0.85rem;
    fill: currentColor;
    stroke: currentColor;
  }

  .head strong {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 400;
    line-height: 1.15;
  }

  .cost {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
  }

  /* One small card per card the route asks for: a star for any city of the colour, a letter for a different city each. */
  .cards {
    display: flex;
    flex: none;
    gap: 2px;
  }

  .cards i {
    display: grid;
    place-items: center;
    width: 0.7rem;
    height: 0.95rem;
    border-radius: 2px;
    background: var(--tint);
    color: #f6efdf;
    font-size: 0.55rem;
    font-style: normal;
    font-weight: 700;
  }

  .where {
    color: var(--slip-muted);
  }

  .status {
    padding-top: 0.2rem;
    border-top: 1px solid var(--slip-line);
    font-weight: 600;
  }

  .ready .status {
    color: #2f6e5c;
  }

  .blocked .status {
    color: #7d2414;
  }
</style>
