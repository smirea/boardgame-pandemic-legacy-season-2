<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { handLimit, pack, reject } from '@repo/game';
	import type { Action, CardId, Command, Decide, Play, PublicState, Purchase, SeatId } from '@repo/game';
	import { flip } from 'svelte/animate';
	import { cubicIn } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import ActionIcon from './ActionIcon.svelte';
	import type { CardUse, DockChoice, HandPick } from './choosing.svelte.ts';
	import { cityName, decideLabel, decisionTitle, seatName, SEAT_COLORS, cardName } from './labels.svelte.ts';
	import { deal } from './deal.ts';
	import { sortHand } from './handOrder.ts';
	import PlayerCard, { HAND_CARD_SIZE } from './PlayerCard.svelte';
	import { keep } from './viewState.ts';

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
		/** What waits for a click on the map, and what the slip asks for. */
		aiming: { label: string; a: Action['a'] | null; prompt: string } | null;
		/** An action or Lockdown waiting for card(s) to be clicked directly in the hand. */
		handPick?: HandPick | null;
		/** An inline mode choice in the dock slip (such as Produce Supplies local vs system-wide). */
		dockChoice?: DockChoice | null;
		onhandcard?: (seat: SeatId, card: CardId) => void;
		onhandconfirm?: () => void;
		onhandtoggle?: () => void;
		oncancel: () => void;
		/** The ways to use a card in hand right now, shown as tags over the card. */
		uses: (seat: SeatId, card: CardId) => CardUse[];
		onplaycard: (seat: SeatId, card: CardId) => void;
		/** Clicking a Produce Supplies card directly runs its sole mode, opens its inline choice, or reports why it cannot run. */
		onproducecard?: (seat: SeatId, card: CardId) => void;
		/** Destroying a Lockdown card costs a Player card, so the screen asks whose. */
		onlockdown?: (card: CardId) => void;
		/** How many of the cards that open a game are still to flip at the turn desk. Picking Events waits for the last. */
		opening?: number | null;
		/** Cards drawn into a hand whose flight there has not landed: the hand keeps their place and hides them. */
		arriving?: ReadonlySet<CardId>;
	};

	let {
		snap,
		canAct,
		owns,
		seat,
		home,
		plays,
		decides,
		send,
		onview,
		aiming,
		handPick = null,
		dockChoice = null,
		onhandcard,
		onhandconfirm,
		onhandtoggle,
		oncancel,
		uses,
		onplaycard,
		onproducecard,
		onlockdown,
		opening = null,
		arriving = new Set(),
	}: Props = $props();

	const world = $derived(snap.world);
	const game = $derived(world.game!);
	/** Abilities the group may take during setup with units a Legacy card gave it for nothing. */
	const freeAbilities = $derived.by(() => {
		const { campaign } = world;
		const offers: Extract<Purchase, { t: 'ability' }>[] = [];
		if (snap.phase !== 'setup.supply' || campaign.freeAbilityUnits <= 0) return offers;
		for (const ability of new Set(campaign.abilitiesForSale))
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
	// An Epidemic is started from its card beside the deck and its steps follow on the Epidemic's own panel, so the
	// slip beside the hand only speaks up for what can be played into it.
	const epidemicStep = $derived(
		pending?.t === 'epidemicDrawn' || pending?.t === 'epidemicInfect' || pending?.t === 'intensify',
	);
	const lockable = $derived(
		game.infectionDiscard.flatMap(id => {
			const card = world.campaign.infectionCards[id];
			return card?.kind === 'city' && card.improvement === 'lockdown' ? [{ id, city: card.city }] : [];
		}),
	);
	const myLockPay = $derived(
		game.seats.filter(owns).flatMap(other => game.players[other]!.hand.map(pay => ({ seat: other, pay })))[0] ?? null,
	);
	const lockableHere = $derived(
		onlockdown && myLockPay && snap.phase.startsWith('playing') && !(canAct && snap.phase === 'playing.actions')
			? lockable.filter(card => reject(world, snap.phase, { type: 'LOCKDOWN', card: card.id, ...myLockPay }) === null)
			: [],
	);
	const cardsOf = (other: SeatId) =>
		(game.players[other]?.hand ?? []).flatMap(id => world.campaign.playerCards[id] ?? []);
	const handCards = $derived(sortHand(cardsOf(seat), card => cardName(world, card.id)));
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
		const loose = Math.max(0.35, Math.min(3.4, (count - 3) * 0.65));
		if (count < 2 || !cardWidth || !handWidth) return loose;
		const room = handWidth - 1.2 * rem();
		return Math.max(loose, (count * cardWidth - room) / (count - 1) / rem());
	});
	let skipFree = $state(false);
	$effect(() => {
		void snap.phase;
		void freeAbilities.length;
		skipFree = false;
	});
	function confirmSupply() {
		if (freeAbilities.length > 0 && !skipFree) {
			skipFree = true;
			return;
		}
		send({ type: 'CONFIRM_SUPPLY' });
	}
	const hollowSetup = $derived(world.campaign.rules.includes('hollowSetup'));
	const fanAngle = (index: number) => (index - (handCards.length - 1) / 2) * Math.min(4.5, 22 / handCards.length);
	const mustDiscard = $derived(owns(seat) && decides.some(decide => decide.d === 'discard' && decide.seat === seat));
	const playable = $derived(new Set(plays.filter(option => option.seat === seat).map(option => option.card)));
	// Pending decisions where the player picks a card directly from hand (cordon, shield, giveCard).
	const pendingHandKind = $derived(
		pending && (pending.t === 'cordon' || pending.t === 'shield' || pending.t === 'giveCard') ? pending.t : null,
	);
	let pickedGiveCard = $state<CardId | null>(null);
	$effect(() => {
		void pending;
		pickedGiveCard = null;
	});
	const pendingHandSeats = $derived.by(() => {
		if (!pendingHandKind) return [] as SeatId[];
		if (pendingHandKind === 'giveCard') {
			return pending?.t === 'giveCard' && owns(pending.seat) ? [pending.seat] : [];
		}
		return [
			...new Set(
				decides
					.filter(
						(decide): decide is Extract<Decide, { d: 'cordon' | 'shield' }> =>
							decide.d === pendingHandKind && owns(decide.seat),
					)
					.map(decide => decide.seat),
			),
		];
	});
	const pendingHandMap = $derived.by(() => {
		const map = new Map<CardId, Decide[]>();
		if (!pendingHandKind || !owns(seat)) return map;
		for (const decide of decides) {
			if (decide.d === 'cordon' || decide.d === 'shield') {
				if (decide.d === pendingHandKind && decide.seat === seat)
					map.set(decide.card, [...(map.get(decide.card) ?? []), decide]);
			} else if (decide.d === 'giveCard' && pending?.t === 'giveCard' && pending.seat === seat) {
				map.set(decide.card, [...(map.get(decide.card) ?? []), decide]);
			}
		}
		return map;
	});
	const pendingHandActive = $derived(pendingHandSeats.length > 0);
	const handPickEligible = $derived(handPick ? handPick.eligible(seat) : new Set<CardId>());
	const handPickSeats = $derived(
		handPick && handPick.seat === null
			? game.seats.filter(other => owns(other) && handPick.eligible(other).size > 0)
			: [],
	);
	const handSelectionMode = $derived(Boolean(handPick) || mustDiscard || pendingHandActive);
	// While a choice waits, an event another of this screen's seats may play now is offered on the prompt itself.
	const elsewhere = $derived(
		pending
			? [
					...new Map(
						plays.filter(option => option.seat !== seat && owns(option.seat)).map(option => [option.card, option]),
					).values(),
				]
			: [],
	);
	const decider = $derived(pending && 'seat' in pending && pending.seat ? pending.seat : game.active);
	// Card-discard / card-give decisions are answered by clicking a card in hand; the slip keeps only non-card choices (such as Skip).
	const choices = $derived(
		decides.filter(decide => {
			if (decide.d === 'discard') return false;
			if (decide.d === 'shield' || decide.d === 'cordon' || decide.d === 'giveCard') return false;
			if (epidemicStep && decide.d === 'skip') return false;
			return owns(decider);
		}),
	);
	const giveRecipients = $derived(
		pickedGiveCard
			? decides.filter(
					(decide): decide is Extract<Decide, { d: 'giveCard' }> =>
						decide.d === 'giveCard' && decide.card === pickedGiveCard,
				)
			: [],
	);
	function clickPendingHandCard(card: CardId) {
		const options = pendingHandMap.get(card);
		if (!options?.length) return;
		if (options.length === 1) {
			send({ type: 'DECIDE', decide: options[0]! });
			pickedGiveCard = null;
			return;
		}
		if (pendingHandKind === 'giveCard') pickedGiveCard = pickedGiveCard === card ? null : card;
	}
	const overLimit = $derived(game.seats.filter(other => game.players[other]!.hand.length > handLimit(world, other)));
	// The hand limit waits until both cards of a draw are in hand, so being over it does not always mean discarding now.
	const discarding = $derived(
		overLimit.filter(other => decides.some(decide => decide.d === 'discard' && decide.seat === other)),
	);
	const rationed = $derived(
		Object.values(world.campaign.playerCards).filter(card => card.kind === 'event' && card.mode === 'rationed'),
	);
	const eventsNeeded = $derived(Math.min(world.campaign.rationing, rationed.length));

	// The engine only accepts a full pick, so a swap in progress lives here until it is complete again.
	let draft = $state<CardId[] | null>(null);
	keep(
		'dock',
		() => ({ draft }),
		saved => (draft = saved.draft),
	);
	const picked = $derived(draft ?? game.pickedEvents);

	function toggleEvent(card: CardId) {
		const next = picked.includes(card) ? picked.filter(id => id !== card) : [...picked, card];
		if (next.length > eventsNeeded) return;
		draft = next.length === eventsNeeded ? null : next;
		if (next.length === eventsNeeded) send({ type: 'PICK_EVENTS', cards: next });
	}
</script>

<svelte:window onkeydown={event => event.key === 'Escape' && (pickedGiveCard = null)} />

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
	<footer class="dock" data-dest="hand">
		{#if snap.phase === 'setup.supply'}
			<div class="setup">
				<div data-testid="supply-left">
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
								<button onclick={() => send({ type: 'PURCHASE', purchase })}>
									{def.name} ({def.cost}) for {world.campaign.characters[purchase.character]!.name}
								</button>
							{/each}
						</div>
					</details>
				{/if}
				<button onclick={() => send({ type: 'AUTO_SUPPLY' })} data-testid="auto-supply">Spread the rest evenly</button>
				<button
					class="primary"
					class:warn-skip={skipFree}
					disabled={game.stockpile > 0}
					onclick={confirmSupply}
					data-testid="confirm-supply"
				>
					{#if skipFree}
						Skip {world.campaign.freeAbilityUnits} free unit{world.campaign.freeAbilityUnits === 1 ? '' : 's'} &amp; infect
					{:else}
						Infect 9 cities
					{/if}
				</button>
			</div>
		{:else if opening !== null}
			<div class="setup" data-testid="setup-infect-bar">
				<div>
					{#if opening > 0}
						<strong>{opening}</strong> Infection card{opening === 1 ? '' : 's'} left to flip. Anyone can click the Infection
						deck, or press Space.
						{#if hollowSetup}
							<span class="hollow-note" class:now={opening <= 3} data-testid="hollow-setup-note">
								{#if opening <= 3}
									Next {opening} flip{opening === 1 ? '' : 's'} place Hollow Men
								{:else}
									Last 3 flips place Hollow Men
								{/if}
							</span>
						{/if}
					{:else}
						The last city is infected
					{/if}
				</div>
			</div>
		{:else if snap.phase === 'setup.events'}
			<div class="setup">
				{#if eventsNeeded === 0}
					<div data-testid="no-funding">No funding — no rationed events for you.</div>
				{:else}
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
				{/if}
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
						class:picking={handSelectionMode}
						data-testid="hand"
						bind:this={hand}
						bind:clientWidth={handWidth}
						style:--card-size={`${HAND_CARD_SIZE}rem`}
						style:--overlap={`${overlap}rem`}
						in:fade={{ duration: 220 }}
					>
						{#each handCards as card, index (card.id)}
							{@const tags = handSelectionMode
								? mustDiscard && playable.has(card.id)
									? uses(seat, card.id).filter(tag => tag.key === 'play')
									: []
								: uses(seat, card.id)}
							{@const inHandPick = handPick !== null}
							{@const pickEligible = inHandPick && handPickEligible.has(card.id)}
							{@const pickSelected = inHandPick && handPick!.selected.includes(card.id)}
							{@const pendingEligible = !inHandPick && !mustDiscard && pendingHandActive && pendingHandMap.has(card.id)}
							{@const pendingSelected = pendingHandKind === 'giveCard' && pickedGiveCard === card.id}
							{@const produceReady =
								!handSelectionMode &&
								card.kind === 'produce' &&
								tags.some(tag => tag.key.startsWith('produce:') && !tag.disabled)}
							{@const searchReady =
								!handSelectionMode && card.kind === 'city' && tags.some(tag => tag.key.startsWith('search:'))}
							{@const cardTone = inHandPick
								? pickEligible
									? 'discard'
									: null
								: mustDiscard
									? 'discard'
									: pendingEligible
										? pendingHandKind === 'giveCard'
											? 'play'
											: 'discard'
										: playable.has(card.id) || produceReady || searchReady
											? 'play'
											: null}
							{@const cardDimmed =
								(inHandPick && !pickEligible) || (!inHandPick && !mustDiscard && pendingHandActive && !pendingEligible)}
							{@const cardClick = inHandPick
								? pickEligible
									? () => onhandcard?.(seat, card.id)
									: undefined
								: mustDiscard
									? () => send({ type: 'DECIDE', decide: { d: 'discard', seat, cards: [card.id] } })
									: pendingEligible
										? () => clickPendingHandCard(card.id)
										: playable.has(card.id)
											? () => onplaycard(seat, card.id)
											: card.kind === 'produce' && onproducecard
												? () => onproducecard(seat, card.id)
												: undefined}
							<div
								class="slot"
								class:arriving={arriving.has(card.id)}
								class:selected={pickSelected || pendingSelected}
								data-card={card.id}
								animate:flip={{ duration: 320 }}
								in:deal
								out:fly={{ y: -140, duration: 260, easing: cubicIn }}
							>
								{#if tags.length}
									<div class="tags" data-testid="card-uses">
										{#each tags as tag, order (tag.key)}
											<button
												type="button"
												class:muted={tag.disabled}
												style:--i={order}
												data-use={tag.key}
												aria-disabled={tag.disabled ? 'true' : undefined}
												onclick={tag.run}
											>
												{#if tag.icon}<ActionIcon action={tag.icon} size="1.5rem" />{:else}<i class="star">✦</i>{/if}
												{tag.label}
											</button>
										{/each}
									</div>
								{/if}
								<div
									class="lift"
									style:--angle={`${fanAngle(index)}deg`}
									style:--drop={`${Math.abs(fanAngle(index)) * 0.06}rem`}
								>
									<PlayerCard
										{card}
										tone={cardTone}
										selected={pickSelected || pendingSelected}
										dimmed={cardDimmed}
										focusable={!cardClick && tags.length > 0}
										onclick={cardClick}
									/>
									{#if pickSelected || pendingSelected}
										<span class="hand-check" aria-label="selected">✓</span>
									{/if}
								</div>
							</div>
						{:else}
							<p class="empty">No cards in hand.</p>
						{/each}
					</div>
				{/key}
			</div>

			<div class="middle">
				{#if handPick}
					<div class="slip step aiming" data-testid="hand-pick">
						{#if handPick.a}<ActionIcon action={handPick.a} size="2.4rem" />{/if}
						<div class="say">
							<strong>{handPick.title}</strong>
							<span>{handPick.prompt} Esc or a right click cancels.</span>
							{#if handPickSeats.length > 1}
								<div class="hand-switch" data-testid="hand-pick-seats">
									<span>Hand:</span>
									{#each handPickSeats as other (other)}
										<button type="button" class:current={other === seat} onclick={() => onview(other)}>
											{seatName(world, other)}
										</button>
									{/each}
								</div>
							{/if}
						</div>
						<div class="step-actions">
							{#if handPick.toggle && onhandtoggle}
								<button
									type="button"
									class:active={handPick.toggle.active}
									data-testid="hand-pick-toggle"
									onclick={onhandtoggle}
								>
									{handPick.toggle.label}
								</button>
							{/if}
							{#if handPick.multi && onhandconfirm}
								<button
									type="button"
									class="primary"
									disabled={!handPick.canConfirm}
									data-testid="hand-pick-confirm"
									onclick={onhandconfirm}
								>
									{handPick.confirmLabel ?? 'Confirm'}
								</button>
							{/if}
							<button type="button" onclick={oncancel} data-testid="cancel-aim">Cancel</button>
						</div>
					</div>
				{:else if dockChoice}
					<div class="slip step aiming" data-testid="dock-choice">
						{#if dockChoice.a}<ActionIcon action={dockChoice.a} size="2.4rem" />{/if}
						<div class="say">
							<strong>{dockChoice.title}</strong>
							<span>{dockChoice.prompt}</span>
							<div class="chips">
								{#each dockChoice.options as option (option.key)}
									<button type="button" data-use={option.key} onclick={option.run}>{option.label}</button>
								{/each}
							</div>
						</div>
						<button type="button" onclick={oncancel} data-testid="cancel-aim">Cancel</button>
					</div>
				{:else if discarding.length}
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
				{:else if pending && (!epidemicStep || elsewhere.length || lockableHere.length)}
					<div class="slip">
						<p class="prompt">
							{decisionTitle(world, pending)}
							{#if pendingHandActive && pendingHandKind === 'giveCard' && !pickedGiveCard}
								Click a card in your hand to give.
							{:else if pendingHandActive && (pendingHandKind === 'cordon' || pendingHandKind === 'shield')}
								Click a highlighted card in hand to discard.
							{/if}
						</p>
						{#if pendingHandSeats.length > 1}
							<div class="hand-switch" data-testid="pending-hand-seats">
								<span>Hand:</span>
								{#each pendingHandSeats as other (other)}
									<button type="button" class:current={other === seat} onclick={() => onview(other)}>
										{seatName(world, other)}
									</button>
								{/each}
							</div>
						{/if}
						{#if pendingHandKind === 'giveCard' && pickedGiveCard && giveRecipients.length}
							<div class="chips" data-testid="give-card-recipients">
								{#each giveRecipients as decide (decide.to)}
									<button
										type="button"
										onclick={() => {
											send({ type: 'DECIDE', decide });
											pickedGiveCard = null;
										}}
									>
										Give {cardName(world, pickedGiveCard)} to {seatName(world, decide.to)}
									</button>
								{/each}
								<button type="button" onclick={() => (pickedGiveCard = null)}>Pick another card</button>
							</div>
						{/if}
						{#if choices.length}
							<div class="chips">
								{#each choices as decide, index (index)}
									<button onclick={() => send({ type: 'DECIDE', decide })}>{decideLabel(world, decide)}</button>
								{/each}
							</div>
						{:else if !epidemicStep && !pendingHandActive}
							<p class="waiting">Waiting for {seatName(world, decider)}.</p>
						{/if}
						{#if elsewhere.length || (lockableHere.length && onlockdown)}
							<div class="chips" data-testid="play-elsewhere">
								{#each elsewhere as option (option.card)}
									<button onclick={() => onplaycard(option.seat, option.card)}>
										{seatName(world, option.seat)}: play {cardName(world, option.card)}
									</button>
								{/each}
								{#if onlockdown}
									{#each lockableHere as card (card.id)}
										<button onclick={() => onlockdown(card.id)} data-testid="lockdown">
											Lockdown: destroy {cityName(card.city)}
										</button>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				{:else if snap.phase === 'playing.actions' && canAct && aiming}
					<div class="slip step aiming" data-testid="aiming">
						{#if aiming.a}<ActionIcon action={aiming.a} size="2.4rem" />{/if}
						<div class="say">
							<strong>{aiming.label}</strong>
							<span>{aiming.prompt} Esc or a right click cancels.</span>
						</div>
						<button onclick={oncancel} data-testid="cancel-aim">Cancel</button>
					</div>
				{/if}
				{#if !handPick && !dockChoice && lockableHere.length && onlockdown && (discarding.length || !pending)}
					<div class="slip">
						<div class="chips" data-testid="lockdown-bar">
							{#each lockableHere as card (card.id)}
								<button onclick={() => onlockdown(card.id)} data-testid="lockdown">
									Lockdown: destroy {cityName(card.city)}
								</button>
							{/each}
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

	.step.aiming {
		flex-wrap: wrap;
		border-color: var(--warn);
	}

	/* A slip asking for a click on the map or hand holds its words cleanly while leaving the fan room to spread. */
	.middle:has(.aiming) {
		min-width: min(16rem, 42%);
	}

	.step.aiming .say {
		flex: 1 1 10rem;
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

	.step.aiming button:hover:not(:disabled) {
		border-color: var(--paper);
		background: var(--wash);
	}

	.step.aiming button.primary {
		border-color: var(--paper);
		background: var(--paper);
		color: var(--paper-ink);
		font-weight: 700;
	}

	.step.aiming button.primary:hover:not(:disabled) {
		background: #e9dec5;
	}

	.step.aiming button.active {
		border-color: var(--warn);
		background: rgb(227 178 60 / 0.22);
		color: #fce29a;
	}

	.step-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
	}

	.step-actions button {
		margin-left: 0;
	}

	.hand-switch {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.25rem;
		color: var(--muted);
		font-size: 0.78rem;
	}

	.hand-switch button {
		margin-left: 0;
		padding: 0.14rem 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.hand-switch button.current {
		border-color: var(--paper);
		background: var(--wash);
		font-weight: 700;
	}

	.hand-check {
		position: absolute;
		top: -0.5rem;
		left: 0.35rem;
		z-index: 3;
		display: grid;
		place-items: center;
		width: 1.55rem;
		height: 1.55rem;
		border: 2px solid var(--table);
		border-radius: 50%;
		background: var(--good);
		color: #101914;
		font-size: 0.9rem;
		font-weight: 800;
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.45);
		pointer-events: none;
	}

	/* A card on its way from the deck has its place in the hand kept, and shows once its flight lands. */
	.slot.arriving {
		visibility: hidden;
	}

	.slot.selected .lift {
		transform: translateY(-0.95rem) rotate(calc(var(--angle) * 0.2));
	}

	/* Each way to use a card stands as a tag over it once it rises out of the fan. The bottom padding overlaps the
	   top edge of the lifted card so moving the pointer from the card onto a tag never drops :hover. */
	.tags {
		position: absolute;
		bottom: calc(100% + 3.55rem);
		left: 50%;
		z-index: 6;
		display: none;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding-bottom: 0.85rem;
		translate: -50% 0;
		pointer-events: auto;
	}

	.slot:hover .tags,
	.slot:has(:focus-visible) .tags,
	.slot:has(:global(.focus-only):focus) .tags,
	.slot:has(.tags :focus) .tags {
		display: flex;
	}

	.slot:has(:global([data-floating-upgrade])) .tags {
		bottom: calc(100% + 8.1rem);
		padding-bottom: 1rem;
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

	.tags button.muted {
		border-color: rgb(231 220 198 / 0.28);
		background: rgb(24 20 16 / 0.92);
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: 500;
		font-style: italic;
	}

	.tags button.muted:hover {
		background: rgb(32 27 22 / 0.95);
		scale: 1;
	}

	.tags button:not(.muted):hover {
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
		padding: 0.24rem 0.7rem;
		border: 1px solid var(--warn);
		border-radius: 999px;
		background: rgb(227 178 60 / 0.16);
		color: #fce29a;
		font-weight: 600;
		cursor: pointer;
	}

	.free summary:hover {
		background: rgb(227 178 60 / 0.26);
	}

	.setup button.warn-skip {
		border-color: var(--warn);
		background: var(--warn);
		color: #1c140a;
	}

	.hollow-note {
		display: inline-block;
		margin-left: 0.5rem;
		padding: 0.1rem 0.48rem;
		border: 1px solid rgb(186 154 232 / 0.45);
		border-radius: 999px;
		background: rgb(58 44 82 / 0.45);
		color: #d9c9f0;
		font-size: 0.78rem;
		font-weight: 600;
	}

	.hollow-note.now {
		border-color: #d97c6e;
		background: rgb(168 38 28 / 0.38);
		color: #ffd0c8;
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
		--card-size: 1.12rem;
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
		z-index: 6;
	}

	.slot:has(:focus-visible),
	.slot:has(:global(.focus-only):focus),
	.slot:has(.tags :focus) {
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
	.slot:hover .lift,
	.slot:has(:focus-visible) .lift,
	.slot:has(:global(.focus-only):focus) .lift {
		transform: translateY(-0.65rem) rotate(calc(var(--angle) * 0.15)) scale(1.22);
	}

	/* While picking cards to discard, lift cleanly without scaling sideways over adjacent cards in tight fans. */
	.hand.picking .slot:hover .lift,
	.hand.picking .slot:has(:focus-visible) .lift {
		transform: translateY(-1.15rem) rotate(calc(var(--angle) * 0.15)) scale(1.06);
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
