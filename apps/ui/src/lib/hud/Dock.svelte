<script lang="ts">
	import { actionCost, checkAction, handLimit, pack } from '@repo/game';
	import type { Action, CardId, Command, Decide, Play, PublicState, SeatId } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { backOut, cubicIn } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import {
		ACTION_NAMES,
		actionDetail,
		actionTarget,
		cityName,
		decideLabel,
		decisionTitle,
		seatName,
		SEAT_COLORS,
		cardName,
	} from './labels.svelte.ts';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import PlayerCard, { cardColor } from './PlayerCard.svelte';

	type Props = {
		snap: PublicState;
		canAct: boolean;
		/** Whether this client plays the seat. Prompts and discards are offered only to whoever they belong to. */
		owns: (seat: SeatId) => boolean;
		viewing: SeatId | null;
		actions: Action[];
		plays: { seat: SeatId; card: CardId; play: Play }[];
		decides: Decide[];
		send: (command: Command) => void;
		onview: (seat: SeatId) => void;
		ongroup: (name: Action['a']) => void;
		onplaycard: (seat: SeatId, card: CardId) => void;
	};

	let { snap, canAct, owns, viewing, actions, plays, decides, send, onview, ongroup, onplaycard }: Props = $props();

	const world = $derived(snap.world);
	const game = $derived(world.game!);
	const pending = $derived(game.pending[0]);
	// The hand held up in front of this player is their own. On a shared screen that is whoever's turn it is.
	const home = $derived(owns(game.active) ? game.active : (game.seats.find(owns) ?? game.active));
	const seat = $derived(viewing ?? home);
	const cardsOf = (other: SeatId) =>
		(game.players[other]?.hand ?? []).flatMap(id => world.campaign.playerCards[id] ?? []);
	const handCards = $derived(cardsOf(seat));
	const others = $derived(game.seats.filter(other => other !== seat));
	const seatColor = (other: SeatId) => SEAT_COLORS[game.seats.indexOf(other)];
	// The fan tightens as the hand grows so a full hand still fits between the seats and the prompts.
	const overlap = $derived(Math.max(0.3, Math.min(2.9, (handCards.length - 3) * 0.55)));
	const fanAngle = (index: number) => (index - (handCards.length - 1) / 2) * Math.min(4.5, 22 / handCards.length);
	const mustDiscard = $derived(owns(seat) && decides.some(decide => decide.d === 'discard' && decide.seat === seat));
	const playable = $derived(new Set(plays.filter(option => option.seat === seat).map(option => option.card)));
	const FREE = new Set(['pickUp', 'transfer', 'inoculate', 'salvage', 'destroyInfection']);
	// One chip per kind of action. A chip with a single variant says exactly what it will do, so nothing fires blind.
	const chips = $derived(
		[...new Set(actions.map(action => action.a))].map(name => {
			const variants = actions.filter(action => action.a === name);
			const only = variants.length === 1 ? variants[0]! : null;
			const target = only ? actionTarget(world, only) : null;
			return {
				name,
				label: ACTION_NAMES[name] + (target ? ` to ${cityName(target)}` : ''),
				detail: only ? actionDetail(world, only) : '',
				count: variants.length,
				free: only !== null && !FREE.has(name) && actionCost(world, game.active, only) === 0,
			};
		}),
	);
	const noSupplies = $derived(
		canAct &&
			snap.phase === 'playing.actions' &&
			game.actionsLeft > 0 &&
			!actions.some(action => action.a === 'makeSupplies')
			? checkAction(world, game.active, { a: 'makeSupplies' })
			: null,
	);
	const decider = $derived(pending && 'seat' in pending && pending.seat ? pending.seat : game.active);
	// A shared prompt shows each player only their own cards, and the player whose turn it is may pass on it.
	const choices = $derived(
		decides.filter(decide => {
			if (decide.d === 'discard') return false;
			if (decide.d === 'shield' || decide.d === 'cordon') return owns(decide.seat);
			return owns(decider);
		}),
	);
	const overLimit = $derived(game.seats.filter(other => game.players[other]!.hand.length > handLimit(world, other)));
	const blocked = $derived(pending !== undefined || overLimit.length > 0);
	const rationed = $derived(
		Object.values(world.campaign.playerCards).filter(card => card.kind === 'event' && card.mode === 'rationed'),
	);
	const EFFECT = {
		supply: 'cube lost',
		plague: 'plague',
		outbreak: 'outbreak',
		hollow: 'Hollow Men',
		skipped: 'forsaken',
		blocked: 'held',
	} as const;
	// The Infection cards flipped since this turn began, newest first, each with what it did.
	const flipped = $derived.by(() => {
		const sinceTurn = game.log.slice(game.log.findLastIndex(entry => entry.t === 'turn') + 1);
		return sinceTurn
			.flatMap(entry => {
				const card = entry.t === 'infect' ? world.campaign.infectionCards[entry.card] : undefined;
				return entry.t === 'infect' && card ? [{ seq: entry.seq, card, note: EFFECT[entry.effect] }] : [];
			})
			.reverse();
	});
	// What this turn's draw step turned up, kept on screen through the Infect step so an Epidemic cannot slip by.
	const drawn = $derived.by(() => {
		const sinceTurn = game.log.slice(game.log.findLastIndex(entry => entry.t === 'turn') + 1);
		const cards = sinceTurn.flatMap(entry =>
			entry.t === 'draw' ? [world.campaign.playerCards[entry.card]].filter(card => card !== undefined) : [],
		);
		const epidemics = sinceTurn.flatMap(entry => (entry.t === 'epidemic' ? [entry] : []));
		return { cards, epidemics };
	});
	const eventsNeeded = $derived(Math.min(world.campaign.rationing, rationed.length));

	// The engine only accepts a full pick, so a swap in progress lives here until it is complete again.
	let draft = $state<CardId[] | null>(null);
	const picked = $derived(draft ?? game.pickedEvents);

	function toggleEvent(card: CardId) {
		const next = picked.includes(card) ? picked.filter(id => id !== card) : [...picked, card];
		if (next.length > eventsNeeded) return;
		draft = next.length === eventsNeeded ? null : next;
		if (next.length === eventsNeeded) send({ type: 'PICK_EVENTS', cards: next });
	}
</script>

{#snippet drew()}
	{#if drawn.cards.length}
		<div class="drew" data-testid="drawn">
			<span>Drew</span>
			{#each drawn.cards as card (card.id)}
				<span class="pill" class:epidemic={card.kind === 'epidemic'}
					>{card.kind === 'epidemic' ? 'Epidemic' : cardName(world, card.id)}</span
				>
			{/each}
			{#each drawn.epidemics as entry (entry.seq)}
				<span class="pill epidemic">
					{entry.city
						? `${cityName(entry.city)} lost ${entry.removed} cube${entry.removed === 1 ? '' : 's'}`
						: 'No city struck'}, rate {entry.rate}
				</span>
			{/each}
		</div>
	{/if}
{/snippet}

<footer class="dock">
	{#if snap.phase === 'setup.supply'}
		<div class="setup">
			<div>
				{#if game.stockpile > 0}
					<strong>{game.stockpile}</strong> supply cubes to place. Click a city to add one. The opening infection then flips
					9 cards. The list on the right shows where it is most likely to land.
				{:else}
					<strong>All cubes placed.</strong> The opening infection flips 9 cards next.
				{/if}
			</div>
			<button onclick={() => send({ type: 'AUTO_SUPPLY' })} data-testid="auto-supply">Spread the rest evenly</button>
			<button
				class="primary"
				disabled={game.stockpile > 0}
				onclick={() => send({ type: 'CONFIRM_SUPPLY' })}
				data-testid="confirm-supply">Infect 9 cities</button
			>
		</div>
	{:else if snap.phase === 'setup.events'}
		<div class="setup">
			<div>Pick <strong>{eventsNeeded}</strong> Rationed Events for the deck ({picked.length} chosen).</div>
			<div class="events">
				{#each rationed as card (card.id)}
					<span class:unpicked={!picked.includes(card.id)}
						><PlayerCard
							{card}
							small
							tone={picked.includes(card.id) ? 'play' : null}
							onclick={() => toggleEvent(card.id)}
						/></span
					>
				{/each}
			</div>
			<button
				class="primary"
				disabled={picked.length !== eventsNeeded}
				onclick={() => send({ type: 'CONFIRM_EVENTS' })}
				data-testid="confirm-events">Deal and begin</button
			>
		</div>
	{:else if snap.phase === 'over'}
		<div class="setup">
			<div class:lost={!game.outcome?.won}>
				<strong>{game.outcome?.won ? 'Victory' : 'Defeat'}</strong>: {game.outcome?.reason}
			</div>
			<button class="primary" onclick={() => send({ type: 'CONTINUE' })} data-testid="continue">Go to game end</button>
		</div>
	{:else}
		<div class="hands">
			<nav aria-label="Other hands">
				{#each others as other (other)}
					<button
						class:current={other === game.active}
						style:--seat={seatColor(other)}
						onclick={() => onview(other)}
						title={`Show ${seatName(world, other)}'s hand`}
						animate:flip={{ duration: 300 }}
					>
						<span class="who">{seatName(world, other)}</span>
						<span class="minis">
							{#each cardsOf(other) as card (card.id)}
								<i style:--band={cardColor(card)} title={cardName(world, card.id)} transition:fade={{ duration: 200 }}
								></i>
							{/each}
						</span>
					</button>
				{/each}
			</nav>
		</div>

		<div class="held" style:--seat={seatColor(seat)}>
			<p class="holder">
				<i></i>{seatName(world, seat)}
				<small
					>{seat === home && owns(seat) ? 'your hand' : owns(seat) ? 'also yours' : 'their hand'}, {handCards.length} of {handLimit(
						world,
						seat,
					)}</small
				>
				{#if seat !== home}<button class="back" onclick={() => onview(home)}>Back to {seatName(world, home)}</button
					>{/if}
			</p>
			{#key seat}
				<div class="hand" data-testid="hand" style:--overlap={`${overlap}rem`} in:fade={{ duration: 220 }}>
					{#each handCards as card, index (card.id)}
						<div
							class="slot"
							animate:flip={{ duration: 320 }}
							in:fly={{ x: 160, y: -220, duration: 520, easing: backOut }}
							out:fly={{ y: -140, duration: 260, easing: cubicIn }}
						>
							<div
								class="lift"
								style:--angle={`${fanAngle(index)}deg`}
								style:--drop={`${Math.abs(fanAngle(index)) * 0.06}rem`}
							>
								<PlayerCard
									{card}
									tone={mustDiscard ? 'discard' : playable.has(card.id) ? 'play' : null}
									onclick={mustDiscard
										? () => send({ type: 'DECIDE', decide: { d: 'discard', seat, cards: [card.id] } })
										: playable.has(card.id)
											? () => onplaycard(seat, card.id)
											: undefined}
								/>
							</div>
						</div>
					{:else}
						<p class="empty">No cards in hand.</p>
					{/each}
				</div>
			{/key}
		</div>

		<div class="middle">
			{#if overLimit.length}
				<p class="prompt">
					{overLimit.map(other => seatName(world, other)).join(', ')} must discard down to the hand limit.
					{overLimit.some(owns) ? 'Click a card in that hand, or play an event.' : 'Waiting for them.'}
				</p>
			{:else if pending}
				<p class="prompt">
					{decisionTitle(world, pending)}
				</p>
				{#if choices.length}
					<div class="chips">
						{#each choices.slice(0, 24) as decide, index (index)}
							<button onclick={() => send({ type: 'DECIDE', decide })}>{decideLabel(world, decide)}</button>
						{/each}
					</div>
				{:else}
					<p class="waiting">Waiting for {seatName(world, decider)}.</p>
				{/if}
			{:else if snap.phase === 'playing.actions'}
				{#if canAct}
					<div class="chips" data-testid="actions">
						{#each chips as chip (chip.name)}
							<button onclick={() => ongroup(chip.name)}>
								{chip.label}
								{#if chip.detail}<small>{chip.detail}</small>{/if}
								{#if chip.free}<small class="free">free</small>{/if}
								{#if chip.count > 1}<small class="count">{chip.count}</small>{/if}
							</button>
						{/each}
						{#if noSupplies}
							<button disabled title={noSupplies}>Make supplies <small>{noSupplies}</small></button>
						{/if}
					</div>
				{:else}
					<p class="prompt">{seatName(world, game.active)} is taking actions.</p>
				{/if}
			{:else if snap.phase === 'playing.draw'}
				<p class="prompt">{seatName(world, game.active)} draws 2 Player cards.</p>
				{@render drew()}
			{:else}
				<p class="prompt">Infect cities: {game.infectionsLeft} card{game.infectionsLeft === 1 ? '' : 's'} to flip.</p>
				{@render drew()}
				<div class="flipped" data-testid="flipped">
					{#each flipped as entry (entry.seq)}
						<div class="flipcard" animate:flip={{ duration: 300 }}>
							<InfectionCard card={entry.card} note={entry.note} />
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="turn">
			{#if snap.phase === 'playing.actions'}
				<div class="pips" title="Actions left">
					{#each { length: Math.max(pack.numbers.actionsPerTurn, game.actionsLeft) } as _, index (index)}
						<i class:on={index < game.actionsLeft}></i>
					{/each}
				</div>
				<button
					class="primary"
					disabled={!canAct || blocked}
					onclick={() => send({ type: 'END_ACTIONS', seat: game.active })}
					data-testid="end-actions"
					title="Space"
				>
					{game.actionsLeft > 0 ? 'End actions' : 'Draw cards'}
				</button>
				<button disabled={!snap.canUndo || !canAct} onclick={() => send({ type: 'UNDO' })} data-testid="undo" title="Z"
					>Undo</button
				>
			{:else if snap.phase === 'playing.draw'}
				<button
					class="primary"
					disabled={!canAct || blocked}
					onclick={() => send({ type: 'DRAW' })}
					data-testid="draw"
					title="Space">Draw card ({game.drawsLeft})</button
				>
			{:else}
				<button
					class="primary"
					disabled={!canAct || blocked}
					onclick={() => send({ type: 'INFECT' })}
					data-testid="infect"
					title="Space">Flip infection ({game.infectionsLeft})</button
				>
			{/if}
		</div>
	{/if}
</footer>

<style>
	/* No tray: the dock is the near edge of the table, with the held hand rising out of the bottom of the screen. */
	/* The dock reaches up over the empty table below the chart, so only its contents take clicks. */
	.dock {
		position: relative;
		z-index: 35;
		display: grid;
		grid-template-columns: minmax(8rem, 12rem) minmax(0, 1.35fr) minmax(0, 1fr) 9rem;
		gap: 1.1rem;
		height: 10.4rem;
		margin-top: -2.6rem;
		padding: 0 0.9rem;
		pointer-events: none;
	}

	.dock :is(button, input, .slot, .events, .flipped, .drew, .prompt) {
		pointer-events: auto;
	}

	.setup {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.2rem;
		font-size: 0.95rem;
	}

	.setup strong {
		color: var(--paper);
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 400;
	}

	.setup .lost strong {
		color: var(--danger);
	}

	.events {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		max-width: 40rem;
	}

	.events > span {
		transition:
			opacity 200ms ease,
			transform 200ms ease;
	}

	.events > span:hover {
		transform: translateY(-0.2rem);
	}

	.unpicked {
		opacity: 0.5;
	}

	.hands {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-width: 0;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	nav button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.2rem;
		padding: 0.15rem 0 0.15rem 0.55rem;
		border: 0;
		border-left: 2px solid var(--seat);
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
		transition: color 150ms ease;
	}

	nav button:hover,
	nav button.current {
		color: var(--ink);
	}

	nav button.current .who::after {
		content: ' is playing';
		color: var(--muted);
		font-size: 0.72rem;
	}

	.who {
		font-family: var(--font-display);
		font-size: 0.98rem;
	}

	/* Someone else's hand is shown face up but small: a sliver of each card in its region's colour. */
	.minis {
		display: flex;
		gap: 2px;
		min-height: 1.1rem;
	}

	.minis i {
		width: 0.75rem;
		height: 1.1rem;
		border-radius: 1px;
		border-top: 3px solid var(--band);
		background: #e6dcc5;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
		transition: transform 200ms ease;
	}

	nav button:hover .minis i {
		transform: translateY(-2px);
	}

	.held {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
	}

	.holder {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-size: 1.05rem;
		white-space: nowrap;
	}

	.holder i {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--seat);
		align-self: center;
	}

	.holder small {
		color: var(--muted);
		font-family: var(--font-ui);
		font-size: 0.75rem;
	}

	.back {
		padding: 0;
		border: 0;
		border-bottom: 1px solid var(--line-strong);
		background: none;
		color: var(--muted);
		font: inherit;
		font-family: var(--font-ui);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.back:hover {
		color: var(--ink);
	}

	.hand {
		--card-size: 0.8rem;
		display: flex;
		justify-content: center;
		min-width: 0;
		margin-top: 0.4rem;
		padding-inline: var(--overlap);
	}

	.slot {
		margin-inline: calc(var(--overlap) / -2);
	}

	.slot:hover {
		z-index: 5;
	}

	.lift {
		transform: translateY(var(--drop)) rotate(var(--angle));
		transform-origin: 50% 140%;
		transition: transform 260ms cubic-bezier(0.2, 0.9, 0.3, 1.2);
	}

	.slot:hover .lift {
		transform: translateY(-1.6rem) rotate(0deg) scale(1.08);
	}

	.empty,
	.prompt {
		margin: 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.empty {
		padding-top: 2rem;
	}

	.middle {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.prompt {
		color: var(--ink);
		line-height: 1.35;
	}

	.waiting {
		margin: 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.drew {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		color: var(--muted);
		font-size: 0.78rem;
	}

	.pill {
		padding: 0.05rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		color: var(--ink);
	}

	.pill.epidemic {
		border-color: var(--danger);
		background: rgb(207 91 62 / 0.14);
		color: #ec8c70;
	}

	.flipcard {
		animation: turn-over 520ms cubic-bezier(0.2, 0.9, 0.3, 1.15) backwards;
		transform-origin: left center;
	}

	@keyframes turn-over {
		from {
			opacity: 0;
			transform: perspective(40rem) rotateY(-95deg) translateX(1.5rem);
		}
		to {
			opacity: 1;
			transform: perspective(40rem) rotateY(0) translateX(0);
		}
	}

	.flipped {
		display: flex;
		gap: 0.35rem;
		--card-size: 0.62rem;
		overflow: hidden;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		max-height: 7.8rem;
		overflow: auto;
		scrollbar-width: thin;
	}

	.chips button,
	.setup button,
	.turn button {
		padding: 0.32rem 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			transform 150ms ease;
	}

	.chips button:hover:not(:disabled),
	.setup button:hover:not(:disabled),
	.turn button:hover:not(:disabled) {
		border-color: var(--paper);
		background: var(--wash);
	}

	.chips button:active:not(:disabled),
	.turn button:active:not(:disabled) {
		transform: translateY(1px);
	}

	.chips small {
		margin-left: 0.35rem;
		color: var(--muted);
		font-size: 0.74rem;
	}

	.chips small.free {
		color: var(--good);
	}

	.chips small.count {
		padding: 0 0.3rem;
		border-radius: 2px;
		background: rgb(231 220 198 / 0.12);
	}

	.turn {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.4rem;
	}

	.pips {
		display: flex;
		justify-content: center;
		gap: 0.35rem;
	}

	.pips i {
		width: 0.75rem;
		height: 0.75rem;
		border: 1px solid var(--paper);
		border-radius: 50%;
		transition:
			background 250ms ease,
			transform 250ms ease;
	}

	.pips i.on {
		background: var(--paper);
	}

	.pips i:not(.on) {
		transform: scale(0.8);
		opacity: 0.5;
	}

	button.primary,
	.turn button.primary,
	.setup button.primary {
		border-color: var(--paper);
		background: var(--paper);
		color: var(--paper-ink);
		font-weight: 700;
	}

	button.primary:hover:not(:disabled) {
		background: #e9dec5;
	}

	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
