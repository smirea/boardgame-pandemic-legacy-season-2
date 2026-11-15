<script lang="ts">
	import { handLimit, pack } from '@repo/game';
	import type { Action, CardId, Command, Decide, Play, PublicState, SeatId } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { ACTION_NAMES, DECISION_TITLES, decideLabel, seatName, SEAT_COLORS } from './labels';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import PlayerCard from './PlayerCard.svelte';

	type Props = {
		snap: PublicState;
		canAct: boolean;
		viewing: SeatId | null;
		actions: Action[];
		plays: { seat: SeatId; card: CardId; play: Play }[];
		decides: Decide[];
		send: (command: Command) => void;
		onview: (seat: SeatId) => void;
		ongroup: (name: Action['a']) => void;
		onplaycard: (seat: SeatId, card: CardId) => void;
	};

	let { snap, canAct, viewing, actions, plays, decides, send, onview, ongroup, onplaycard }: Props = $props();

	const world = $derived(snap.world);
	const game = $derived(world.game!);
	const pending = $derived(game.pending[0]);
	const seat = $derived(viewing ?? game.active);
	const handCards = $derived((game.players[seat]?.hand ?? []).flatMap(id => world.campaign.playerCards[id] ?? []));
	const mustDiscard = $derived(decides.some(decide => decide.d === 'discard' && decide.seat === seat));
	const playable = $derived(new Set(plays.filter(option => option.seat === seat).map(option => option.card)));
	const groups = $derived([...new Set(actions.map(action => action.a))]);
	const choices = $derived(decides.filter(decide => decide.d !== 'discard'));
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

<footer class="dock">
	{#if snap.phase === 'setup.supply'}
		<div class="setup">
			<div>
				<strong>{game.stockpile}</strong> supply cubes to place. Click a city to add one. Every cube must go out before infection
				begins.
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
					<PlayerCard
						{card}
						small
						tone={picked.includes(card.id) ? 'play' : null}
						onclick={() => toggleEvent(card.id)}
					/>
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
			<div><strong>{game.outcome?.won ? 'Victory' : 'Defeat'}</strong>: {game.outcome?.reason}</div>
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
		</div>

		<div class="middle">
			{#if overLimit.length}
				<p class="prompt">
					{overLimit.map(other => seatName(world, other)).join(', ')} must discard down to the hand limit. Click a card in
					that hand, or play an event.
				</p>
			{:else if pending}
				<p class="prompt">
					{'seat' in pending ? `${seatName(world, pending.seat)}: ` : ''}{DECISION_TITLES[pending.t]}
				</p>
				<div class="chips">
					{#each choices.slice(0, 24) as decide, index (index)}
						<button onclick={() => send({ type: 'DECIDE', decide })}>{decideLabel(world, decide)}</button>
					{/each}
				</div>
			{:else if snap.phase === 'playing.actions'}
				{#if canAct}
					<div class="chips" data-testid="actions">
						{#each groups as name (name)}
							<button onclick={() => ongroup(name)}>
								{ACTION_NAMES[name]}
								{#if actions.filter(action => action.a === name).length > 1}<small
										>{actions.filter(action => action.a === name).length}</small
									>{/if}
							</button>
						{/each}
					</div>
				{:else}
					<p class="prompt">{seatName(world, game.active)} is taking actions.</p>
				{/if}
			{:else if snap.phase === 'playing.draw'}
				<p class="prompt">{seatName(world, game.active)} draws 2 Player cards.</p>
			{:else}
				<p class="prompt">Infect cities: {game.infectionsLeft} card{game.infectionsLeft === 1 ? '' : 's'} to flip.</p>
				<div class="flipped" data-testid="flipped">
					{#each flipped as entry (entry.seq)}
						<div animate:flip={{ duration: 300 }} in:fly={{ x: 80, duration: 380 }}>
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
				>
					{game.actionsLeft > 0 ? 'End actions' : 'Draw cards'}
				</button>
				<button disabled={!snap.canUndo || !canAct} onclick={() => send({ type: 'UNDO' })} data-testid="undo"
					>Undo</button
				>
			{:else if snap.phase === 'playing.draw'}
				<button class="primary" disabled={!canAct || blocked} onclick={() => send({ type: 'DRAW' })} data-testid="draw"
					>Draw card ({game.drawsLeft})</button
				>
			{:else}
				<button
					class="primary"
					disabled={!canAct || blocked}
					onclick={() => send({ type: 'INFECT' })}
					data-testid="infect">Flip infection ({game.infectionsLeft})</button
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
		margin-left: 0.3rem;
		color: var(--muted);
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
