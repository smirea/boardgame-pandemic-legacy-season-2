<script lang="ts">
  import type { CityId } from "@repo/game";
  import { CITY_COLOR } from "#lib/board/CityMarker.svelte";
  import { ART_HEIGHT, ART_WIDTH, mapArt } from "./mapArt.ts";

  type Props = { city: CityId; accent: string; tone?: "day" | "night" };

  let { city, accent, tone = "day" }: Props = $props();

  const art = $derived(mapArt(city));
</script>

<svg
  class={tone}
  viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}
  preserveAspectRatio="xMidYMid slice"
  style:--accent={accent}
  aria-hidden="true"
>
  <rect class="sea" width={ART_WIDTH} height={ART_HEIGHT} />
  <path class="graticule" d={art.graticule} />
  <path class="rings" d={art.land} />
  <path class="land" d={art.land} />
  {#each art.neighbours as point, index (index)}
    <circle
      class="neighbour"
      cx={point.x}
      cy={point.y}
      r="1.5"
      fill={CITY_COLOR[point.color ?? "haven"]}
    />
  {/each}
  <circle class="halo" cx={art.pin.x} cy={art.pin.y} r="9" />
  <circle class="halo inner" cx={art.pin.x} cy={art.pin.y} r="4.5" />
  <path
    class="pin"
    transform={`translate(${art.pin.x} ${art.pin.y})`}
    d="M0 0 C-1.2 -4.2 -5.2 -6 -5.2 -10.2 A5.2 5.2 0 1 1 5.2 -10.2 C5.2 -6 1.2 -4.2 0 0 Z"
  />
  <circle class="eye" cx={art.pin.x} cy={art.pin.y - 10.2} r="1.9" />
</svg>

<style>
  /* The same chart as the board, cropped: paper sea, a ring of water-lining off the coast, inked land. */
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .sea {
    fill: #a9c1cc;
  }

  .rings {
    fill: none;
    stroke: rgb(36 72 106 / 0.25);
    stroke-width: 3.2;
    stroke-linejoin: round;
  }

  .land {
    fill: #dcc9a0;
    stroke: #3a2c1f;
    stroke-width: 0.45;
    stroke-linejoin: round;
  }

  .graticule {
    fill: none;
    stroke: rgb(139 74 51 / 0.32);
    stroke-width: 0.3;
  }

  .night .sea {
    fill: color-mix(in srgb, var(--accent) 45%, #120d09);
  }

  .night .rings {
    stroke: rgb(231 220 198 / 0.08);
  }

  .night .land {
    fill: color-mix(in srgb, var(--accent) 25%, #2c261e);
    stroke: rgb(231 220 198 / 0.55);
  }

  .night .graticule {
    stroke: rgb(231 220 198 / 0.1);
  }

  .neighbour {
    stroke: #2a2017;
    stroke-width: 0.4;
  }

  .night .neighbour {
    stroke: rgb(0 0 0 / 0.6);
    opacity: 0.8;
  }

  .halo {
    fill: none;
    stroke: var(--accent);
    stroke-width: 0.7;
    opacity: 0.6;
  }

  .halo.inner {
    opacity: 0.95;
  }

  .pin {
    fill: var(--accent);
    stroke: #2a2017;
    stroke-width: 0.6;
    filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.4));
  }

  .eye {
    fill: #f1e9d6;
  }
</style>
