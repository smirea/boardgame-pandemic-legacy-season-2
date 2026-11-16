<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { Insights, PublicState } from '@repo/game';
	import { fly } from 'svelte/transition';
	import { MONTHS } from './labels.svelte.ts';

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
</script>

<div
	class="frame"
	{@attach feedback(undefined, () => ({ status, players, solo, month: campaign.month, phase: snap.phase }))}
>
	<header class="bar">
		<div class="month">
			<strong>{MONTHS[campaign.month] ?? 'Campaign over'}</strong>
			<span
				>{campaign.month > 0 && campaign.month <= 12
					? campaign.attempt === 1
						? 'early attempt'
						: 'late attempt'
					: ''}</span
			>
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
					<div class="stat" title="Cards left in the Player deck" data-deck="player">
						<span class="caption">Player deck</span>
						{#key info.playerDeck.cards}<strong data-testid="deck-count" in:fly={{ y: -10, duration: 280 }}
								>{info.playerDeck.cards}</strong
							>{/key}
					</div>
					<div class="stat minor" title="Turns left before the Player deck runs out">
						<span class="caption">Turns left</span>
						{#key info.playerDeck.turnsLeft}<strong in:fly={{ y: -10, duration: 280 }}
								>{info.playerDeck.turnsLeft}</strong
							>{/key}
					</div>
					<div class="stat" title="Chance that the next Player card drawn is an Epidemic">
						<span class="caption">Epidemic next draw</span>
						<strong class="warn" class:hot={info.playerDeck.epidemicNextDraw > 0.5}
							>{percent(info.playerDeck.epidemicNextDraw)}</strong
						>
					</div>
					<div class="stat" title="Epidemics drawn so far, out of all in the deck">
						<span class="caption">Epidemics</span>
						<strong
							>{info.playerDeck.epidemicsDrawn}/{info.playerDeck.epidemicsDrawn + info.playerDeck.epidemicsLeft}</strong
						>
					</div>
				{/if}

				<div class="stat" title="Supply cubes left in the stockpile">
					<span class="caption">Stockpile</span>
					{#key game.stockpile}<strong in:fly={{ y: -10, duration: 280 }}>{game.stockpile}</strong>{/key}
				</div>
			{/if}
		</div>
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
	.frame {
		container: topbar / inline-size;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		height: 3rem;
		padding: 0 0.9rem;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	/* The bar shares its width with the replay's side panel, so secondary figures give way first. */
	@container topbar (width < 1560px) {
		.month span,
		.minor {
			display: none;
		}
	}

	@container topbar (width < 1300px) {
		.track .caption {
			display: none;
		}
	}

	@container topbar (width < 1150px) {
		.stats .stat:nth-last-child(2) {
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
		align-items: baseline;
		gap: 0.55rem;
	}

	.month strong {
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-weight: 400;
		line-height: 1;
	}

	.month span,
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
