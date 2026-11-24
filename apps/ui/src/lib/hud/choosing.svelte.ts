import { actionMenu, checkAction, grid, isFreeAction, legalPlays, pack, reject } from '@repo/game';
import type { Action, CardId, CityId, Command, EventId, Phase, Play, ReconBox, SeatId, World } from '@repo/game';
import { characterVoice } from '#lib/characters/voice.svelte.ts';
import type { UiStep } from '#lib/studio/scene.ts';
import { untrack } from 'svelte';
import {
	ACTION_NAMES,
	actionAt,
	actionDetail,
	offerDetail,
	actionText,
	actionTarget,
	cardName,
	cityName,
	playGroup,
	playTarget,
	seatName,
} from './labels.svelte.ts';
import { plain } from './rich.ts';
import type { Rich } from './rich.ts';
import { cardTwin, ways } from './ways.ts';

export type Option = {
	label: string;
	detail: Rich | string;
	run: () => void;
	frequency?: number;
};
/** Monitor's frequencies, which the Frequency Scanner's dial shows: the one list left that is not a click on the game. */
export type Chooser = {
	title: string;
	action?: Action['a'];
	options: Option[];
};
/**
 * An action or card waiting for its target on the map: its targets are lit and a click on one finishes it. One
 * aimed at a player lights their pawns and seats, and a click on either picks them; one that moves a pawn first
 * lights the pawns it can move, then `pawn` is the one picked. Recon lights the boxes of the routes it can take.
 * A card that takes several places keeps them in `multi` until it is confirmed.
 */
export type Targeting = {
	label: string;
	a: Action['a'] | null;
	/** Every city a click does something on. */
	cities: Map<CityId, () => void>;
	/** The cities lit, when not every city a click acts on is lit (a city already picked is clicked to put back). */
	lit?: ReadonlySet<CityId>;
	pawns?: Map<SeatId, () => void>;
	pawn?: SeatId;
	recons?: ReadonlySet<string>;
	prompt?: string;
	multi?: { picked: ReadonlyMap<CityId, number>; verb: string; count: number; max: number; ready: boolean };
};

/**
 * Real cards laid out in front of the table for a pick: the discard pile's cards a trade can take, another player's
 * hand, the top of the Infection deck to put back in order. A pick that takes several is confirmed.
 */
export type CardPick = {
	title: string;
	prompt: string;
	a: Action['a'] | null;
	groups: { label: string; pile: 'player' | 'infection'; cards: CardId[] }[];
	eligible: ReadonlySet<CardId>;
	picked: readonly CardId[];
	/** The order of the picks matters, so each shows its place. */
	ordered: boolean;
	confirm: { label: string; ready: boolean } | null;
	onpick: (card: CardId) => void;
	onconfirm?: () => void;
};

/**
 * An action or Lockdown waiting for the player to pick card(s) directly from their hand in the dock.
 * Single-card discards execute as soon as a highlighted card is clicked; multi-card discards toggle selection
 * and confirm from the dock slip.
 */
export type HandPick = {
	title: string;
	prompt: string;
	a: Action['a'] | null;
	/** Seat whose hand must be picked from, or null when any owned seat may pay (Lockdown). */
	seat: SeatId | null;
	eligible: (seat: SeatId) => ReadonlySet<CardId>;
	selected: readonly CardId[];
	multi: boolean;
	canConfirm: boolean;
	confirmLabel?: string;
	toggle?: { label: string; active: boolean };
	oncard: (seat: SeatId, card: CardId) => void;
	onconfirm?: () => void;
	ontoggle?: () => void;
};

/**
 * A few words to pick between in the dock slip, for what the board cannot show: Produce Supplies' two modes, how many
 * cubes to carry over, give or take with a player.
 */
export type DockChoice = {
	title: string;
	prompt: string;
	a: Action['a'] | null;
	options: { key: string; label: string; run: () => void }[];
};

export type CardUse = {
	key: string;
	label: string;
	icon: Action['a'] | null;
	disabled?: boolean;
	run: () => void;
};

/** What choosing an action reads from the game screen. */
export type ChoosingSource = {
	readonly world: World;
	readonly phase: Phase;
	/** True in the action step of a seat this browser plays. */
	readonly live: boolean;
	readonly canAct: boolean;
	readonly actionChoices: ReturnType<typeof actionMenu>;
	readonly plays: ReturnType<typeof legalPlays>;
	readonly recons: ReconBox[];
	owns(seat: SeatId): boolean;
	send(command: Command): void;
	toast(text: string, tone?: string): void;
};

const HAND_CARD_ACTIONS = new Set<Action['a']>([
	'drive',
	'sail',
	'charter',
	'captainSail',
	'shuttle',
	'buildShelter',
	'sabotage',
	'smuggle',
	'run',
	'broker',
	'trade',
	'investigate',
	'transmit',
	'produce',
	'search',
]);

/** Actions whose card is the one its destination asks for, so picking the destination picks the card. */
const CARD_FOLLOWS_TARGET = new Set<Action['a']>(['sail', 'charter', 'supply']);

/** What the player has clicked on the way to an action. */
type Chosen = { city?: CityId; card?: CardId; seat?: SeatId; route?: string; box?: number; mode?: string };

/** The player an action is taken with: the one it gives to, takes from or moves. */
function partnerOf(action: Action): SeatId | null {
	if (action.a === 'share' || action.a === 'transfer' || action.a === 'facilitate') return action.with;
	if (action.a === 'coordinate') return action.pawn;
	return null;
}

/**
 * How a player gets from a click to a command: the action, card or city clicked, then whatever it still needs, a
 * city lit on the map, a pawn, cards in hand, or a row of a list. Every click that starts, aims or picks goes
 * through `step`, which keeps the clicks that led to what is half-chosen, so the studio can write a screen down
 * and make them again. Create it while a component is being set up: it keeps effects.
 */
export function createChoosing(source: ChoosingSource) {
	const { owns, send, toast } = source;
	const world = $derived(source.world);
	const campaign = $derived(world.campaign);
	const game = $derived(world.game);
	const snap = {
		get phase() {
			return source.phase;
		},
	};
	const live = $derived(source.live);
	const canAct = $derived(source.canAct);
	const actionChoices = $derived(source.actionChoices);
	const plays = $derived(source.plays);
	const recons = $derived(source.recons);

	let targeting = $state.raw<Targeting | null>(null);
	let handPick = $state.raw<HandPick | null>(null);
	let dockChoice = $state.raw<DockChoice | null>(null);
	/** The actions shown round a city that was clicked with nothing chosen. */
	let ring = $state.raw<CityId | null>(null);
	let chooser = $state.raw<Chooser | null>(null);
	let cardPick = $state.raw<CardPick | null>(null);
	/** What `aimConfirm` sends: the places a card that takes several has picked. */
	let confirmAim: (() => void) | null = null;
	function act(action: Action) {
		send({ type: 'ACTION', seat: game!.active, action });
		dismiss();
	}
	// Even an input with one possible value is clicked: an action happens only once the player has picked everything it
	// takes, so nothing they did not choose is chosen for them.
	let chosen: Chosen = {};
	/** Whether the action takes something the player has not picked yet. */
	function remaining(action: Action): boolean {
		return Object.entries(action).some(([key, value]) => {
			if (key === 'a' || key === 'first' || key === 'laborer' || value === undefined) return false;
			// Free actions and Deliver move one at a time (`ways`), so only Carry asks how many.
			if (key === 'count') return action.a === 'carry';
			if (key === 'card') {
				if (chosen.card && cardTwin(world, chosen.card) === cardTwin(world, value as CardId)) return false;
				return !(CARD_FOLLOWS_TARGET.has(action.a) && chosen.city && actionTarget(world, action) === chosen.city);
			}
			if (key === 'box') return chosen.box !== value && !chosen.card;
			if (key === 'mode') return chosen.mode !== value;
			if (key === 'route') return chosen.route !== value;
			return value !== chosen.city && value !== chosen.seat;
		});
	}
	/** Puts down whatever is half-chosen, keeping the clicks that led here, before the next part of it shows. */
	function only() {
		targeting = null;
		handPick = null;
		dockChoice = null;
		chooser = null;
		ring = null;
		cardPick = null;
		confirmAim = null;
	}
	function dismiss() {
		trail = [];
		chosen = {};
		only();
	}
	const busy = () => Boolean(targeting || handPick || dockChoice || chooser || ring || cardPick);
	// Whatever was half-chosen belongs to the game state it was chosen in, so UNDO, PLAY, DECIDE or remote changes clear it.
	$effect(() => {
		void live;
		void snap.phase;
		void game;
		untrack(dismiss);
	});
	const actionOption = (action: Action): Option => ({
		label: ACTION_NAMES[action.a],
		detail: actionDetail(world, action),
		run: () => act(action),
		...(action.a === 'monitor' ? { frequency: action.frequency } : {}),
	});

	/** The last resort, for ways the board cannot tell apart: a few words each in the dock slip. */
	function choose(title: string, options: Option[], action?: Action['a']) {
		if (action === 'monitor') {
			only();
			chooser = { title, action, options };
			return;
		}
		chips(
			title,
			action ?? null,
			'Choose one.',
			options.map((option, index) => {
				const detail = plain(option.detail);
				return { key: String(index), label: detail ? `${option.label}: ${detail}` : option.label, run: option.run };
			}),
		);
	}

	function chips(title: string, a: Action['a'] | null, prompt: string, options: DockChoice['options']) {
		if (!options.length) return;
		only();
		dockChoice = { title, prompt, a, options };
	}

	/** Lights the given players' pawns and seats; a click on one runs what it was lit for. */
	function aimSeats(label: string, a: Action['a'] | null, aimed: Map<SeatId, () => void>, prompt?: string) {
		if (!aimed.size) return;
		const runs = new Map(
			[...aimed].map(([seat, run]) => [
				seat,
				() => {
					chosen.seat = seat;
					run();
				},
			]),
		);
		const byCity = new Map<CityId, SeatId[]>();
		for (const seat of runs.keys()) {
			const city = game!.players[seat]!.location;
			byCity.set(city, [...(byCity.get(city) ?? []), seat]);
		}
		const cities = new Map<CityId, () => void>();
		for (const [city, seats] of byCity)
			cities.set(
				city,
				seats.length === 1
					? runs.get(seats[0]!)!
					: () =>
							chips(
								label,
								a,
								'Whose pawn?',
								seats.map(seat => ({ key: seat, label: seatName(world, seat), run: runs.get(seat)! })),
							),
			);
		only();
		targeting = {
			label,
			a,
			cities,
			pawns: runs,
			prompt:
				prompt ??
				(runs.size === 1
					? 'Click the lit pawn on the map, or its seat.'
					: `Click one of the ${runs.size} lit pawns on the map, or their seat.`),
		};
	}

	/** Lays real cards out to pick one from; a click on one runs what it was lit for. */
	function pickCard(
		title: string,
		a: Action['a'] | null,
		groups: CardPick['groups'],
		runs: Map<CardId, () => void>,
		prompt = runs.size === 1 ? 'Click the lit card.' : 'Click one of the lit cards.',
	) {
		if (!runs.size) return;
		only();
		cardPick = {
			title,
			prompt,
			a,
			groups,
			eligible: new Set(runs.keys()),
			picked: [],
			ordered: false,
			confirm: null,
			onpick: card => runs.get(card)?.(),
		};
	}

	/** Supply cubes that Produce Supplies would place right now in the given mode. */
	function produceCubes(mode: 'local' | 'system'): number {
		if (!game) return 0;
		const at = game.players[game.active]?.location;
		if (!at) return 0;
		const onGrid = grid(campaign);
		const sites =
			mode === 'local'
				? [at]
				: [
						...new Set([
							at,
							...pack.cities
								.filter(city => onGrid.has(city.id) && (city.kind === 'haven' || game.locations[city.id]!.center))
								.map(city => city.id),
						]),
					];
		const needed = sites.reduce(
			(sum, city) => sum + Math.max(0, campaign.locations[city]!.population - game.locations[city]!.supplies),
			0,
		);
		return Math.min(needed, game.stockpile);
	}

	function produceModeLabel(card: CardId, mode: 'local' | 'system'): string {
		const held = campaign.playerCards[card];
		const left = held?.kind === 'produce' ? held.boxesLeft : 0;
		const cubes = produceCubes(mode);
		return mode === 'local'
			? `Produce local (+${cubes})`
			: `Produce system-wide (+${cubes} · ${left} ${left === 1 ? 'use' : 'uses'} left)`;
	}

	function openProduceModes(card: CardId, variants: Extract<Action, { a: 'produce' }>[]) {
		if (variants.length === 1 && !remaining(variants[0]!)) return act(variants[0]!);
		only();
		dockChoice = {
			title: 'Produce Supplies',
			prompt: 'Choose a production mode.',
			a: 'produce',
			options: variants.map(action => ({
				key: `produce:${action.mode}`,
				label: produceModeLabel(card, action.mode),
				run: () => act(action),
			})),
		};
	}

	function signatureCounts(ids: readonly CardId[]): Map<string, number> {
		const counts = new Map<string, number>();
		for (const id of ids) {
			const sig = cardTwin(world, id);
			counts.set(sig, (counts.get(sig) ?? 0) + 1);
		}
		return counts;
	}

	/** Multi-card hand picker for Build Supply Center and Recon, validated directly against `checkAction`. */
	function pickPaymentCards(options: {
		title: string;
		a: 'buildCenter' | 'recon';
		confirmLabel: string;
		variants: { cards: CardId[]; laborer?: boolean; moveFrom?: CityId; route?: string }[];
		makeCandidate: (cards: CardId[], laborer: boolean) => Action;
		uniqueCities?: boolean;
		canToggleLaborer?: boolean;
		initialLaborer?: boolean;
	}) {
		const activeSeat = game!.active;
		let selected: CardId[] = [];
		let useLaborer = options.initialLaborer ?? false;

		const activeList = () =>
			options.a === 'buildCenter'
				? options.variants.filter(entry => Boolean(entry.laborer) === useLaborer)
				: options.variants;

		const rebuild = () => {
			const current = activeList();
			const multisets = current.map(entry => signatureCounts(entry.cards));
			const selectedSet = new Set(selected);
			const pickedCounts = signatureCounts(selected);
			const selectedCities = new Set(
				selected.flatMap(id => {
					const held = campaign.playerCards[id];
					return held?.kind === 'city' ? [held.city] : [];
				}),
			);
			const matching = multisets.filter(m => [...pickedCounts].every(([sig, count]) => (m.get(sig) ?? 0) >= count));
			const eligibleIds = new Set<CardId>(selected);
			for (const id of game!.players[activeSeat]!.hand) {
				if (selectedSet.has(id)) continue;
				if (options.uniqueCities) {
					const held = campaign.playerCards[id];
					if (held?.kind === 'city' && selectedCities.has(held.city)) continue;
				}
				const sig = cardTwin(world, id);
				const used = pickedCounts.get(sig) ?? 0;
				if (matching.some(m => (m.get(sig) ?? 0) > used)) eligibleIds.add(id);
			}
			const canConfirm =
				selected.length > 0 && checkAction(world, activeSeat, options.makeCandidate(selected, useLaborer)) === null;
			const laborerNote = options.a === 'buildCenter' && useLaborer ? ' (using Laborer: 2 cubes)' : '';
			handPick = {
				title: options.title,
				prompt: canConfirm
					? `${selected.length} card${selected.length === 1 ? '' : 's'} selected${laborerNote}. Click ${options.confirmLabel} or toggle cards.`
					: `Select City cards from your hand to discard${laborerNote} (${selected.length} selected).`,
				a: options.a,
				seat: activeSeat,
				eligible: seat => (seat === activeSeat ? eligibleIds : new Set()),
				selected: [...selected],
				multi: true,
				canConfirm,
				confirmLabel: options.confirmLabel,
				...(options.canToggleLaborer
					? { toggle: { label: 'Laborer: spend 2 cubes (−1 card)', active: useLaborer } }
					: {}),
				oncard: (seat, card) => {
					if (seat !== activeSeat || !eligibleIds.has(card)) return;
					selected = selected.includes(card) ? selected.filter(id => id !== card) : [...selected, card];
					rebuild();
				},
				onconfirm: () => {
					const candidate = options.makeCandidate(selected, useLaborer);
					if (checkAction(world, activeSeat, candidate) === null) act(candidate);
				},
				...(options.canToggleLaborer
					? {
							ontoggle: () => {
								useLaborer = !useLaborer;
								selected = [];
								rebuild();
							},
						}
					: {}),
			};
		};

		rebuild();
	}

	/** Two-card hand discard picker for Salvage and Rehab, followed by picking the card to take if >1 exists. */
	function pickTwoDiscardCards(name: 'salvage' | 'rehab', variants: Extract<Action, { a: 'salvage' | 'rehab' }>[]) {
		const activeSeat = game!.active;
		const allTakes = [...new Set(variants.map(entry => entry.take))];
		let selected: CardId[] = [];

		const rebuild = () => {
			const selectedSet = new Set(selected);
			const hand = game!.players[activeSeat]!.hand;
			const eligibleIds = new Set<CardId>(selected.length < 2 ? hand : selected);
			const readyTakes = (() => {
				if (selected.length !== 2) return [];
				const seen = new Set<string>();
				return allTakes.filter(take => {
					if (checkAction(world, activeSeat, { a: name, discard: selected, take }) !== null) return false;
					const twin = cardTwin(world, take);
					if (seen.has(twin)) return false;
					seen.add(twin);
					return true;
				});
			})();
			const canConfirm = selected.length === 2 && readyTakes.length > 0;
			const confirmLabel = !canConfirm
				? `Select 2 cards (${selected.length}/2)`
				: readyTakes.length === 1
					? `Take ${cardName(world, readyTakes[0]!)}`
					: 'Choose card to take';

			handPick = {
				title: ACTION_NAMES[name],
				prompt:
					selected.length === 2
						? `2 cards selected to discard. Click ${confirmLabel} or toggle cards.`
						: `Select 2 cards from your hand to discard (${selected.length}/2).`,
				a: name,
				seat: activeSeat,
				eligible: seat => (seat === activeSeat ? eligibleIds : new Set()),
				selected: [...selected],
				multi: true,
				canConfirm,
				confirmLabel,
				oncard: (seat, card) => {
					if (seat !== activeSeat || !eligibleIds.has(card)) return;
					if (selectedSet.has(card)) selected = selected.filter(id => id !== card);
					else if (selected.length < 2) selected = [...selected, card];
					rebuild();
				},
				onconfirm: () => {
					if (!canConfirm) return;
					if (readyTakes.length === 1) {
						act({ a: name, discard: [...selected], take: readyTakes[0]! });
						return;
					}
					const discarded = [...selected];
					pickCard(
						name === 'salvage' ? 'Salvage: take a card from the discard pile' : 'Rehab: take a stored City card',
						name,
						[
							{
								label: name === 'salvage' ? 'Player discard pile' : 'Storage',
								pile: 'player',
								cards: readyTakes,
							},
						],
						new Map(readyTakes.map(take => [take, () => act({ a: name, discard: discarded, take })])),
						'Click the card to take.',
					);
				},
			};
		};

		rebuild();
	}

	/** Single-card hand picker for every action that discards or spends one card from hand. */
	function pickSingleHandCard(title: string, name: Action['a'], variants: Action[]): boolean {
		const activeSeat = game!.active;
		const hand = game!.players[activeSeat]!.hand;
		const byCard = new Map<CardId, Action[]>();
		for (const cardId of hand) {
			const seen = new Set<string>();
			const matching: Action[] = [];
			for (const variant of variants) {
				if (!('card' in variant) || !variant.card) continue;
				if (cardId !== variant.card && cardTwin(world, cardId) !== cardTwin(world, variant.card)) continue;
				const candidate = { ...variant, card: cardId } as Action;
				const key = JSON.stringify(candidate);
				if (seen.has(key)) continue;
				if (checkAction(world, activeSeat, candidate) === null) {
					seen.add(key);
					matching.push(candidate);
				}
			}
			if (matching.length) byCard.set(cardId, matching);
		}
		if (byCard.size === 0) return false;
		const distinctTwins = new Set([...byCard.keys()].map(id => cardTwin(world, id)));
		if (distinctTwins.size === 1 && chosen.card && distinctTwins.has(cardTwin(world, chosen.card))) {
			const onlyCard = [...byCard.keys()][0]!;
			const next = byCard.get(onlyCard)!;
			if (name === 'produce') {
				openProduceModes(onlyCard, next as Extract<Action, { a: 'produce' }>[]);
				return true;
			}
			afterCard(title, name, onlyCard, next);
			return true;
		}
		const eligibleIds = new Set(byCard.keys());
		const prompt =
			name === 'transmit'
				? 'Click a City card in your hand to transmit.'
				: name === 'produce'
					? 'Click a Produce Supplies card in your hand.'
					: name === 'broker' || name === 'trade' || name === 'investigate'
						? 'Click a card in your hand to discard for the swap.'
						: 'Click a highlighted card in your hand to discard.';
		handPick = {
			title,
			prompt,
			a: name,
			seat: activeSeat,
			eligible: seat => (seat === activeSeat ? eligibleIds : new Set()),
			selected: [],
			multi: false,
			canConfirm: false,
			oncard: (seat, card) => {
				if (seat !== activeSeat) return;
				const next = byCard.get(card);
				if (!next?.length) return;
				chosen.card = card;
				if (name === 'produce') {
					openProduceModes(card, next as Extract<Action, { a: 'produce' }>[]);
					return;
				}
				afterCard(title, name, card, next);
			},
		};
		return true;
	}

	/** What a card picked from the hand still needs: a player to send it to, a card to take for it. */
	function afterCard(title: string, name: Action['a'], card: CardId, next: Action[]) {
		const offered = ways(world, next);
		if (offered.length === 1 && !remaining(offered[0]!)) return act(offered[0]!);
		if (name === 'transmit')
			return aimSeats(
				`Transmit ${cardName(world, card)} to …`,
				name,
				new Map(offered.flatMap(action => (action.a === 'transmit' ? [[action.to, () => act(action)]] : []))),
			);
		if (name === 'broker' || name === 'trade' || name === 'investigate') {
			const takes = offered.flatMap(action => ('take' in action ? [[action.take, () => act(action)] as const] : []));
			return pickCard(
				`${ACTION_NAMES[name]}: take a card for ${cardName(world, card)}`,
				name,
				[{ label: 'Player discard pile', pile: 'player', cards: takes.map(([take]) => take) }],
				new Map(takes),
				'Click the card to take.',
			);
		}
		if (name === 'share') return aimPartners(name, offered);
		choose(title, offered.map(actionOption), name);
	}

	/** Lights the players an action can be taken with; a click on one takes it with them, or asks what is left. */
	function aimPartners(name: Action['a'], all: Action[]) {
		const bySeat = new Map<SeatId, Action[]>();
		for (const action of ways(world, all)) {
			const seat = partnerOf(action);
			if (seat) bySeat.set(seat, [...(bySeat.get(seat) ?? []), action]);
		}
		aimSeats(
			ACTION_NAMES[name],
			name,
			new Map([...bySeat].map(([seat, subset]) => [seat, () => withPartner(name, seat, subset)])),
		);
	}

	function withPartner(name: Action['a'], seat: SeatId, subset: Action[]) {
		if (subset.length === 1 && !remaining(subset[0]!)) return act(subset[0]!);
		const who = seatName(world, seat);
		const gives = subset.filter(action => 'give' in action && action.give);
		const takes = subset.filter(action => !('give' in action && action.give));
		const theirCards = (actions: Action[]) =>
			pickCard(
				`${ACTION_NAMES[name]} with ${who}`,
				name,
				[
					{
						label: `${who}'s hand`,
						pile: 'player',
						cards: actions.flatMap(action => ('card' in action && action.card ? [action.card] : [])),
					},
				],
				new Map(actions.flatMap(action => ('card' in action && action.card ? [[action.card, () => act(action)]] : []))),
				'Click the card to take.',
			);
		const giveFromHand = () => {
			if (!pickSingleHandCard(`Give a card to ${who}`, name, gives)) choose(who, gives.map(actionOption), name);
		};
		if (name === 'facilitate' || (name === 'share' && !gives.length)) return theirCards(takes);
		if (name === 'share' && !takes.length) return giveFromHand();
		if (name === 'share')
			return chips(`${ACTION_NAMES[name]} with ${who}`, name, 'Give a card or take one?', [
				{ key: 'give', label: `Give to ${who}`, run: giveFromHand },
				{ key: 'take', label: `Take from ${who}`, run: () => theirCards(takes) },
			]);
		if (name === 'transfer')
			return chips(`${ACTION_NAMES[name]} with ${who}`, name, 'Give a cube or take one?', [
				...gives.map(action => ({ key: 'give', label: `Give ${who} a cube`, run: () => act(action) })),
				...takes.map(action => ({ key: 'take', label: `Take a cube from ${who}`, run: () => act(action) })),
			]);
		choose(who, subset.map(actionOption), name);
	}

	/**
	 * Resolves a set of legal variants for one action kind after any destination city has already been chosen:
	 * routes card discards to `handPick`, `moveFrom` to map targeting, Produce Supplies modes to `dockChoice`,
	 * and non-discard lists to `chooser`.
	 */
	function resolveActionVariants(title: string, name: Action['a'], all: Action[]) {
		if (!all.length) return;
		const offered = ways(world, all);
		if (offered.length === 1 && name !== 'monitor' && !remaining(offered[0]!)) return act(offered[0]!);

		// Moving without spending a card does all that moving with one does.
		if (name === 'drive' || name === 'shuttle') {
			const free = offered.find(action => !('card' in action && action.card));
			if (free) return act(free);
		}

		if (offered.every(action => partnerOf(action))) return aimPartners(name, offered);

		if (name === 'broadcast') {
			const froms = new Map<CityId, Action[]>();
			for (const action of offered) {
				if (action.a === 'broadcast') froms.set(action.from, [...(froms.get(action.from) ?? []), action]);
			}
			const aimTo = (from: CityId) => {
				const cities = new Map(
					froms.get(from)!.flatMap(action => (action.a === 'broadcast' ? [[action.to, () => act(action)]] : [])),
				);
				only();
				targeting = { label: `Broadcast from ${cityName(from)} to …`, a: name, cities };
			};
			only();
			targeting = {
				label: 'Broadcast: Hollow Men from …',
				a: name,
				cities: new Map([...froms.keys()].map(from => [from, () => aimTo(from)])),
			};
			return;
		}

		if (name === 'carry')
			return chips(
				title,
				name,
				'How many cubes?',
				offered.flatMap(action =>
					action.a === 'carry'
						? [
								{
									key: String(action.count),
									label: `${action.count} ${action.count === 1 ? 'cube' : 'cubes'}`,
									run: () => act(action),
								},
							]
						: [],
				),
			);

		if (name === 'inoculate' || name === 'destroyInfection') {
			const inPlayer = new Set(game!.playerDiscard);
			const cards = offered.flatMap(action =>
				action.a === 'inoculate' || action.a === 'destroyInfection' ? [action.card] : [],
			);
			const player = cards.filter(card => inPlayer.has(card));
			const infection = cards.filter(card => !inPlayer.has(card));
			return pickCard(
				title,
				name,
				[
					...(player.length ? [{ label: 'Player discard pile', pile: 'player' as const, cards: player }] : []),
					...(infection.length
						? [{ label: 'Infection discard pile', pile: 'infection' as const, cards: infection }]
						: []),
				],
				new Map(
					offered.flatMap(action =>
						action.a === 'inoculate' || action.a === 'destroyInfection' ? [[action.card, () => act(action)]] : [],
					),
				),
			);
		}

		if (name === 'buildShelter' || name === 'buildCenter' || name === 'buildTower') {
			const moveFroms = [
				...new Set(all.flatMap(action => ('moveFrom' in action && action.moveFrom ? [action.moveFrom] : []))),
			];
			if (moveFroms.length > 1 || (moveFroms.length === 1 && chosen.city !== moveFroms[0])) {
				const cities = new Map<CityId, () => void>();
				for (const from of moveFroms) {
					const subset = all.filter(action => 'moveFrom' in action && action.moveFrom === from);
					cities.set(from, () => resolveActionVariants(`${title} (from ${cityName(from)})`, name, subset));
				}
				only();
				targeting = {
					label: `Move a ${name === 'buildShelter' ? 'shelter' : name === 'buildTower' ? 'tower' : 'supply center'} from …`,
					a: name,
					cities,
				};
				return;
			}
		}

		if (name === 'buildCenter') {
			const buildVariants = all as Extract<Action, { a: 'buildCenter' }>[];
			const moveFrom = buildVariants[0]?.moveFrom;
			const hasRegular = buildVariants.some(entry => !entry.laborer);
			const hasLaborer = buildVariants.some(entry => Boolean(entry.laborer));
			pickPaymentCards({
				title,
				a: 'buildCenter',
				confirmLabel: 'Build supply center',
				variants: buildVariants,
				makeCandidate: (cards, laborer) => ({
					a: 'buildCenter',
					cards,
					laborer,
					...(moveFrom ? { moveFrom } : {}),
				}),
				canToggleLaborer: hasRegular && hasLaborer,
				initialLaborer: !hasRegular && hasLaborer,
			});
			return;
		}

		if (name === 'recon') {
			const reconVariants = all as Extract<Action, { a: 'recon' }>[];
			const routeIds = [...new Set(reconVariants.map(entry => entry.route))];
			const pickRoute = (routeId: string) => {
				const route = pack.reconRoutes.find(candidate => candidate.id === routeId)!;
				const subset = reconVariants.filter(entry => entry.route === routeId);
				pickPaymentCards({
					title: `Recon ${title.startsWith('Recon ') ? title.slice(6) : cityName(route.city)}`,
					a: 'recon',
					confirmLabel: 'Confirm Recon',
					variants: subset,
					makeCandidate: cards => ({ a: 'recon', route: routeId, cards }),
					uniqueCities: route.unique,
				});
			};
			if (routeIds.length === 1 && chosen.route === routeIds[0]) return pickRoute(routeIds[0]!);
			// Every route is printed on the board as a box that says what it costs and opens, so the boxes are the choice.
			only();
			targeting = {
				label: 'Recon',
				a: 'recon',
				cities: new Map(),
				recons: new Set(routeIds),
				prompt:
					routeIds.length === 1
						? 'Click the lit recon box on the map.'
						: `Click one of the ${routeIds.length} lit recon boxes on the map.`,
			};
			return;
		}

		if (name === 'salvage' || name === 'rehab') {
			pickTwoDiscardCards(name, all as Extract<Action, { a: 'salvage' | 'rehab' }>[]);
			return;
		}

		if (HAND_CARD_ACTIONS.has(name) && all.every(action => 'card' in action && Boolean(action.card))) {
			if (pickSingleHandCard(title, name, all)) return;
		}

		choose(title, offered.map(actionOption), name);
	}

	/** Takes a recon route from its box on the board, picking cards directly from hand when >1 payment exists. */
	function clickRecon(route: string) {
		const box = recons.find(entry => entry.route.id === route);
		if (!box || !canAct) return;
		dismiss();
		chosen.route = route;
		resolveActionVariants(`Recon ${box.name}`, 'recon', box.actions);
	}

	/**
	 * Starts one kind of action from the panel, a city's ring or a card: a way that needs nothing more than that click
	 * happens at once, ways that aim at cities light those cities, card discards highlight the hand, and anything else
	 * opens a list. A choice with a single answer is still asked.
	 */
	function start(name: Action['a'], all: Action[]) {
		only();
		const variants = ways(world, all);
		if (variants.length === 1 && name !== 'monitor' && !remaining(variants[0]!)) return act(variants[0]!);
		if (name === 'administratorMove') {
			const moves = new Map<SeatId, Map<CityId, () => void>>();
			for (const action of variants) {
				if (action.a !== 'administratorMove') continue;
				const to = game!.players[action.to]!.location;
				const byCity = moves.get(action.pawn) ?? new Map<CityId, () => void>();
				// Two pawns standing together are one destination.
				if (!byCity.has(to)) byCity.set(to, () => act(action));
				moves.set(action.pawn, byCity);
			}
			return aimPawns(ACTION_NAMES[name], name, moves);
		}
		if (all.every(action => actionTarget(world, action))) {
			const byCity = new Map<CityId, Action[]>();
			for (const action of all) {
				const target = actionTarget(world, action)!;
				byCity.set(target, [...(byCity.get(target) ?? []), action]);
			}
			if (byCity.size === 1 && byCity.has(chosen.city!)) {
				const [city, cityActions] = [...byCity.entries()][0]!;
				return resolveActionVariants(actionAt(name, city), name, cityActions);
			}
			const cities = new Map<CityId, () => void>();
			for (const [city, cityActions] of byCity) {
				cities.set(city, () => resolveActionVariants(actionAt(name, city), name, cityActions));
			}
			only();
			targeting = { label: ACTION_NAMES[name], a: name, cities };
			return;
		}
		resolveActionVariants(ACTION_NAMES[name], name, all);
	}

	/** Lights the pawns that can be moved, then, once one is picked, where it can go. */
	function aimPawns(label: string, a: Action['a'] | null, moves: Map<SeatId, Map<CityId, () => void>>) {
		const pickPawn = (pawn: SeatId) => {
			const id = game?.players[pawn]?.character;
			const character = id ? campaign.characters[id] : undefined;
			if (character) characterVoice.playFor(character, 'punchline', { priority: 'ui' });
			only();
			targeting = { label: `Move ${seatName(world, pawn)} to …`, a, cities: new Map(moves.get(pawn)!), pawn };
		};
		aimSeats(label, a, new Map([...moves.keys()].map(pawn => [pawn, () => pickPawn(pawn)])));
	}

	/** One entry of a city's ring: a kind of action, with the ways to take it that the ring's click starts. */
	type RingEntry = { a: Action['a']; label: string; detail: Rich | string; variants: Action[] };
	const here = $derived(game?.players[game.active]?.location ?? null);
	// Round the pawn's own city, every action it can take; round any other, the actions that end there.
	const ringEntries = $derived.by((): RingEntry[] => {
		if (!ring) return [];
		return actionChoices.flatMap(choice => {
			const there = choice.actions.filter(action => actionTarget(world, action) === ring);
			const variants = there.length ? there : ring === here ? choice.actions : [];
			if (!variants.length) return [];
			const offered = ways(world, variants);
			const single = offered.length === 1 ? offered[0]! : null;
			return [
				{
					a: choice.a,
					label: ACTION_NAMES[choice.a],
					detail:
						offerDetail(world, offered) ??
						(single ? actionDetail(world, single) : there.length ? `${offered.length} ways` : summary(choice.a)),
					variants,
				},
			];
		});
	});

	// A free action's ways (give or take, which player) are a click each, so its line says what they are.
	const summary = (a: Action['a']) => (isFreeAction(a) && game ? actionText(world, game.active, a) : '');

	function clickCity(city: CityId) {
		if (snap.phase === 'setup.supply') return send({ type: 'PLACE_SUPPLY', city, count: 1 });
		if (targeting) {
			const run = targeting.cities.get(city);
			if (!run) return;
			targeting = null;
			chosen.city = city;
			return run();
		}
		const open = live && ring !== city ? city : null;
		only();
		ring = open;
	}

	/** Ways the active player can use a card in hand right now, each a tag above the card. */
	const CARD_KINDS = new Set<Action['a']>([
		'sail',
		'charter',
		'captainSail',
		'produce',
		'buildShelter',
		'search',
		'share',
		'transmit',
		'sabotage',
		'broker',
		'trade',
		'investigate',
		'supply',
		'smuggle',
		'run',
	]);
	function cardUses(seat: SeatId, card: CardId): CardUse[] {
		const uses: CardUse[] = [];
		const held = campaign.playerCards[card];
		let hasProduce = false;
		if (live && seat === game?.active) {
			for (const choice of actionChoices) {
				if (!CARD_KINDS.has(choice.a)) continue;
				const variants = cardVariants(choice.actions, card);
				if (!variants.length) continue;
				if (choice.a === 'search') {
					if (held?.kind !== 'city') continue;
					for (const variant of variants) {
						if (variant.a !== 'search') continue;
						const scope = held.search[variant.box]?.scope;
						const label = scope === 'sea' ? 'Search the sea' : 'Search the land';
						uses.push({
							key: `search:${variant.box}`,
							label,
							icon: 'search',
							run: () => step({ t: 'start', a: 'search', via: { card, box: variant.box } }),
						});
					}
					continue;
				}
				if (choice.a === 'produce') {
					hasProduce = true;
					for (const variant of variants) {
						if (variant.a !== 'produce') continue;
						uses.push({
							key: `produce:${variant.mode}`,
							label: produceModeLabel(card, variant.mode),
							icon: 'produce',
							run: () => step({ t: 'start', a: 'produce', via: { card, mode: variant.mode } }),
						});
					}
					continue;
				}
				const offered = ways(world, variants);
				const target = offered.length === 1 ? actionTarget(world, offered[0]!) : null;
				uses.push({
					key: choice.a,
					label: target ? actionAt(choice.a, target) : ACTION_NAMES[choice.a],
					icon: choice.a,
					run: () => step({ t: 'start', a: choice.a, via: { card } }),
				});
			}
			if (held?.kind === 'produce' && !hasProduce) {
				const reason =
					checkAction(world, seat, { a: 'produce', card, mode: 'local' }) ??
					checkAction(world, seat, { a: 'produce', card, mode: 'system' }) ??
					'Cannot produce supplies here';
				uses.push({
					key: 'produce:blocked',
					label: reason,
					icon: 'produce',
					disabled: true,
					run: () => toast(reason),
				});
			}
		} else if (held?.kind === 'produce' && owns(seat) && game && !game.outcome) {
			const reason = seat === game.active ? 'Use during your actions step' : 'Use on your turn';
			uses.push({
				key: 'produce:blocked',
				label: reason,
				icon: 'produce',
				disabled: true,
				run: () => toast(reason),
			});
		}
		if (plays.some(option => option.seat === seat && option.card === card))
			uses.push({
				key: 'play',
				label: `Play ${cardName(world, card)}`,
				icon: null,
				run: () => step({ t: 'play', seat, card }),
			});
		return uses;
	}

	/**
	 * The variants that spend this card. The rules offer one copy of a city's card where any copy would do, so a twin
	 * of that card is offered the same variants, each checked by the rules again.
	 */
	function cardVariants(variants: Action[], card: CardId, box?: number, mode?: 'local' | 'system'): Action[] {
		const matchesFilter = (action: Action) =>
			(box === undefined || (action.a === 'search' && action.box === box)) &&
			(mode === undefined || (action.a === 'produce' && action.mode === mode));
		const own = variants.filter(action => 'card' in action && action.card === card && matchesFilter(action));
		if (own.length) return own;
		const held = campaign.playerCards[card];
		if (held?.kind !== 'city') return [];
		return variants.flatMap(action => {
			if (!('card' in action) || !action.card || !matchesFilter(action)) return [];
			const other = campaign.playerCards[action.card];
			if (other?.kind !== 'city' || other.city !== held.city) return [];
			const twin = { ...action, card } as Action;
			return checkAction(world, game!.active, twin) === null ? [twin] : [];
		});
	}

	// The clicks that led to whatever is half-chosen now, so the studio can write the screen down and make them again.
	let trail: UiStep[] = [];
	function perform(click: UiStep): boolean {
		if (click.t === 'start') {
			const choice = actionChoices.find(entry => entry.a === click.a);
			if (!choice || !live) return false;
			const variants =
				click.via === 'panel'
					? choice.actions
					: click.via === 'ring'
						? (ringEntries.find(entry => entry.a === click.a)?.variants ?? [])
						: cardVariants(choice.actions, click.via.card, click.via.box, click.via.mode);
			if (!variants.length) return false;
			chosen =
				click.via === 'panel'
					? {}
					: click.via === 'ring'
						? ring
							? { city: ring }
							: {}
						: { card: click.via.card, box: click.via.box, mode: click.via.mode };
			start(click.a, variants);
		} else if (click.t === 'city') clickCity(click.city);
		else if (click.t === 'pawn') {
			const pickPawn = targeting?.pawns?.get(click.seat);
			if (!pickPawn) return false;
			pickPawn();
		} else if (click.t === 'handCard') {
			if (!handPick || !handPick.eligible(click.seat).has(click.card)) return false;
			handPick.oncard(click.seat, click.card);
		} else if (click.t === 'handConfirm') {
			if (!handPick?.onconfirm || !handPick.canConfirm) return false;
			handPick.onconfirm();
		} else if (click.t === 'handToggle') {
			if (!handPick?.ontoggle) return false;
			handPick.ontoggle();
		} else if (click.t === 'option') {
			const option = chooser?.options[click.index];
			if (!option) return false;
			option.run();
		} else if (click.t === 'chip') {
			const option = dockChoice?.options.find(entry => entry.key === click.key);
			if (!option) return false;
			option.run();
		} else if (click.t === 'card') {
			if (!cardPick?.eligible.has(click.card)) return false;
			cardPick.onpick(click.card);
		} else if (click.t === 'cardConfirm') {
			if (!cardPick?.confirm?.ready || !cardPick.onconfirm) return false;
			cardPick.onconfirm();
		} else if (click.t === 'aimConfirm') {
			if (!targeting?.multi?.ready || !confirmAim) return false;
			confirmAim();
		} else if (click.t === 'recon') clickRecon(click.route);
		else if (click.t === 'play') playCard(click.seat, click.card);
		else if (click.t === 'lockdown') lockdown(click.card);
		else chooser = null;
		return true;
	}
	/** Every click that starts, aims or picks goes through here, so the trail is the whole way to what is on screen. */
	function step(next: UiStep): boolean {
		if (!busy()) trail = [];
		const done = perform(next);
		if (done) trail = [...trail, next];
		return done;
	}

	/** Puts down whatever was half-chosen. True when something was. */
	function cancel() {
		if (!busy()) return false;
		dismiss();
		return true;
	}

	type Several = { field: 'cities' | 'to' | 'cards' | 'order'; verb: string; max: number; repeat: number };
	/** Events that take several targets at once: they are picked on the map or from the cards, and confirmed together. */
	const SEVERAL: Partial<Record<EventId, Several>> = {
		safeHouses: { field: 'cities', verb: 'Place shelters', max: 3, repeat: 1 },
		mobileShelters: { field: 'cities', verb: 'Place shelters', max: 2, repeat: 1 },
		handout: { field: 'cities', verb: 'Place cubes', max: 2, repeat: 2 },
		cleanse: { field: 'cities', verb: 'Remove Plague cubes', max: 2, repeat: 2 },
		spreadOut: { field: 'to', verb: 'Move cubes', max: 3, repeat: 3 },
		massInoculation: { field: 'cards', verb: 'Store cards', max: 3, repeat: 1 },
		exile: { field: 'cards', verb: 'Destroy cards', max: 3, repeat: 1 },
		resilience: { field: 'cards', verb: 'Remove cards', max: 2, repeat: 1 },
		// Cards not picked keep their order below the ones picked.
		forecast: { field: 'order', verb: 'Put back, top first', max: 8, repeat: 1 },
	};

	/** How an event is sent once aimed: plainly, or as the event It Worked the First Time took from the discard pile. */
	type Aim = { seat: SeatId; card: CardId; title: string; wrap: (play: Play) => Play };

	function sendPlay(aim: Aim, play: Play) {
		const command: Command = { type: 'PLAY', seat: aim.seat, card: aim.card, play: aim.wrap(play) };
		const refused = reject(world, snap.phase, command);
		if (refused) return toast(refused, 'bad');
		send(command);
		dismiss();
	}
	const refusal = (aim: Aim, play: Play) =>
		reject(world, snap.phase, { type: 'PLAY', seat: aim.seat, card: aim.card, play: aim.wrap(play) });

	/** Places on the map, a click each: a place that can take another is lit, and a click on one picked puts it back. */
	function pickSeveralCities(aim: Aim, candidates: Play[], several: Several) {
		const first = candidates[0] as Record<string, unknown>;
		const field = several.field;
		const items = [...new Set(candidates.map(play => ((play as Record<string, unknown>)[field] as CityId[])[0]!))];
		const picks = new Map<CityId, number>();
		const values = () => [...picks].flatMap(([city, count]) => Array<CityId>(count).fill(city));
		const playOf = (cities: CityId[]) => ({ ...first, [field]: cities }) as Play;
		const rebuild = () => {
			const chosen = values();
			const lit = new Set(
				items.filter(
					city =>
						chosen.length < several.max &&
						(picks.get(city) ?? 0) < several.repeat &&
						refusal(aim, playOf([...chosen, city])) === null,
				),
			);
			const toggle = (city: CityId) => {
				if (lit.has(city)) picks.set(city, (picks.get(city) ?? 0) + 1);
				else picks.delete(city);
				rebuild();
			};
			only();
			targeting = {
				label: aim.title,
				a: null,
				cities: new Map(items.filter(city => lit.has(city) || picks.has(city)).map(city => [city, () => toggle(city)])),
				lit,
				prompt: chosen.length
					? 'Click a lit city to add it, or a ticked one to take it back.'
					: `Click up to ${several.max} of the lit cities.`,
				multi: {
					picked: new Map(picks),
					verb: several.verb,
					count: chosen.length,
					max: several.max,
					ready: chosen.length > 0 && refusal(aim, playOf(chosen)) === null,
				},
			};
			confirmAim = () => sendPlay(aim, playOf(values()));
		};
		rebuild();
	}

	/** Cards laid out to pick several of: a card that could join the pick is lit, and a picked one is put back by a click. */
	function pickSeveralCards(aim: Aim, candidates: Play[], several: Several) {
		const first = candidates[0] as Record<string, unknown>;
		const ordered = several.field === 'order';
		const items = ordered
			? (first.order as CardId[])
			: [...new Set(candidates.flatMap(play => (play as Record<string, unknown>).cards as CardId[]))];
		let picked: CardId[] = [];
		const playOf = (cards: CardId[]) =>
			({
				...first,
				[several.field]: ordered ? [...cards, ...items.filter(item => !cards.includes(item))] : cards,
			}) as Play;
		const rebuild = () => {
			const eligible = new Set(
				items.filter(
					item =>
						picked.includes(item) ||
						(picked.length < several.max && (ordered || refusal(aim, playOf([...picked, item])) === null)),
				),
			);
			const ready = (ordered || picked.length > 0) && refusal(aim, playOf(picked)) === null;
			only();
			cardPick = {
				title: aim.title,
				prompt: ordered
					? 'Click the cards in the order they go back, top first. The rest keep their order below.'
					: `Click up to ${several.max} of the lit cards.`,
				a: null,
				groups: [
					{
						label: ordered ? 'Top of the Infection deck' : 'Infection discard pile',
						pile: 'infection',
						cards: items,
					},
				],
				eligible,
				picked,
				ordered,
				confirm: { label: ordered ? several.verb : `${several.verb} (${picked.length})`, ready },
				onpick: card => {
					picked = picked.includes(card) ? picked.filter(other => other !== card) : [...picked, card];
					rebuild();
				},
				onconfirm: () => sendPlay(aim, playOf(picked)),
			};
		};
		rebuild();
	}

	/** One card from each of two hands. */
	function pickSwap(aim: Aim, candidates: Extract<Play, { e: 'cardSwap' }>[]) {
		const holders = new Map<CardId, SeatId>();
		for (const play of candidates) {
			holders.set(play.cardA, play.a);
			holders.set(play.cardB, play.b);
		}
		const seats = [...new Set(holders.values())];
		let picked: CardId[] = [];
		const matching = (cards: CardId[]) =>
			candidates.filter(play => cards.every(card => card === play.cardA || card === play.cardB));
		const rebuild = () => {
			const eligible = new Set(
				[...holders.keys()].filter(
					card => picked.includes(card) || (picked.length < 2 && matching([...picked, card]).length > 0),
				),
			);
			const chosen = picked.length === 2 ? matching(picked)[0] : undefined;
			only();
			cardPick = {
				title: aim.title,
				prompt: 'Click a card in one hand, then a card in another.',
				a: null,
				groups: seats.map(seat => ({
					label: `${seatName(world, seat)}'s hand`,
					pile: 'player',
					cards: [...holders].flatMap(([card, holder]) => (holder === seat ? [card] : [])),
				})),
				eligible,
				picked,
				ordered: false,
				confirm: { label: 'Swap them', ready: Boolean(chosen) },
				onpick: card => {
					picked = picked.includes(card) ? picked.filter(other => other !== card) : [...picked, card];
					rebuild();
				},
				onconfirm: () => chosen && sendPlay(aim, chosen),
			};
		};
		rebuild();
	}

	/** A character on the table, then the ability, then the slot it covers. */
	function pickMentor(aim: Aim, candidates: Extract<Play, { e: 'mentor' }>[]) {
		const bySeat = new Map<SeatId, typeof candidates>();
		for (const play of candidates) bySeat.set(play.seat, [...(bySeat.get(play.seat) ?? []), play]);
		const slots = (subset: typeof candidates) =>
			chips(
				aim.title,
				null,
				'Which slot does it cover?',
				subset.map(play => {
					const slot = campaign.characters[game!.players[play.seat]!.character]!.slots[play.slot];
					const covers = slot ? ` over ${slot.kind === 'scar' ? 'a scar' : 'an ability'}` : '';
					return { key: `slot:${play.slot}`, label: `Slot ${play.slot + 1}${covers}`, run: () => sendPlay(aim, play) };
				}),
			);
		const abilities = (subset: typeof candidates) => {
			const byAbility = new Map<string, typeof candidates>();
			for (const play of subset) byAbility.set(play.ability, [...(byAbility.get(play.ability) ?? []), play]);
			chips(
				aim.title,
				null,
				'Which ability?',
				[...byAbility].map(([ability, inner]) => ({
					key: `ability:${ability}`,
					label: pack.abilities.find(entry => entry.id === ability)!.name,
					run: () => slots(inner),
				})),
			);
		};
		aimSeats(
			aim.title,
			null,
			new Map(
				[...bySeat].map(([seat, subset]) => [
					seat,
					() => {
						const id = game?.players[seat]?.character;
						const character = id ? campaign.characters[id] : undefined;
						if (character) characterVoice.playFor(character, 'punchline', { priority: 'ui' });
						abilities(subset);
					},
				]),
			),
		);
	}

	function lockdown(card: CardId) {
		dismiss();
		handPick = {
			title: `Lockdown: destroy ${cardName(world, card)}`,
			prompt: 'Click any Player card in your hand to discard.',
			a: null,
			seat: null,
			eligible: seat => {
				if (!game || !owns(seat)) return new Set();
				return new Set(
					game.players[seat]!.hand.filter(
						pay => reject(world, snap.phase, { type: 'LOCKDOWN', card, seat, pay }) === null,
					),
				);
			},
			selected: [],
			multi: false,
			canConfirm: false,
			oncard: (seat, pay) => {
				if (reject(world, snap.phase, { type: 'LOCKDOWN', card, seat, pay }) !== null) return;
				send({ type: 'LOCKDOWN', card, seat, pay });
				dismiss();
			},
		};
	}

	/** Aims an event at whatever its candidates differ in: places on the map, pawns, cards. */
	function aimPlays(aim: Aim, candidates: Play[]) {
		if (!candidates.length) return;
		const event = candidates[0]!.e;
		if (event === 'encore') return encoreOf(aim, candidates as Extract<Play, { e: 'encore' }>[]);
		const several = SEVERAL[event as EventId];
		if (several?.field === 'to') {
			const froms = [...new Set(candidates.map(play => (play.e === 'spreadOut' ? play.from : null)))].filter(
				(from): from is CityId => from !== null,
			);
			const from = (city: CityId) =>
				pickSeveralCities(
					aim,
					candidates.filter(play => play.e === 'spreadOut' && play.from === city),
					several,
				);
			if (froms.length === 1) return from(froms[0]!);
			only();
			targeting = {
				label: `${aim.title}: move cubes from …`,
				a: null,
				cities: new Map(froms.map(city => [city, () => from(city)])),
			};
			return;
		}
		if (several?.field === 'cities') return pickSeveralCities(aim, candidates, several);
		if (several) return pickSeveralCards(aim, candidates, several);
		if (candidates.length === 1) return sendPlay(aim, candidates[0]!);
		if (event === 'cardSwap') return pickSwap(aim, candidates as Extract<Play, { e: 'cardSwap' }>[]);
		if (event === 'mentor') return pickMentor(aim, candidates as Extract<Play, { e: 'mentor' }>[]);
		if (event === 'airlift') {
			const moves = new Map<SeatId, Map<CityId, () => void>>();
			for (const play of candidates) {
				if (play.e !== 'airlift') continue;
				const byCity = moves.get(play.pawn) ?? new Map<CityId, () => void>();
				byCity.set(play.to, () => sendPlay(aim, play));
				moves.set(play.pawn, byCity);
			}
			return aimPawns(aim.title, null, moves);
		}
		const aimAt = (subset: Play[], label: string) => {
			only();
			targeting = {
				label,
				a: null,
				cities: new Map(subset.map(play => [playTarget(play)!, () => sendPlay(aim, play)])),
			};
		};
		const groups = [...new Set(candidates.map(play => playGroup(world, play)))];
		const aimed = candidates.every(play => playTarget(play));
		if (aimed && groups.length === 1) return aimAt(candidates, aim.title);
		chips(
			aim.title,
			null,
			'Choose one.',
			groups.map(name => {
				const subset = candidates.filter(play => playGroup(world, play) === name);
				return {
					key: name || aim.title,
					label: name || aim.title,
					run: aimed ? () => aimAt(subset, name) : () => sendPlay(aim, subset[0]!),
				};
			}),
		);
	}

	/** It Worked the First Time takes an event from the discard pile, then aims it the way that event is aimed. */
	function encoreOf(aim: Aim, candidates: Extract<Play, { e: 'encore' }>[]) {
		const targets = [...new Set(candidates.map(play => play.card))];
		const aimTarget = (target: CardId) =>
			aimPlays(
				{
					...aim,
					title: `${cardName(world, aim.card)}: ${cardName(world, target)}`,
					wrap: played => aim.wrap({ e: 'encore', card: target, played }),
				},
				candidates.flatMap(play => (play.card === target ? [play.played] : [])),
			);
		pickCard(
			cardName(world, aim.card),
			null,
			[{ label: 'Player discard pile', pile: 'player', cards: targets }],
			new Map(targets.map(target => [target, () => aimTarget(target)])),
			'Click the event to play again.',
		);
	}

	function playCard(seat: SeatId, card: CardId) {
		aimPlays(
			{ seat, card, title: cardName(world, card), wrap: play => play },
			plays.filter(option => option.seat === seat && option.card === card).map(option => option.play),
		);
	}

	return {
		get targeting() {
			return targeting;
		},
		get handPick() {
			return handPick;
		},
		get dockChoice() {
			return dockChoice;
		},
		get ring() {
			return ring;
		},
		get chooser() {
			return chooser;
		},
		get cardPick() {
			return cardPick;
		},
		get ringEntries() {
			return ringEntries;
		},
		/** Where the active pawn stands. */
		get here() {
			return here;
		},
		/** The clicks that led to whatever is half-chosen now, and none when nothing is. */
		get steps(): UiStep[] {
			return busy() ? trail : [];
		},
		step,
		cancel,
		dismiss,
		cardUses,
		closeRing() {
			ring = null;
		},
	};
}
