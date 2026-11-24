<script lang="ts">
  import { T } from "@threlte/core";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { Spring } from "svelte/motion";

  type Props = { position: [number, number, number]; delay?: number; children: Snippet };

  let { position, delay = 0, children }: Props = $props();

  // Pieces arrive with a small overshoot, so a cube landing on a city reads as an event and not a redraw.
  const size = new Spring(0, { stiffness: 0.16, damping: 0.38 });
  onMount(() => {
    const timer = setTimeout(() => (size.target = 1), delay);
    return () => clearTimeout(timer);
  });
</script>

<T.Group {position} scale={Math.max(0.001, size.current)}>
  {@render children()}
</T.Group>
