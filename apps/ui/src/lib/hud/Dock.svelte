<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { handLimit, pack, reject } from '@repo/game';
	import type { Action, CardId, Command, Decide, Play, PublicState, Purchase, SeatId } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { cubicIn } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import ActionIcon from './ActionIcon.svelte';
	import { cityName, decideLabel, decisionTitle, seatName, SEAT_COLORS, cardName } from './labels.svelte.ts';
	import InfectionCard from '#lib/cards/InfectionCard.svelte';
	import { deal } from './deal.ts';
	import { sortHand } from './handOrder.ts';
	import PlayerCard from './PlayerCard.svelte';

	type Props = {
		snap: PublicState;
		canAct: boolean;
		/** Whether this client plays the seat. Prompts and discards are offered only to whoever they belong to. */
		owns: (seat: SeatId) => boolean;
		/** The hand held up in the dock, and the hand that is this player's own. */
		seat: SeatId;
		home: SeatId;
		plays: { seat: SeatId; card: CardId; play: Play }[];
		decides: Decide[];
		send: (command: Command) => void;
		onview: (seat: SeatId) => void;
		/** An action or card waiting for a city on the map. */
		aiming: { label: string; a: Action['a'] | null; count: number } | null;
		oncancel: () => void;
		/** The ways to use a card in hand right now, shown as tags over the card. */
		uses: (seat: SeatId, card: CardId) => { key: string; label: string; icon: Action['a'] | null; run: () => void }[];
		onplaycard: (seat: SeatId, card: CardId) => void;
	};

	let { snap, canAct, owns, seat, home, plays, decides, send, onview, aiming, oncancel, uses, onplaycard }: Props =
		$props();

	const world = $derived(snap.world);
	const game = $derived(world.game!);
	/** Abilities the group may take during setup with units a Legacy card gave it for nothing. */
	const freeAbilities = $derived.by(() => {
		const { campaign } = world;
		const offers: Extract<Purchase, { t: 'ability' }>[] = [];
		if (snap.phase !== 'setup.supply' || campaign.freeAbilityUnits <= 0) return offers;
		for (const ability of campaign.abilitiesForSale)
			for (const character of Object.values(campaign.characters)) {
				const purchase = {
					t: 'ability' as const,
					ability,
					character: character.id,
					slot: character.slots.indexOf(null),
				};
				if (purchase.slot >= 0 && reject(world, snap.phase, { type: 'PURCHASE', purchase }) === null)
					offers.push(purchase);
			}
		return offers;
	});

	const pending = $derived(game.pending[0]);
	const cardsOf = (other: SeatId) =>
		(game.players[other]?.hand ?? []).flatMap(id => world.campaign.playerCards[id] ?? []);
	const handCards = $derived(sortHand(cardsOf(seat), card => cardName(world, card.id)));
	const drawnThisTurn = $derived.by(() => {
		const since = game.log.slice(game.log.findLastIndex(entry => entry.t === 'turn') + 1);
		return new Set(since.flatMap(entry => (entry.t === 'draw' && entry.seat === seat ? [entry.card] : [])));
	});
	const seatColor = (other: SeatId) => SEAT_COLORS[game.seats.indexOf(other)];
	// The fan tightens as the hand grows, and further when its column is too narrow, so it never reaches the prompts.
	let handWidth = $state(0);
	let hand = $state<HTMLElement>();
	const cardWidth = $derived.by(() => {
		void handCards.length;
		void handWidth;
		return (hand?.querySelector('.slot') as HTMLElement | null)?.offsetWidth ?? 0;
	});
	const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
	const overlap = $derived.by(() => {
		const count = handCards.length;
		const loose = Math.max(0.3, Math.min(2.9, (count - 3) * 0.55));
		if (count < 2 || !cardWidth || !handWidth) return loose;
		const room = handWidth - 1.2 * rem();
		return Math.max(loose, (count * cardWidth - room) / (count - 1) / rem());
	});
	const fanAngle = (index: number) => (index - (handCards.length - 1) / 2) * Math.min(4.5, 22 / handCards.length);
	const mustDiscard = $derived(owns(seat) && decides.some(decide => decide.d === 'discard' && decide.seat === seat));
	const playable = $derived(new Set(plays.filter(option => option.seat === seat).map(option => option.card)));
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
	// The hand limit waits until both cards of a draw are in hand, so being over it does not always mean discarding now.
	const discarding = $derived(
		overLimit.filter(other => decides.some(decide => decide.d === 'discard' && decide.seat === other)),
	);
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
		<div class="group" data-testid="drawn">
			<div class="cards" title="Drawn this turn">
				{#each drawn.cards as card (card.id)}
					{@const struck =
						card.kind === 'epidemic'
							? drawn.epidemics[drawn.cards.filter(other => other.kind === 'epidemic').indexOf(card)]
							: undefined}
					<div class="drawn" in:fly={{ y: -24, duration: 380 }}>
						{#if card.kind === 'epidemic'}
							<!-- The Epidemic card carries what it did, so the draw reads in one glance. -->
							<div class="epidemic" data-testid="epidemic">
								<strong>Epidemic</strong>
								<span>
									{struck?.city ? `${cityName(struck.city)} −${struck.removed}` : 'No city struck'}{struck
										? `, rate ${struck.rate}`
										: ''}
								</span>
							</div>
						{:else}
							<PlayerCard {card} small />
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}

<div
	class="frame"
	{@attach feedback(undefined, () => ({
		seat,
		home,
		canAct,
		phase: snap.phase,
		aiming: aiming?.label ?? null,
		plays: plays.length,
		decides: decides.length,
	}))}
>
	<footer class="dock">
		{#if snap.phase === 'setup.supply'}
			<div class="setup">
				<div
					title="Click a city to place a cube from the stockpile, right-click to take it back."
					data-testid="supply-left"
				>
					<strong>{game.stockpile}</strong> cube{game.stockpile === 1 ? '' : 's'} left to place
				</div>
				{#if freeAbilities.length}
					<details class="free" data-testid="free-abilities">
						<summary>
							{world.campaign.freeAbilityUnits} free unit{world.campaign.freeAbilityUnits === 1 ? '' : 's'} for abilities
						</summary>
						<div class="free-list">
							{#each freeAbilities as purchase (`${purchase.ability}:${purchase.character}`)}
								{@const def = pack.abilities.find(ability => ability.id === purchase.ability)!}
								<button title={def.text} onclick={() => send({ type: 'PURCHASE', purchase })}>
									{def.name} ({def.cost}) for {world.campaign.characters[purchase.character]!.name}
								</button>
							{/each}
						</div>
					</details>
				{/if}
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
				<div>Pick <strong>{eventsNeeded}</strong> Rationed Events for the deck. {picked.length} chosen.</div>
				<!-- Every Rationed Event as the card a hand holds, with its full text, so the choice never depends on memory. -->
				<div class="events" data-testid="rationed-events" in:fly={{ y: 40, duration: 380 }}>
					{#each rationed as card (card.id)}
						{@const chosen = picked.includes(card.id)}
						<div class="pick" class:picked={chosen} data-picked={chosen}>
							<PlayerCard {card} tone={chosen ? 'play' : null} onclick={() => toggleEvent(card.id)} />
							{#if chosen}<span class="check" aria-label="chosen" in:fly={{ y: -6, duration: 200 }}>✓</span>{/if}
						</div>
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
				<button class="primary" onclick={() => send({ type: 'CONTINUE' })} data-testid="continue">Go to game end</button
				>
			</div>
		{:else}
			<div class="held">
				{#if seat !== home}
					<button class="back" style:--seat={seatColor(seat)} onclick={() => onview(home)}
						>{seatName(world, seat)}'s hand. Back to {seatName(world, home)}</button
					>
				{/if}
				{#key seat}
					<div
						class="hand"
						data-testid="hand"
						bind:this={hand}
						bind:clientWidth={handWidth}
						style:--overlap={`${overlap}rem`}
						in:fade={{ duration: 220 }}
					>
						{#each handCards as card, index (card.id)}
							<div
								class="slot"
								data-card={card.id}
								animate:flip={{ duration: 320 }}
								in:deal={{ drawn: drawnThisTurn.has(card.id) }}
								out:fly={{ y: -140, duration: 260, easing: cubicIn }}
							>
								{#if !mustDiscard}
									{@const tags = uses(seat, card.id)}
									{#if tags.length}
										<div class="tags" data-testid="card-uses">
											{#each tags as tag, order (tag.key)}
												<button style:--i={order} data-use={tag.key} onclick={tag.run}>
													{#if tag.icon}<ActionIcon action={tag.icon} size="1.5rem" />{:else}<i class="star">✦</i>{/if}
													{tag.label}
												</button>
											{/each}
										</div>
									{/if}
								{/if}
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
				{#if discarding.length}
					<div class="slip">
						<p class="prompt">
							{discarding.map(other => seatName(world, other)).join(', ')} must discard down to the hand limit.
							{discarding.some(owns) ? 'Click a card in that hand, or play an event.' : 'Waiting for them.'}
						</p>
					</div>
				{:else if overLimit.length && !pending}
					<div class="slip">
						<p class="prompt">
							{overLimit.map(other => seatName(world, other)).join(', ')} is over the hand limit and discards once the draw
							is finished.
						</p>
					</div>
				{:else if pending}
					<div class="slip">
						<p class="prompt">{decisionTitle(world, pending)}</p>
						{#if choices.length}
							<div class="chips">
								{#each choices.slice(0, 24) as decide, index (index)}
									<button onclick={() => send({ type: 'DECIDE', decide })}>{decideLabel(world, decide)}</button>
								{/each}
							</div>
						{:else}
							<p class="waiting">Waiting for {seatName(world, decider)}.</p>
						{/if}
					</div>
				{:else if snap.phase === 'playing.actions'}
					{#if canAct && aiming}
						<div class="slip step aiming" data-testid="aiming">
							{#if aiming.a}<ActionIcon action={aiming.a} size="2.4rem" />{/if}
							<div class="say">
								<strong>{aiming.label}</strong>
								<span
									>{aiming.count === 1 ? 'Click the lit city' : `Click one of the ${aiming.count} lit cities`} on the map.
									Esc or a right click cancels.</span
								>
							</div>
							<button onclick={oncancel} data-testid="cancel-aim">Cancel</button>
						</div>
					{/if}
				{:else if snap.phase === 'playing.draw'}
					<div class="slip">
						<div class="say line">
							<strong>Draw Player cards</strong>
							<span>{seatName(world, game.active)} has <b>{game.drawsLeft}</b> to draw.</span>
						</div>
						{@render drew()}
					</div>
				{:else}
					<div class="slip">
						<div class="say line">
							<strong>Infect cities</strong>
							<span><b>{game.infectionsLeft}</b> left to flip</span>
						</div>
						<div class="tray">
							{@render drew()}
							{#if flipped.length}
								<div class="group">
									<div class="cards flipped" data-testid="flipped" title="Flipped this Infect step">
										{#each flipped as entry (entry.seq)}
											<div class="flipcard" animate:flip={{ duration: 300 }}>
												<InfectionCard card={entry.card} note={entry.note} />
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</footer>
</div>

<style>
	.slip.step {
		flex-direction: row;
		align-items: center;
		gap: 0.8rem;
	}

	.say {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.say.line {
		flex-direction: row;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 0.7rem;
	}

	.say strong {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 400;
		line-height: 1.05;
	}

	.say span {
		color: var(--muted);
		font-size: 0.92rem;
		line-height: 1.3;
	}

	.say b {
		color: var(--paper);
		font-size: 1.05rem;
	}

	.step.aiming {
		border-color: var(--warn);
	}

	.step.aiming strong {
		color: var(--warn);
	}

	.step.aiming button {
		margin-left: auto;
		padding: 0.35rem 0.8rem;
		border: 1px solid var(--line-strong);
		border-radius: 2px;
		background: none;
		color: var(--ink);
		font: inherit;
		cursor: pointer;
	}

	.step.aiming button:hover {
		border-color: var(--paper);
		background: var(--wash);
	}

	.tray {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.6rem 1.2rem;
		min-width: 0;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.cards {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		--card-size: 0.82rem;
	}

	.epidemic {
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: 7.6em;
		height: 3em;
		padding: 0 0.6em;
		border: 1px solid #5e140e;
		border-radius: 0.4em;
		background: linear-gradient(172deg, #a8261c, #6d150f);
		color: #fff1e6;
		font-size: var(--card-size);
		animation: alarm 900ms ease-out 2;
	}

	.epidemic strong {
		font-family: var(--font-display);
		font-size: 1.12em;
		font-weight: 400;
		line-height: 1;
	}

	.epidemic span {
		overflow: hidden;
		font-size: 0.7em;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@keyframes alarm {
		50% {
			box-shadow: 0 0 0 0.35rem rgb(207 91 62 / 0.45);
		}
	}

	/* Each way to use a card stands as a tag over it once it rises out of the fan. */
	.tags {
		position: absolute;
		bottom: calc(100% + 3.4rem);
		left: 50%;
		z-index: 6;
		display: none;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		translate: -50% 0;
	}

	.slot:hover .tags,
	.slot:focus-within .tags {
		display: flex;
	}

	.tags button {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0.7rem 0.15rem 0.15rem;
		border: 1px solid rgb(42 32 23 / 0.55);
		border-radius: 999px;
		background: rgb(240 231 210 / 0.97);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font: inherit;
		font-size: 0.86rem;
		font-weight: 650;
		white-space: nowrap;
		cursor: pointer;
		animation: tag 220ms calc(var(--i) * 40ms) cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
		transition:
			background 140ms ease,
			scale 140ms ease;
	}

	.tags button:hover {
		background: #fff8e6;
		scale: 1.05;
	}

	.tags :global(.icon) {
		border-radius: 50%;
	}

	.star {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: #b08628;
		color: #fff8e6;
		font-style: normal;
	}

	@keyframes tag {
		from {
			opacity: 0;
			translate: 0 0.5rem;
		}
	}

	/* No tray: the hand and the step's slip float over the bottom of the map, and only they take clicks. The slip
	   stands beside the hand, never above it, so the band the board leaves free stays the hand's height all turn and
	   the map holds still from one step to the next. */
	.dock {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 1.2rem;
		padding-bottom: 0.6rem;
	}

	.dock :is(button, input, summary, .slot, .events, .free-list, .slip, .setup) {
		pointer-events: auto;
	}

	.slip,
	.setup {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		padding: 0.55rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--panel);
		backdrop-filter: blur(10px);
		box-shadow: 0 0.6rem 1.6rem rgb(0 0 0 / 0.4);
		animation: rise 320ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
	}

	.setup {
		position: relative;
		flex-direction: row;
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

	.free {
		position: relative;
	}

	.free summary {
		cursor: pointer;
		color: var(--paper);
	}

	.free-list {
		position: absolute;
		bottom: calc(100% + 0.6rem);
		left: 50%;
		display: grid;
		grid-template-columns: repeat(3, minmax(13rem, 1fr));
		gap: 0.3rem;
		max-height: min(26rem, calc(100vh - 14rem));
		padding: 0.6rem;
		overflow: auto;
		translate: -50% 0;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: var(--panel);
	}

	.setup .lost strong {
		color: var(--danger);
	}

	.events {
		position: absolute;
		bottom: calc(100% + 0.6rem);
		left: 50%;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.9rem;
		width: max-content;
		max-width: min(66rem, calc(100vw - 4rem));
		padding: 0.9rem 1rem;
		border-radius: 2px;
		background: var(--document);
		box-shadow: var(--document-shadow);
		translate: -50% 0;
		--card-size: 1rem;
	}

	/* A card not chosen stands back a little; a chosen one lifts and wears a check. */
	.pick {
		position: relative;
		opacity: 0.82;
		transition:
			opacity 160ms ease,
			translate 200ms cubic-bezier(0.3, 1.4, 0.5, 1);
	}

	.pick:hover,
	.pick.picked {
		opacity: 1;
	}

	.pick.picked {
		translate: 0 -0.35rem;
	}

	.check {
		position: absolute;
		top: -0.55rem;
		right: -0.55rem;
		display: grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border: 2px solid var(--document);
		border-radius: 50%;
		background: var(--ink-good);
		color: #f4efe2;
		font-weight: 700;
		box-shadow: 0 2px 4px rgb(0 0 0 / 0.35);
		pointer-events: none;
	}

	/* The fan's overlap is worked out from the room it has, so the hand takes all the width the step's slip leaves. */
	.held {
		position: relative;
		display: flex;
		flex: 1 1 0;
		flex-direction: column;
		min-width: 0;
		align-items: center;
		gap: 0.4rem;
	}

	.back {
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--seat);
		border-radius: 999px;
		background: var(--panel);
		box-shadow: 0 0.3rem 0.8rem rgb(0 0 0 / 0.35);
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.back:hover {
		background: var(--wash);
	}

	.hand {
		--card-size: 0.8rem;
		display: flex;
		align-self: stretch;
		justify-content: center;
		min-width: 0;
		padding-inline: calc(var(--overlap) / 2 + 0.6rem);
	}

	.slot {
		position: relative;
		margin-inline: calc(var(--overlap) / -2);
	}

	.slot:hover {
		z-index: 5;
	}

	/* No bar behind the hand, so each card carries its own shadow onto the map. */
	.lift {
		filter: drop-shadow(0 0.45rem 0.7rem rgb(0 0 0 / 0.5));
		transform: translateY(var(--drop)) rotate(var(--angle));
		transform-origin: 50% 140%;
		transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	/* A card pointed at rises out of the fan, mostly straightened and large enough to read. */
	.slot:hover .lift {
		transform: translateY(-0.6rem) rotate(calc(var(--angle) * 0.2)) scale(1.3);
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
		flex: 0 1 auto;
		flex-direction: column;
		justify-content: flex-end;
		max-width: min(30rem, 48%);
		min-width: 0;
	}

	.middle:not(:has(.slip)) {
		display: none;
	}

	.prompt {
		color: var(--ink);
		line-height: 1.35;
	}

	.chips > button {
		animation: rise 300ms calc(var(--i, 0) * 35ms) both;
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 0.6rem;
		}
	}

	.waiting {
		margin: 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	.flipcard {
		flex: none;
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

	.cards.flipped {
		--card-size: 0.5rem;
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
	.setup button {
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
	.setup button:hover:not(:disabled) {
		border-color: var(--paper);
		background: var(--wash);
	}

	.chips button:active:not(:disabled) {
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

	button.primary,
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
