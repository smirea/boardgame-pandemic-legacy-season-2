<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { HTML } from "@threlte/extras";
  import { onMount } from "svelte";
  import type { BoardPoint } from "./projection";
  import { LAND_HEIGHT } from "./projection";
  import { CITY_RADIUS } from "./routes";

  type Props = { at: BoardPoint; slot: number };

  let { at, slot }: Props = $props();

  // Where CityMarker stands its plague cube number `slot`, so the skull sinks into the cube that replaces it.
  const position = $derived<[number, number, number]>([
    at.x - CITY_RADIUS - 0.85 - (slot % 2) * 1.12,
    LAND_HEIGHT + 0.5 + Math.floor(slot / 4) * 1.12,
    at.z - 0.5 + (Math.floor(slot / 2) % 2) * 1.12,
  ]);

  // The board may be resting, and an HTML piece is placed only when a frame is drawn.
  const { invalidate } = useThrelte();
  onMount(invalidate);
</script>

<HTML {position} center pointerEvents="none" zIndexRange={[20, 15]}>
  <div class="skull" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path
        d="M12 2.2c-5 0-8.6 3.5-8.6 8.2 0 2.7 1.2 4.6 3 5.8v2.6c0 .8.6 1.4 1.4 1.4h1.1v-2h1.4v2h3.4v-2h1.4v2h1.1c.8 0 1.4-.6 1.4-1.4v-2.6c1.8-1.2 3-3.1 3-5.8 0-4.7-3.6-8.2-8.6-8.2Zm-3.6 11.3a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Zm7.2 0a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Zm-3.6 3.3-1.3-2.3h2.6Z"
      />
    </svg>
    <i class="cube"></i>
  </div>
</HTML>

<style>
  /* A green skull swells over the empty city, holds, then folds down into a plague cube. */
  .skull {
    position: relative;
    width: 3.4rem;
    height: 3.4rem;
  }

  svg {
    position: absolute;
    inset: 0;
    fill: #93b236;
    stroke: #26350a;
    stroke-width: 0.6;
    filter: drop-shadow(0 0 0.6rem rgb(147 178 54 / 0.9));
    animation: skull 1050ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
  }

  .cube {
    position: absolute;
    inset: 1.1rem;
    border: 2px solid #3b5210;
    border-radius: 3px;
    background: #93b236;
    box-shadow: 0 0 0.8rem rgb(147 178 54 / 0.9);
    animation: cube 1050ms ease-in both;
  }

  @keyframes skull {
    0% {
      opacity: 0;
      transform: translateY(1.4rem) scale(0.2);
    }
    28% {
      opacity: 1;
      transform: translateY(-0.6rem) scale(1.25);
    }
    45%,
    68% {
      opacity: 1;
      transform: translateY(-0.6rem) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(0) scale(0.3) rotate(45deg);
    }
  }

  @keyframes cube {
    0%,
    70% {
      opacity: 0;
      transform: scale(0.4) rotate(45deg);
    }
    88% {
      opacity: 1;
      transform: scale(1.1) rotate(0deg);
    }
    100% {
      opacity: 1;
      transform: scale(0.8);
    }
  }
</style>
