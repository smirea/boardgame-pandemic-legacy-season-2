<script lang="ts">
	import type { GameSession } from '#lib/session/session.svelte.ts';

	let { error, session }: { error: unknown; session: GameSession } = $props();

	const message = $derived(error instanceof Error ? error.message : String(error));

	function download() {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([session.exportSave()], { type: 'application/json' }));
		link.download = `campaign-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<main>
	<section>
		<h1>The screen broke</h1>
		<p>The campaign is safe in this browser. Reloading usually brings the game back where it was.</p>
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
		background: #070b0f;
		color: #e9e6dc;
		font-family: 'Avenir Next', 'Segoe UI', system-ui, sans-serif;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		width: min(32rem, 90vw);
	}

	h1 {
		margin: 0;
		font-size: 2rem;
	}

	p {
		margin: 0;
		color: #8a9aa8;
	}

	pre {
		margin: 0;
		padding: 0.7rem;
		border-radius: 0.5rem;
		background: rgb(255 255 255 / 0.06);
		color: #ff6b6b;
		font-size: 0.75rem;
		white-space: pre-wrap;
	}

	div {
		display: flex;
		gap: 0.5rem;
	}

	button {
		padding: 0.5rem 0.9rem;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 0.5rem;
		background: rgb(255 255 255 / 0.05);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.primary {
		border-color: #7dfcc0;
		background: #7dfcc0;
		color: #06120c;
		font-weight: 700;
	}
</style>
