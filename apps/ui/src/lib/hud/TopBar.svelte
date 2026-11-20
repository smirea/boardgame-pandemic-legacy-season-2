<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import { scan, scanUrl } from '#lib/scans.svelte.ts';
	import { legacyScans } from '#lib/scans.generated.ts';
	import type { Insights, PublicState } from '@repo/game';
	import Calendar from './Calendar.svelte';
	import Decks from './Decks.svelte';
	import { MONTHS } from './labels.svelte.ts';

	type Props = {
		snap: PublicState;
		info: Insights | null;
		status: string;
		players: number;
		solo: boolean;
		onreset: () => void;
		onmenu: () => void;
		onbox: () => void;
		ondeck: () => void;
	};

	let { snap, info, status, players, solo, onreset, onmenu, onbox, ondeck }: Props = $props();

	const campaign = $derived(snap.world.campaign);
	const game = $derived(snap.world.game);
	const rates = pack.numbers.infectionRates;
	const dealt = $derived(!snap.phase.startsWith('setup'));
	/** The width left for the calendar once the rest of the bar has what it needs. */
	let room = $state(0);
	const nextLegacy = $derived(pack.legacyDeck[campaign.legacyIndex]);
	const legacyLeft = $derived(pack.legacyDeck.length - campaign.legacyIndex);
</script>

<div
	class="frame"
	{@attach feedback(undefined, () => ({ status, players, solo, month: campaign.month, phase: snap.phase }))}
>
	<header class="bar">
		<div class="month" bind:clientWidth={room}>
			{#if !MONTHS[campaign.month]}<strong>Campaign over</strong>{/if}
			<Calendar {campaign} {room} />
		</div>
		<div class="stats">
			{#if game && info}
				<div class="track" title="Infection rate: cards flipped at the end of every turn">
					<span class="caption">Infection rate</span>
					{#each rates as rate, index (index)}
						<span class="pip" class:on={index === game.rateIndex} class:past={index < game.rateIndex}>{rate}</span>
					{/each}
				</div>

				<Decks {info} {dealt} />
			{/if}
		</div>
		<div class="right">
			{#if !solo}
				<span class="link" class:down={status !== 'connected'} title="Connection to the host"
					>{status === 'connected' ? `${Math.max(1, players)} online` : status}</span
				>
			{/if}
			<button onclick={onreset} title="Show the whole map">Fit map</button>
			<button
				onclick={onbox}
				title="The packages and dossier doors opened so far"
				data-testid="open-box"
				data-dest="box">Box</button
			>
			<button onclick={onmenu}>Menu</button>
			<button
				class="legacy"
				onclick={ondeck}
				aria-label={`Legacy deck, ${legacyLeft} cards left`}
				title="The Legacy deck: the cards read so far, and when the next one is read"
				data-testid="open-legacy-deck"
				{@attach scan(
					() => (nextLegacy ? [{ title: 'Top of the Legacy deck', src: legacyScans[nextLegacy.id]!.back! }] : []),
					'legacy-pile',
				)}
			>
				{#if nextLegacy}<img src={scanUrl(legacyScans[nextLegacy.id]!.back!)} alt="" />{/if}
				<span>{legacyLeft}</span>
			</button>
		</div>
	</header>
</div>

<style>
	.legacy {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding-left: 0.3rem;
	}

	.legacy img {
		height: 1.9rem;
		border-radius: 2px;
		box-shadow:
			1px 1px 0 rgb(0 0 0 / 0.5),
			2px 2px 0 rgb(231 220 198 / 0.25);
	}

	.legacy span {
		font-variant-numeric: tabular-nums;
	}

	/* Above the seats and panels on the board, so the bar's slips hang over them. */
	.frame {
		position: relative;
		z-index: 55;
		container: topbar / inline-size;
	}

	.bar {
		position: relative;
		display: flex;
		align-items: center;
		gap: 1.1rem;
		height: 3rem;
		padding: 0 0.9rem;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	@container topbar (width < 1600px) {
		.track .caption {
			display: none;
		}
	}

	/* Too narrow for a single line: the rate track sits over the decks. */
	@container topbar (width < 1400px) {
		.bar .stats {
			flex-direction: column;
			align-items: flex-end;
			gap: 0.1rem;
		}

		.stats :global(.deck strong) {
			font-size: 0.9rem;
		}

		.stats :global(.deck) {
			padding: 0;
		}

		.stats :global(.deck .card-icon) {
			scale: 0.8;
		}

		.stats :global(.decks) {
			height: 1.2rem;
		}
	}

	@container topbar (width < 1000px) {
		.bar {
			gap: 0.8rem;
		}

		.pip {
			width: 0.95rem;
			height: 0.95rem;
		}
	}

	/* Takes the room the rest of the bar leaves, whatever the calendar holds, so the calendar can fold to fit it. */
	.month {
		display: flex;
		flex: 1 1 0;
		align-items: center;
		gap: 0.7rem;
		min-width: 0;
	}

	.month strong {
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-weight: 400;
		line-height: 1;
	}

	.caption {
		color: var(--muted);
		font-size: 0.82rem;
	}

	.stats {
		display: flex;
		align-items: center;
		gap: 1.4rem;
		flex: none;
		line-height: 1;
	}

	.track {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.caption {
		margin-right: 0.3rem;
	}

	.pip {
		display: grid;
		place-items: center;
		width: 1.1rem;
		height: 1.1rem;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 600;
		transition:
			background 300ms ease,
			color 300ms ease,
			transform 300ms cubic-bezier(0.3, 1.6, 0.5, 1);
	}

	.pip.past {
		opacity: 0.35;
	}

	.pip.on {
		border-color: var(--warn);
		background: var(--warn);
		color: var(--paper-ink);
		transform: scale(1.15);
	}

	.right {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex: none;
		margin-left: auto;
	}

	.link {
		color: var(--good);
	}

	.link.down {
		color: var(--warn);
	}

	button {
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
		transition: border-color 150ms ease;
	}

	button:hover {
		border-color: var(--line-strong);
	}
</style>
