<script lang="ts">
  import { HTML } from "@threlte/extras";
  import type { Placement } from "./labels";
  import { NAME_SIZE } from "./labels";
  import type { BoardPoint } from "./projection";
  import { CITY_TOP } from "./routes";
  import type { MarkTone } from "./types";

  type Props = {
    at: BoardPoint;
    flags: { id: string; text: string; tone: MarkTone }[];
    name?: Placement;
  };

  let { at, flags, name }: Props = $props();

  // A name printed north of the city would sit under the flags, so they rise above it instead.
  const north = $derived(name && name.z < 0 ? name.z - NAME_SIZE : 0);
</script>

<!-- Paper flags pinned above a city, saying what just happened there. They sit above the city name, never over it. -->
<HTML
  position={[at.x, CITY_TOP + 2.4, at.z + north]}
  center
  pointerEvents="none"
  zIndexRange={[20, 11]}
>
  <div class="flags">
    {#each flags as flag, index (flag.id)}
      <span class="flag {flag.tone}" style:--i={index}>{flag.text}</span>
    {/each}
  </div>
</HTML>

<style>
  .flags {
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 0.15rem;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .flag {
    padding: 0.08rem 0.4rem 0.1rem;
    border-left: 3px solid var(--edge, #2a2017);
    background: #f4ecd9;
    box-shadow:
      0 1px 1px rgb(40 26 12 / 0.4),
      0 0.3rem 0.7rem rgb(20 12 4 / 0.35);
    color: #2a2017;
    font-family: var(--font-ui);
    font-size: 0.74rem;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    animation: pin 380ms calc(var(--i) * 90ms) cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }

  .good {
    --edge: #3d6b55;
  }

  .bad {
    --edge: #a3301c;
    color: #7d2414;
  }

  .warn {
    --edge: #8b5a12;
  }

  .hollow {
    --edge: #4e3b63;
    color: #3b2b4d;
  }

  @keyframes pin {
    from {
      opacity: 0;
      translate: 0 0.6rem;
      scale: 0.8;
    }
  }
</style>
