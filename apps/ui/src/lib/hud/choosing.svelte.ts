import {
	actionMenu,
	checkAction,
	grid,
	has,
	isFreeAction,
	legalPlays,
	pack,
	playDetail,
	reject,
	sealDef,
} from '@repo/game';
import type { Action, CardId, CityId, Command, EventId, Phase, Play, ReconBox, SeatId, World } from '@repo/game';
import type { UiStep } from '#lib/studio/scene.ts';
import { untrack } from 'svelte';
import {
	ACTION_NAMES,
	actionAt,
	actionDetail,
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
	city?: CityId;
	item?: string;
	frequency?: number;
};
export type Chooser = {
	title: string;
	action?: Action['a'];
	options: Option[];
	multi?: { max: number; verb: string; confirm: (picked: Option[]) => void };
};
const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);
/**
 * An action or card waiting for its target on the map: its targets are lit and a click on one finishes it. One
 * that moves a pawn first lights the pawns it can move, with the cities they stand in, and a click on either
 * picks the pawn; then `pawn` is the one picked.
 */
export type Targeting = {
	label: string;
	a: Action['a'] | null;
	cities: Map<CityId, () => void>;
	pawns?: Map<SeatId, () => void>;
	pawn?: SeatId;
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

/** A compact inline choice in the dock slip (e.g. Produce Supplies local vs system-wide). */
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
]);

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
	let filter = $state('');
	let picked = $state.raw<Option[]>([]);
	$effect(() => {
		void chooser;
		filter = '';
		picked = [];
	});
	const shown = $derived(
		chooser?.options.filter(option =>
			`${option.label} ${plain(option.detail)}`.toLowerCase().includes(filter.trim().toLowerCase()),
		) ?? [],
	);
	function pick(option: Option) {
		if (!chooser?.multi) return option.run();
		if (picked.includes(option)) picked = picked.filter(other => other !== option);
		else if (picked.length < chooser.multi.max) picked = [...picked, option];
	}
	function act(action: Action) {
		send({ type: 'ACTION', seat: game!.active, action });
		dismiss();
	}
	function dismiss() {
		trail = [];
		targeting = null;
		handPick = null;
		dockChoice = null;
		chooser = null;
		ring = null;
	}
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

	function choose(title: string, options: Option[], action?: Action['a']) {
		if (options.length === 1 && action !== 'monitor') options[0]!.run();
		else if (options.length >= 1) chooser = { title, action, options };
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
		if (variants.length === 1) return act(variants[0]!);
		handPick = null;
		targeting = null;
		chooser = null;
		ring = null;
		dockChoice = {
			title: 'Produce Supplies',
			prompt: 'Choose a production mode.',
			a: 'produce',
			options: variants.map(action => ({
				key: `produce:${action.mode}`,
				label: produceModeLabel(card, action.mode),
				run: () => step({ t: 'start', a: 'produce', via: { card, mode: action.mode } }),
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
					handPick = null;
					choose(
						name === 'salvage' ? 'Salvage: take a card from Player discard' : 'Rehab: take a stored City card',
						readyTakes.map(take => ({
							label: cardName(world, take),
							detail: actionDetail(world, { a: name, discard: discarded, take }),
							run: () => act({ a: name, discard: discarded, take }),
						})),
						name,
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
		if (distinctTwins.size === 1) {
			const onlyCard = [...byCard.keys()][0]!;
			const next = byCard.get(onlyCard)!;
			if (name === 'produce') {
				openProduceModes(onlyCard, next as Extract<Action, { a: 'produce' }>[]);
				return true;
			}
			const offered = ways(world, next);
			if (offered.length === 1) {
				act(offered[0]!);
				return true;
			}
			const nextTitle =
				name === 'broker' || name === 'trade' || name === 'investigate'
					? `${ACTION_NAMES[name]}: take a card for ${cardName(world, onlyCard)}`
					: name === 'transmit'
						? `Transmit ${cardName(world, onlyCard)} to …`
						: title;
			choose(nextTitle, offered.map(actionOption), name);
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
				if (name === 'produce') {
					openProduceModes(card, next as Extract<Action, { a: 'produce' }>[]);
					return;
				}
				const offered = ways(world, next);
				if (offered.length === 1) {
					act(offered[0]!);
					return;
				}
				handPick = null;
				const nextTitle =
					name === 'broker' || name === 'trade' || name === 'investigate'
						? `${ACTION_NAMES[name]}: take a card for ${cardName(world, card)}`
						: name === 'transmit'
							? `Transmit ${cardName(world, card)} to …`
							: title;
				choose(nextTitle, offered.map(actionOption), name);
			},
		};
		return true;
	}

	/**
	 * Resolves a set of legal variants for one action kind after any destination city has already been chosen:
	 * routes card discards to `handPick`, `moveFrom` to map targeting, Produce Supplies modes to `dockChoice`,
	 * and non-discard lists to `chooser`.
	 */
	function resolveActionVariants(title: string, name: Action['a'], all: Action[]) {
		if (!all.length) return;
		const offered = ways(world, all);
		if (offered.length === 1 && name !== 'monitor') return act(offered[0]!);

		if (name === 'buildShelter' || name === 'buildCenter') {
			const moveFroms = [
				...new Set(all.flatMap(action => ('moveFrom' in action && action.moveFrom ? [action.moveFrom] : []))),
			];
			if (moveFroms.length > 1) {
				const cities = new Map<CityId, () => void>();
				for (const from of moveFroms) {
					const subset = all.filter(action => 'moveFrom' in action && action.moveFrom === from);
					cities.set(from, () => resolveActionVariants(`${title} (from ${cityName(from)})`, name, subset));
				}
				targeting = {
					label: name === 'buildShelter' ? 'Move a shelter from …' : 'Move a supply center from …',
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
				if (ways(world, subset).length === 1) return act(subset[0]!);
				pickPaymentCards({
					title: `Recon ${title.startsWith('Recon ') ? title.slice(6) : cityName(route.city)}`,
					a: 'recon',
					confirmLabel: 'Confirm Recon',
					variants: subset,
					makeCandidate: cards => ({ a: 'recon', route: routeId, cards }),
					uniqueCities: route.unique,
				});
			};
			if (routeIds.length === 1) return pickRoute(routeIds[0]!);
			choose(
				title,
				routeIds.map(routeId => {
					const route = pack.reconRoutes.find(candidate => candidate.id === routeId)!;
					const planColor = `${route.color[0]!.toUpperCase()}${route.color.slice(1)}`;
					const needed = Math.max(
						1,
						route.count +
							(has(world, game!.active, 'reconExtraCard') ? 1 : 0) -
							(has(world, game!.active, 'outrider') ? 1 : 0),
					);
					return {
						label: route.opens ? sealDef(route.opens).name : `The Plan (${planColor})`,
						detail: `${needed} ${route.unique ? 'unique ' : ''}${route.color} card${needed === 1 ? '' : 's'}`,
						run: () => {
							chooser = null;
							pickRoute(routeId);
						},
					};
				}),
				'recon',
			);
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
		resolveActionVariants(`Recon ${box.name}`, 'recon', box.actions);
	}

	/**
	 * Starts one kind of action from the panel, a city's ring or a card: a single way to take it happens at once,
	 * ways that aim at cities light those cities, card discards highlight the hand, and anything else opens a list.
	 */
	function start(name: Action['a'], all: Action[]) {
		ring = null;
		chooser = null;
		targeting = null;
		handPick = null;
		dockChoice = null;
		const variants = ways(world, all);
		if (variants.length === 1 && name !== 'monitor') return act(variants[0]!);
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
		if (all.length > 1 && all.every(action => actionTarget(world, action))) {
			const byCity = new Map<CityId, Action[]>();
			for (const action of all) {
				const target = actionTarget(world, action)!;
				byCity.set(target, [...(byCity.get(target) ?? []), action]);
			}
			if (byCity.size === 1) {
				const [city, cityActions] = [...byCity.entries()][0]!;
				return resolveActionVariants(actionAt(name, city), name, cityActions);
			}
			const cities = new Map<CityId, () => void>();
			for (const [city, cityActions] of byCity) {
				cities.set(city, () => resolveActionVariants(actionAt(name, city), name, cityActions));
			}
			targeting = { label: ACTION_NAMES[name], a: name, cities };
			return;
		}
		resolveActionVariants(ACTION_NAMES[name], name, all);
	}

	/** Lights the pawns that can be moved, then, once one is picked, where it can go. */
	function aimPawns(label: string, a: Action['a'] | null, moves: Map<SeatId, Map<CityId, () => void>>) {
		const pickPawn = (pawn: SeatId) => {
			chooser = null;
			const cities = new Map(moves.get(pawn)!);
			targeting = { label: `Move ${seatName(world, pawn)} to …`, a, cities, pawn };
		};
		const byCity = new Map<CityId, SeatId[]>();
		for (const pawn of moves.keys()) {
			const city = game!.players[pawn]!.location;
			byCity.set(city, [...(byCity.get(city) ?? []), pawn]);
		}
		const cities = new Map<CityId, () => void>();
		for (const [city, seats] of byCity) {
			cities.set(city, () => {
				if (seats.length === 1) pickPawn(seats[0]!);
				else
					choose(
						label,
						seats.map(pawn => ({ label: seatName(world, pawn), detail: '', run: () => pickPawn(pawn) })),
					);
			});
		}
		if (moves.size === 1) return pickPawn([...moves.keys()][0]!);
		targeting = { label, a, cities, pawns: new Map([...moves.keys()].map(pawn => [pawn, () => pickPawn(pawn)])) };
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
			const only = offered.length === 1 ? offered[0]! : null;
			return [
				{
					a: choice.a,
					label: ACTION_NAMES[choice.a],
					detail: only ? actionDetail(world, only) : there.length ? `${offered.length} ways` : summary(choice.a),
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
			return run();
		}
		chooser = null;
		handPick = null;
		dockChoice = null;
		ring = live && ring !== city ? city : null;
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
						const label =
							held.search.length > 1
								? scope === 'sea'
									? 'Search the sea'
									: 'Search the land'
								: scope === 'sea'
									? 'Search the sea'
									: 'Search';
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
			pick(option);
		} else if (click.t === 'recon') clickRecon(click.route);
		else if (click.t === 'play') playCard(click.seat, click.card);
		else if (click.t === 'lockdown') lockdown(click.card);
		else chooser = null;
		return true;
	}
	/** Every click that starts, aims or picks goes through here, so the trail is the whole way to what is on screen. */
	function step(next: UiStep): boolean {
		if (!targeting && !handPick && !dockChoice && !chooser && !ring) trail = [];
		const done = perform(next);
		if (done) trail = [...trail, next];
		return done;
	}

	/** Puts down whatever was half-chosen. True when something was. */
	function cancel() {
		if (!targeting && !handPick && !dockChoice && !chooser && !ring) return false;
		dismiss();
		return true;
	}

	type Several = { field: 'cities' | 'to' | 'cards' | 'order'; verb: string; max: number; repeat: number };
	/** Events that take several targets at once: they are ticked off a list and confirmed together. */
	const SEVERAL: Partial<Record<EventId, Several>> = {
		safeHouses: { field: 'cities', verb: 'Place shelters', max: 3, repeat: 1 },
		mobileShelters: { field: 'cities', verb: 'Place shelters', max: 2, repeat: 1 },
		handout: { field: 'cities', verb: 'Place cubes', max: 2, repeat: 2 },
		cleanse: { field: 'cities', verb: 'Remove Plague cubes', max: 2, repeat: 2 },
		spreadOut: { field: 'to', verb: 'Move cubes', max: 3, repeat: 3 },
		massInoculation: { field: 'cards', verb: 'Store cards', max: 3, repeat: 1 },
		exile: { field: 'cards', verb: 'Destroy cards', max: 3, repeat: 1 },
		// Cards not picked keep their order below the ones picked.
		forecast: { field: 'order', verb: 'Put back, top first', max: 8, repeat: 1 },
	};

	function pickSeveral(seat: SeatId, card: CardId, variants: { play: Play }[], several: Several, encore?: CardId) {
		const first = variants[0]!.play as Record<string, unknown>;
		const items =
			several.field === 'order'
				? (first.order as string[])
				: variants.map(option => ((option.play as Record<string, unknown>)[several.field] as string[])[0]!);
		const isCard = several.field === 'cards' || several.field === 'order';
		const name = (item: string) => (isCard ? cardName(world, item as CardId) : cityName(item as CityId));
		const wrap = (play: Play): Play => (encore ? { e: 'encore', card: encore, played: play } : play);
		// A second or third cube on one city is offered only where the engine would take that many there.
		const takes = (item: string, count: number) =>
			count === 1 ||
			reject(world, snap.phase, {
				type: 'PLAY',
				seat,
				card,
				play: wrap({ ...first, [several.field]: Array<string>(count).fill(item) } as Play),
			}) === null;
		const ORDINAL = ['', 'second', 'third'];
		const options: Option[] = items.flatMap(item =>
			Array.from({ length: several.repeat }, (_, copy) => copy)
				.filter(copy => takes(item, copy + 1))
				.map(copy => ({
					label: copy ? `${name(item)}, ${ORDINAL[copy]} cube` : name(item),
					detail: '',
					run: () => {},
					item,
					...(isCard ? {} : { city: item as CityId }),
				})),
		);
		targeting = null;
		chooser = {
			title: encore ? `${cardName(world, card)}: ${cardName(world, encore)}` : cardName(world, card),
			options: several.field === 'order' ? options : options.sort(byLabel),
			multi: {
				max: Math.min(several.max, options.length),
				verb: several.verb,
				confirm: chosen => {
					const values = chosen.map(option => option.item!);
					if (several.field === 'order') values.push(...items.filter(item => !values.includes(item)));
					const command: Command = {
						type: 'PLAY',
						seat,
						card,
						play: wrap({ ...first, [several.field]: values } as Play),
					};
					const refused = reject(world, snap.phase, command);
					if (refused) return toast(refused, 'bad');
					send(command);
					chooser = null;
				},
			},
		};
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

	/** Encore picks the event from the discard pile, then aims it the way that event is aimed. */
	function encoreOf(seat: SeatId, card: CardId, variants: { play: Play }[]) {
		const targets = [...new Set(variants.flatMap(option => (option.play.e === 'encore' ? [option.play.card] : [])))];
		const aimTarget = (target: CardId) => {
			const inner = variants.flatMap(option =>
				option.play.e === 'encore' && option.play.card === target ? [{ play: option.play.played }] : [],
			);
			const held = world.campaign.playerCards[target];
			const several = held?.kind === 'event' ? SEVERAL[held.event] : undefined;
			if (several) return pickSeveral(seat, card, inner, several, target);
			chooser = {
				title: `${cardName(world, card)}: ${cardName(world, target)}`,
				options: inner.map(({ play }) => ({
					label: playDetail(world, play) || cardName(world, target),
					detail: '',
					run: () => {
						send({ type: 'PLAY', seat, card, play: { e: 'encore', card: target, played: play } });
						dismiss();
					},
				})),
			};
		};
		if (targets.length === 1) return aimTarget(targets[0]!);
		chooser = {
			title: cardName(world, card),
			options: targets.map(target => ({ label: cardName(world, target), detail: '', run: () => aimTarget(target) })),
		};
	}

	function playCard(seat: SeatId, card: CardId) {
		const variants = plays.filter(option => option.seat === seat && option.card === card);
		const run = (play: Play) => () => {
			send({ type: 'PLAY', seat, card, play });
			dismiss();
		};
		const aim = (subset: typeof variants, label: string) => {
			const cities = new Map<CityId, () => void>();
			for (const option of subset) cities.set(playTarget(option.play)!, run(option.play));
			chooser = null;
			handPick = null;
			dockChoice = null;
			ring = null;
			targeting = { label, a: null, cities };
		};
		const held = world.campaign.playerCards[card];
		if (held?.kind === 'event' && held.event === 'encore' && variants.length) return encoreOf(seat, card, variants);
		const several = held?.kind === 'event' ? SEVERAL[held.event] : undefined;
		if (several && variants.length) {
			const froms = [...new Set(variants.map(option => (option.play.e === 'spreadOut' ? option.play.from : '')))];
			if (froms.length > 1) {
				chooser = {
					title: cardName(world, card),
					options: froms.map(from => ({
						label: cityName(from as CityId),
						detail: '',
						run: () =>
							pickSeveral(
								seat,
								card,
								variants.filter(option => 'from' in option.play && option.play.from === from),
								several,
							),
					})),
				};
				return;
			}
			return pickSeveral(seat, card, variants, several);
		}
		if (variants.length === 1) return run(variants[0]!.play)();
		if (variants.every(option => option.play.e === 'airlift')) {
			const moves = new Map<SeatId, Map<CityId, () => void>>();
			for (const { play } of variants) {
				if (play.e !== 'airlift') continue;
				const byCity = moves.get(play.pawn) ?? new Map<CityId, () => void>();
				byCity.set(play.to, run(play));
				moves.set(play.pawn, byCity);
			}
			return aimPawns(cardName(world, card), null, moves);
		}
		const groups = [...new Set(variants.map(option => playGroup(world, option.play)))];
		const aimed = variants.every(option => playTarget(option.play));
		if (aimed && groups.length === 1) return aim(variants, cardName(world, card));
		chooser = {
			title: cardName(world, card),
			options: groups.map(name => {
				const subset = variants.filter(option => playGroup(world, option.play) === name);
				return {
					label: name || cardName(world, card),
					detail: '',
					run: aimed ? () => aim(subset, name) : run(subset[0]!.play),
				};
			}),
		};
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
		get filter() {
			return filter;
		},
		set filter(value: string) {
			filter = value;
		},
		get picked() {
			return picked;
		},
		get shown() {
			return shown;
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
			return targeting || handPick || dockChoice || chooser || ring ? trail : [];
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
