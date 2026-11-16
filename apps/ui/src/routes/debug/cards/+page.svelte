<script lang="ts">
	import { createGameActor, pack } from '@repo/game';
	import type { InfectionCard as InfectionCardData, PlayerCard as PlayerCardData } from '@repo/game';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import PlayerCard from '#lib/hud/PlayerCard.svelte';

	// Every card comes from a fresh campaign, so this page shows exactly what the generator produces.
	const campaign = createGameActor({ seed: 1 }).getSnapshot().context.world.campaign;
	const firstPerCity = <T extends { kind: string }>(cards: T[]) => {
		const seen = new Set<string>();
		return cards.filter(card => {
			const key =
				'city' in card
					? `${card.kind}:${String(card.city)}`
					: `${card.kind}:${'event' in card ? String(card.event) : ''}`;
			return !seen.has(key) && Boolean(seen.add(key));
		});
	};
	const playerCards = firstPerCity(Object.values(campaign.playerCards)) as PlayerCardData[];
	const infectionCards = firstPerCity(Object.values(campaign.infectionCards)) as InfectionCardData[];
	const extras: PlayerCardData[] = [
		...pack.companions.map((companion, index) => ({
			id: `c${index}` as never,
			kind: 'companion' as const,
			companion: companion.id,
		})),
		...pack.events.map((event, index) => ({
			id: `e${index}` as never,
			kind: 'event' as const,
			event: event.id,
			mode: 'unrationed' as const,
		})),
	];
	const hollow: InfectionCardData[] = [
		{ id: 'g' as never, kind: 'gather' },
		{ id: 'a' as never, kind: 'assemble' },
	];
	let size = $state(1);
</script>

<svelte:head>
	<title>Legacy: cards</title>
</svelte:head>

<main style:--card-size={`${size}rem`}>
	<header>
		<h1>Cards</h1>
		<label>Size <input type="range" min="0.6" max="1.6" step="0.05" bind:value={size} /></label>
		<span data-testid="counts"
			>{playerCards.length + extras.length} player, {infectionCards.length + hollow.length} infection</span
		>
	</header>
	<h2>Player cards</h2>
	<section data-testid="player-cards">
		{#each [...playerCards, ...extras] as card (card.id)}<PlayerCard {card} />{/each}
	</section>
	<h2>Infection cards</h2>
	<section data-testid="infection-cards">
		{#each [...infectionCards, ...hollow] as card (card.id)}<InfectionCard {card} />{/each}
	</section>
</main>

<style>
	main {
		min-height: 100vh;
		padding: 1.5rem 2rem 3rem;
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 1.5rem;
		color: var(--muted);
		font-size: 0.9rem;
	}

	header label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	input[type='range'] {
		accent-color: var(--paper);
	}

	h1 {
		margin: 0;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 2.2rem;
		font-weight: 400;
	}

	h2 {
		margin: 1.8rem 0 0.8rem;
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 400;
	}

	section {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
	}
</style>
