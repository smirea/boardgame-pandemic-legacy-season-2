<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { Insights, PlayerDeckKind, PublicState } from '@repo/game';
	import { fade, fly } from 'svelte/transition';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { inkOn } from '#lib/color.ts';
	import Calendar from './Calendar.svelte';
	import { MONTHS } from './labels.svelte.ts';
	import { GLYPH, KIND_COLOR } from './PlayerCard.svelte';

	type Props = {
		snap: PublicState;
		info: Insights | null;
		status: string;
		players: number;
		solo: boolean;
		onreset: () => void;
		onmenu: () => void;
	};

	let { snap, info, status, players, solo, onreset, onmenu }: Props = $props();

	const campaign = $derived(snap.world.campaign);
	const game = $derived(snap.world.game);
	const rates = pack.numbers.infectionRates;
	const percent = (value: number) => `${Math.round(value * 100)}%`;

	const KINDS: { kind: PlayerDeckKind; name: string; color: string; glyph?: string }[] = [
		{ kind: 'blue', name: 'Blue cities', color: CITY_COLOR.blue },
		{ kind: 'yellow', name: 'Yellow cities', color: CITY_COLOR.yellow },
		{ kind: 'black', name: 'Black cities', color: CITY_COLOR.black },
		{ kind: 'red', name: 'Red cities', color: CITY_COLOR.red },
		{ kind: 'haven', name: 'Havens', color: CITY_COLOR.haven },
		{ kind: 'event', name: 'Events', color: KIND_COLOR.event, glyph: GLYPH.event },
		{ kind: 'produce', name: 'Produce Supplies', color: KIND_COLOR.produce, glyph: GLYPH.produce },
		{ kind: 'companion', name: 'Companions', color: KIND_COLOR.companion, glyph: GLYPH.companion },
		{ kind: 'epidemic', name: 'Epidemics', color: KIND_COLOR.epidemic, glyph: GLYPH.epidemic },
	];
	const deckKinds = $derived(
		info
			? KINDS.flatMap(entry =>
					info.playerDeck.byKind[entry.kind] ? [{ ...entry, count: info.playerDeck.byKind[entry.kind]! }] : [],
				)
			: [],
	);

	// The figures clip their overflow, so the deck's slip hangs from the bar instead and is placed under the figure.
	let bar = $state<HTMLElement>();
	let deckTip = $state<number | null>(null);
	const showDeck = (event: PointerEvent) => {
		const at = (event.currentTarget as HTMLElement).getBoundingClientRect();
		deckTip = at.left - bar!.getBoundingClientRect().left;
	};
</script>

{#snippet cardIcon(color: string, glyph?: string)}
	<span class="card-icon" style:--band={color} style:--on={inkOn(color)} aria-hidden="true">{glyph ?? ''}</span>
{/snippet}

<div
	class="frame"
	{@attach feedback(undefined, () => ({ status, players, solo, month: campaign.month, phase: snap.phase }))}
>
	<header class="bar" bind:this={bar}>
		<div class="month">
			{#if !MONTHS[campaign.month]}<strong>Campaign over</strong>{/if}
			<Calendar {campaign} />
		</div>

		<div class="spacer"></div>
		<div class="stats">
			{#if game && info}
				<div class="track" title="Infection rate: cards flipped at the end of every turn">
					<span class="caption">Infection rate</span>
					{#each rates as rate, index (index)}
						<span class="pip" class:on={index === game.rateIndex} class:past={index < game.rateIndex}>{rate}</span>
					{/each}
				</div>

				{#if info.playerDeck.cards > 0}
					<div
						class="stat deck"
						data-deck="player"
						aria-label={`Player deck: ${info.playerDeck.cards} cards`}
						onpointerenter={showDeck}
						onpointerleave={() => (deckTip = null)}
						{@attach feedback('Player deck', () => ({
							cards: info?.playerDeck.cards,
							byKind: info?.playerDeck.byKind,
						}))}
					>
						{@render cardIcon('#5d5446')}
						{#key info.playerDeck.cards}<strong data-testid="deck-count" in:fly={{ y: -10, duration: 280 }}
								>{info.playerDeck.cards}</strong
							>{/key}
					</div>
					<div class="stat" title="Chance that the next Player card drawn is an Epidemic">
						<span class="caption">Epidemic next draw</span>
						<strong class="warn" class:hot={info.playerDeck.epidemicNextDraw > 0.5}
							>{percent(info.playerDeck.epidemicNextDraw)}</strong
						>
					</div>
				{/if}
			{/if}
		</div>
		{#if deckTip !== null && info}
			<div
				class="deck-tip"
				style:left={`${deckTip}px`}
				role="tooltip"
				data-testid="deck-tip"
				transition:fade={{ duration: 140 }}
			>
				<strong>Player deck, {info.playerDeck.cards} cards</strong>
				<ul>
					{#each deckKinds as entry (entry.kind)}
						<li data-kind={entry.kind}>
							{@render cardIcon(entry.color, entry.glyph)}<span>{entry.name}</span><b>{entry.count}</b>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		<div class="right">
			{#if !solo}
				<span class="link" class:down={status !== 'connected'} title="Connection to the host"
					>{status === 'connected' ? `${Math.max(1, players)} online` : status}</span
				>
			{/if}
			<button onclick={onreset} title="Show the whole map">Fit map</button>
			<button onclick={onmenu}>Menu</button>
		</div>
	</header>
</div>

<style>
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

	@container topbar (width < 1300px) {
		.track .caption {
			display: none;
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

	.month {
		display: flex;
		align-items: center;
		gap: 0.7rem;
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

	.spacer {
		flex: 1;
	}

	/* The figures give way before the controls: Fit map and Menu always stay on screen. */
	/* Figures that do not fit wrap onto a second line that is never shown, so none is ever cut in half. */
	.stats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		align-content: flex-start;
		column-gap: 1.1rem;
		height: 1.7rem;
		min-width: 0;
		overflow: hidden;
	}

	.stats > * {
		flex: none;
	}

	.track,
	.stat {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.stat {
		gap: 0.45rem;
	}

	.stat + .stat {
		margin-left: -0.5rem;
		padding-left: 0.8rem;
		border-left: 1px solid var(--line);
	}

	.stat strong,
	.track strong {
		font-size: 1.05rem;
		font-weight: 600;
	}

	.track strong {
		margin-left: 0.4rem;
	}

	.track strong.hot,
	.stat .warn.hot {
		color: var(--danger);
	}

	.stat .warn {
		color: var(--warn);
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

	.deck {
		cursor: default;
	}

	.card-icon {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 0.8rem;
		height: 1.1rem;
		border: 1px solid color-mix(in srgb, var(--band) 55%, #000);
		border-radius: 2px;
		background: linear-gradient(172deg, var(--band), color-mix(in srgb, var(--band) 80%, #140c06));
		box-shadow: inset 0 0 0 1.5px rgb(255 248 228 / 0.16);
		color: var(--on);
		font-size: 0.58rem;
		line-height: 1;
	}

	.deck .card-icon {
		box-shadow:
			inset 0 0 0 1.5px rgb(255 248 228 / 0.16),
			2px -2px 0 -1px #3a332a,
			2px -2px 0 0 var(--line-strong);
	}

	.deck-tip {
		position: absolute;
		top: calc(100% + 0.2rem);
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.4rem 0.65rem 0.5rem;
		border-radius: 2px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.78rem;
		pointer-events: none;
	}

	.deck-tip strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
	}

	.deck-tip ul {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.2rem 0.45rem;
		align-items: center;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.deck-tip li {
		display: contents;
	}

	.deck-tip b {
		font-weight: 700;
		text-align: right;
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
