<script lang="ts">
	import { onGrid, pack, purchaseCost, reject } from '@repo/game';
	import type { CardId, Command, PublicState, Purchase } from '@repo/game';
	import { cityName, purchaseLabel } from './labels';

	type Props = { snap: PublicState; send: (command: Command) => void };

	let { snap, send }: Props = $props();

	const world = $derived(snap.world);
	const campaign = $derived(world.campaign);
	const upkeep = $derived(world.game!.upkeep!);

	type Offer = { group: string; text: string; purchase: Purchase };

	const offers = $derived.by(() => {
		const grid = onGrid(world);
		const all: Offer[] = [];
		for (const ability of campaign.abilitiesForSale) {
			const def = pack.abilities.find(candidate => candidate.id === ability)!;
			for (const character of Object.values(campaign.characters)) {
				const slot = character.slots.indexOf(null);
				if (slot >= 0)
					all.push({
						group: `${def.name} (${def.cost})`,
						text: def.text,
						purchase: { t: 'ability', ability, character: character.id, slot },
					});
			}
		}
		const seenCity = new Set<string>();
		for (const improvement of campaign.cityImprovementsForSale) {
			const def = pack.cityImprovements.find(candidate => candidate.id === improvement)!;
			for (const card of Object.values(campaign.playerCards)) {
				if (card.kind !== 'city' || seenCity.has(`${improvement}:${card.city}`)) continue;
				seenCity.add(`${improvement}:${card.city}`);
				all.push({
					group: `City card: ${def.name} (${def.cost})`,
					text: def.text,
					purchase: { t: 'cityImprovement', improvement, card: card.id },
				});
			}
		}
		const seenInfection = new Set<string>();
		for (const improvement of campaign.infectionImprovementsForSale) {
			const def = pack.infectionImprovements.find(candidate => candidate.id === improvement)!;
			for (const card of Object.values(campaign.infectionCards)) {
				if (card.kind !== 'city' || seenInfection.has(`${improvement}:${card.city}`)) continue;
				seenInfection.add(`${improvement}:${card.city}`);
				all.push({
					group: `Infection card: ${def.name} (${def.cost})`,
					text: def.text,
					purchase: { t: 'infectionImprovement', improvement, card: card.id as CardId },
				});
			}
		}
		for (const city of grid) {
			all.push({
				group: 'Population +1 (1)',
				text: 'Raise a location by one, up to 8.',
				purchase: { t: 'population', city, steps: 1 },
			});
			all.push({
				group: 'Restore a forsaken city (2)',
				text: 'Back to population 1. It stays infested.',
				purchase: { t: 'restore', city },
			});
			for (const structure of campaign.permanentForSale) {
				all.push({
					group: `Permanent ${structure === 'center' ? 'supply center' : structure} (${pack.numbers.costs.permanent[structure]})`,
					text: 'Standing at the start of every later game.',
					purchase: { t: 'permanent', structure, city },
				});
			}
		}
		return all.filter(offer => reject(world, 'upkeep', { type: 'PURCHASE', purchase: offer.purchase }) === null);
	});
	const groups = $derived([...new Set(offers.map(offer => offer.group))]);
	let group = $state('');
	$effect(() => {
		if (!groups.includes(group)) group = groups[0] ?? '';
	});
	const inGroup = $derived(offers.filter(offer => offer.group === group));
</script>

<div class="upkeep">
	<header>
		<h1>{world.game!.outcome?.won ? 'Victory' : 'Defeat'}</h1>
		<p>{world.game!.outcome?.reason}</p>
	</header>

	<section>
		<h2>Population</h2>
		<p class="changes">
			{#each upkeep.populationChanges as change (change.city)}
				<span class:up={change.delta > 0}>{cityName(change.city)} {change.delta > 0 ? '+' : ''}{change.delta}</span>
			{:else}
				<span class="none">No change</span>
			{/each}
		</p>
	</section>

	<section>
		<h2>
			Spend production units: {upkeep.units} left{campaign.freeAbilityUnits
				? `, plus ${campaign.freeAbilityUnits} free for abilities`
				: ''}
		</h2>
		{#if groups.length}
			<div class="shop">
				<select bind:value={group} data-testid="purchase-group">
					{#each groups as option (option)}<option>{option}</option>{/each}
				</select>
				<p>{inGroup[0]?.text}</p>
				<div class="targets">
					{#each inGroup as offer, index (index)}
						<button
							onclick={() => send({ type: 'PURCHASE', purchase: offer.purchase })}
							title={`${purchaseCost(offer.purchase)} units`}
						>
							{purchaseLabel(world, offer.purchase)}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<p class="none">Nothing left to buy.</p>
		{/if}
	</section>

	<button class="primary" onclick={() => send({ type: 'FINISH_UPKEEP' })} data-testid="finish-upkeep"
		>Done. Unspent units are lost.</button
	>
</div>

<style>
	.upkeep {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: min(44rem, 92vw);
		max-height: 100%;
		padding: 1.3rem 1.5rem;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: var(--panel);
		backdrop-filter: blur(14px);
		box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.5);
		overflow: auto;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
	}

	header p {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	h2 {
		margin: 0 0 0.4rem;
		color: var(--muted);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.changes,
	.targets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.75rem;
	}

	.changes span {
		padding: 0.1rem 0.45rem;
		border-radius: 0.3rem;
		background: rgb(255 107 107 / 0.16);
		color: var(--danger);
	}

	.changes span.up {
		background: rgb(125 252 192 / 0.14);
		color: var(--accent);
	}

	.none {
		color: var(--muted);
		font-size: 0.8rem;
	}

	.shop p {
		margin: 0.4rem 0;
		color: var(--muted);
		font-size: 0.75rem;
	}

	.targets {
		max-height: 9rem;
		overflow: auto;
	}

	select,
	button {
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		background: rgb(255 255 255 / 0.05);
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.targets button:hover {
		border-color: var(--accent);
	}

	.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #06120c;
		font-weight: 700;
	}
</style>
