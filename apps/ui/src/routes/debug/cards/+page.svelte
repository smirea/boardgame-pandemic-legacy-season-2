<script lang="ts">
	import { createGameActor, pack } from '@repo/game';
	import type { InfectionCard as InfectionCardData, PlayerCard as PlayerCardData } from '@repo/game';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import LegacyCard from '#lib/cards/LegacyCard.svelte';
	import { EVENT_PRINT } from '#lib/cards/playerPrint.ts';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { playerCardScan, scanUrl } from '#lib/scans.svelte.ts';
	import PlayerCard, { HAND_CARD_SIZE } from '#lib/hud/PlayerCard.svelte';
	import type { CityCardCopies } from '#lib/hud/PlayerCard.svelte';

	// Every card comes from a fresh campaign, so this page shows exactly what the generator produces.
	const campaign = createGameActor({ seed: 1 }).getSnapshot().context.world.campaign;
	const firstPerCity = <T extends { kind: string }>(cards: T[]) => {
		const seen = new Set<string>();
		return cards.filter(card => {
			const key =
				'city' in card
					? `${card.kind}:${String(card.city)}`
					: card.kind === 'produce' && 'boxesLeft' in card
						? `produce:${String(card.boxesLeft)}`
						: `${card.kind}:${'event' in card ? String(card.event) : ''}`;
			return !seen.has(key) && Boolean(seen.add(key));
		});
	};
	const playerCards = firstPerCity(Object.values(campaign.playerCards)) as PlayerCardData[];
	const infectionCards = firstPerCity(Object.values(campaign.infectionCards)) as InfectionCardData[];
	const improvementCities = ['new-york', 'sao-paulo', 'cairo', 'ho-chi-minh-city'] as const;
	const extras: { card: PlayerCardData; copies?: CityCardCopies }[] = [
		...pack.cityImprovements.map((improvement, index) => ({
			card: {
				id: `i${index}` as never,
				kind: 'city' as const,
				city: improvementCities[index % improvementCities.length] as never,
				improvement: improvement.id,
				search: [],
				companion: null,
			},
		})),
		{
			card: {
				id: 'search-1' as never,
				kind: 'city' as const,
				city: 'chicago' as never,
				improvement: null,
				search: [{ scope: 'land' as const, result: { t: 'nothing' as const }, scratched: false }],
				companion: null,
			},
		},
		{
			card: {
				id: 'search-2' as never,
				kind: 'city' as const,
				city: 'new-mumbai' as never,
				improvement: null,
				search: [
					{ scope: 'land' as const, result: { t: 'nothing' as const }, scratched: false },
					{ scope: 'sea' as const, result: { t: 'nothing' as const }, scratched: false },
				],
				companion: null,
			},
			copies: { live: 1, discarded: 1, trashed: 0 },
		},
		{
			card: {
				id: 'search-2-upgrade' as never,
				kind: 'city' as const,
				city: 'new-mumbai' as never,
				improvement: 'double' as const,
				search: [
					{ scope: 'land' as const, result: { t: 'nothing' as const }, scratched: false },
					{ scope: 'sea' as const, result: { t: 'nothing' as const }, scratched: false },
				],
				companion: null,
			},
		},
		{
			card: {
				id: 'search-1-upgrade' as never,
				kind: 'city' as const,
				city: 'st-petersburg' as never,
				improvement: 'wild' as const,
				search: [
					{ scope: 'land' as const, result: { t: 'nothing' as const }, scratched: true },
					{ scope: 'sea' as const, result: { t: 'nothing' as const }, scratched: false },
				],
				companion: null,
			},
		},
		{
			card: {
				id: 'pips-mixed' as never,
				kind: 'city' as const,
				city: 'washington' as never,
				improvement: null,
				search: [],
				companion: null,
			},
			copies: { live: 2, discarded: 1, trashed: 1 },
		},
		{
			card: {
				id: 'pips-discarded' as never,
				kind: 'city' as const,
				city: 'dar-es-salaam' as never,
				improvement: null,
				search: [],
				companion: null,
			},
			copies: { live: 0, discarded: 1, trashed: 1 },
		},
		...pack.companions.map((companion, index) => ({
			card: {
				id: `c${index}` as never,
				kind: 'city' as const,
				city: 'cairo' as never,
				improvement: null,
				search: [],
				companion: companion.id,
			},
		})),
		{
			card: {
				id: 'ic-combo' as never,
				kind: 'city' as const,
				city: 'lima' as never,
				improvement: 'wild' as const,
				search: [
					{ scope: 'land' as const, result: { t: 'companion' as const, companion: 'medic' as const }, scratched: true },
					{ scope: 'sea' as const, result: { t: 'nothing' as const }, scratched: false },
				],
				companion: 'medic' as const,
			},
		},
		...pack.events.map((event, index) => ({
			card: {
				id: `e${index}` as never,
				kind: 'event' as const,
				event: event.id,
				mode: EVENT_PRINT[event.id].mode,
			},
		})),
	];
	const allPlayerItems = [...playerCards.map(card => ({ card, copies: undefined })), ...extras];
	const playerScanOf = (card: PlayerCardData): string | null => playerCardScan(card)?.card.src ?? null;
	const hollow: InfectionCardData[] = [
		...pack.infectionImprovements.map((improvement, index) => ({
			id: `inf-imp-${index}` as never,
			kind: 'city' as const,
			city: improvementCities[index % improvementCities.length] as never,
			improvement: improvement.id,
		})),
		{ id: 'g' as never, kind: 'gather' },
		{ id: 'a' as never, kind: 'assemble' },
	];
	let size = $state(HAND_CARD_SIZE);
	let legacySize = $state<'full' | 'deck'>('full');
	let comparePlayer = $state(false);
	let legacyFilter = $state('');
	const legacyCards = $derived(
		pack.legacyDeck.filter(card => !legacyFilter || `${card.id} ${card.kind} ${card.title}`.includes(legacyFilter)),
	);
</script>

<svelte:head>
	<title>Legacy: cards</title>
</svelte:head>

<main style:--card-size={`${size}rem`}>
	<header>
		<h1>Cards</h1>
		<label>Size <input type="range" min="0.6" max="1.6" step="0.01" bind:value={size} /> {size.toFixed(2)}rem</label>
		<label><input type="checkbox" bind:checked={comparePlayer} /> Compare player scans</label>
		<label>
			Legacy size
			<select bind:value={legacySize}>
				<option value="full">full</option>
				<option value="deck">deck</option>
			</select>
		</label>
		<span data-testid="counts"
			>{playerCards.length + extras.length} player, {infectionCards.length + hollow.length} infection</span
		>
	</header>
	<h2>Player cards</h2>
	<section class="player-grid" data-testid="player-cards">
		{#each allPlayerItems as item (item.card.id)}
			{@const scan = comparePlayer ? playerScanOf(item.card) : null}
			{#if scan}
				<div class="player-pair" data-player-card={item.card.id}>
					<PlayerCard card={item.card} copies={item.copies} />
					<img class="player-scan" src={scanUrl(scan)} alt={`${item.card.id} printed`} />
				</div>
			{:else}
				<PlayerCard card={item.card} copies={item.copies} />
			{/if}
		{/each}
	</section>
	<h2>Infection cards</h2>
	<section data-testid="infection-cards">
		{#each [...infectionCards, ...hollow] as card (card.id)}<InfectionCard {card} />{/each}
	</section>
	<h2>Legacy deck, generated beside the printed original</h2>
	<label class="filter">Filter <input bind:value={legacyFilter} placeholder="id, kind or title" /></label>
	{#each legacyCards as card (card.id)}
		<section class="legacy" data-legacy-row={card.id}>
			<LegacyCard {card} side="a" size={legacySize} {campaign} />
			{#if legacyScans[card.id]?.back}<img
					src={scanUrl(legacyScans[card.id]!.back!)}
					alt={`${card.id}a printed`}
				/>{/if}
			<LegacyCard {card} side="b" size={legacySize} {campaign} />
			<img src={scanUrl(legacyScans[card.id]!.src)} alt={`${card.id}b printed`} />
		</section>
	{/each}
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

	.filter {
		display: block;
		margin-bottom: 0.8rem;
	}

	.legacy {
		align-items: center;
		margin-bottom: 1.2rem;
	}

	.legacy img {
		max-width: 23.5rem;
		max-height: 20.4rem;
		border-radius: 7px;
	}

	section {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
	}

	.player-grid {
		align-items: flex-end;
	}

	.player-grid :global(.card[data-floating-upgrade]) {
		margin-top: 3.8em;
	}

	.player-pair {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.player-scan {
		height: calc(var(--card-size) * 10.6);
		width: auto;
		border-radius: 0.4em;
	}
</style>
