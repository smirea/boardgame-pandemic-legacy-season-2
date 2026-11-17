<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import {
		actionMenu,
		cardTargets,
		checkAction,
		insights,
		isForsaken,
		legalDecides,
		legalPlays,
		onGrid,
		pack,
		reconBoxes,
		reject,
		scenarios,
	} from '@repo/game';
	import type { Action, CardId, CityId, Command, EdgeDef, Play, SeatId } from '@repo/game';
	import Board from '#lib/board/Board.svelte';
	import type { BoardPoint } from '#lib/board/projection.ts';
	import { travelOf } from '#lib/board/travel.ts';
	import type { BoardMarks, BoardView, CityView, Fx, FxKind, Travel } from '#lib/board/types.ts';
	import type { SessionView } from '#lib/session/session.svelte.ts';
	import { inkOn } from '#lib/color.ts';
	import { presentFeedback } from '#lib/feedback.ts';
	import { onButton, typing } from '#lib/keys.ts';
	import { LS } from '#lib/storage.ts';
	import { setContext, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { backOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import ActionPanel from './ActionPanel.svelte';
	import Corner from './Corner.svelte';
	import { placeSeats } from './seats.ts';
	import type { Place } from './seats.ts';
	import Dock from './Dock.svelte';
	import InsightsPanel from './InsightsPanel.svelte';
	import {
		ACTION_NAMES,
		actionDetail,
		actionTarget,
		cardName,
		cityName,
		playGroup,
		playTarget,
		seatName,
		SEAT_COLORS,
		setNames,
	} from './labels.svelte.ts';
	import Lobby from './Lobby.svelte';
	import Objectives from './Objectives.svelte';
	import TopBar from './TopBar.svelte';
	import Upkeep from './Upkeep.svelte';

	// A spectator owns no seat, whatever this browser claimed in a live game. Replays use it, and draw their own
	// players and step marks over the board, so the panels a player acts from stay out of the way.
	let {
		session,
		spectator = false,
		marks,
		announce = true,
		corner,
		children,
	}: {
		session: SessionView;
		spectator?: boolean;
		marks?: BoardMarks;
		/** False when a spectator jumped rather than stepped, so the events in between are not announced. */
		announce?: boolean;
		/** Draws a seat's corner in place of the live table's slip, as the replay does with its speech bubbles. */
		corner?: Snippet<[SeatId, Place]>;
		children?: Snippet;
	} = $props();

	const snap = $derived(session.state!);
	const world = $derived(snap.world);
	const campaign = $derived(world.campaign);
	const game = $derived(world.game);
	const info = $derived(insights(world));
	const gridSet = $derived(new Set(onGrid(world)));
	const playing = $derived(snap.phase.startsWith('playing'));
	$effect.pre(() => setNames(campaign.names));

	let mine = $state<SeatId[]>(LS.get('mySeats', []));
	const solo = $derived(session.mode === 'solo');
	const owns = (seat: SeatId) => !spectator && (solo || mine.includes(seat));
	const canAct = $derived(game !== null && owns(game.active));
	const unclaimed = $derived(game !== null && !spectator && !solo && !game.seats.some(seat => mine.includes(seat)));
	let viewing = $state<SeatId | null>(null);
	// The seat the pointer or keyboard focus rests on, whose pawn lights up on the board.
	let pointedSeat = $state<SeatId | null>(null);
	$effect(() => {
		// The dock follows whoever's turn it is, until the player picks a hand to look at.
		void game?.active;
		viewing = null;
	});
	// The seat this browser sits at. Playing several characters, on one screen or not, it moves to whoever's turn it is.
	const me = $derived(game ? (owns(game.active) ? game.active : game.seats.find(owns)) : undefined);
	const home = $derived(game ? (me ?? game.active) : null);
	const dockSeat = $derived(spectator ? null : (viewing ?? home));

	const actionChoices = $derived(game && playing ? actionMenu(world, game.active) : []);
	// Actions are offered only to whoever plays the active seat, and only in its action step.
	const live = $derived(snap.phase === 'playing.actions' && canAct);
	const actions = $derived(live ? actionChoices.flatMap(choice => choice.actions) : []);
	const plays = $derived(playing ? legalPlays(world, snap.phase) : []);
	const decides = $derived(playing ? legalDecides(world) : []);
	$effect(() => {
		// When one of this client's characters has to discard, the dock turns to that hand.
		const owed = decides.find(decide => decide.d === 'discard' && owns(decide.seat));
		if (owed?.d === 'discard') viewing = owed.seat;
	});

	type Option = { label: string; detail: string; run: () => void; city?: CityId };
	type Chooser = {
		title: string;
		options: Option[];
		multi?: { max: number; verb: string; confirm: (picked: Option[]) => void };
	};
	const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);
	let selected = $state<CityId | null>(null);
	/** An action or card waiting for its target on the map: its targets are lit and a click on one finishes it. */
	type Targeting = { label: string; a: Action['a'] | null; cities: Map<CityId, Option[]> };
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
			`${option.label} ${option.detail}`.toLowerCase().includes(filter.trim().toLowerCase()),
		) ?? [],
	);
	function pick(option: Option) {
		if (!chooser?.multi) return option.run();
		if (picked.includes(option)) picked = picked.filter(other => other !== option);
		else if (picked.length < chooser.multi.max) picked = [...picked, option];
	}
	let menu = $state(false);
	let stage = $state<HTMLElement | null>();
	let leftColumn = $state<HTMLElement | null>();
	let rightColumn = $state<HTMLElement | null>();
	let goals = $state<HTMLElement | null>();

	// Everyone sits round the table in turn order, clockwise, with this browser's player at the bottom right.
	// A replay seats the first player there.
	const seatAt = $derived(game ? placeSeats(game.seats, me) : null);
	// Where the panels on the board's sides sit, so the fitted view keeps cities out from under them.
	let covered = $state.raw<{ x: number; y: number; width: number; height: number }[]>([]);
	$effect(() => {
		void seatAt;
		// `bind:this` hands back null, not undefined, once a column leaves the screen.
		const columns = [leftColumn, rightColumn].filter((column): column is HTMLElement => column instanceof HTMLElement);
		if (!stage) return void (covered = []);
		// The columns run the full height but only their panels cover the board, so the panels are what is measured.
		// The dock follows the stage and its cards rise over the stage's bottom edge.
		const panels = [
			...columns.flatMap(column => [...column.children]),
			...[goals, stage.nextElementSibling].filter(element => element instanceof HTMLElement),
		];
		// A box drawn outside its element, like the dock's cards above its frame, still covers the board.
		const extent = (element: Element) => {
			const boxes = [element, ...element.children].map(child => child.getBoundingClientRect());
			const left = Math.min(...boxes.map(box => box.left));
			const top = Math.min(...boxes.map(box => box.top));
			const right = Math.max(...boxes.map(box => box.right));
			const bottom = Math.max(...boxes.map(box => box.bottom));
			return { left, top, width: right - left, height: bottom - top };
		};
		const measure = () => {
			const origin = stage!.getBoundingClientRect();
			covered = panels.map(panel => {
				const box = extent(panel);
				return { x: box.left - origin.x, y: box.top - origin.y, width: box.width, height: box.height };
			});
		};
		const observer = new ResizeObserver(measure);
		for (const element of [stage, ...panels]) observer.observe(element);
		measure();
		return () => observer.disconnect();
	});
	let resetView = $state(0);

	const send = (command: Command) => session.send(command);

	/** How a pawn made its most recent move, which picks its vehicle and the way it goes. */
	function lastMove(seat: SeatId): { travel: Travel; course: BoardPoint[] | null } {
		const log = game?.log ?? [];
		for (let index = log.length - 1; index >= 0; index--) {
			const entry = log[index]!;
			if (entry.t === 'move' && entry.seat === seat) return travelOf(entry, campaign.edges);
		}
		return { travel: 'land', course: null };
	}
	function act(action: Action) {
		send({ type: 'ACTION', seat: game!.active, action });
		dismiss();
	}
	function dismiss() {
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

	const recons = $derived(reconBoxes(world, snap.phase));
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
	function start(name: Action['a'], variants: Action[]) {
		ring = null;
		chooser = null;
		targeting = null;
		if (variants.length === 1) return act(variants[0]!);
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

	/** One entry of a city's ring: a kind of action, with the ways to take it that the ring's click starts. */
	type RingEntry = { a: Action['a']; label: string; detail: string; variants: Action[] };
	const here = $derived(game?.players[game.active]?.location ?? null);
	// Round the pawn's own city, every action it can take; round any other, the actions that end there.
	const ringEntries = $derived.by((): RingEntry[] => {
		if (!ring) return [];
		return actionChoices.flatMap(choice => {
			const there = choice.actions.filter(action => actionTarget(world, action) === ring);
			const variants = there.length ? there : ring === here ? choice.actions : [];
			if (!variants.length) return [];
			const only = variants.length === 1 ? variants[0]! : null;
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
			const label = `${targeting.label} to ${cityName(city)}`;
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
					run: () => start(choice.a, variants),
				});
			}
		}
		if (plays.some(option => option.seat === seat && option.card === card))
			uses.push({ key: 'play', label: `Play ${cardName(world, card)}`, icon: null, run: () => playCard(seat, card) });
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

	/** Escape and a right click put down whatever was half-chosen. */
	function cancel() {
		if (!targeting && !chooser && !ring) return false;
		dismiss();
		return true;
	}

	function takeBack(city: CityId) {
		const command = { type: 'PLACE_SUPPLY', city, count: -1 } as const;
		if (reject(world, snap.phase, command) === null) send(command);
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
		if (held?.kind === 'event' && held.event === 'safeHouses') {
			// The card places up to three shelters at once, so its cities are ticked off a list and confirmed together.
			const cities = [...new Set(variants.map(option => playTarget(option.play)!))];
			targeting = null;
			chooser = {
				title: 'Safe Houses',
				options: cities
					.map(target => ({ label: cityName(target), detail: '', run: () => {}, city: target }))
					.sort(byLabel),
				multi: {
					max: Math.min(3, game!.pieces.shelter),
					verb: 'Place shelters',
					confirm: chosen => {
						send({ type: 'PLAY', seat, card, play: { e: 'safeHouses', cities: chosen.map(option => option.city!) } });
						chooser = null;
					},
				},
			};
			return;
		}
		const groups = [...new Set(variants.map(option => playGroup(world, option.play)))];
		const aimed = variants.every(option => playTarget(option.play));
		if (variants.length === 1) return run(variants[0]!.play)();
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

	// A spectator cannot acknowledge a briefing for the table, so closing it is theirs alone.
	let briefingRead = $state('');

	function claim(seat: SeatId) {
		if (spectator) return;
		mine = mine.includes(seat) ? mine.filter(other => other !== seat) : [...mine, seat];
		LS.set({ mySeats: mine });
	}

	let fx = $state.raw<Fx[]>([]);
	let toasts = $state.raw<{ id: number; text: string; tone: string }[]>([]);
	let banner = $state.raw<{ id: number; title: string; text: string } | null>(null);
	let turnBanner = $state.raw<{ id: number; name: string; color: string } | null>(null);
	let lastSeq = untrack(() => game?.log.at(-1)?.seq ?? 0);
	let nextFx = 1;

	function toast(text: string, tone = '') {
		const id = nextFx++;
		toasts = [...toasts, { id, text, tone }];
		setTimeout(() => (toasts = toasts.filter(entry => entry.id !== id)), 5200);
	}

	$effect(() => {
		const log = game?.log ?? [];
		const newest = log.at(-1)?.seq ?? 0;
		// A spectator jumping through a recording skips over events rather than living through each one at once,
		// and what was announced where they jumped from no longer applies.
		const jumped = spectator && (newest < lastSeq || !untrack(() => announce));
		if (newest < lastSeq) lastSeq = spectator ? newest : 0;
		if (jumped) {
			lastSeq = newest;
			untrack(() => {
				toasts = [];
				banner = null;
				turnBanner = null;
				fx = [];
			});
			return;
		}
		const fresh = log.filter(entry => entry.seq > lastSeq);
		if (fresh.length === 0) return;
		lastSeq = newest;
		const added: Fx[] = [];
		const pulse = (city: CityId, kind: FxKind) => added.push({ id: nextFx++, city, kind, delay: added.length * 240 });
		for (const entry of fresh) {
			if (entry.t === 'infect' && entry.effect !== 'skipped' && entry.effect !== 'blocked') {
				pulse(entry.city, entry.effect === 'supply' ? 'infect' : entry.effect === 'hollow' ? 'hollow' : entry.effect);
			} else if (entry.t === 'incident') pulse(entry.city, 'plague');
			else if (entry.t === 'outbreak') pulse(entry.city, 'outbreak');
			else if (entry.t === 'connected') pulse(entry.city, 'connected');
			else if (entry.t === 'structure') pulse(entry.city, 'build');
			else if (entry.t === 'epidemic') {
				if (entry.city) pulse(entry.city, 'epidemic');
				const id = nextFx++;
				banner = {
					id,
					title: 'Epidemic',
					text: entry.city
						? `${cityName(entry.city)} loses ${entry.removed} cubes. Infection rate ${entry.rate}.`
						: `Infection rate ${entry.rate}.`,
				};
				setTimeout(() => banner?.id === id && (banner = null), 3400);
			} else if (entry.t === 'turn') {
				const id = nextFx++;
				turnBanner = {
					id,
					name: seatName(world, entry.seat),
					color: SEAT_COLORS[game!.seats.indexOf(entry.seat)] ?? '#fff',
				};
				setTimeout(() => turnBanner?.id === id && (turnBanner = null), 1900);
			} else if (entry.t === 'objective') toast('Objective complete', 'good');
			else if (entry.t === 'unlock')
				toast(`Opened: ${pack.bundles.find(bundle => bundle.id === entry.bundle)?.name}`, 'good');
			else if (entry.t === 'death')
				toast(`${campaign.characters[entry.character]?.name} died in ${cityName(entry.at)}`, 'bad');
			else if (entry.t === 'exposure' && entry.result === 'scar')
				toast(`${seatName(world, entry.seat)} takes a scar`, 'bad');
			else if (entry.t === 'note') toast(entry.text, 'good');
		}
		untrack(() => {
			fx = [...fx, ...added];
			const ids = new Set(added.map(entry => entry.id));
			setTimeout(() => (fx = fx.filter(entry => !ids.has(entry.id))), 6000);
		});
	});

	$effect(() => {
		const notice = session.notice;
		if (notice) untrack(() => toast(notice.text, 'bad'));
	});

	// A seat's hand shows interchangeable cards as one pile, so hovering it lights what every card in it reaches.
	let hoveredCards = $state<CardId[]>([]);
	setContext('card-hover', (cards: CardId | CardId[] | null) => {
		hoveredCards = cards === null ? [] : [cards].flat();
	});
	const hoveredTargets = $derived.by(() => {
		const targets = hoveredCards.map(card => cardTargets(world, snap.phase, card));
		return {
			cities: [...new Set(targets.flatMap(target => target.cities))],
			seats: [...new Set(targets.flatMap(target => target.seats))],
		};
	});

	const boardView = $derived.by((): BoardView => {
		const targets = new Set(hoveredCards.length ? hoveredTargets.cities : (targeting?.cities.keys() ?? []));
		const showOdds = playing && info !== null;
		const cities = Object.fromEntries(
			pack.cities.map((city): [CityId, CityView] => {
				const record = campaign.locations[city.id]!;
				const location = game?.locations[city.id];
				return [
					city.id,
					{
						name: cityName(city.id),
						revealed: record.revealed,
						onGrid: gridSet.has(city.id),
						supplies: location?.supplies ?? 0,
						plague: location?.plague ?? 0,
						hollow: location?.hollow ?? 0,
						population: record.population,
						port: city.port,
						structures: (['center', 'tower', 'shelter'] as const)
							.filter(kind => location?.[kind] ?? record.permanent.includes(kind))
							.map(kind => ({ kind, permanent: record.permanent.includes(kind) })),
						infested: record.infested,
						forsaken: isForsaken(campaign, city.id),
						lab: record.lab,
						highlight: selected === city.id || ring === city.id ? 'selected' : targets.has(city.id) ? 'target' : null,
						infection: showOdds
							? {
									odds: info!.infection.odds[city.id] ?? 0,
									inDeck: info!.infection.strata.reduce((sum, stratum) => sum + (stratum.cities[city.id] ?? 0), 0),
									discarded: info!.infection.discard[city.id] ?? 0,
								}
							: null,
						cards: showOdds ? (info!.playerDeck.cities[city.id] ?? { inDeck: 0, inHands: 0, discarded: 0 }) : null,
					},
				];
			}),
		) as Record<CityId, CityView>;
		// The lines a player could draw show faintly while they pick where to draw one.
		const drawing = targeting?.a === 'establishLine' || targeting?.a === 'chartLane' ? targeting.a : null;
		const ghostEdges: EdgeDef[] =
			here && drawing
				? actions.flatMap(action =>
						action.a === drawing
							? [{ a: here, b: action.to, kind: drawing === 'establishLine' ? ('land' as const) : ('sea' as const) }]
							: [],
					)
				: [];
		return {
			cities,
			edges: campaign.edges,
			ghostEdges,
			recon: recons.map(box => ({
				route: box.route.id,
				city: box.route.city,
				cityName: cityName(box.route.city),
				name: box.name,
				color: box.route.color,
				count: box.route.count,
				unique: box.route.unique,
				needsCenter: box.route.needsCenter,
				reveals: box.reveals,
				...(spectator
					? { state: 'idle' as const, reason: null }
					: !canAct
						? { state: 'blocked' as const, reason: 'Not your turn' }
						: box.actions.length
							? { state: 'ready' as const, reason: null }
							: { state: 'blocked' as const, reason: box.reason }),
			})),
			pawns: (game?.seats ?? []).map((seat, index) => ({
				id: seat,
				city: game!.players[seat]!.location,
				color: SEAT_COLORS[index]!,
				name: seatName(world, seat),
				active: game!.active === seat && playing,
				lit: pointedSeat === seat,
				carried: game!.players[seat]!.supplies,
				...lastMove(seat),
			})),
			stockpile: game?.stockpile ?? null,
			cursors: Object.entries(session.cursors).map(([id, point], index) => ({
				id,
				name: session.peers.find(peer => peer.id === id)?.name ?? 'player',
				color: SEAT_COLORS[(index + 1) % SEAT_COLORS.length]!,
				...point,
			})),
			fx,
			marks,
		};
	});

	/** Space advances the turn, Z undoes, F fits the map, Escape closes whatever is open. */
	function onkey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			cancel();
			menu = false;
		}
		if (typing(event) || onButton(event) || event.metaKey || event.ctrlKey || !game) return;
		const key = event.key.toLowerCase();
		if (key === 'f') resetView++;
		if (key === 'z' && snap.canUndo && canAct) send({ type: 'UNDO' });
		if (key !== ' ' || !canAct) return;
		event.preventDefault();
		if (snap.phase === 'playing.actions') send({ type: 'END_ACTIONS', seat: game.active });
		else if (snap.phase === 'playing.draw') send({ type: 'DRAW' });
		else if (snap.phase === 'playing.infect') send({ type: 'INFECT' });
	}

	function downloadRecord() {
		const record = session.exportRecord();
		if (!record) return;
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([record], { type: 'application/json' }));
		link.download = `recording-${(JSON.parse(record) as { id: string }).id}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}

	let fileInput = $state<HTMLInputElement>();
	function download() {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([session.exportSave()], { type: 'application/json' }));
		link.download = `campaign-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<svelte:window onkeydown={onkey} />

{#snippet actionPanel()}
	{#if game && !spectator && actionChoices.length}
		<div class="actions-slot">
			<ActionPanel
				{world}
				seat={game.active}
				name={seatName(world, game.active)}
				menu={actionChoices}
				{live}
				aiming={targeting?.a ?? null}
				onchoose={choice => start(choice.a, choice.actions)}
			/>
		</div>
	{/if}
{/snippet}

{#snippet seated(place: Place)}
	{@const seat = seatAt?.get(place)}
	{#if seat && game}
		<div
			class="place {place}"
			role="group"
			onpointerenter={() => (pointedSeat = seat)}
			onpointerleave={() => pointedSeat === seat && (pointedSeat = null)}
			onfocusin={() => (pointedSeat = seat)}
			onfocusout={() => pointedSeat === seat && (pointedSeat = null)}
		>
			{#if corner}
				{@render corner(seat, place)}
			{:else}
				{#key seat}
					<div class="seated" in:fly={{ x: place === 'tl' || place === 'bl' ? -32 : 32, duration: 360, delay: 120 }}>
						<Corner
							highlighted={hoveredTargets.seats.includes(seat)}
							{seat}
							{place}
							{world}
							name={seatName(world, seat)}
							color={SEAT_COLORS[game.seats.indexOf(seat)]!}
							selected={viewing === seat}
							showHand={seat !== dockSeat}
							action="Show this hand in the dock"
							selectedTag="Hand shown"
							onselect={() => (viewing = seat)}
							claim={solo || spectator ? null : { mine: mine.includes(seat), toggle: () => claim(seat) }}
						/>
					</div>
				{/key}
			{/if}
		</div>
	{/if}
{/snippet}

<div
	class="game"
	data-card-cities={hoveredTargets.cities.join(' ')}
	data-card-seats={hoveredTargets.seats.join(' ')}
	{@attach feedback('Game', () => ({
		phase: snap.phase,
		turn: game?.turn,
		active: game?.active,
		mine,
		canAct,
	}))}
>
	<TopBar
		{snap}
		{info}
		status={session.status}
		players={session.peers.filter(peer => peer.connected).length}
		solo={session.mode === 'solo' || spectator}
		onreset={() => resetView++}
		onmenu={() => (menu = !menu)}
	/>

	<main class="stage" bind:this={stage}>
		<Board
			view={boardView}
			oncity={clickCity}
			onrecon={clickRecon}
			oncityback={city => cancel() || takeBack(city)}
			oncancel={cancel}
			onmiss={() => (ring = null)}
			ring={ring && ringEntries.length
				? {
						city: ring,
						entries: ringEntries.map(entry => ({ key: entry.a, label: entry.label, detail: entry.detail })),
					}
				: null}
			onring={key => {
				const entry = ringEntries.find(candidate => candidate.a === key);
				if (entry) start(entry.a, entry.variants);
			}}
			onpointer={point => session.pointer(point)}
			{resetView}
			{covered}
		/>

		{#if game && seatAt && snap.phase !== 'upkeep'}
			<div class="column left" class:docked={!spectator} bind:this={leftColumn}>
				{@render seated('tl')}
				{#if seatAt.has('tr')}{@render actionPanel()}{/if}
				{@render seated('bl')}
			</div>
			<div class="column right" class:docked={!spectator} bind:this={rightColumn}>
				{@render seated('tr')}
				{#if info && !spectator}
					<div class="insights">
						<InsightsPanel
							{world}
							{info}
							onfocus={city => (selected = city)}
							onlockdown={card => send({ type: 'LOCKDOWN', card })}
						/>
					</div>
				{/if}
				{#if !seatAt.has('tr')}{@render actionPanel()}{/if}
				{@render seated('br')}
			</div>
		{/if}
		{#if game && snap.phase !== 'upkeep'}
			<div class="goals" bind:this={goals}>
				<Objectives
					{snap}
					onwaive={objective =>
						confirm('Mark this objective impossible for this game? The remaining objectives then decide the win.') &&
						send({ type: 'WAIVE_OBJECTIVE', objective })}
				/>
			</div>
		{/if}

		{#if unclaimed}
			<!-- A networked player has to say which pawn is theirs before any control is offered. Asking beats leaving the dock empty. -->
			<div class="whoami" data-testid="whoami" transition:fly={{ y: 12, duration: 180 }}>
				<span>Who do you play?</span>
				{#each game!.seats as seat (seat)}
					<button onclick={() => claim(seat)}>{seatName(world, seat)}</button>
				{/each}
			</div>
		{/if}

		{#if chooser}
			<div
				class="chooser"
				transition:fly={{ y: 16, duration: 180 }}
				data-testid="chooser"
				{@attach feedback('Chooser', () => ({ title: chooser?.title, filter, picked }))}
			>
				<header>{chooser.title}<button onclick={() => (chooser = null)} aria-label="Close">×</button></header>
				{#if chooser.options.length > 8}
					<input bind:value={filter} placeholder="Type to filter" aria-label="Filter the list" />
				{/if}
				<div class="rows">
					{#each shown as option, index (option)}
						<button style:--i={Math.min(index, 12)} class:picked={picked.includes(option)} onclick={() => pick(option)}
							><strong>{option.label}</strong><span>{option.detail}</span></button
						>
					{:else}
						<p>Nothing matches.</p>
					{/each}
				</div>
				{#if chooser.multi}
					{@const multi = chooser.multi}
					<button
						class="primary"
						disabled={picked.length === 0}
						onclick={() => multi.confirm(picked)}
						data-testid="chooser-confirm"
					>
						{multi.verb}: {picked.length} of up to {multi.max}
					</button>
				{/if}
			</div>
		{/if}

		<div class="toasts">
			{#each toasts as entry (entry.id)}
				<div class={entry.tone} in:fly={{ y: -16, duration: 220 }} out:fade={{ duration: 300 }}>{entry.text}</div>
			{/each}
		</div>

		{#if banner}
			{#key banner.id}
				<div class="banner" out:fade={{ duration: 450 }}>
					<strong>{banner.title}</strong>
					<span>{banner.text}</span>
				</div>
			{/key}
		{/if}

		{#if turnBanner && !banner}
			{#key turnBanner.id}
				<div
					class="turn-banner"
					style:--seat={turnBanner.color}
					style:--on={inkOn(turnBanner.color)}
					in:fly={{ y: -24, duration: 320 }}
					out:fade={{ duration: 450 }}
				>
					<i></i>{turnBanner.name}'s turn
				</div>
			{/key}
		{/if}

		{#if banner}
			{#key banner.id}<div class="flash" out:fade={{ duration: 200 }}></div>{/key}
		{/if}

		{#if game?.outcome && snap.phase === 'over'}
			<div
				class="outcome"
				{@attach feedback('Outcome', () => game?.outcome)}
				class:won={game.outcome.won}
				in:scale={{ start: 0.7, duration: 600, easing: backOut }}
			>
				<strong>{game.outcome.won ? 'Victory' : 'Defeat'}</strong>
				<span>{game.outcome.reason}</span>
			</div>
		{/if}

		{#if campaign.briefing.length && briefingRead !== campaign.briefing.join('|')}
			<!-- A spectator reads the briefing beside the board instead of in front of it, so what was just revealed stays in view. -->
			<div
				class="scrim"
				class:passive={spectator}
				role="dialog"
				aria-modal={!spectator}
				aria-label="New this game"
				transition:fade={{ duration: 200 }}
			>
				<div
					class="briefing"
					{@attach feedback('Briefing', () => ({ briefing: campaign.briefing }))}
					in:fly={{ y: 24, duration: 300 }}
				>
					<h2>New this game</h2>
					<ul>
						{#each campaign.briefing as line, index (index)}
							{@const split = line.indexOf(': ')}
							<li>
								{#if split > 0 && split < 48}<strong>{line.slice(0, split)}</strong>
									{line.slice(split + 2)}{:else}{line}{/if}
							</li>
						{/each}
					</ul>
					<button
						class="primary"
						onclick={() => (spectator ? (briefingRead = campaign.briefing.join('|')) : send({ type: 'ACK_BRIEFING' }))}
						data-testid="ack-briefing">Continue</button
					>
				</div>
			</div>
		{:else if snap.phase === 'lobby' || snap.phase === 'finished'}
			<div class="scrim" role="dialog" aria-modal="true" aria-label="Lobby" transition:fade={{ duration: 200 }}>
				<Lobby {snap} {send} />
			</div>
		{:else if snap.phase === 'upkeep'}
			<div class="scrim" role="dialog" aria-modal="true" aria-label="Between games" transition:fade={{ duration: 200 }}>
				<Upkeep {snap} {send} />
			</div>
		{/if}

		{@render children?.()}

		{#if menu}
			<div
				class="menu"
				transition:scale={{ start: 0.92, duration: 180, opacity: 0 }}
				{@attach feedback('Menu', () => undefined)}
			>
				{#if import.meta.env.DEV}
					<button
						onclick={() => {
							menu = false;
							// The capture waits for the menu's exit transition, so the screenshot shows the table without it.
							setTimeout(() => void presentFeedback(), 220);
						}}>Give feedback <kbd>⌥⌘ click</kbd></button
					>
				{/if}
				<button onclick={download}>Export campaign save</button>
				{#if session.mode !== 'join' && !spectator}
					<button onclick={downloadRecord} data-testid="save-recording">Save this game's recording</button>
					<a href="/replay?src=local" target="_blank" data-testid="open-replay">Replay this game</a>
				{/if}
				{#if session.mode !== 'join'}
					<button onclick={() => fileInput?.click()}>Import campaign save</button>
					<button onclick={() => session.importSave(scenarios.october())} data-testid="scenario-october"
						>Load scenario: October</button
					>
					<button onclick={() => session.importSave(scenarios.december())} data-testid="scenario-december"
						>Load scenario: December</button
					>
					<button
						class="danger"
						onclick={() =>
							confirm('Start a new campaign? The current one is erased unless you exported it.') &&
							session.newCampaign()}>New campaign</button
					>
					<input
						bind:this={fileInput}
						type="file"
						accept="application/json"
						hidden
						onchange={async event => session.importSave(await event.currentTarget.files![0]!.text())}
					/>
				{/if}
			</div>
		{/if}
	</main>

	{#if game && snap.phase !== 'upkeep' && !spectator}
		<Dock
			{snap}
			{canAct}
			{owns}
			seat={dockSeat!}
			home={home!}
			{plays}
			{decides}
			{send}
			onview={seat => (viewing = seat)}
			aiming={targeting ? { label: targeting.label, a: targeting.a, count: targeting.cities.size } : null}
			oncancel={cancel}
			uses={cardUses}
			onplaycard={playCard}
		/>
	{/if}
</div>

<style>
	.game {
		position: fixed;
		/* A page that hosts the game beside something else, such as the replay viewer, sets the inset. */
		inset: var(--game-inset, 0);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		grid-template-columns: minmax(0, 1fr);
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
		font-variant-numeric: tabular-nums;
		overflow: hidden;
	}

	.stage {
		position: relative;
		min-height: 0;
	}

	/* The seats sit in the corners, with the chart's key and the insights between them on either side. */
	.column {
		position: absolute;
		top: 0.7rem;
		bottom: 0.7rem;
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 15.5rem;
		pointer-events: none;
	}

	.column > :global(*) {
		pointer-events: auto;
	}

	/* A seat's character sheet opens over the objectives and the targeting line, which share the layer. */
	.column:has(:global([data-testid='character-sheet'], [data-testid='corner-full-hand'])) {
		z-index: 32;
	}

	/* The dock's cards rise 2.6rem over the stage's bottom edge, and the bottom seats sit above them. */
	.column.docked {
		bottom: 3.3rem;
	}

	.column.left {
		left: 0.7rem;
	}

	.column.right {
		right: 0.7rem;
		align-items: flex-end;
	}

	.place,
	.seated {
		width: 100%;
	}

	.place.bl,
	.place.br {
		margin-top: auto;
	}

	/* The action list sits in whichever side column has room, beside the seats. */
	.actions-slot {
		display: flex;
		/* As wide as a seat: the fitted view already gives up that much of the board to the seats. */
		width: 15.5rem;
		min-height: 0;
		/* Gives up its height before the insights do, scrolling its rows. */
		flex: 0 100 auto;
	}

	/* On the right it stands on the player's own seat, above the controls that end the turn. */
	.column.right .actions-slot {
		margin-top: auto;
	}

	.column.right .actions-slot + .place.br {
		margin-top: 0;
	}

	.insights {
		display: flex;
		width: 12.5rem;
		min-height: 0;
		flex: 0 1 auto;
	}

	.goals {
		position: absolute;
		top: 0.6rem;
		left: 50%;
		z-index: 30;
		transform: translateX(-50%);
	}

	.whoami {
		position: absolute;
		top: 5.6rem;
		left: 50%;
		z-index: 31;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--paper);
		border-radius: 3px;
		background: var(--panel-solid);
		font-size: 0.9rem;
		transform: translateX(-50%);
		white-space: nowrap;
	}

	.whoami button {
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		color: var(--paper);
		font: inherit;
		cursor: pointer;
	}

	.whoami button:hover {
		border-color: var(--paper);
	}

	.chooser header button {
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	.chooser header button:hover {
		color: var(--ink);
	}

	.chooser {
		position: absolute;
		left: 50%;
		bottom: 0.8rem;
		z-index: 40;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 22rem;
		max-height: min(72%, 28rem);
		padding: 0.6rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--panel);
		backdrop-filter: blur(12px);
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.55);
		transform: translateX(-50%);
	}

	.chooser header {
		display: flex;
		justify-content: space-between;
		padding: 0 0.15rem;
		font-family: var(--font-display);
		font-size: 1rem;
	}

	.chooser input {
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.82rem;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-height: 0;
		overflow: auto;
		scrollbar-width: thin;
	}

	.rows p {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.rows button {
		display: flex;
		flex: none;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.85rem;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease;
	}

	.rows button:hover {
		border-color: var(--line-strong);
	}

	.rows button.picked {
		border-color: var(--paper);
		background: rgb(220 207 178 / 0.12);
	}

	.rows span {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.75rem;
		text-align: right;
	}

	.toasts {
		position: absolute;
		top: 5.6rem;
		left: 50%;
		z-index: 50;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.toasts div {
		padding: 0.3rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--panel-solid);
		font-size: 0.82rem;
	}

	.toasts .good {
		border-color: var(--good);
		color: var(--good);
	}

	.toasts .bad {
		border-color: var(--danger);
		color: var(--danger);
	}

	/* The epidemic lands like a quarantine stamp across the chart: it overshoots, settles, and bleeds. */
	.banner {
		position: absolute;
		top: 30%;
		left: 50%;
		z-index: 45;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.7rem 2.6rem 0.8rem;
		border: 3px double rgb(176 48 28 / 0.9);
		background: rgb(28 12 8 / 0.82);
		color: #e46a4c;
		translate: -50% 0;
		rotate: -3deg;
		pointer-events: none;
		animation: stamp 520ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
	}

	.banner strong {
		font-family: var(--font-display);
		font-size: 3rem;
		font-weight: 400;
		line-height: 1;
		letter-spacing: 0.04em;
	}

	.banner span {
		color: var(--ink);
		font-size: 0.9rem;
	}

	@keyframes stamp {
		from {
			opacity: 0;
			scale: 1.7;
		}
		60% {
			opacity: 1;
		}
		to {
			scale: 1;
		}
	}

	.turn-banner {
		position: absolute;
		top: 3.3rem;
		left: 50%;
		z-index: 44;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.3rem 1.1rem 0.35rem;
		border-radius: 2px;
		background: var(--seat);
		color: var(--on);
		box-shadow: 0 0.6rem 1.6rem rgb(0 0 0 / 0.45);
		font-family: var(--font-display);
		font-size: 1.15rem;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.turn-banner i {
		width: 0.55rem;
		height: 0.55rem;
		border: 2px solid var(--on);
		border-radius: 50%;
	}

	.flash {
		position: absolute;
		inset: 0;
		z-index: 43;
		box-shadow: inset 0 0 10rem 2rem rgb(140 28 18 / 0.6);
		animation: flash 1.6s ease-out forwards;
		pointer-events: none;
	}

	@keyframes flash {
		0% {
			opacity: 0;
		}
		12% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	.outcome {
		position: absolute;
		top: 28%;
		left: 50%;
		z-index: 46;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 1.3rem 3.5rem 1.5rem;
		border: 1px solid var(--danger);
		border-radius: 2px;
		background: rgb(20 18 14 / 0.9);
		backdrop-filter: blur(10px);
		color: var(--danger);
		translate: -50% 0;
		pointer-events: none;
	}

	.outcome.won {
		border-color: var(--good);
		color: var(--good);
	}

	.outcome strong {
		font-family: var(--font-display);
		font-size: 3.6rem;
		font-weight: 400;
		line-height: 1;
	}

	.outcome span {
		color: var(--ink);
		font-size: 1rem;
	}

	.scrim {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgb(12 10 8 / 0.62);
	}

	.scrim.passive {
		place-items: start center;
		padding-top: 3.2rem;
		background: none;
		pointer-events: none;
	}

	.scrim.passive .briefing {
		width: min(26rem, 90vw);
		padding: 0.9rem 1.1rem 0.9rem;
		pointer-events: auto;
	}

	.scrim.passive .briefing ul {
		max-height: 30vh;
		font-size: 0.85rem;
	}

	.briefing {
		width: min(34rem, 90vw);
		padding: 1.4rem 1.6rem 1.3rem;
		border-radius: 2px;
		background: var(--paper);
		color: var(--paper-ink);
		box-shadow:
			0 1.5rem 4rem rgb(0 0 0 / 0.6),
			inset 0 0 3rem rgb(120 86 48 / 0.18);
	}

	.briefing h2 {
		margin: 0 0 0.7rem;
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 400;
	}

	.briefing ul {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		max-height: 60vh;
		margin: 0 0 1.1rem;
		padding: 0;
		overflow: auto;
		list-style: none;
		font-size: 0.95rem;
		line-height: 1.45;
	}

	.briefing li {
		padding-left: 0.7rem;
		border-left: 2px solid rgb(42 32 23 / 0.3);
	}

	.briefing strong {
		display: block;
		font-family: var(--font-display);
		font-size: 1.08rem;
		font-weight: 400;
	}

	.briefing li::marker {
		color: var(--paper-muted);
	}

	.primary {
		padding: 0.45rem 1.1rem;
		border: 1px solid var(--paper);
		border-radius: 2px;
		background: var(--paper);
		color: var(--paper-ink);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.briefing .primary {
		border-color: var(--paper-ink);
		background: var(--paper-ink);
		color: var(--paper);
	}

	.menu {
		transform-origin: top right;
		position: absolute;
		top: 0.4rem;
		right: 0.7rem;
		z-index: 70;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--panel-solid);
		box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.5);
		font-size: 0.85rem;
	}

	.menu > * {
		animation: rise 260ms calc(var(--n, 0) * 30ms) both;
	}

	.menu > :nth-child(2) {
		--n: 1;
	}

	.menu > :nth-child(3) {
		--n: 2;
	}

	.menu > :nth-child(4) {
		--n: 3;
	}

	.menu > :nth-child(5) {
		--n: 4;
	}

	.menu > :nth-child(n + 6) {
		--n: 5;
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 0.4rem;
		}
	}

	.rows button {
		animation: rise 240ms calc(var(--i, 0) * 25ms) both;
	}

	.menu button,
	.menu a {
		padding: 0.35rem 0.7rem;
		border: 1px solid transparent;
		border-radius: 2px;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.menu button:hover,
	.menu a:hover {
		border-color: var(--line);
		background: var(--wash);
	}

	.menu kbd {
		margin-left: 0.6rem;
		color: var(--muted);
		font: inherit;
		font-size: 0.75rem;
	}

	.menu .danger {
		color: var(--danger);
	}

	.menu p {
		margin: 0;
		color: var(--muted);
	}
</style>
