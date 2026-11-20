<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { briefingSections, pack } from '@repo/game';
	import type { BriefingEntry, Campaign } from '@repo/game';
	import { scan, sourceScans } from '#lib/scans.svelte.ts';
	import BriefPiece from './BriefPiece.svelte';
	import ObjectiveTag from './ObjectiveTag.svelte';

	// Unlocks that show as a card or cubes get a grid, so the pieces line up.
	const PIECES = new Set(['cityImprovement', 'infectionImprovement', 'event', 'gather', 'assemble', 'stockpileBonus']);

	type Props = { briefing: BriefingEntry[]; campaign: Campaign; passive: boolean; oncontinue: () => void };

	let { briefing, campaign, passive, oncontinue }: Props = $props();

	const sections = $derived(briefingSections(briefing));
	const objectives = $derived(pack.objectives.filter(objective => campaign.objectives.includes(objective.id)));
</script>

<div class="briefing" class:passive {@attach feedback('Briefing', () => ({ briefing }))}>
	<h2>New this game</h2>
	<div class="sections">
		{#each sections as section, index (index)}
			{#if section.t === 'card'}
				<section class="card-text" {@attach scan(() => sourceScans(section.from), `brief:${index}`)}>
					<h3>{section.title}</h3>
					{#if section.text}<p>{section.text}</p>{/if}
				</section>
			{:else}
				<section>
					<h3>{section.heading}</h3>
					{#if section.items[0]?.unlock.t === 'objectives'}
						<div class="objectives">
							{#each objectives as objective (objective.id)}
								<span class="tag" data-brief-objective={objective.id}><ObjectiveTag {objective} /></span>
							{/each}
						</div>
						<p class="note">
							Complete {Math.min(campaign.required, objectives.length)} of {objectives.length} to win.
						</p>
					{:else}
						<ul class:pieces={section.items.some(item => PIECES.has(item.unlock.t))}>
							{#each section.items as item, index (index)}
								<li {@attach feedback('Unlock', () => item.unlock)}>
									<BriefPiece unlock={item.unlock} {campaign} />
									<p>{item.text}</p>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		{/each}
	</div>
	<button class="primary" onclick={oncontinue} data-testid="ack-briefing">Continue</button>
</div>

<style>
	.briefing {
		display: flex;
		flex-direction: column;
		width: min(62rem, 94vw);
		max-height: calc(100vh - 2rem);
		padding: 1.3rem 1.6rem 1.3rem;
		overflow: auto;
		border-radius: 2px;
		background: var(--paper);
		color: var(--paper-ink);
		box-shadow:
			0 1.5rem 4rem rgb(0 0 0 / 0.6),
			inset 0 0 3rem rgb(120 86 48 / 0.18);
	}

	.briefing.passive {
		width: min(28rem, 90vw);
		max-height: 45vh;
		padding: 0.9rem 1.1rem;
		font-size: 0.85rem;
		pointer-events: auto;
	}

	h2 {
		margin: 0 0 0.6rem;
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 400;
	}

	/* Two columns, so a month's whole briefing reads at once on a laptop screen. */
	.sections {
		flex: none;
		columns: 2 22rem;
		column-gap: 2rem;
		margin: 0 -0.4rem 1.1rem;
		padding: 0 0.4rem;
		font-size: 0.92rem;
		line-height: 1.4;
	}

	/* Beside the board the briefing is a short column that scrolls, and a multi-column box would overflow sideways. */
	.passive .sections {
		flex: 1 1 auto;
		columns: auto;
		min-height: 0;
		overflow: auto;
	}

	section {
		margin-bottom: 0.85rem;
		break-inside: avoid;
		padding-left: 0.7rem;
		border-left: 2px solid rgb(42 32 23 / 0.3);
	}

	h3 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: 1.12rem;
		font-weight: 400;
	}

	p {
		margin: 0;
	}

	.note {
		margin-top: 0.4rem;
		color: var(--paper-muted);
		font-size: 0.85em;
	}

	/* The objectives are shown as the tags they become over the board, a little larger, so they can fly there. */
	.objectives {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding-top: 0.2rem;
		font-size: 1rem;
	}

	.tag {
		display: flex;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	ul.pieces {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: 0.6rem 1rem;
	}

	.passive ul.pieces {
		grid-template-columns: 1fr;
	}

	.primary {
		align-self: flex-start;
		padding: 0.45rem 1.1rem;
		border: 1px solid var(--paper-ink);
		border-radius: 2px;
		background: var(--paper-ink);
		color: var(--paper);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
</style>
