<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { hollowInPlay, pack } from '@repo/game';
	import { fade } from 'svelte/transition';
	import LegacyCard from '#lib/cards/LegacyCard.svelte';
	import type { CityId, Insights, PublicState } from '@repo/game';
	import type { CitySpot } from '#lib/board/types.ts';
	import AtRisk from './AtRisk.svelte';
	import AudioMenu from '#lib/audio/AudioMenu.svelte';
	import Calendar from './Calendar.svelte';
	import CampaignStatus from './CampaignStatus.svelte';
	import Decks from './Decks.svelte';
	import FrequencyScanner from './FrequencyScanner.svelte';
	import HollowSupply from './HollowSupply.svelte';
	import { MONTHS } from './labels.svelte.ts';
	import StorageDeck from './StorageDeck.svelte';

	type Props = {
		snap: PublicState;
		info: Insights | null;
		status: string;
		players: number;
		solo: boolean;
		/** True while the Legacy deck is lifted out onto the table during an interactive briefing. */
		legacyOut?: boolean;
		canMonitor?: boolean;
		monitorReason?: string | null;
		hasDrawings?: boolean;
		/** Whether any of the strokes on the map are this player's, which is all Erase mine takes off. */
		hasOwnDrawings?: boolean;
		erasing?: boolean;
		oneraser?: () => void;
		onclear?: () => void;
		onreset: () => void;
		/** Shown while something covers the board: lifts it off to see the board, and puts it back. */
		peek?: { on: boolean; toggle: () => void } | null;
		onmenu: () => void;
		onbox: () => void;
		ondeck: () => void;
		onscanner?: () => void;
		/** Cities on the board a counter points at while the pointer rests on it. */
		onspot?: (spots: ReadonlyMap<CityId, CitySpot> | null) => void;
	};

	let {
		snap,
		info,
		status,
		players,
		solo,
		legacyOut = false,
		canMonitor = false,
		monitorReason = null,
		hasDrawings = false,
		hasOwnDrawings = false,
		erasing = false,
		oneraser,
		onclear,
		onreset,
		peek = null,
		onmenu,
		onbox,
		ondeck,
		onscanner,
		onspot,
	}: Props = $props();

	const campaign = $derived(snap.world.campaign);
	const game = $derived(snap.world.game);
	const dealt = $derived(!snap.phase.startsWith('setup'));
	const nextLegacy = $derived(pack.legacyDeck[campaign.legacyIndex]);
	const legacyLeft = $derived(pack.legacyDeck.length - campaign.legacyIndex);
	const hasStorage = $derived(campaign.rules.includes('storage'));
	const hasScanner = $derived(campaign.actions.includes('monitor'));
	const hasHollow = $derived(game !== null && hollowInPlay(campaign));
	let legacyPeek = $state(false);
</script>

<div
	class="frame"
	{@attach feedback(undefined, () => ({ status, players, solo, month: campaign.month, phase: snap.phase }))}
>
	<header class="bar">
		<div class="month">
			{#if !MONTHS[campaign.month]}<strong>Campaign over</strong>{/if}
			<Calendar {campaign} />
		</div>
		<CampaignStatus world={snap.world} onopen={onbox} />
		{#if hasStorage}
			<StorageDeck {campaign} onopen={onbox} />
		{/if}
		{#if hasScanner}
			<FrequencyScanner {campaign} {canMonitor} {monitorReason} onopen={onscanner} />
		{/if}
		{#if hasHollow}
			<HollowSupply world={snap.world} {onspot} />
		{/if}
		{#if game && info && dealt}
			<AtRisk infection={info.infection} {onspot} />
		{/if}
		<div class="stats">
			<div class="deck-strip">
				{#if game && info}
					<Decks {info} world={snap.world} {dealt} />
				{/if}

				<div class="legacy-wrap">
					<button
						class="legacy"
						class:out={legacyOut}
						onclick={() => {
							legacyPeek = false;
							ondeck();
						}}
						aria-label={`Legacy deck, ${legacyLeft} cards left`}
						aria-expanded={legacyPeek}
						data-testid="open-legacy-deck"
						data-dest="legacyDeck"
						onpointerenter={() => (legacyPeek = true)}
						onpointerleave={() => (legacyPeek = false)}
						onfocus={() => (legacyPeek = true)}
						onblur={() => (legacyPeek = false)}
					>
						{#if nextLegacy}<LegacyCard card={nextLegacy} side="a" size="mini" />{/if}
						<span>{legacyLeft}</span>
					</button>
					{#if legacyPeek && nextLegacy && !legacyOut}
						<div class="legacy-tip" role="tooltip" data-testid="legacy-deck-tip" transition:fade={{ duration: 140 }}>
							<LegacyCard card={nextLegacy} side="a" size="full" {campaign} />
							<span class="legacy-tip-note">{legacyLeft} cards left · click to open</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
		<div class="right">
			{#if hasDrawings}
				<div
					class="draw-tools"
					transition:fade={{ duration: 140 }}
					{@attach feedback('Drawing tools', () => ({ erasing }))}
				>
					<button
						type="button"
						class="tool-btn"
						class:active={erasing}
						onclick={oneraser}
						aria-pressed={erasing}
						data-testid="draw-eraser"
					>
						<svg viewBox="0 0 16 16" aria-hidden="true">
							<path d="M9.6 2.4 14 6.8l-6.2 6.2H3.6L1.8 11.2a1.4 1.4 0 0 1 0-2Z" />
							<path d="M6.4 5.6 10.8 10" />
							<path d="M7.8 13H14.5" />
						</svg>
						Eraser
					</button>
					{#if hasOwnDrawings}
						<button type="button" class="tool-btn clear" onclick={onclear} data-testid="draw-clear">
							<svg viewBox="0 0 16 16" aria-hidden="true">
								<path d="M2.5 4h11M5.5 4V2.5h5V4M4 4l.8 9.5h6.4L12 4" />
							</svg>
							Erase mine
						</button>
					{/if}
				</div>
			{/if}
			{#if !solo}
				<span class="link" class:down={status !== 'connected'}
					>{status === 'connected' ? `${Math.max(1, players)} online` : status}</span
				>
			{/if}
			{#if peek}
				<button
					class="peek"
					class:on={peek.on}
					aria-pressed={peek.on}
					onclick={peek.toggle}
					data-testid="show-board"
					transition:fade={{ duration: 160 }}
				>
					<svg viewBox="0 0 16 16" aria-hidden="true"
						><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" /><circle
							cx="8"
							cy="8"
							r="2"
						/></svg
					>
					{peek.on ? 'Back' : 'Show board'}
				</button>
			{/if}
			<AudioMenu />
			<button onclick={onreset}>Fit map</button>
			<button onclick={onbox} data-testid="open-box" data-dest="box">Box</button>
			<button onclick={onmenu}>Menu</button>
		</div>
	</header>
</div>

<style>
	.deck-strip {
		display: inline-flex;
		align-items: center;
		gap: 0.9rem;
	}

	.legacy-wrap {
		position: relative;
		display: inline-flex;
	}

	.legacy {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0.25rem;
		border: 0;
		background: transparent;
	}

	.legacy:hover {
		border-color: transparent;
	}

	.legacy-tip {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem;
		border-radius: 6px;
		background: rgb(20 18 14 / 0.94);
		box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 0.6);
		pointer-events: none;
		white-space: normal;
	}

	.legacy-tip-note {
		color: var(--muted);
		font-size: 0.72rem;
		letter-spacing: 0.03em;
	}

	.legacy.out {
		visibility: hidden;
		pointer-events: none;
	}

	.legacy :global(.legacy-card) {
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

	@container topbar (width < 1000px) {
		.bar {
			gap: 0.8rem;
		}
	}

	/* Takes the room the rest of the bar leaves, so the bar's other parts keep their places. */
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

	.stats {
		display: flex;
		align-items: center;
		gap: 1.4rem;
		flex: none;
		line-height: 1;
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

	.peek {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.peek.on {
		border-color: var(--warn);
		background: var(--warn);
		color: #1c140a;
	}

	.peek svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
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

	.draw-tools {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding-right: 0.45rem;
		border-right: 1px solid var(--line);
	}

	.tool-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		padding: 0.25rem 0.6rem;
	}

	.tool-btn svg {
		width: 0.85rem;
		height: 0.85rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.tool-btn.active {
		border-color: var(--paper);
		background: var(--paper);
		color: var(--paper-ink);
		font-weight: 600;
	}

	.tool-btn.clear:hover {
		border-color: var(--danger);
		color: var(--danger);
	}
</style>
