import { actionMenu, checkAction, legalPlays, playDetail, reject } from '@repo/game';
import type { Action, CardId, CityId, Command, EventId, Phase, Play, ReconBox, SeatId, World } from '@repo/game';
import type { UiStep } from '#lib/studio/scene.ts';
import { untrack } from 'svelte';
import {
	ACTION_NAMES,
	actionDetail,
	actionTarget,
	cardName,
	cityName,
	playGroup,
	playTarget,
	seatName,
} from './labels.svelte.ts';
import { plain } from './rich.ts';
import type { Rich } from './rich.ts';
import { ways } from './ways.ts';

export type Option = { label: string; detail: Rich | string; run: () => void; city?: CityId; item?: string };
export type Chooser = {
	title: string;
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
	cities: Map<CityId, Option[]>;
	pawns?: Map<SeatId, () => void>;
	pawn?: SeatId;
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

/**
 * How a player gets from a click to a command: the action, card or city clicked, then whatever it still needs, a
 * city lit on the map, a pawn, or a row of a list. Every click that starts, aims or picks goes through `step`, which
 * keeps the clicks that led to what is half-chosen, so the studio can write a screen down and make them again.
 * Create it while a component is being set up: it keeps effects.
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
		chooser = null;
		ring = null;
	}
	// Whatever was half-chosen belongs to the turn it was chosen in.
	$effect(() => {
		void live;
		void game?.active;
		untrack(dismiss);
	});
	const actionOption = (action: Action): Option => ({
		label: ACTION_NAMES[action.a],
		detail: actionDetail(world, action),
		run: () => act(action),
	});

	function choose(title: string, options: Option[]) {
		if (options.length === 1) options[0]!.run();
		else if (options.length > 1) chooser = { title, options };
	}

	/** Takes a recon route from its box on the board, asking how to pay when there is more than one way. */
	function clickRecon(route: string) {
		const box = recons.find(entry => entry.route.id === route);
		if (!box || !canAct) return;
		dismiss();
		choose(`Recon ${box.name}`, box.actions.map(actionOption));
	}

	/**
	 * Starts one kind of action from the panel, a city's ring or a card: a single way to take it happens at once,
	 * ways that each aim at a city light those cities, and anything else is picked from a list.
	 */
	function start(name: Action['a'], all: Action[]) {
		ring = null;
		chooser = null;
		targeting = null;
		const variants = ways(all);
		if (variants.length === 1) return act(variants[0]!);
		if (name === 'administratorMove') {
			const moves = new Map<SeatId, Map<CityId, Option>>();
			for (const action of variants) {
				if (action.a !== 'administratorMove') continue;
				const to = game!.players[action.to]!.location;
				const byCity = moves.get(action.pawn) ?? new Map<CityId, Option>();
				// Two pawns standing together are one destination.
				if (!byCity.has(to)) byCity.set(to, { ...actionOption(action), label: ACTION_NAMES[name] });
				moves.set(action.pawn, byCity);
			}
			return aimPawns(ACTION_NAMES[name], name, moves);
		}
		if (variants.length > 1 && variants.every(action => actionTarget(world, action))) {
			const cities = new Map<CityId, Option[]>();
			for (const action of variants) {
				const target = actionTarget(world, action)!;
				cities.set(target, [...(cities.get(target) ?? []), actionOption(action)]);
			}
			targeting = { label: ACTION_NAMES[name], a: name, cities };
			return;
		}
		choose(ACTION_NAMES[name], variants.map(actionOption));
	}

	/** Lights the pawns that can be moved, then, once one is picked, where it can go. */
	function aimPawns(label: string, a: Action['a'] | null, moves: Map<SeatId, Map<CityId, Option>>) {
		const pickPawn = (pawn: SeatId) => {
			chooser = null;
			const cities = new Map([...moves.get(pawn)!].map(([city, option]) => [city, [option]]));
			targeting = { label: `Move ${seatName(world, pawn)} to …`, a, cities, pawn };
		};
		const cities = new Map<CityId, Option[]>();
		for (const pawn of moves.keys()) {
			const city = game!.players[pawn]!.location;
			cities.set(city, [
				...(cities.get(city) ?? []),
				{ label: seatName(world, pawn), detail: '', run: () => pickPawn(pawn) },
			]);
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
			const offered = ways(variants);
			const only = offered.length === 1 ? offered[0]! : null;
			return [
				{
					a: choice.a,
					label: ACTION_NAMES[choice.a],
					detail: only ? actionDetail(world, only) : there.length ? `${variants.length} ways` : '',
					variants,
				},
			];
		});
	});

	function clickCity(city: CityId) {
		if (snap.phase === 'setup.supply') return send({ type: 'PLACE_SUPPLY', city, count: 1 });
		if (targeting) {
			const options = targeting.cities.get(city) ?? [];
			if (options.length === 0) return;
			const label = targeting.pawns ? targeting.label : `${targeting.label} to ${cityName(city)}`;
			targeting = null;
			return choose(label, options);
		}
		chooser = null;
		ring = live && ring !== city ? city : null;
	}

	/** Ways the active player can use a card in hand right now, each a tag above the card. */
	const CARD_KINDS = new Set<Action['a']>([
		'sail',
		'charter',
		'captainSail',
		'produce',
		'buildShelter',
		'share',
		'transmit',
		'sabotage',
		'broker',
		'investigate',
		'supply',
		'smuggle',
		'run',
	]);
	function cardUses(
		seat: SeatId,
		card: CardId,
	): { key: string; label: string; icon: Action['a'] | null; run: () => void }[] {
		const uses: { key: string; label: string; icon: Action['a'] | null; run: () => void }[] = [];
		if (live && seat === game?.active) {
			for (const choice of actionChoices) {
				if (!CARD_KINDS.has(choice.a)) continue;
				const variants = cardVariants(choice.actions, card);
				if (!variants.length) continue;
				const target = variants.length === 1 ? actionTarget(world, variants[0]!) : null;
				uses.push({
					key: choice.a,
					label: ACTION_NAMES[choice.a] + (target ? ` to ${cityName(target)}` : ''),
					icon: choice.a,
					run: () => step({ t: 'start', a: choice.a, via: { card } }),
				});
			}
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
	function cardVariants(variants: Action[], card: CardId): Action[] {
		const own = variants.filter(action => 'card' in action && action.card === card);
		if (own.length) return own;
		const held = campaign.playerCards[card];
		if (held?.kind !== 'city') return [];
		return variants.flatMap(action => {
			if (!('card' in action) || !action.card) return [];
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
						: cardVariants(choice.actions, click.via.card);
			if (!variants.length) return false;
			start(click.a, variants);
		} else if (click.t === 'city') clickCity(click.city);
		else if (click.t === 'pawn') {
			const pickPawn = targeting?.pawns?.get(click.seat);
			if (!pickPawn) return false;
			pickPawn();
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
		if (!targeting && !chooser && !ring) trail = [];
		const done = perform(next);
		if (done) trail = [...trail, next];
		return done;
	}

	/** Puts down whatever was half-chosen. True when something was. */
	function cancel() {
		if (!targeting && !chooser && !ring) return false;
		dismiss();
		return true;
	}

	type Several = { field: 'cities' | 'to' | 'cards' | 'order'; verb: string; max: number; repeat: number };
	/** Events that take several targets at once: they are ticked off a list and confirmed together. */
	const SEVERAL: Partial<Record<EventId, Several>> = {
		safeHouses: { field: 'cities', verb: 'Place shelters', max: 3, repeat: 1 },
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
		const options: Option[] = game!.seats.filter(owns).flatMap(seat =>
			game!.players[seat]!.hand.map(pay => ({
				label: `${seatName(world, seat)} discards ${cardName(world, pay)}`,
				detail: '',
				run: () => {
					send({ type: 'LOCKDOWN', card, seat, pay });
					chooser = null;
				},
			})),
		);
		chooser = { title: `Lockdown: discard a card to destroy ${cardName(world, card)}`, options };
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
			const cities = new Map<CityId, Option[]>();
			for (const option of subset)
				cities.set(playTarget(option.play)!, [{ label: cardName(world, card), detail: '', run: run(option.play) }]);
			chooser = null;
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
			const moves = new Map<SeatId, Map<CityId, Option>>();
			for (const { play } of variants) {
				if (play.e !== 'airlift') continue;
				const byCity = moves.get(play.pawn) ?? new Map<CityId, Option>();
				byCity.set(play.to, { label: cardName(world, card), detail: '', run: run(play) });
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
			return targeting || chooser || ring ? trail : [];
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
