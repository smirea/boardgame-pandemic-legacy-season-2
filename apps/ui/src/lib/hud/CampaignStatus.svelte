<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { breakthrough, pack } from '@repo/game';
	import type { TurningPointId, World } from '@repo/game';
	import RichText from './RichText.svelte';
	import TopTip from './TopTip.svelte';

	type Props = {
		world: World;
		onopen?: () => void;
	};

	let { world, onopen }: Props = $props();

	const campaign = $derived(world.campaign);
	const game = $derived(world.game);

	const BREAKTHROUGH_INFO = [
		{
			id: 'opal' as const,
			name: 'Opal Lab',
			city: 'Buenos Aires',
			text: 'Make Supplies at a haven or supply center takes +1 cube.',
		},
		{
			id: 'jade' as const,
			name: 'Jade Lab',
			city: 'Johannesburg',
			text: 'Epidemics remove only 1 cube from the city they strike.',
		},
		{
			id: 'topaz' as const,
			name: 'Topaz Lab',
			city: 'Wellington',
			text: 'When a city would lose a cube to infection, any player may discard a matching City card to keep it.',
		},
	];

	const TURNING_POINT_INFO: Record<TurningPointId, { title: string; text: string }> = {
		firstForsaken: {
			title: 'Forsaken Cities',
			text: 'At Game End, if any revealed city is at population 0, open doors A and 12.',
		},
		losingStreak: {
			title: 'Give Us the Tools',
			text: 'After 4 games lost in a row, up to 10 extra reserve cubes join the stockpile for 3 games.',
		},
		defection: {
			title: 'Hollow Men Have Defected',
			text: 'At Game End, with a Hollow Man on 3 different havens, open door 17.',
		},
	};

	const activeBreakthroughs = $derived(BREAKTHROUGH_INFO.filter(entry => breakthrough(campaign, entry.id)));
	const hasCarrier = $derived(campaign.rules.includes('carrier'));
	const dosesLeft = $derived(Math.max(0, pack.numbers.selfInfectDoses - campaign.dosesUsed));
	const carrierName = $derived.by(() => {
		if (!game) return null;
		const holder = game.seats
			.map(seat => campaign.characters[game.players[seat]!.character])
			.find(character => character?.carrier);
		return holder?.name ?? null;
	});
	const turningPoints = $derived(campaign.turningPoints.map(id => ({ id, ...TURNING_POINT_INFO[id] })));
	const reliefGames = $derived(campaign.losingStreakBonusGames);

	const count = $derived(
		activeBreakthroughs.length + turningPoints.length + (hasCarrier ? 1 : 0) + (reliefGames > 0 ? 1 : 0),
	);
</script>

{#if count > 0}
	<TopTip
		name="campaign-status"
		testid="campaign-status"
		dest="campaignStatus"
		label={`Active campaign effects: ${count}`}
		title="Active campaign effects"
		width="23rem"
		{onopen}
		{@attach feedback('Campaign rules & turning points', () => ({
			breakthroughs: activeBreakthroughs.map(entry => entry.id),
			turningPoints: campaign.turningPoints,
			hasCarrier,
			dosesLeft,
			reliefGames,
		}))}
	>
		{#snippet counter()}
			<span class="badge-icon" aria-hidden="true">
				<svg viewBox="0 0 16 16">
					<path d="M5.5 2h5M6.5 2v4L3.2 12.6A1.1 1.1 0 0 0 4.2 14h7.6a1.1 1.1 0 0 0 1-1.4L9.5 6V2" />
					<path d="M5 10.5h6" />
				</svg>
			</span>
			<strong>{count}</strong>
		{/snippet}

		{#if activeBreakthroughs.length}
			<section>
				<h4>Lab breakthroughs</h4>
				<ul>
					{#each activeBreakthroughs as lab (lab.id)}
						<li>
							<b>{lab.name}</b> <span class="where">({lab.city})</span> — <RichText text={lab.text} />
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if hasCarrier}
			<section>
				<h4>Pearl Lab sample <b>{dosesLeft}/{pack.numbers.selfInfectDoses} doses</b></h4>
				<p>
					{#if carrierName}
						Carried by <b>{carrierName}</b>. Deliver to a supply center in Johannesburg.
					{:else if dosesLeft > 0}
						Take the sample at Lake Baikal ({dosesLeft} dose{dosesLeft === 1 ? '' : 's'} remaining).
					{:else}
						No doses remaining.
					{/if}
				</p>
			</section>
		{/if}

		{#if turningPoints.length}
			<section>
				<h4>Turning points</h4>
				<ul>
					{#each turningPoints as point (point.id)}
						<li><b>{point.title}</b> — <RichText text={point.text} /></li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if reliefGames > 0}
			<section>
				<h4>Relief supply <b>{reliefGames} game{reliefGames === 1 ? '' : 's'} left</b></h4>
				<p>Up to 10 extra reserve cubes join the stockpile at setup.</p>
			</section>
		{/if}
	</TopTip>
{/if}

<style>
	.badge-icon {
		display: inline-grid;
		place-items: center;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid #48697c;
		border-radius: 2px;
		background: linear-gradient(170deg, #273e4c, #182730);
		color: #a8d7ec;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.45);
	}

	.badge-icon svg {
		width: 0.85rem;
		height: 0.85rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	section {
		padding-top: 0.35rem;
		border-top: 1px solid var(--slip-line);
	}

	section:first-of-type {
		padding-top: 0;
		border-top: 0;
	}

	h4 {
		display: flex;
		justify-content: space-between;
		margin: 0 0 0.18rem;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--slip-muted);
	}

	h4 b {
		color: var(--slip-ink);
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
		margin: 0;
		padding-left: 1rem;
	}

	.where {
		color: var(--slip-muted);
	}

	p {
		margin: 0;
	}
</style>
