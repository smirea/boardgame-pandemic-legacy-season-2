<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { briefingSections, pack } from '@repo/game';
	import type {
		BriefedUnlock,
		CityId,
		InfectionCard as InfectionCardData,
		BriefingEntry,
		Campaign,
		PlayerCard as PlayerCardData,
	} from '@repo/game';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import ActionIcon from './ActionIcon.svelte';
	import { ACTION_ICON } from './labels.svelte.ts';
	import ObjectiveTag from './ObjectiveTag.svelte';
	import PlayerCard from './PlayerCard.svelte';

	type Props = { briefing: BriefingEntry[]; campaign: Campaign; passive: boolean; oncontinue: () => void };

	let { briefing, campaign, passive, oncontinue }: Props = $props();

	const sections = $derived(briefingSections(briefing));
	const objectives = $derived(pack.objectives.filter(objective => campaign.objectives.includes(objective.id)));

	// An improvement is bought for any card, so it is shown on a city the group already knows.
	const known = <T extends { kind: string }>(cards: T[]) =>
		cards.find(card => 'city' in card && campaign.locations[card.city as CityId]?.revealed) as
			| Extract<T, { kind: 'city' }>
			| undefined;
	const samplePlayer = $derived(known(Object.values(campaign.playerCards)));
	const sampleInfection = $derived(known(Object.values(campaign.infectionCards)));

	/** The game piece an unlock puts on the table, when it is one. */
	function piece(
		unlock: BriefedUnlock,
	):
		| { t: 'player'; card: PlayerCardData }
		| { t: 'infection'; card: InfectionCardData; copies: number }
		| { t: 'cubes'; count: number }
		| { t: 'action'; action: keyof typeof ACTION_ICON }
		| null {
		switch (unlock.t) {
			case 'cityImprovement':
				return samplePlayer
					? { t: 'player', card: { ...samplePlayer, improvement: unlock.improvement, search: [] } }
					: null;
			case 'infectionImprovement':
				return sampleInfection
					? { t: 'infection', card: { ...sampleInfection, improvement: unlock.improvement }, copies: 1 }
					: null;
			case 'event': {
				const card = Object.values(campaign.playerCards).find(
					card => card.kind === 'event' && card.event === unlock.event,
				);
				return card ? { t: 'player', card } : null;
			}
			case 'gather':
			case 'assemble': {
				const card = Object.values(campaign.infectionCards).find(card => card.kind === unlock.t);
				return card ? { t: 'infection', card, copies: unlock.cards } : null;
			}
			case 'stockpileBonus':
				return { t: 'cubes', count: unlock.amount };
			case 'action':
				return unlock.action in ACTION_ICON ? { t: 'action', action: unlock.action as keyof typeof ACTION_ICON } : null;
			default:
				return null;
		}
	}
</script>

<div class="briefing" class:passive {@attach feedback('Briefing', () => ({ briefing }))}>
	<h2>New this game</h2>
	<div class="sections">
		{#each sections as section, index (index)}
			{#if section.t === 'card'}
				<section class="card-text">
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
						{@const pieces = section.items.map(item => ({ ...item, piece: piece(item.unlock) }))}
						<ul class:pieces={pieces.some(item => item.piece && item.piece.t !== 'action')}>
							{#each pieces as item, index (index)}
								<li {@attach feedback('Unlock', () => item.unlock)}>
									{#if item.piece?.t === 'player'}
										<span class="piece"><PlayerCard card={item.piece.card} /></span>
									{:else if item.piece?.t === 'infection'}
										<span class="piece infection">
											<InfectionCard card={item.piece.card} />
											{#if item.piece.copies > 1}<b class="copies">×{item.piece.copies}</b>{/if}
										</span>
									{:else if item.piece?.t === 'cubes'}
										<span class="piece cubes" role="img" aria-label={`${item.piece.count} supply cubes`}>
											{#each { length: item.piece.count } as _, cube (cube)}<i></i>{/each}
										</span>
									{:else if item.piece?.t === 'action'}
										<ActionIcon action={item.piece.action} size="1.9rem" />
									{/if}
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

	.piece {
		--card-size: 0.6rem;
		position: relative;
		display: flex;
		flex: none;
	}

	.piece.infection {
		--card-size: 0.56rem;
	}

	.copies {
		align-self: flex-end;
		margin-left: 0.3rem;
		padding: 0 0.35rem;
		border-radius: 2px;
		background: var(--paper-ink);
		color: var(--paper);
		font-size: 0.8rem;
	}

	.cubes {
		flex-wrap: wrap;
		filter: drop-shadow(0 1px 0.5px rgb(20 12 4 / 0.6));
		width: 4.6rem;
		gap: 3px;
	}

	.cubes i {
		width: 0.8rem;
		height: 0.8rem;
		background: conic-gradient(from 30deg at 50% 35%, #b1a38a 0deg 120deg, #e0d5bb 120deg 240deg, #fff5dc 240deg);
		clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
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
