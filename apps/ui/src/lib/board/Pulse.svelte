<script lang="ts" module>
  import type { FxKind } from "./types";

  const STYLE: Record<FxKind, { color: string; size: number; duration: number }> = {
    infect: { color: "#9a6514", size: 5, duration: 900 },
    plague: { color: "#5d7a14", size: 8, duration: 1400 },
    outbreak: { color: "#b0301c", size: 16, duration: 1700 },
    epidemic: { color: "#8c1c12", size: 22, duration: 2200 },
    connected: { color: "#2f6e5c", size: 9, duration: 1500 },
    build: { color: "#2a2017", size: 6, duration: 1000 },
    hollow: { color: "#4e3b63", size: 7, duration: 1300 },
  };
</script>

<script lang="ts">
  import { T } from "@threlte/core";
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { Tween } from "svelte/motion";
  import type { BoardPoint } from "./projection";
  import { LAND_HEIGHT } from "./projection";

  type Props = { at: BoardPoint; kind: FxKind; delay: number };

  let { at, kind, delay }: Props = $props();

  const style = $derived(STYLE[kind]);
  const progress = new Tween(0, { easing: cubicOut });
  let started = $state(false);
  onMount(() => {
    const timer = setTimeout(() => {
      started = true;
      void progress.set(1, { duration: style.duration });
    }, delay);
    return () => clearTimeout(timer);
  });
</script>

{#if started && progress.current < 1}
  <T.Mesh
    position={[at.x, LAND_HEIGHT + 0.7, at.z]}
    rotation.x={-Math.PI / 2}
    scale={0.2 + progress.current * style.size}
  >
    <T.RingGeometry args={[0.82, 1, 48]} />
    <T.MeshBasicMaterial
      color={style.color}
      transparent
      opacity={(1 - progress.current) * 0.95}
      depthWrite={false}
    />
  </T.Mesh>
{/if}
