<script lang="ts">
	import type { RunSummary } from '@repo/game';
	import { createQuery } from '@tanstack/svelte-query';

	const runs = createQuery(() => ({
		queryKey: ['runs'],
		queryFn: async (): Promise<RunSummary[]> => {
			const response = await fetch('/api/runs');
			if (!response.ok) throw new Error(`/api/runs answered ${response.status}`);
			return response.json();
		},
	}));

	const replay = (run: string) => `/replay?index=${encodeURIComponent(`/api/runs/${run}/index.json`)}`;
	const when = (at: number) =>
		new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
</script>

<svelte:head>
	<title>Legacy: playtest runs</title>
</svelte:head>

<main>
	<header>
		<p class="eyebrow">Playtest lab</p>
		<h1>Runs</h1>
	</header>

	{#if runs.isPending}
		<p class="hint">Loading runs…</p>
	{:else if runs.isError}
		<p class="error">{runs.error.message}</p>
	{:else if !runs.data.length}
		<p class="hint">
			No run has recorded a game yet. Recordings land in <code>apps/playtest/runs/&lt;run&gt;/records</code>.
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
							{#if run.games > run.won + run.lost}<b class="live">{run.games - run.won - run.lost} in play</b>{/if}
						</span>
						<span class="meta"
							>{run.games} {run.games === 1 ? 'game' : 'games'} · last played {when(run.updatedAt)}</span
						>
					</a>
				</li>
			{/each}
		</ol>
	{/if}
</main>

<style>
	main {
		--ink: #e9e6dc;
		--muted: #8a9aa8;
		--accent: #7dfcc0;
		--line: rgb(255 255 255 / 0.1);
		min-height: 100vh;
		padding: 3rem max(1.5rem, calc(50vw - 22rem));
		background: #070b0f;
		color: var(--ink);
		font-family: 'Avenir Next', 'Segoe UI', system-ui, sans-serif;
		font-variant-numeric: tabular-nums;
	}

	.eyebrow {
		margin: 0;
		color: var(--muted);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.15rem 0 1.4rem;
		font-size: 1.5rem;
		font-weight: 650;
	}

	.hint {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.error {
		color: #ff8f8f;
		font-size: 0.85rem;
	}

	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li + li {
		margin-top: 0.5rem;
	}

	a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.2rem 0.8rem;
		padding: 0.8rem 1rem;
		border: 1px solid var(--line);
		border-radius: 0.6rem;
		color: inherit;
		text-decoration: none;
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	a:hover {
		border-color: var(--accent);
		background: rgb(125 252 192 / 0.05);
	}

	.name {
		font-size: 0.95rem;
		font-weight: 650;
		overflow-wrap: anywhere;
	}

	.score {
		display: flex;
		gap: 0.35rem;
		align-self: center;
	}

	.score b {
		padding: 0.05rem 0.5rem;
		border-radius: 999px;
		font-size: 0.68rem;
		font-weight: 600;
	}

	.won {
		background: rgb(125 252 192 / 0.16);
		color: var(--accent);
	}

	.lost {
		background: rgb(255 107 107 / 0.16);
		color: #ff8f8f;
	}

	.live {
		background: rgb(255 255 255 / 0.1);
		color: var(--muted);
	}

	.meta {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 0.74rem;
	}
</style>
