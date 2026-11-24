<script lang="ts">
  import type { RunSummary } from "@repo/game";
  import { createQuery } from "@tanstack/svelte-query";

  const runs = createQuery(() => ({
    queryKey: ["runs"],
    queryFn: async (): Promise<RunSummary[]> => {
      const response = await fetch("/api/runs");
      if (!response.ok) throw new Error(`/api/runs answered ${response.status}`);
      return response.json();
    },
  }));

  const replay = (run: string) =>
    `/replay?index=${encodeURIComponent(`/api/runs/${run}/index.json`)}`;
  const when = (at: number) =>
    new Date(at).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
</script>

<svelte:head>
  <title>Legacy: playtest runs</title>
</svelte:head>

<main>
  <header>
    <h1>Playtest runs</h1>
  </header>

  {#if runs.isPending}
    <p class="hint">Loading runs…</p>
  {:else if runs.isError}
    <p class="error">{runs.error.message}</p>
  {:else if !runs.data.length}
    <p class="hint">
      No run has recorded a game yet. Recordings land in <code
        >apps/playtest/runs/&lt;run&gt;/records</code
      >.
    </p>
  {:else}
    <ol data-testid="runs">
      {#each runs.data as run (run.run)}
        <li>
          <a href={replay(run.run)}>
            <span class="name">{run.run}</span>
            <span class="score">
              {#if run.won}<b class="won">{run.won} won</b>{/if}
              {#if run.lost}<b class="lost">{run.lost} lost</b>{/if}
              {#if run.games > run.won + run.lost}<b class="live"
                  >{run.games - run.won - run.lost} in play</b
                >{/if}
            </span>
            <span class="meta"
              >{run.games}
              {run.games === 1 ? "game" : "games"}, last played {when(run.updatedAt)}</span
            >
          </a>
        </li>
      {/each}
    </ol>
  {/if}
</main>

<style>
  main {
    min-height: 100vh;
    padding: 3rem max(1.5rem, calc(50vw - 22rem));
    background: var(--table);
    color: var(--ink);
    font-family: var(--font-ui);
    font-variant-numeric: tabular-nums;
  }

  h1 {
    margin: 0 0 1.4rem;
    font-family: var(--font-display);
    font-size: 2.6rem;
    font-weight: 400;
  }

  .hint {
    color: var(--muted);
  }

  .error {
    color: var(--danger);
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  a {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.2rem 1rem;
    padding: 0.8rem 1rem;
    border-left: 2px solid var(--line-strong);
    background: var(--wash);
    color: inherit;
    text-decoration: none;
    transition:
      border-color 0.15s,
      background 0.15s;
  }

  a:hover {
    border-left-color: var(--paper);
    background: rgb(231 220 198 / 0.09);
  }

  .name {
    font-family: var(--font-display);
    font-size: 1.2rem;
  }

  .score {
    display: flex;
    gap: 0.4rem;
    align-items: center;
  }

  .score b {
    padding: 0.05rem 0.45rem;
    border: 1px solid currentcolor;
    border-radius: 2px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .won {
    color: var(--good);
  }

  .lost {
    color: var(--danger);
  }

  .live {
    color: var(--muted);
  }

  .meta {
    grid-column: 1 / -1;
    color: var(--muted);
    font-size: 0.8rem;
  }

  code {
    color: var(--ink);
  }
</style>
