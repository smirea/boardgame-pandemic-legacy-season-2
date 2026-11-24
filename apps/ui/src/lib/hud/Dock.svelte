<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { handLimit, pack, reject, tablePlayers } from '@repo/game';
	import type {
		Action,
		CardId,
		CharacterId,
		Command,
		Decide,
		Play,
		PlayerId,
		PublicState,
		Purchase,
		SeatId,
	} from '@repo/game';
	import { untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { cubicIn } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import Beacon from '#lib/Beacon.svelte';
	import ActionIcon from './ActionIcon.svelte';
	import type { CardUse, DockChoice, HandPick } from './choosing.svelte.ts';
	import { cityName, decideLabel, decisionTitle, seatName, SEAT_COLORS, cardName } from './labels.svelte.ts';
	import { deal } from './deal.ts';
	import { sortHand } from './handOrder.ts';
	import VoteButton from './VoteButton.svelte';
	import { tableVoters, waitingOn } from './voters.ts';
	import PlayerCard, { HAND_CARD_SIZE } from './PlayerCard.svelte';
	import Portrait from './Portrait.svelte';
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
		aiming: {
			label: string;
			a: Action['a'] | null;
			prompt: string;
			/** A card that takes several places is sent once they are picked. */
			confirm: { label: string; ready: boolean } | null;
		} | null;
		onaimconfirm?: () => void;
		/** A word in the dock slip's choice, by its key. */
		onchip?: (key: string) => void;
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
		/** This browser's player, who votes to go on to game end. */
		player: PlayerId;
		spectator?: boolean;
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
		onaimconfirm,
		onchip,
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
		player,
		spectator = false,
	}: Props = $props();

	const world = $derived(snap.world);
	// Everyone at the table agrees before the game-end step opens, as for every other step the table takes together.
	const ended = $derived(world.game?.ended ?? []);
	const endVoters = $derived(tableVoters(world.table, who => ended.includes(who)));
	const endWaiting = $derived(waitingOn(endVoters, player));
	const seatedHere = $derived(tablePlayers(world.table).length === 0 || tablePlayers(world.table).includes(player));
	const game = $derived(world.game!);
	/**
	 * Abilities the group may take during setup with units a Legacy card gave it for nothing, as a table of abilities by
	 * the characters who may take them, the seated ones first in seat order.
	 */
	const freeAbilities = $derived.by(() => {
		const { campaign } = world;
		const none = { rows: [], characters: [] };
		if (snap.phase !== 'setup.supply' || campaign.freeAbilityUnits <= 0) return none;
		const seated = game.seats.map(other => game.players[other]!.character);
		const rank = (id: CharacterId) => (seated.includes(id) ? seated.indexOf(id) : Infinity);
		const rows = [...new Set(campaign.abilitiesForSale)].flatMap(ability => {
			const def = pack.abilities.find(candidate => candidate.id === ability)!;
			const buy = new Map<CharacterId, Extract<Purchase, { t: 'ability' }>>();
			for (const character of Object.values(campaign.characters)) {
				const purchase = {
					t: 'ability' as const,
					ability,
					character: character.id,
					slot: character.slots.indexOf(null),
				};
				if (purchase.slot >= 0 && reject(world, snap.phase, { type: 'PURCHASE', purchase }) === null)
					buy.set(character.id, purchase);
			}
			return buy.size ? [{ def, buy }] : [];
		});
		const characters = Object.values(campaign.characters)
			.filter(character => rows.some(row => row.buy.has(character.id)))
			.toSorted((a, b) => rank(a.id) - rank(b.id))
			.map(character => {
				const at = seated.indexOf(character.id);
				const job = character.job ? pack.jobs.find(candidate => candidate.id === character.job)!.name : null;
				return {
					character,
					color: at >= 0 ? SEAT_COLORS[at]! : '#4a4238',
					seated: at >= 0,
					job: job === character.name ? null : job,
				};
			});
		return { rows, characters };
	});

	const benched = $derived(freeAbilities.characters.filter(entry => !entry.seated).length);

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
		void freeAbilities.rows.length;
		skipFree = false;
	});
	function confirmSupply() {
		if (freeAbilities.rows.length > 0 && !skipFree) {
			skipFree = true;
			return;
		}
		send({ type: 'CONFIRM_SUPPLY' });
	}
	const hollowSetup = $derived(world.campaign.rules.includes('hollowSetup'));
	const fanAngle = (index: number) => (index - (handCards.length - 1) / 2) * Math.min(4.5, 22 / handCards.length);
	const mustDiscard = $derived(owns(seat) && decides.some(decide => decide.d === 'discard' && decide.seat === seat));
	const playable = $derived(new Set(plays.filter(option => option.seat === seat).map(option => option.card)));
	// Pending decisions where the player picks a card directly from hand (cordon, shield, guard, giveCard).
	const pendingHandKind = $derived(
		pending && (pending.t === 'cordon' || pending.t === 'shield' || pending.t === 'guard' || pending.t === 'giveCard')
			? pending.t
			: null,
	);
	let pickedGiveCard = $state<CardId | null>(null);
	let lastPending = untrack(() => pending);
	$effect(() => {
		if (pending === lastPending) return;
		lastPending = pending;
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
						(decide): decide is Extract<Decide, { d: 'cordon' | 'shield' | 'guard' }> =>
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
			if (decide.d === 'cordon' || decide.d === 'shield' || decide.d === 'guard') {
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
			if (decide.d === 'shield' || decide.d === 'cordon' || decide.d === 'guard' || decide.d === 'giveCard')
				return false;
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
		if (pendingHandKind === 'giveCard') {
			pickedGiveCard = pickedGiveCard === card ? null : card;
			return;
		}
		if (options.length === 1) {
			send({ type: 'DECIDE', decide: options[0]! });
			pickedGiveCard = null;
		}
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
		() => ({ draft, pickedGiveCard }),
		saved => {
			draft = saved.draft ?? null;
			pickedGiveCard = saved.pickedGiveCard ?? null;
		},
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="frame"
	oncontextmenu={event => {
		if (handPick || dockChoice || aiming) {
			event.preventDefault();
			oncancel();
		}
	}}
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
				{#if freeAbilities.rows.length}
					<details class="free" data-testid="free-abilities">
						<summary>
							{world.campaign.freeAbilityUnits} free unit{world.campaign.freeAbilityUnits === 1 ? '' : 's'} for abilities
						</summary>
						<div
							class="free-list"
							data-testid="free-ability-list"
							{@attach feedback('Free abilities', () => ({
								units: world.campaign.freeAbilityUnits,
								abilities: freeAbilities.rows.map(row => row.def.id),
								characters: freeAbilities.characters.map(entry => entry.character.name),
							}))}
						>
							<header>
								<strong>Free abilities</strong>
								<span>
									{world.campaign.freeAbilityUnits} unit{world.campaign.freeAbilityUnits === 1 ? '' : 's'} to spend before
									the game starts
								</span>
							</header>
							<table style:--columns={freeAbilities.characters.length}>
								<thead>
									{#if benched > 0}
										<tr class="groups">
											<th></th>
											{#if benched < freeAbilities.characters.length}
												<th colspan={freeAbilities.characters.length - benched}>At the table</th>
											{/if}
											<th colspan={benched} class="bench">Not playing</th>
										</tr>
									{/if}
									<tr>
										<th></th>
										{#each freeAbilities.characters as { character, color, seated, job }, index (character.id)}
											<th
												class="who"
												class:benched={!seated}
												class:first-benched={!seated && index === freeAbilities.characters.length - benched}
												style:--seat={color}
												scope="col"
											>
												<span class="face"><Portrait portrait={character.portrait} {color} job={character.job} /></span>
												<span class="name">{character.name}</span>
												{#if job}<small>{job}</small>{/if}
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each freeAbilities.rows as { def, buy } (def.id)}
										<tr data-ability={def.id}>
											<th scope="row">
												<span class="ability-head">
													<strong>{def.name}</strong>
													<span
														class="cost"
														role="img"
														aria-label={`Costs ${def.cost} unit${def.cost === 1 ? '' : 's'}`}
													>
														{#each { length: def.cost } as _, index (index)}<i></i>{/each}
													</span>
												</span>
												<span class="text">{def.text}</span>
											</th>
											{#each freeAbilities.characters as { character, color } (character.id)}
												{@const purchase = buy.get(character.id)}
												<td style:--seat={color}>
													{#if purchase}
														<button
															class="give"
															onclick={() => send({ type: 'PURCHASE', purchase })}
															aria-label={`Give ${def.name} to ${character.name}`}>+</button
														>
													{/if}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
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
				<div class="end-vote">
					<VoteButton
						label="Go to game end"
						tally="ready"
						voters={endVoters}
						on={ended.includes(player)}
						disabled={spectator || !seatedHere}
						onclick={() => send({ type: 'CONTINUE', player, done: !ended.includes(player) })}
						testid="continue"
					/>
					{#if endWaiting.length && ended.length}<small>Waiting for {endWaiting.join(', ')}</small>{/if}
				</div>
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
								? (mustDiscard || pendingHandKind === 'giveCard') && playable.has(card.id)
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
							{@const beckon = inHandPick
								? pickEligible && !pickSelected
								: (mustDiscard && owns(seat)) || (pendingEligible && !pendingSelected)}
							{@const cardTone =
								!beckon && !handSelectionMode && (playable.has(card.id) || produceReady || searchReady) ? 'play' : null}
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
										<span class="hand-check" aria-hidden="true">✓</span>
									{/if}
									{#if beckon}<Beacon />{/if}
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
							<span>{dockChoice.prompt} Esc or a right click cancels.</span>
							<div class="chips beckoning">
								{#each dockChoice.options as option (option.key)}
									<button type="button" data-use={option.key} onclick={() => onchip?.(option.key)}
										>{option.label}<Beacon gap="0.12rem" /></button
									>
								{/each}
							</div>
						</div>
						<button type="button" onclick={oncancel} data-testid="cancel-aim">Cancel</button>
					</div>
				{:else if aiming}
					<div class="slip step aiming" data-testid="aiming">
						{#if aiming.a}<ActionIcon action={aiming.a} size="2.4rem" />{/if}
						<div class="say">
							<strong>{aiming.label}</strong>
							<span>{aiming.prompt} Esc or a right click cancels.</span>
						</div>
						<div class="step-actions">
							{#if aiming.confirm}
								<button
									type="button"
									class="primary"
									disabled={!aiming.confirm.ready}
									data-testid="aim-confirm"
									onclick={onaimconfirm}>{aiming.confirm.label}</button
								>
							{/if}
							<button onclick={oncancel} data-testid="cancel-aim">Cancel</button>
						</div>
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
				{:else if pending && pending.t !== 'scar' && pending.t !== 'scarVote' && pending.t !== 'reveal' && pending.t !== 'search' && (!epidemicStep || elsewhere.length || lockableHere.length)}
					<div class="slip">
						<p class="prompt">
							{decisionTitle(world, pending)}
							{#if pendingHandActive && pendingHandKind === 'giveCard' && !pickedGiveCard}
								Click a card in your hand to give{playable.size ? ', or play an event' : ''}.
							{:else if pendingHandActive && pendingHandKind !== 'giveCard'}
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

	/* Each way to use a card stands as a tag over it once it rises out of the fan. The bottom padding meets the
	   top edge of the lifted card so moving the pointer from the card onto a tag never drops :hover. */
	.tags {
		position: absolute;
		bottom: calc(100% + 3.9rem);
		left: 50%;
		z-index: 6;
		display: none;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding-bottom: 0.45rem;
		translate: -50% 0;
		pointer-events: auto;
	}

	.hand.picking .tags {
		bottom: calc(100% + 1.95rem);
		padding-bottom: 0.45rem;
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

	.hand.picking .slot:has(:global([data-floating-upgrade])) .tags {
		bottom: calc(100% + 5.6rem);
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

	.end-vote {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	.end-vote small {
		color: var(--muted);
		font-size: 0.78rem;
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
		width: max-content;
		max-width: calc(100vw - 4rem);
		max-height: min(34rem, calc(100vh - 14rem));
		padding: 0.75rem 0.8rem 0.6rem;
		overflow: auto;
		translate: -50% 0;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		background: var(--panel);
		backdrop-filter: blur(10px);
		box-shadow: 0 0.8rem 2rem rgb(0 0 0 / 0.45);
	}

	.free-list header {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0 0.2rem 0.5rem;
	}

	.free-list header strong {
		color: #fce29a;
		font-size: 1.05rem;
	}

	.free-list header span,
	.free-list small,
	.free-list .text {
		color: var(--muted);
	}

	.free-list header span {
		font-size: 0.82rem;
	}

	.free-list table {
		border-collapse: separate;
		border-spacing: 0;
	}

	.free-list thead th {
		position: sticky;
		top: -0.75rem;
		z-index: 1;
		background: var(--panel);
	}

	.free-list th.who {
		width: 5.2rem;
		padding: 0 0.25rem 0.45rem;
		border-bottom: 2px solid var(--seat);
		font-weight: 400;
		text-align: center;
		vertical-align: bottom;
	}

	.free-list th.who.benched {
		opacity: 0.7;
	}

	.free-list th.who.first-benched,
	.free-list .groups .bench {
		border-left: 1px solid var(--line);
	}

	.free-list .groups th {
		top: -0.75rem;
		padding: 0 0.25rem 0.4rem;
		color: var(--muted);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-align: center;
		text-transform: uppercase;
	}

	.free-list .groups + tr th {
		top: 0.6rem;
	}

	.free-list .face {
		position: relative;
		display: block;
		width: 2.6rem;
		height: 2.6rem;
		margin: 0 auto 0.3rem;
		overflow: hidden;
		border-radius: 0.25rem;
	}

	.free-list .name,
	.free-list small {
		display: block;
		max-width: 5.2rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.free-list .name {
		font-size: 0.85rem;
	}

	.free-list small {
		font-size: 0.7rem;
	}

	.free-list tbody th {
		width: 15rem;
		padding: 0.5rem 1rem 0.5rem 0.2rem;
		font-weight: 400;
		text-align: left;
	}

	.free-list tbody tr + tr > * {
		border-top: 1px solid rgb(255 255 255 / 0.07);
	}

	.ability-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.ability-head strong {
		font-size: 0.98rem;
	}

	.cost {
		display: flex;
		gap: 0.18rem;
	}

	.cost i {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 2px;
		background: var(--warn);
		box-shadow: inset 0 -1px 0 rgb(0 0 0 / 0.3);
	}

	.free-list .text {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.78rem;
		line-height: 1.3;
	}

	.free-list td {
		padding: 0.3rem;
		text-align: center;
		vertical-align: middle;
	}

	.setup .free-list .give {
		width: 2.1rem;
		height: 2.1rem;
		padding: 0;
		border: 1px solid color-mix(in srgb, var(--seat) 55%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--seat) 12%, transparent);
		color: var(--ink);
		font-size: 1.15rem;
		line-height: 1;
	}

	.setup .free-list .give:hover,
	.setup .free-list .give:focus-visible {
		border-color: var(--seat);
		background: var(--seat);
		color: #1c140a;
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
		position: relative;
		border-radius: 0.4rem;
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

	.chips.beckoning {
		gap: 0.55rem;
		padding: 0.4rem;
	}

	.chips.beckoning button {
		position: relative;
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
