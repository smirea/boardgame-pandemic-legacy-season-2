<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { keep } from './viewState.ts';
	import { onGrid, pack, reject } from '@repo/game';
	import type { CardId, Command, PublicState, Purchase } from '@repo/game';
	import { cityName, purchaseLabel } from './labels.svelte.ts';

	type Props = { snap: PublicState; send: (command: Command) => void };

	let { snap, send }: Props = $props();

	const world = $derived(snap.world);
	const campaign = $derived(world.campaign);
	const upkeep = $derived(world.game!.upkeep!);

	type Offer = { group: string; text: string; purchase: Purchase };

	const offers = $derived.by(() => {
		const grid = onGrid(world);
		const all: Offer[] = [];
		for (const ability of new Set(campaign.abilitiesForSale)) {
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
		for (const improvement of new Set(campaign.cityImprovementsForSale)) {
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
		for (const improvement of new Set(campaign.infectionImprovementsForSale)) {
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
			for (const structure of new Set(campaign.permanentForSale)) {
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
	let bought = $state.raw<string[]>([]);
	keep(
		'upkeep',
		() => ({ group, bought }),
		saved => {
			group = saved.group;
			bought = saved.bought;
		},
	);
	$effect(() => {
		if (!groups.includes(group)) group = groups[0] ?? '';
	});
	const inGroup = $derived(offers.filter(offer => offer.group === group));
</script>

<div class="upkeep" {@attach feedback(undefined, () => ({ upkeep, offers: offers.length }))}>
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

	<section class="spend">
		<h2>
			Spend production units: {upkeep.units} left{campaign.freeAbilityUnits
				? `, plus ${campaign.freeAbilityUnits} free for abilities`
				: ''}
		</h2>
		{#if groups.length}
			<div class="shop">
				<div class="groups" data-testid="purchase-group">
					{#each groups as option (option)}
						{@const cost = option.match(/\((\d+)\)$/)?.[1]}
						<button class:on={option === group} onclick={() => (group = option)}>
							<strong>{option.replace(/ \(\d+\)$/, '')}</strong>
							<small>{cost} unit{cost === '1' ? '' : 's'}</small>
						</button>
					{/each}
				</div>
				<div class="detail">
					<p>{inGroup[0]?.text}</p>
					<div class="targets">
						{#each inGroup as offer (JSON.stringify(offer.purchase))}
							<button
								onclick={() => {
									bought = [
										...bought,
										`${offer.group.replace(/ \(\d+\)$/, '')}: ${purchaseLabel(world, offer.purchase)}`,
									];
									send({ type: 'PURCHASE', purchase: offer.purchase });
								}}
							>
								{purchaseLabel(world, offer.purchase)}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{:else}
			<p class="none">Nothing left to buy.</p>
		{/if}
	</section>

	{#if bought.length}
		<section>
			<h2>Bought</h2>
			<p class="changes">
				{#each bought as line, index (index)}<span class="up">{line}</span>{/each}
			</p>
		</section>
	{/if}

	<button class="primary" onclick={() => send({ type: 'FINISH_UPKEEP' })} data-testid="finish-upkeep"
		>Done. Unspent units are lost.</button
	>
</div>

<style>
	/* The game-end requisition: what changed, and what the units left over can buy. */
	.upkeep {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: min(46rem, 92vw);
		max-height: 100%;
		min-height: 0;
		padding: 1.4rem 1.7rem 1.4rem;
		border-radius: 2px;
		background: var(--document);
		color: var(--slip-ink);
		box-shadow: var(--document-shadow);
		overflow: hidden;
		animation: laid 420ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
	}

	@keyframes laid {
		from {
			opacity: 0;
			translate: 0 1.5rem;
			rotate: 1deg;
		}
	}

	header {
		padding-bottom: 0.8rem;
		border-bottom: 1px solid rgb(42 32 23 / 0.25);
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 2.4rem;
		font-weight: 400;
		line-height: 1;
	}

	header p {
		margin: 0.35rem 0 0;
		color: var(--slip-muted);
		font-size: 0.92rem;
	}

	h2 {
		margin: 0 0 0.45rem;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 400;
	}

	.changes,
	.targets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.82rem;
	}

	.changes span {
		padding: 0.05rem 0.45rem;
		border: 1px solid rgb(163 48 28 / 0.45);
		border-radius: 2px;
		color: var(--ink-danger);
	}

	.changes span.up {
		border-color: rgb(61 107 85 / 0.55);
		color: var(--ink-good);
	}

	.none {
		color: var(--slip-muted);
		font-size: 0.85rem;
	}

	/* The shopping list takes whatever height is left and scrolls inside, so Done never leaves the sheet. */
	.spend {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.upkeep > :not(.spend) {
		flex: none;
	}

	.shop {
		flex: 1;
		display: grid;
		grid-template-columns: 24rem minmax(0, 1fr);
		gap: 1rem;
		min-height: 0;
	}

	.groups {
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-content: start;
		gap: 0.2rem;
		min-height: 0;
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: rgb(42 32 23 / 0.45) transparent;
	}

	.groups button {
		padding-block: 0.25rem;
	}

	.groups button {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		text-align: left;
	}

	.groups button.on {
		border-color: var(--slip-ink);
		background: rgb(42 32 23 / 0.08);
	}

	.groups small {
		color: var(--slip-muted);
		white-space: nowrap;
	}

	.detail p {
		margin: 0 0 0.5rem;
		color: var(--slip-muted);
		font-size: 0.85rem;
		line-height: 1.35;
	}

	.detail {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.targets {
		min-height: 0;
		overflow: auto;
		scrollbar-width: thin;
	}

	select,
	button {
		padding: 0.32rem 0.55rem;
		border: 1px solid rgb(42 32 23 / 0.35);
		border-radius: 2px;
		background: none;
		color: var(--slip-ink);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}

	button:hover {
		border-color: var(--slip-ink);
		background: rgb(42 32 23 / 0.06);
	}

	.primary {
		align-self: flex-start;
		padding: 0.5rem 1.1rem;
		border-color: var(--slip-ink);
		background: var(--slip-ink);
		color: #efe6d2;
		font-weight: 700;
	}

	.primary:hover {
		background: #3d3022;
	}
</style>
