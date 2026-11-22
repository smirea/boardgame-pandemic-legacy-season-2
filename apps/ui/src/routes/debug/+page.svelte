<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';

	const TOOLS = [
		{
			href: '/debug/studio',
			name: 'Studio',
			text: 'The real game on one client, in a frame of a chosen size. Set the screen up exactly, play on from it, and capture it as a picture with the state that draws it again. Agents drive it through window.STUDIO.',
		},
		{
			href: '/debug/game',
			name: 'Game',
			text: 'The real machine and screen with every seat on this client and no networking, on this browser’s campaign. window.DEBUG reads and replaces the state.',
		},
		{
			href: '/debug/cards',
			name: 'Cards',
			text: 'Every generated card face: city, event, companion, Infection and Hollow Men cards.',
		},
		{
			href: '/debug/runs',
			name: 'Playtest runs',
			text: 'The playtest lab’s recorded games, each opened in the replay viewer.',
		},
		{
			href: '/replay?src=library',
			name: 'Replays',
			text: 'Every game this browser has hosted, with who played which character.',
		},
	];
</script>

<svelte:head>
	<title>Legacy: debug</title>
</svelte:head>

<main {@attach feedback('Debug tools', () => ({ tools: TOOLS.map(tool => tool.href) }))}>
	<h1>Debugging tools</h1>
	<ul>
		{#each TOOLS as tool (tool.href)}
			<li>
				<a href={tool.href} data-testid={`tool-${tool.name}`}>
					<strong>{tool.name}</strong>
					<code>{tool.href}</code>
					<span>{tool.text}</span>
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	main {
		min-height: 100vh;
		padding: 3rem max(1.5rem, calc(50vw - 22rem));
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
	}

	h1 {
		margin: 0 0 1.4rem;
		font-family: var(--font-display);
		font-size: 2.6rem;
		font-weight: 400;
	}

	ul {
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

	strong {
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 400;
	}

	code {
		color: var(--muted);
		font-size: 0.8rem;
	}

	span {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
