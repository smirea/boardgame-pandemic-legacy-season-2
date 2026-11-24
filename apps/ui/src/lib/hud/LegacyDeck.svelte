<script lang="ts">
	import CloseButton from './CloseButton.svelte';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack, sealKey } from '@repo/game';
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import LegacyCard from '#lib/cards/LegacyCard.svelte';
	import { MONTHS } from './labels.svelte.ts';
	import RichText from './RichText.svelte';

	type Props = { campaign: Campaign; onclose: () => void };

	let { campaign, onclose }: Props = $props();

	const deck = pack.legacyDeck;
	const read = $derived(deck.slice(0, campaign.legacyIndex));
	const next = $derived(deck[campaign.legacyIndex] ?? null);
	const left = $derived(deck.length - campaign.legacyIndex);
	const months = $derived(
		[...new Set(read.map(card => card.month))].map(month => ({
			month,
			name: month === 0 ? 'Prologue' : MONTHS[month],
			cards: read.filter(card => card.month === month),
		})),
	);

	/** When the next card is read, from the STOP or PAUSE on its back. */
	const when = $derived.by(() => {
		const halt = campaign.legacyHalt;
		if (!next) return 'The deck is finished.';
		if (!halt || halt.kind === 'stop')
			return `Read at setup of the first game in ${MONTHS[(halt?.month ?? 0) + 1] ?? 'the next month'}.`;
		if (halt.kind === 'pause') return `Read at the end of the first game in ${MONTHS[halt.month]}.`;
		return 'Read when December is won, or when its second game is lost.';
	});

	const KIND: Record<LegacyCardDef['kind'], string> = {
		prologue: 'Prologue',
		stop: 'Stop',
		pause: 'Pause',
		archive: 'Journal',
		priorities: 'Priorities',
		objective: 'Objective',
		turningPoint: 'Turning point',
		event: 'Rationed Event',
		epidemic: 'Epidemic',
		scanner: 'Scanner',
		plan: 'The Plan',
		ending: 'Ending',
		reckoning: 'Scoring',
		end: 'End',
	};

	/** Where the card is now, as the box would have it. */
	function status(card: LegacyCardDef): string {
		if (card.when && (card.when === 'delivered') !== campaign.sampleDelivered) return 'Not this ending';
		for (const unlock of card.unlocks) {
			if (unlock.t === 'objectives' && unlock.add?.length)
				return unlock.add.every(id => campaign.objectives.includes(id)) ? 'In the objective pool' : 'Destroyed';
			if (unlock.t === 'turningPoint')
				return campaign.turningPoints.includes(unlock.id) ? 'In the Game End area' : 'Resolved and destroyed';
			if (unlock.t === 'perimeter')
				return campaign.forced.includes(sealKey(unlock.seal))
					? `Box scratched: ${unlock.seal.t === 'package' ? 'Package' : 'door'} ${unlock.seal.id} forced open`
					: 'Already explored, nothing forced';
			if (unlock.t === 'event') return 'In the reserve';
			if (unlock.t === 'epidemicCard') return 'In the box';
		}
		if (card.kind === 'prologue') return campaign.month === 0 ? 'In play' : 'Destroyed';
		if (card.kind === 'objective') return campaign.objectives.includes('prologueCenters') ? 'In play' : 'Destroyed';
		if (card.kind === 'archive' || card.kind === 'scanner') return 'In the reserve';
		if (card.kind === 'plan') return campaign.objectives.includes('plan') ? 'In play' : 'Destroyed';
		if (card.kind === 'stop' || card.kind === 'pause' || card.kind === 'priorities') return 'Read and set aside';
		return 'Read';
	}

	const frequencies = pack.frequencyLabels;
	const PLAN = ['red', 'black', 'yellow', 'blue'] as const;
</script>

<section
	class="deck"
	aria-label="The Legacy deck"
	{@attach feedback('Legacy deck', () => ({ read: campaign.legacyIndex, left, next: next?.id }))}
>
	<header>
		<h2>Legacy deck</h2>
		<p class="tally">{read.length} read, {left} still in the deck</p>
		<CloseButton label="Close the Legacy deck" onclick={onclose} />
	</header>

	<div class="top">
		{#if next}
			<span class="back-wrap">
				<LegacyCard card={next} side="a" size="thumb" {campaign} />
			</span>
		{/if}
		<div>
			<h3>Top of the deck</h3>
			<p>{when}</p>
			<p class="hint">Hold O to see the printed original. Unread cards stay face down.</p>
		</div>
	</div>

	<div class="months">
		{#each months as group (group.month)}
			<section class="month" aria-label={group.name}>
				<h3>{group.name}</h3>
				<ol>
					{#each group.cards as card (card.id)}
						<li>
							<button
								class="card"
								class:muted={status(card) === 'Not this ending' || status(card).startsWith('Destroyed')}
								aria-label={`${card.id} ${card.title}: ${status(card)}`}
							>
								<span class="code">{card.id}</span>
								<span class="kind">{KIND[card.kind]}</span>
								<strong>{card.title}</strong>
								<span class="text"><RichText text={card.text} /></span>
								{#if card.kind === 'scanner'}
									<span class="boxes" aria-label="Frequencies scratched">
										{#each frequencies as label, index (label)}
											<i class:on={campaign.frequenciesUsed.includes(index)}>{label}</i>
										{/each}
									</span>
								{:else if card.kind === 'plan'}
									<span class="boxes" aria-label="Plan recons done">
										{#each PLAN as color (color)}
											<i class:on={campaign.planRecons.includes(`hidden:plan-${color}`)}>{color}</i>
										{/each}
									</span>
								{/if}
								<span class="status">{status(card)}</span>
							</button>
						</li>
					{/each}
				</ol>
			</section>
		{/each}
	</div>
</section>

<style>
	.deck {
		display: flex;
		flex-direction: column;
		width: min(72rem, 100%);
		max-height: 100%;
		box-sizing: border-box;
		padding: 1.2rem 1.6rem 1rem;
		overflow: auto;
		border-radius: 2px;
		background: var(--document);
		color: var(--paper-ink);
		box-shadow: var(--document-shadow);
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 1.2rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.9rem;
		font-weight: 400;
	}

	h3 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 400;
	}

	.tally,
	.hint {
		margin: 0;
		color: var(--paper-muted);
	}

	.top {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin: 0.6rem 0 1rem;
	}

	.top p {
		margin: 0 0 0.2rem;
	}

	.back-wrap {
		display: inline-flex;
		border-radius: 5px;
		box-shadow:
			2px 2px 0 #b9ab8e,
			4px 4px 0 #a99a7c,
			0 0.5rem 1rem rgb(0 0 0 / 0.3);
	}

	.months {
		display: grid;
		gap: 0.9rem;
	}

	ol {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		width: 100%;
		height: 100%;
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--slip-line);
		border-radius: 4px;
		background: var(--slip);
		color: var(--slip-ink);
		font: inherit;
		font-size: 0.78rem;
		text-align: left;
		cursor: default;
	}

	.card:hover,
	.card:focus-visible {
		border-color: var(--paper-ink);
	}

	.card.muted {
		opacity: 0.55;
	}

	.code {
		font-variant-numeric: tabular-nums;
		color: var(--slip-muted);
	}

	.kind {
		float: right;
		margin-top: -1.1rem;
		align-self: flex-end;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--slip-muted);
	}

	strong {
		font-size: 0.9rem;
	}

	.text {
		color: var(--slip-muted);
	}

	.status {
		margin-top: auto;
		padding-top: 0.2rem;
		font-weight: 600;
	}

	.boxes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		margin-top: 0.2rem;
	}

	.boxes i {
		padding: 0 0.25rem;
		border: 1px solid var(--slip-line);
		border-radius: 2px;
		font-style: normal;
		font-size: 0.68rem;
	}

	.boxes i.on {
		background: var(--paper-ink);
		color: var(--slip);
		text-decoration: line-through;
	}
</style>
