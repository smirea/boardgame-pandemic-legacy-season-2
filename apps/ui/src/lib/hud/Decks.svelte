<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { cityDef, pack } from '@repo/game';
	import type { CityId, Insights, PlayerDeckKind, World } from '@repo/game';
	import { fade, fly } from 'svelte/transition';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { inkOn } from '#lib/color.ts';
	import { sortHand } from './handOrder.ts';
	import { cardName, cityName } from './labels.svelte.ts';
	import { cardColor, GLYPH, KIND_COLOR } from './PlayerCard.svelte';
	import { HOLLOW_COLOR } from './rich.ts';
	import type { Rich } from './rich.ts';
	import RichText from './RichText.svelte';

	type Props = {
		info: Insights;
		world?: World;
		dealt: boolean;
	};

	let { info, world, dealt }: Props = $props();

	const percent = (value: number) => `${Math.round(value * 100)}%`;
	const INFECTION = '#2c2733';

	const KINDS: { kind: PlayerDeckKind; name: string; color: string; glyph?: string }[] = [
		{ kind: 'blue', name: 'Blue cities', color: CITY_COLOR.blue },
		{ kind: 'yellow', name: 'Yellow cities', color: CITY_COLOR.yellow },
		{ kind: 'black', name: 'Black cities', color: CITY_COLOR.black },
		{ kind: 'red', name: 'Red cities', color: CITY_COLOR.red },
		{ kind: 'haven', name: 'Havens', color: CITY_COLOR.haven },
		{ kind: 'event', name: 'Events', color: KIND_COLOR.event, glyph: GLYPH.event },
		{ kind: 'produce', name: 'Produce Supplies', color: KIND_COLOR.produce, glyph: GLYPH.produce },
		{ kind: 'epidemic', name: 'Epidemics', color: KIND_COLOR.epidemic, glyph: GLYPH.epidemic },
	];
	const player = $derived(info.playerDeck);
	const infection = $derived(info.infection);
	const rates = pack.numbers.infectionRates;
	const rateIndex = $derived(world?.game?.rateIndex ?? 0);
	const kinds = $derived(
		KINDS.flatMap(entry => (player.byKind[entry.kind] ? [{ ...entry, count: player.byKind[entry.kind]! }] : [])),
	);
	/** Before the opening infection the deck is not built, but every card of a city on the grid will be in it. */
	const infectionCards = $derived(infection.opening ? (infection.strata[0]?.size ?? 0) : infection.deck);

	/** Each card in a pile as an Infection card glyph in its city's colour, the most copies first. */
	const names = (cities: Partial<Record<CityId | 'hollow', number>>): Rich =>
		(Object.entries(cities) as [CityId | 'hollow', number][])
			.toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.flatMap(([city, count], index) => [
				...(index ? [', '] : []),
				{
					glyph: 'infection' as const,
					color: city === 'hollow' ? HOLLOW_COLOR : CITY_COLOR[cityDef(city).color ?? 'haven'],
					text: `${city === 'hollow' ? 'Hollow Men' : cityName(city)}${count > 1 ? ` ×${count}` : ''}`,
				},
			]);
	const discard = $derived(names(infection.discard));
	const setAside = $derived(names(infection.gameEnd));
	const playerDiscardIds = $derived(world?.game?.playerDiscard ?? []);
	const playerDiscard = $derived.by((): Rich => {
		if (!world || !playerDiscardIds.length) return [];
		const cards = sortHand(
			playerDiscardIds.flatMap(id => world.campaign.playerCards[id] ?? []),
			card => cardName(world, card.id),
		);
		const groups = new Map<string, { card: (typeof cards)[number]; count: number }>();
		for (const card of cards) {
			const key =
				card.kind === 'city' ? `city:${card.city}` : card.kind === 'event' ? `event:${card.event}` : card.kind;
			const existing = groups.get(key);
			if (existing) existing.count += 1;
			else groups.set(key, { card, count: 1 });
		}
		return [...groups.values()].flatMap(({ card, count }, index) => [
			...(index ? [', '] : []),
			{
				glyph:
					card.kind === 'epidemic'
						? ('epidemic' as const)
						: card.kind === 'event'
							? ('event' as const)
							: ('card' as const),
				color: cardColor(card),
				text: `${cardName(world, card.id)}${count > 1 ? ` ×${count}` : ''}`,
			},
		]);
	});

	let open = $state<'player' | 'infection' | null>(null);
</script>

{#snippet cardIcon(color: string, glyph?: string)}
	<span class="card-icon" style:--band={color} style:--on={inkOn(color)} aria-hidden="true">
		{#if glyph === '☣'}
			<svg class="bio-svg" viewBox="0 0 24 24">
				<circle cx="12" cy="12" r="2.2" fill="currentColor" />
				<path
					d="M12 4.2a4.3 4.3 0 0 0-3.7 6.5l1.5-.9a2.6 2.6 0 1 1 4.4 0l1.5.9A4.3 4.3 0 0 0 12 4.2Zm-6.8 11.7a4.3 4.3 0 0 0 7.4-.1l-1.5-.9a2.6 2.6 0 1 1-2.2-3.8V9.4a4.3 4.3 0 0 0-3.7 6.5Zm13.6 0a4.3 4.3 0 0 0-3.7-6.5v1.7a2.6 2.6 0 1 1-2.2 3.8l-1.5.9a4.3 4.3 0 0 0 7.4.1Z"
					fill="currentColor"
				/>
			</svg>
		{:else}
			{glyph ?? ''}
		{/if}
	</span>
{/snippet}

<!-- What is left in a deck and what is known about it. Cards are drawn at the turn desk, not here. -->
{#snippet deck(which: 'player' | 'infection', label: string, color: string, count: string)}
	<div
		class="deck"
		data-deck={which}
		data-dest={which === 'player' ? 'playerDeck' : 'infectionDeck'}
		role="button"
		tabindex="0"
		aria-label={label}
		aria-expanded={open === which}
		onpointerenter={() => (open = which)}
		onpointerleave={() => (open = null)}
		onfocus={() => (open = which)}
		onblur={() => (open = null)}
	>
		{@render cardIcon(color, which === 'infection' ? '☣' : undefined)}
		{#key count}<strong data-testid={`${which}-deck-count`} in:fly={{ y: -10, duration: 280 }}>{count}</strong>{/key}
	</div>
{/snippet}

<div
	class="decks"
	{@attach feedback('Decks', () => ({
		player: player.cards,
		epidemicsLeft: player.epidemicsLeft,
		infection: infectionCards,
		rateIndex,
		discard: infection.discard,
	}))}
>
	{@render deck(
		'player',
		dealt ? `Player deck: ${player.cards} cards` : 'Player deck: dealt when the game begins',
		'#5d5446',
		dealt ? String(player.cards) : '–',
	)}
	{@render deck(
		'infection',
		`Infection deck: ${infectionCards} cards, rate ${rates[rateIndex]}`,
		INFECTION,
		String(infectionCards),
	)}

	{#if open === 'player'}
		<div class="tip" role="tooltip" data-testid="player-deck-tip" transition:fade={{ duration: 140 }}>
			{#if dealt}
				<strong>Player deck, {player.cards} cards</strong>
				<dl>
					<dt>Turns of draws left</dt>
					<dd>{player.turnsLeft}</dd>
					<dt><RichText text="Epidemic draw chance" /></dt>
					<dd class:hot={player.epidemicNextDraw > 0.5}>{percent(player.epidemicNextDraw)}</dd>
					{#if player.epidemicWithin}
						<dt><RichText text="Epidemic comes within" /></dt>
						<dd>{player.epidemicWithin} cards</dd>
					{/if}
				</dl>
				<ul>
					{#each kinds as entry (entry.kind)}
						<li data-kind={entry.kind}>
							{@render cardIcon(entry.color, entry.glyph)}<span>{entry.name}</span><b>{entry.count}</b>
						</li>
					{/each}
				</ul>
				<section data-testid="player-discard-section">
					<h4>Discard pile <b>{playerDiscardIds.length}</b></h4>
					<p>
						{#if playerDiscard.length}<RichText text={playerDiscard} />{:else}empty{/if}
					</p>
				</section>
			{:else}
				<strong>Player deck</strong>
				<p><RichText text="Shuffled with its Epidemics and dealt once setup is done." /></p>
			{/if}
		</div>
	{:else if open === 'infection'}
		<div class="tip wide" role="tooltip" data-testid="infection-deck-tip" transition:fade={{ duration: 140 }}>
			<strong>Infection deck, {infectionCards} cards</strong>
			<dl>
				<dt>Infection rate</dt>
				<dd>
					<span class="rate-track" data-testid="infection-rate-track" aria-label={`Infection rate ${rates[rateIndex]}`}>
						{#each rates as rate, index (index)}
							<span class="pip" class:on={index === rateIndex} class:past={index < rateIndex}>{rate}</span>
						{/each}
					</span>
				</dd>
				{#if infection.opening}
					<dt>The opening infection flips</dt>
					<dd>{infection.rate}</dd>
				{/if}
			</dl>
			{#each infection.strata as stratum, index (index)}
				<section>
					<h4>
						{infection.strata.length > 1
							? index === 0
								? 'On top, in no known order'
								: `Layer ${index + 1}`
							: infection.opening
								? 'In the deck'
								: 'In the deck, in no known order'}
						<b>{stratum.size}</b>
					</h4>
					<p>
						{#if Object.keys(stratum.cities).length}<RichText text={names(stratum.cities)} />{:else}empty{/if}
					</p>
				</section>
			{/each}
			<section>
				<h4>
					Discard pile <b>{Object.values(infection.discard).reduce((a, b) => a + b, 0)}</b>
				</h4>
				<p>
					{#if discard.length}<RichText text={discard} />{:else}empty{/if}
				</p>
				{#if discard.length}<p class="note">
						<RichText text="An Epidemic shuffles these back on top of the deck." />
					</p>{/if}
			</section>
			{#if setAside.length}
				<section>
					<h4>Game End area <b>{Object.values(infection.gameEnd).reduce((a, b) => a + b, 0)}</b></h4>
					<p><RichText text={setAside} /></p>
					<p class="note">
						Out of play until the game ends: new cities' cards, forsaken cities' and quarantined cards.
					</p>
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.decks {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.deck {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.2rem 0.35rem;
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: default;
		outline: none;
		transition:
			transform 180ms ease,
			border-color 180ms ease;
	}

	.deck:focus-visible {
		outline: 1px solid var(--line-strong);
		outline-offset: 2px;
	}

	.deck strong {
		font-size: 1.05rem;
		font-weight: 600;
	}

	.card-icon {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 0.85rem;
		height: 1.15rem;
		border: 1px solid color-mix(in srgb, var(--band) 55%, #000);
		border-radius: 2px;
		background: linear-gradient(172deg, var(--band), color-mix(in srgb, var(--band) 80%, #140c06));
		box-shadow: inset 0 0 0 1.5px rgb(255 248 228 / 0.16);
		color: var(--on);
		font-size: 0.62rem;
		line-height: 1;
	}

	.bio-svg {
		display: block;
		width: 0.72rem;
		height: 0.72rem;
	}

	.deck .card-icon {
		width: 1rem;
		height: 1.35rem;
		box-shadow:
			inset 0 0 0 1.5px rgb(255 248 228 / 0.16),
			2px -2px 0 -1px #3a332a,
			2px -2px 0 0 var(--line-strong);
	}

	.deck[data-deck='infection'] .card-icon {
		width: 1.35rem;
		height: 1rem;
		color: #93b236;
		font-size: 0.7rem;
	}

	/* A slip hanging from the bar under the decks, right-aligned so it never runs off the screen. */
	.tip {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 19rem;
		padding: 0.45rem 0.7rem 0.6rem;
		border-radius: 2px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.78rem;
		line-height: 1.3;
		white-space: normal;
		pointer-events: none;
	}

	.tip.wide {
		width: 26rem;
	}

	.tip > strong {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 400;
	}

	dl {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.15rem 0.6rem;
		margin: 0;
	}

	dt {
		color: var(--slip-muted);
	}

	dd {
		margin: 0;
		font-weight: 700;
		text-align: right;
	}

	.hot {
		color: var(--ink-danger);
	}

	.rate-track {
		display: inline-flex;
		align-items: center;
		gap: 0.18rem;
	}

	.pip {
		display: grid;
		place-items: center;
		width: 1.05rem;
		height: 1.05rem;
		border: 1px solid var(--slip-line);
		border-radius: 50%;
		color: var(--slip-muted);
		font-size: 0.66rem;
		font-weight: 600;
		line-height: 1;
	}

	.pip.past {
		opacity: 0.4;
	}

	.pip.on {
		border-color: var(--slip-ink);
		background: var(--slip-ink);
		color: var(--slip);
		font-weight: 700;
	}

	ul {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.2rem 0.45rem;
		align-items: center;
		margin: 0;
		padding: 0.35rem 0 0;
		border-top: 1px solid var(--slip-line);
		list-style: none;
	}

	li {
		display: contents;
	}

	li b {
		font-weight: 700;
		text-align: right;
	}

	section {
		padding-top: 0.35rem;
		border-top: 1px solid var(--slip-line);
	}

	.tip > strong + section {
		padding-top: 0;
		border-top: 0;
	}

	h4 {
		display: flex;
		justify-content: space-between;
		margin: 0 0 0.1rem;
		font-size: 0.74rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	p {
		margin: 0;
	}

	.note {
		margin-top: 0.15rem;
		color: var(--slip-muted);
		font-style: italic;
	}
</style>
