<script lang="ts">
  import type { GameSession } from "#lib/session/session.svelte.ts";

  let { error, session }: { error: unknown; session: GameSession } = $props();

  const message = $derived.by(() => {
    const shown = error as { message?: unknown; stack?: unknown } | null;
    if (typeof shown?.message !== "string") return String(error);
    return typeof shown.stack === "string" && shown.stack.includes(shown.message)
      ? shown.stack
      : shown.message;
  });

  function download() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([session.exportSave()], { type: "application/json" }));
    link.download = `campaign-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
</script>

<main>
  <section>
    <h1>The screen broke</h1>
    <p>
      The campaign is safe in this browser. Reloading usually brings the game back where it was.
    </p>
    <pre>{message}</pre>
    <div>
      <button class="primary" onclick={() => location.reload()}>Reload</button>
      <button onclick={download}>Export the save first</button>
    </div>
  </section>
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--table);
    color: var(--ink);
    font-family: var(--font-ui);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    width: min(32rem, 90vw);
  }

  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 2.6rem;
    font-weight: 400;
  }

  p {
    margin: 0;
    color: var(--muted);
  }

  pre {
    margin: 0;
    padding: 0.7rem;
    border-left: 2px solid var(--danger);
    background: var(--wash);
    color: var(--danger);
    font-size: 0.75rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 50vh;
    overflow: auto;
  }

  div {
    display: flex;
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--line-strong);
    border-radius: 2px;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .primary {
    border-color: var(--paper);
    background: var(--paper);
    color: var(--paper-ink);
    font-weight: 700;
  }
</style>
