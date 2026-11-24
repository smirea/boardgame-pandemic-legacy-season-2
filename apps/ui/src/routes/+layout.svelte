<script lang="ts">
  import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
  import favicon from "#lib/assets/favicon.svg";
  import { startFeedback } from "#lib/feedback.ts";
  import { typing } from "#lib/keys.ts";
  import { blockAutofill } from "#lib/noAutofill.ts";
  import { originals } from "#lib/scans.svelte.ts";
  import { onMount } from "svelte";
  import "./layout.css";

  let { children } = $props();
  const browser = typeof window !== "undefined";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: browser,
      },
    },
  });

  onMount(blockAutofill);
  onMount(startFeedback);

  function onkeydown(event: KeyboardEvent) {
    if (event.repeat || typing(event) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === "o") originals.held = true;
  }
  function onkeyup(event: KeyboardEvent) {
    if (event.key.toLowerCase() === "o") originals.held = false;
  }
</script>

<svelte:window {onkeydown} {onkeyup} onblur={() => (originals.held = false)} />

<svelte:head>
  <link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
