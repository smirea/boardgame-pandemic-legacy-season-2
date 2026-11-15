<script lang="ts">
	import { pack } from '@repo/game';
	import type { Insights, PublicState } from '@repo/game';
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

	{#if game && info}
		<div class="track" title="Infection rate: cards flipped at the end of every turn">
			<span class="caption">Rate</span>
			{#each rates as rate, index (index)}
				<span class="pip" class:on={index === game.rateIndex} class:past={index < game.rateIndex}>{rate}</span>
			{/each}
		</div>

		<div class="track incidents" title="Incidents: the game is lost at 8">
			<span class="caption">Incidents</span>
			{#each { length: pack.numbers.incidentLimit } as _, index (index)}
				<span class="pip" class:on={index < game.incidents} class:last={index === pack.numbers.incidentLimit - 1}
				></span>
			{/each}
		</div>

		{#if info.playerDeck.cards > 0}
			<div
				class="stat"
				title="Player deck. Turns left before it runs out, and the chance the next draw holds an epidemic."
			>
				<span class="caption">Player deck</span>
				<strong data-testid="deck-count">{info.playerDeck.cards}</strong>
				<span>{info.playerDeck.turnsLeft} turns</span>
				<span class="warn" class:hot={info.playerDeck.epidemicNextDraw > 0.5}
					>epidemic {percent(info.playerDeck.epidemicNextDraw)}</span
				>
				<span>{info.playerDeck.epidemicsDrawn}/{info.playerDeck.epidemicsDrawn + info.playerDeck.epidemicsLeft}</span>
			</div>
		{/if}

		<div class="stat" title="Supply cubes left in the stockpile">
			<span class="caption">Stockpile</span>
			<strong>{game.stockpile}</strong>
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

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		height: 3rem;
		padding: 0 0.9rem;
		border-bottom: 1px solid var(--line);
		background: var(--panel-solid);
		font-size: 0.74rem;
		white-space: nowrap;
	}

	.month {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}

	.month strong {
		font-size: 0.95rem;
		letter-spacing: 0.01em;
	}

	.month span,
	.caption {
		color: var(--muted);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.spacer {
		flex: 1;
	}

	.track,
	.stat {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.stat {
		gap: 0.4rem;
	}

	.stat strong {
		font-size: 0.95rem;
	}

	.stat span:not(.caption) {
		color: var(--muted);
	}

	.stat .warn {
		color: var(--warn);
	}

	.stat .warn.hot {
		color: var(--danger);
	}

	.caption {
		margin-right: 0.25rem;
	}

	.pip {
		display: grid;
		place-items: center;
		width: 1.05rem;
		height: 1.05rem;
		border: 1px solid var(--line);
		border-radius: 50%;
		color: var(--muted);
		font-size: 0.6rem;
		font-weight: 700;
		transition: all 300ms ease;
	}

	.pip.past {
		opacity: 0.45;
	}

	.pip.on {
		border-color: var(--warn);
		background: var(--warn);
		color: #1a1300;
		transform: scale(1.15);
	}

	.incidents .pip {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 0.15rem;
	}

	.incidents .pip.on {
		border-color: #7be02a;
		background: #7be02a;
		transform: none;
	}

	.incidents .pip.last {
		border-color: var(--danger);
	}

	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.link {
		color: var(--accent);
	}

	.link.down {
		color: var(--warn);
	}

	button {
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 0.35rem;
		background: transparent;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	button:hover {
		border-color: var(--accent);
	}
</style>
