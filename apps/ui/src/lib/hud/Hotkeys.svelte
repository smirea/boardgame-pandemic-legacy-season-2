<script lang="ts">
	import CloseButton from './CloseButton.svelte';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';

	let { onclose }: { onclose: () => void } = $props();

	type Row = { keys: string[]; join?: '+' | '/'; label: string };
	type Section = { heading: string; rows: Row[] };

	const sections: Section[] = [
		{
			heading: 'Map & table',
			rows: [
				{ keys: ['W A S D', 'Arrows'], label: 'Pan the map' },
				{ keys: ['Hold F', 'Drag'], join: '+', label: 'Draw on the map (shared live)' },
				{ keys: ['E'], label: 'Toggle eraser when drawings are on the map' },
				{ keys: ['Tab'], label: 'Ping the map at your pointer' },
			],
		},
		{
			heading: 'Turn & actions',
			rows: [
				{ keys: ['Space'], label: 'Advance turn (end actions, draw, infect)' },
				{ keys: ['Z'], label: 'Undo last action' },
				{ keys: ['Esc', 'Right-click'], label: 'Cancel action, exit eraser, or close panel' },
			],
		},
		{
			heading: 'Reference',
			rows: [
				{ keys: ['Hold O'], label: 'Show printed original scans' },
				{ keys: ['?'], label: 'Show or hide keyboard shortcuts' },
				{ keys: ['⌥⌘ Click'], label: 'Give feedback on an element' },
			],
		},
	];
</script>

<section class="sheet" data-testid="hotkeys-dialog" {@attach feedback('Keyboard shortcuts', () => undefined)}>
	<header>
		<h2>Keyboard shortcuts</h2>
		<CloseButton label="Close keyboard shortcuts" onclick={onclose} />
	</header>

	<div class="sections">
		{#each sections as section (section.heading)}
			<div class="group">
				<h3>{section.heading}</h3>
				<dl>
					{#each section.rows as row (row.label)}
						<dt>
							{#each row.keys as key, index (key)}
								{#if index > 0}<span class="sep">{row.join ?? '/'}</span>{/if}
								<kbd>{key}</kbd>
							{/each}
						</dt>
						<dd>{row.label}</dd>
					{/each}
				</dl>
			</div>
		{/each}
	</div>
</section>

<style>
	.sheet {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: min(31rem, 92vw);
		max-height: min(84vh, 38rem);
		padding: 1.15rem 1.35rem 1.25rem;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background: var(--panel-solid);
		box-shadow: 0 1.4rem 3.5rem rgb(0 0 0 / 0.65);
		color: var(--ink);
		font-family: var(--font-ui);
		overflow: auto;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.55rem;
		border-bottom: 1px solid var(--line);
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.4rem;
		font-weight: 400;
		line-height: 1.1;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 0.95rem;
	}

	.group h3 {
		margin: 0 0 0.4rem;
		color: var(--muted);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		align-items: center;
		gap: 0.42rem 1rem;
		margin: 0;
	}

	dt {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.28rem;
		white-space: nowrap;
	}

	.sep {
		color: var(--muted);
		font-size: 0.72rem;
	}

	kbd {
		padding: 0.14rem 0.45rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		color: var(--paper);
		font-family: var(--font-ui);
		font-size: 0.76rem;
		font-weight: 600;
		line-height: 1.25;
	}

	dd {
		margin: 0;
		color: var(--ink);
		font-size: 0.88rem;
		line-height: 1.3;
	}
</style>
