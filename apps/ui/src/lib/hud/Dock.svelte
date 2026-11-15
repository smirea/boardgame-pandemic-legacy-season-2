<script lang="ts">
	import { actionCost, checkAction, handLimit, pack } from '@repo/game';
	import type { Action, CardId, Command, Decide, Play, PublicState, SeatId } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
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
	import PlayerCard from './PlayerCard.svelte';

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
	const seat = $derived(viewing ?? game.active);
	const handCards = $derived((game.players[seat]?.hand ?? []).flatMap(id => world.campaign.playerCards[id] ?? []));
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
					9 cards. The panel on the right shows where it is most likely to land.
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
			<nav>
				{#each game.seats as other, index (other)}
					<button
						class:on={other === seat}
						class:current={other === game.active}
						style:--seat={SEAT_COLORS[index]}
						onclick={() => onview(other)}
					>
						{seatName(world, other)}
						<small>{game.players[other]!.hand.length}</small>
					</button>
				{/each}
			</nav>
			{#key seat}
				<div class="hand" data-testid="hand">
					{#each handCards as card (card.id)}
						<div animate:flip={{ duration: 300 }} in:fly={{ y: -60, duration: 350 }} out:fly={{ y: 50, duration: 220 }}>
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
	.dock {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) auto;
		gap: 1rem;
		height: 10.6rem;
		padding: 0.5rem 0.9rem 0.6rem;
		border-top: 1px solid var(--line);
		background: var(--panel-solid);
	}

	.setup {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.2rem;
		font-size: 0.9rem;
	}

	.setup strong {
		color: var(--accent);
		font-size: 1.2rem;
	}

	.setup .lost strong {
		color: var(--danger);
	}

	.events {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
		max-width: 40rem;
	}

	.hands {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	nav {
		display: flex;
		gap: 0.3rem;
	}

	nav button {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		height: 1.5rem;
		padding: 0 0.55rem;
		border: 1px solid var(--line);
		border-bottom: 2px solid var(--seat);
		border-radius: 0.35rem;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.7rem;
		cursor: pointer;
	}

	nav button.on {
		background: rgb(255 255 255 / 0.08);
		color: var(--ink);
	}

	nav button.current::before {
		content: '';
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--seat);
	}

	nav small {
		margin-left: 0.25rem;
		color: var(--muted);
	}

	.hand {
		display: flex;
		gap: 0.35rem;
		min-width: 0;
		padding-top: 0.5rem;
		overflow: visible;
	}

	.hand > div {
		min-width: 2.6rem;
		flex: 0 1 6.1rem;
	}

	.empty,
	.prompt {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
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
	}

	.waiting {
		margin: 0;
		color: var(--muted);
		font-size: 0.78rem;
	}

	.drew {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		color: var(--muted);
		font-size: 0.72rem;
	}

	.pill {
		padding: 0.05rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		color: var(--ink);
	}

	.pill.epidemic {
		border-color: #ff3b6b;
		background: rgb(255 59 107 / 0.16);
		color: #ff8fab;
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
		max-height: 7.6rem;
		overflow: auto;
	}

	.chips button,
	.setup button,
	.turn button {
		padding: 0.32rem 0.65rem;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		background: rgb(255 255 255 / 0.05);
		color: var(--ink);
		font: inherit;
		font-size: 0.76rem;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			transform 150ms ease;
	}

	.chips button:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
	}

	.chips small {
		margin-left: 0.35rem;
		color: var(--muted);
		font-size: 0.66rem;
	}

	.chips small.free {
		color: var(--accent);
	}

	.chips small.count {
		padding: 0 0.3rem;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.1);
	}

	.unpicked {
		opacity: 0.45;
	}

	.turn {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.4rem;
		width: 9.5rem;
	}

	.pips {
		display: flex;
		justify-content: center;
		gap: 0.3rem;
	}

	.pips i {
		width: 0.8rem;
		height: 0.8rem;
		border: 1px solid var(--accent);
		border-radius: 50%;
		transition: background 250ms ease;
	}

	.pips i.on {
		background: var(--accent);
	}

	button.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #06120c;
		font-weight: 700;
	}

	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
