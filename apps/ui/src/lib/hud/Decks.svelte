<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { cityDef } from '@repo/game';
	import type { CityId, Insights, PlayerDeckKind } from '@repo/game';
	import { fade, fly } from 'svelte/transition';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { inkOn } from '#lib/color.ts';
	import { cityName } from './labels.svelte.ts';
	import { GLYPH, KIND_COLOR } from './PlayerCard.svelte';
	import { HOLLOW_COLOR } from './rich.ts';
	import type { Rich } from './rich.ts';
	import RichText from './RichText.svelte';

	type DeckAction = { left: number; busy?: boolean; onclick: () => void } | null;
	type Props = { info: Insights; dealt: boolean; drawPlayer?: DeckAction; drawInfection?: DeckAction };

	let { info, dealt, drawPlayer = null, drawInfection = null }: Props = $props();

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

	let open = $state<'player' | 'infection' | null>(null);
</script>

{#snippet cardIcon(color: string, glyph?: string)}
	<span class="card-icon" style:--band={color} style:--on={inkOn(color)} aria-hidden="true">{glyph ?? ''}</span>
{/snippet}

{#snippet deck(which: 'player' | 'infection', label: string, color: string, count: string, action: DeckAction)}
	{@const ready = Boolean(action && !action.busy)}
	{@const lifted = which === 'player' && Boolean(action)}
	<div class="deck-wrap" class:lifted>
		<div
			class="deck"
			class:actionable={ready && !lifted}
			class:hidden={lifted}
			data-deck={which}
			data-dest={which === 'player' ? 'playerDeck' : 'infectionDeck'}
			role="button"
			tabindex={lifted ? -1 : 0}
			aria-label={action ? `${label} — click to draw (${action.left} left)` : label}
			aria-expanded={!action && open === which}
			onclick={() => ready && action!.onclick()}
			onkeydown={event => {
				if ((event.key === 'Enter' || event.key === ' ') && ready) {
					event.preventDefault();
					action!.onclick();
				}
			}}
			onpointerenter={() => !action && (open = which)}
			onpointerleave={() => (open = null)}
			onfocus={() => !action && (open = which)}
			onblur={() => (open = null)}
		>
			{@render cardIcon(color, which === 'infection' ? '☣' : undefined)}
			{#key count}<strong data-testid={`${which}-deck-count`} in:fly={{ y: -10, duration: 280 }}>{count}</strong>{/key}
		</div>
		{#if lifted && action}
			<button
				class="draw-pile"
				class:pulsing={ready}
				disabled={!ready}
				onclick={() => ready && action.onclick()}
				data-testid="player-draw-deck"
				aria-label={`Draw from the Player deck (${action.left} left)`}
				in:fly={{ y: -16, duration: 260 }}
				out:fade={{ duration: 160 }}
			>
				<span class="pile-card">
					<span class="pile-emblem" aria-hidden="true">✦</span>
					<span class="pile-label">PLAYER</span>
					<strong class="pile-count">{count}</strong>
				</span>
				<span class="pile-badge">Draw · {action.left} left</span>
			</button>
		{/if}
	</div>
{/snippet}

<div
	class="decks"
	{@attach feedback('Decks', () => ({
		player: player.cards,
		epidemicsLeft: player.epidemicsLeft,
		infection: infectionCards,
		discard: infection.discard,
	}))}
>
	{@render deck(
		'player',
		dealt ? `Player deck: ${player.cards} cards` : 'Player deck: dealt when the game begins',
		'#5d5446',
		dealt ? String(player.cards) : '–',
		drawPlayer,
	)}
	{@render deck(
		'infection',
		`Infection deck: ${infectionCards} cards`,
		INFECTION,
		String(infectionCards),
		drawInfection,
	)}

	{#if open === 'player' && !drawPlayer}
		<div class="tip" role="tooltip" data-testid="player-deck-tip" transition:fade={{ duration: 140 }}>
			{#if dealt}
				<strong>Player deck, {player.cards} cards</strong>
				<dl>
					<dt>Turns of draws left</dt>
					<dd>{player.turnsLeft}</dd>
					<dt>Epidemics still in the deck</dt>
					<dd>{player.epidemicsLeft}</dd>
					<dt>Epidemics drawn</dt>
					<dd>{player.epidemicsDrawn}</dd>
					<dt>Epidemic in the next draw</dt>
					<dd class:hot={player.epidemicNextDraw > 0.5}>{percent(player.epidemicNextDraw)}</dd>
					{#if player.epidemicWithin}
						<dt>An Epidemic comes within</dt>
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
			{:else}
				<strong>Player deck</strong>
				<p>Shuffled with its Epidemics and dealt once setup is done.</p>
			{/if}
		</div>
	{:else if open === 'infection' && !drawInfection}
		<div class="tip wide" role="tooltip" data-testid="infection-deck-tip" transition:fade={{ duration: 140 }}>
			<strong>Infection deck, {infectionCards} cards</strong>
			<dl>
				{#if infection.opening}
					<dt>The opening infection flips</dt>
					<dd>{infection.rate}</dd>
				{:else}
					<dt>Infection rate</dt>
					<dd>{infection.rate}, then {infection.nextRate}</dd>
				{/if}
				<dt>Incidents before the game is lost</dt>
				<dd class:hot={info.incidentsLeft <= 2}>{info.incidentsLeft}</dd>
			</dl>
			{#each infection.strata as stratum, index (index)}
				<section>
					<h4>
						{infection.strata.length > 1
							? index === 0
								? 'On top, drawn next'
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
					Discard pile <b>{infection.opening ? 0 : Object.values(infection.discard).reduce((a, b) => a + b, 0)}</b>
				</h4>
				<p>
					{#if discard.length}<RichText text={discard} />{:else}empty{/if}
				</p>
				{#if discard.length}<p class="note">An Epidemic shuffles these back on top of the deck.</p>{/if}
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
			{#if infection.atRisk.length}
				<section>
					<h4>An incident if hit next</h4>
					<ul class="risk">
						{#each infection.atRisk.slice(0, 8) as risk (risk.city)}
							<li>
								<span>{cityName(risk.city)}{risk.outbreak ? ', outbreak' : ''}</span><b>{percent(risk.odds)}</b>
							</li>
						{/each}
					</ul>
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

	.deck-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.deck.hidden {
		visibility: hidden;
		pointer-events: none;
	}

	.draw-pile {
		position: absolute;
		top: -0.15rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 60;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.draw-pile:disabled {
		cursor: default;
		opacity: 0.7;
	}

	.draw-pile.pulsing .pile-card {
		animation: playerDeckPulse 1.6s ease-in-out infinite;
	}

	.draw-pile.pulsing:hover .pile-card {
		transform: scale(1.07);
	}

	.pile-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		width: 4.5rem;
		height: 6.2rem;
		padding: 0.55rem 0.4rem;
		border: 1.5px solid #e3b23c;
		border-radius: 6px;
		background:
			radial-gradient(circle at 50% 35%, rgb(227 178 60 / 0.2), transparent 65%),
			linear-gradient(165deg, #5d5446 0%, #3d352a 65%, #2a241c 100%);
		box-shadow:
			inset 0 0 0 2px rgb(255 248 228 / 0.16),
			3px 3px 0 #8a7c64,
			6px 6px 0 #5b5140,
			0 0.8rem 1.8rem rgb(0 0 0 / 0.65);
		color: #f6ead4;
		transition: transform 180ms ease;
	}

	.pile-emblem {
		font-size: 1.15rem;
		color: #e3b23c;
		line-height: 1;
	}

	.pile-label {
		font-size: 0.56rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		color: rgb(246 234 212 / 0.78);
	}

	.pile-count {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		line-height: 1;
	}

	.pile-badge {
		padding: 0.16rem 0.6rem;
		border-radius: 999px;
		background: rgb(16 13 10 / 0.9);
		border: 1px solid rgb(227 178 60 / 0.65);
		color: var(--paper);
		font-size: 0.72rem;
		font-weight: 600;
		white-space: nowrap;
		box-shadow: 0 0.35rem 0.9rem rgb(0 0 0 / 0.5);
	}

	@keyframes playerDeckPulse {
		0%,
		100% {
			transform: scale(1);
			filter: drop-shadow(0 0.25rem 0.7rem rgb(227 178 60 / 0.35));
		}
		50% {
			transform: scale(1.06);
			filter: drop-shadow(0 0.45rem 1.3rem rgb(227 178 60 / 0.85));
		}
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

	.deck.actionable {
		border-color: rgb(227 178 60 / 0.7);
		background: rgb(227 178 60 / 0.12);
		cursor: pointer;
		animation: deckDrawPulse 1.6s ease-in-out infinite;
	}

	.deck.actionable[data-deck='infection'] {
		border-color: rgb(147 178 54 / 0.8);
		background: rgb(147 178 54 / 0.14);
	}

	.deck.actionable:hover {
		transform: scale(1.06);
	}

	@keyframes deckDrawPulse {
		0%,
		100% {
			box-shadow: 0 0 0 rgb(227 178 60 / 0);
		}
		50% {
			box-shadow: 0 0 0.8rem rgb(227 178 60 / 0.65);
		}
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
		width: 17rem;
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

	ul.risk {
		grid-template-columns: 1fr auto;
		border: 0;
		padding: 0;
	}

	section {
		padding-top: 0.35rem;
		border-top: 1px solid var(--slip-line);
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
