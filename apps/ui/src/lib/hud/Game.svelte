<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import {
		actionMenu,
		cardTargets,
		cityDef,
		insights,
		legalDecides,
		legalPlays,
		onGrid,
		pack,
		reconBoxes,
		reject,
		scenarios,
		sealKey,
		tableStart,
	} from '@repo/game';
	import type { CardId, CityId, Command, EdgeDef, SeatId } from '@repo/game';
	import Board from '#lib/board/Board.svelte';
	import type { BoardMarks, Covered, Fx, FxKind } from '#lib/board/types.ts';
	import type { SessionView } from '#lib/session/session.svelte.ts';
	import { inkOn } from '#lib/color.ts';
	import { presentFeedback } from '#lib/feedback.ts';
	import { CITY_COLOR } from '#lib/board/CityMarker.svelte';
	import { onButton, typing } from '#lib/keys.ts';
	import { LS } from '#lib/storage.ts';
	import { setContext, tick, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { backOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
	import ActionPanel from './ActionPanel.svelte';
	import { createBoardView } from './boardView.svelte.ts';
	import { createChoosing } from './choosing.svelte.ts';
	import { MapTools } from './mapTools.svelte.ts';
	import Corner from './Corner.svelte';
	import { placeSeats } from './seats.ts';
	import type { Place } from './seats.ts';
	import Dock from './Dock.svelte';
	import EpidemicSequence from './EpidemicSequence.svelte';
	import InfectionDraw from './InfectionDraw.svelte';
	import { InfectionShow } from './infectionShow.svelte.ts';
	import { cardName, cityName, seatName, SEAT_COLORS, setNames } from './labels.svelte.ts';
	import Lobby from './Lobby.svelte';
	import CharacterSelect from './CharacterSelect.svelte';
	import Briefing from './Briefing.svelte';
	import Unboxing from './Unboxing.svelte';
	import LegacyBox from './LegacyBox.svelte';
	import LegacyDeck from './LegacyDeck.svelte';
	import Hotkeys from './Hotkeys.svelte';
	import Objectives from './Objectives.svelte';
	import SeatPicker from './SeatPicker.svelte';
	import TopBar from './TopBar.svelte';
	import Upkeep from './Upkeep.svelte';
	import RichText from './RichText.svelte';
	import { provideViewState } from './viewState.ts';
	import type { GameUi } from '#lib/studio/scene.ts';

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

	// Which seats are this browser's is game state, keyed by the id the browser keeps, so a reload sits back down.
	const mine = $derived(world.table.seats.filter(entry => entry.player === session.player).map(entry => entry.seat));
	const solo = $derived(session.mode === 'solo');
	const owns = (seat: SeatId) => !spectator && (solo || mine.includes(seat));
	const canAct = $derived(game !== null && owns(game.active));
	const present = $derived(new Set(session.peers.filter(peer => peer.connected).map(peer => peer.id as string)));
	/** A seat nobody holds, or held by someone no longer connected, such as a player who moved to another browser. */
	const isOpen = (seat: SeatId) => {
		const holder = world.table.seats.find(entry => entry.seat === seat);
		return !holder || (holder.player !== session.player && !present.has(holder.player));
	};
	const picking = $derived(
		game !== null && !spectator && !solo && mine.length === 0 && snap.phase !== 'upkeep' && snap.phase !== 'over',
	);
	const openSeats = $derived(picking ? game!.seats.filter(isOpen) : []);
	function takeSeat(seat: SeatId) {
		send({ type: 'TAKE_SEAT', player: session.player, name: LS.get('name', '').trim() || 'Player', seat });
	}
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

	let menu = $state(false);
	let boxOpen = $state(false);
	let deckOpen = $state(false);
	let hotkeysOpen = $state(false);
	let legacyDeckOut = $state(false);
	// Once the table knows which game is next, every game is set up by choosing who plays, over the whole table.
	const choosingCharacters = $derived(snap.phase === 'lobby' && !spectator && tableStart(snap.world) !== null);
	// A haven the character screen points at, which the camera looks at behind it.
	let focus = $state.raw<{ city: CityId; x: number; y: number } | null>(null);
	let stage = $state<HTMLElement | null>();
	let leftColumn = $state<HTMLElement | null>();
	let rightColumn = $state<HTMLElement | null>();
	let goals = $state<HTMLElement | null>();

	// Everyone sits round the table in turn order, clockwise, with this browser's player at the bottom right.
	// A replay seats the first player there.
	const seatAt = $derived(game ? placeSeats(game.seats, me) : null);
	// Where the panels on the board's sides sit, so the fitted view keeps cities out from under them.
	let covered = $state.raw<Covered[]>([]);
	// How far the side columns' panels reach in beside the floating hand (`low`) and beside the objectives (`high`),
	// so each stays between them however wide they grow. Only the panels at its own height count: the Actions panel
	// stands mid-side, and the hand has the room under it.
	let sides = $state.raw({ low: { left: 0, right: 0 }, high: { left: 0, right: 0 } });
	const listed = $derived(actionChoices.length > 0);
	let actionColumns = $state(1);
	$effect(() => {
		void seatAt;
		// The Actions panel comes and goes with the turn's steps and grows columns, and is one of the panels measured.
		void listed;
		void actionColumns;
		// `bind:this` hands back null, not undefined, once a column leaves the screen.
		const columns = [leftColumn, rightColumn].filter((column): column is HTMLElement => column instanceof HTMLElement);
		if (!stage) return void (covered = []);
		// The columns run the full height but only their panels cover the board, so the panels are what is measured.
		// The dock layer follows the stage and lies over its bottom edge.
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
			const next = panels.map(panel => {
				const box = extent(panel);
				return {
					x: box.left - origin.x,
					y: box.top - origin.y,
					width: box.width,
					height: box.height,
					// The Actions panel stands mid-side over the board and grows a column rather than hide a row, so
					// the board always makes room for all of it.
					firm: panel.classList.contains('actions-slot'),
				};
			});
			const reach = (column: HTMLElement | null | undefined, side: 'left' | 'right', top: number, bottom: number) =>
				column instanceof HTMLElement
					? Math.max(
							0,
							...[...column.children].map(child => {
								const box = child.getBoundingClientRect();
								if (box.bottom <= top || box.top >= bottom) return 0;
								return side === 'left' ? box.right - origin.left : origin.right - box.left;
							}),
						)
					: 0;
			const band = (top: number, bottom: number) => ({
				left: reach(leftColumn, 'left', top, bottom),
				right: reach(rightColumn, 'right', top, bottom),
			});
			const dock = stage!.nextElementSibling;
			const reached = {
				low: band(dock instanceof HTMLElement ? extent(dock).top : origin.bottom, Infinity),
				high: band(-Infinity, goals instanceof HTMLElement ? extent(goals).top + extent(goals).height : origin.top),
			};
			untrack(() => {
				// A new array restarts the camera's glide even when nothing moved, and a glide under a click reads as a drag.
				if (JSON.stringify(next) !== JSON.stringify(covered)) covered = next;
				if (JSON.stringify(reached) !== JSON.stringify(sides)) sides = reached;
			});
		};
		// A measure moves the floating hand, so it waits a frame rather than run inside the observer's own delivery.
		let frame = 0;
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		});
		for (const element of [stage, ...panels]) observer.observe(element);
		measure();
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
	let resetView = $state(0);

	const send = (command: Command) => session.send(command);

	const recons = $derived(reconBoxes(world, snap.phase));
	const choosing = createChoosing({
		get world() {
			return world;
		},
		get phase() {
			return snap.phase;
		},
		get live() {
			return live;
		},
		get canAct() {
			return canAct;
		},
		get actionChoices() {
			return actionChoices;
		},
		get plays() {
			return plays;
		},
		get recons() {
			return recons;
		},
		owns,
		send,
		toast,
	});

	const view = provideViewState();
	let board = $state<Board>();
	// Announcements put back by `applyUi` stay up until the game moves on, where live ones time out.
	let heldAnnouncements = false;

	/** Everything on this screen that the game state does not decide, as plain JSON. */
	export function ui(): GameUi {
		return {
			camera: board?.camera() ?? null,
			viewing,
			menu,
			box: boxOpen,
			deck: deckOpen,
			hotkeys: hotkeysOpen,
			steps: choosing.steps,
			filter: choosing.filter,
			toasts: toasts.map(({ text, tone }) => ({ text, tone })),
			banner: banner && { title: banner.title, text: banner.text },
			turnBanner: turnBanner && { name: turnBanner.name, color: turnBanner.color },
			parts: view.read(),
		};
	}

	/** Where the board's camera is this instant, for telling when a glide has ended. */
	export const cameraNow = () => board?.cameraNow() ?? null;

	/**
	 * Puts the screen the way `ui()` wrote it down, over the game state already loaded. Returns what could not be
	 * put back, such as a click the rules no longer allow.
	 */
	export async function applyUi(next: GameUi): Promise<string[]> {
		const problems: string[] = [];
		await tick();
		choosing.dismiss();
		menu = next.menu;
		boxOpen = next.box;
		deckOpen = next.deck;
		hotkeysOpen = next.hotkeys ?? false;
		viewing = next.viewing;
		heldAnnouncements = next.toasts.length > 0 || next.banner !== null || next.turnBanner !== null;
		toasts = next.toasts.map(entry => ({ id: nextFx++, ...entry }));
		banner = next.banner && { id: nextFx++, ...next.banner };
		turnBanner = next.turnBanner && { id: nextFx++, ...next.turnBanner };
		view.write(next.parts);
		board?.setCamera(next.camera);
		for (const [index, entry] of next.steps.entries()) {
			// The chooser clears its filter and ticks in an effect, which must run before the next click lands.
			await tick();
			if (choosing.step(entry)) continue;
			problems.push(
				`Step ${index + 1} of ${next.steps.length} (${JSON.stringify(entry)}) is not possible in this state`,
			);
			break;
		}
		await tick();
		choosing.filter = next.filter;
		await tick();
		return problems;
	}

	/** Escape and a right click put down whatever was half-chosen. */
	function cancel() {
		return tools.dropEraser() || choosing.cancel();
	}

	function takeBack(city: CityId) {
		const command = { type: 'PLACE_SUPPLY', city, count: -1 } as const;
		if (reject(world, snap.phase, command) === null) send(command);
	}

	// A spectator cannot acknowledge a briefing for the table, so closing it is theirs alone.
	let briefingRead = $state('');
	const briefingKey = $derived(JSON.stringify(campaign.briefing));
	const briefingOpen = $derived(campaign.briefing.length > 0 && briefingRead !== briefingKey);
	// The closing dialog keeps what it said while it fades, so its objectives are still there to fly to the board.
	let shownBriefing = $state.raw(untrack(() => campaign.briefing));
	$effect.pre(() => {
		if (campaign.briefing.length) shownBriefing = campaign.briefing;
	});

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
		if (heldAnnouncements) {
			heldAnnouncements = false;
			untrack(() => {
				toasts = [];
				banner = null;
				turnBanner = null;
			});
		}
		const added: Fx[] = [];
		const pulse = (city: CityId, kind: FxKind) => added.push({ id: nextFx++, city, kind, delay: added.length * 240 });
		// Infections pulse their cities from the infection show, each at its own moment.
		for (const entry of fresh) {
			if (entry.t === 'connected') pulse(entry.city, 'connected');
			else if (entry.t === 'structure') pulse(entry.city, 'build');
			else if (entry.t === 'epidemic') {
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
				toast(`Opened: ${pack.seals.find(def => sealKey(def.seal) === entry.seal)?.name}`, 'good');
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

	const show = new InfectionShow((city, kind) => {
		const id = nextFx++;
		fx = [...fx, { id, city, kind, delay: 0 }];
		setTimeout(() => (fx = fx.filter(entry => entry.id !== id)), 4000);
	});
	/** The middle of the board left open between the panels, level with the middle of the stage, as fractions. */
	function openMiddle() {
		const width = stage?.clientWidth || 1;
		const y = (stage?.clientHeight ?? 0) * 0.45;
		let left = 0;
		let right = width;
		for (const rect of covered) {
			if (rect.y > y || rect.y + rect.height < y) continue;
			if (rect.x + rect.width / 2 < width / 2) left = Math.max(left, rect.x + rect.width);
			else right = Math.min(right, rect.x);
		}
		return { x: (left + right) / 2 / width, y: 0.45 };
	}
	// Worked out once per city: a new object restarts the camera's glide, and the panels move while the show plays.
	const showFocus = $derived(show.focus ? { city: show.focus, ...untrack(openMiddle), glide: 900, zoom: 0.45 } : null);
	// Before anything draws the new state, so the board and the incident track never show what the show holds back.
	$effect.pre(() => {
		const next = world;
		const lived = !spectator || announce;
		const phase = snap.phase;
		untrack(() => show.observe(next, lived, phase, !spectator));
	});
	$effect(() => () => show.stop());

	// Animate cards flying out of the Player/Infection deck into Package 6 when inoculated.
	let seenStoredPlayer = untrack(() => new Set(campaign.stored.player));
	let seenStoredInfection = untrack(() => new Set(campaign.stored.infection));
	$effect(() => {
		const nextPlayer = campaign.stored.player;
		const nextInfection = campaign.stored.infection;
		const lived = !spectator || announce;
		untrack(() => {
			const added: { id: CardId; pile: 'player' | 'infection' }[] = [
				...nextPlayer.filter(id => !seenStoredPlayer.has(id)).map(id => ({ id, pile: 'player' as const })),
				...nextInfection.filter(id => !seenStoredInfection.has(id)).map(id => ({ id, pile: 'infection' as const })),
			];
			seenStoredPlayer = new Set(nextPlayer);
			seenStoredInfection = new Set(nextInfection);
			if (!lived || added.length === 0 || added.length > 6 || typeof document === 'undefined') return;
			const targetEl = document.querySelector<HTMLElement>('[data-dest="storage"]');
			if (!targetEl) return;
			const to = targetEl.getBoundingClientRect();
			if (!to.width) return;
			added.forEach(({ id, pile }, index) => {
				const sourceEl = document.querySelector<HTMLElement>(`[data-deck="${pile}"]`);
				if (!sourceEl) return;
				const from = sourceEl.getBoundingClientRect();
				const card = pile === 'player' ? campaign.playerCards[id] : campaign.infectionCards[id];
				const city = card && 'city' in card ? cityDef(card.city) : null;
				const band = city ? CITY_COLOR[city.color ?? 'haven'] : '#4e3b63';
				const label = city ? cityName(city.id) : cardName(world, id);
				const ghost = document.createElement('div');
				ghost.dataset.testid = 'inoculate-flight';
				Object.assign(ghost.style, {
					position: 'fixed',
					left: `${from.left + from.width / 2}px`,
					top: `${from.top + from.height / 2}px`,
					zIndex: '95',
					display: 'grid',
					placeItems: 'center',
					width: pile === 'infection' ? '4.8rem' : '3.6rem',
					height: pile === 'infection' ? '3.3rem' : '4.8rem',
					padding: '0.2rem 0.3rem',
					border: `2px solid ${band}`,
					borderRadius: '4px',
					background: pile === 'infection' ? `linear-gradient(90deg, ${band} 0 28%, #26212c 28%)` : band,
					color: '#fff8ec',
					fontSize: '0.62rem',
					fontWeight: '700',
					textAlign: 'center',
					lineHeight: '1.1',
					boxShadow: '0 0.7rem 1.8rem rgb(0 0 0 / 0.6)',
					pointerEvents: 'none',
					transform: 'translate(-50%, -50%)',
				});
				ghost.textContent = label;
				document.body.append(ghost);
				const dx = to.left + to.width / 2 - (from.left + from.width / 2);
				const dy = to.top + to.height / 2 - (from.top + from.height / 2);
				const anim = ghost.animate(
					[
						{ transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0.2 },
						{
							transform: `translate(calc(-50% + ${dx * 0.35}px), calc(-50% + ${dy * 0.35 + 64}px)) scale(1.12) rotate(-6deg)`,
							opacity: 1,
							offset: 0.38,
						},
						{
							transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.32) rotate(4deg)`,
							opacity: 0.9,
						},
					],
					{
						duration: 780,
						delay: index * 140,
						easing: 'cubic-bezier(0.35, 0, 0.2, 1)',
						fill: 'forwards',
					},
				);
				anim.onfinish = () => ghost.remove();
				anim.oncancel = () => ghost.remove();
			});
		});
	});

	const drawPlayerAction = $derived(
		!spectator && canAct && snap.phase === 'playing.draw' && game && game.drawsLeft > 0 && game.pending.length === 0
			? { left: game.drawsLeft, onclick: () => send({ type: 'DRAW' }) }
			: null,
	);
	const drawInfectionAction = $derived.by(() => {
		if (spectator || !game) return null;
		if (show.queued > 0) return { left: show.queued, busy: show.playing, onclick: () => show.next() };
		if (canAct && snap.phase === 'playing.infect' && game.infectionsLeft > 0 && game.pending.length === 0)
			return { left: game.infectionsLeft, busy: show.playing, onclick: () => send({ type: 'INFECT' }) };
		return null;
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

	// A target being aimed at wins over a card the pointer happens to rest on.
	const targetCities = $derived(
		new Set<CityId>(
			choosing.targeting ? choosing.targeting.cities.keys() : hoveredCards.length ? hoveredTargets.cities : [],
		),
	);
	// The lines a player could draw show faintly while they pick where to draw one.
	const ghostEdges = $derived.by((): EdgeDef[] => {
		const aimed = choosing.targeting?.a;
		const drawing = aimed === 'establishLine' || aimed === 'chartLane' ? aimed : null;
		const from = choosing.here;
		if (!from || !drawing) return [];
		return actions.flatMap(action =>
			action.a === drawing
				? [{ a: from, b: action.to, kind: drawing === 'establishLine' ? ('land' as const) : ('sea' as const) }]
				: [],
		);
	});
	const boardView = createBoardView({
		get world() {
			return world;
		},
		get playing() {
			return playing;
		},
		get info() {
			return info;
		},
		get onGrid() {
			return gridSet;
		},
		get lag() {
			return show.lag;
		},
		get skull() {
			return show.skull;
		},
		get selected() {
			return choosing.ring;
		},
		get targets() {
			return targetCities;
		},
		get ghostEdges() {
			return ghostEdges;
		},
		get recons() {
			return recons;
		},
		get spectator() {
			return spectator;
		},
		get canAct() {
			return canAct;
		},
		get solo() {
			return solo;
		},
		litPawn: seat =>
			pointedSeat === seat || choosing.targeting?.pawn === seat || (choosing.targeting?.pawns?.has(seat) ?? false),
		pickablePawn: seat => choosing.targeting?.pawns?.has(seat) ?? false,
		get session() {
			return session;
		},
		get fx() {
			return fx;
		},
		get marks() {
			return marks;
		},
	});

	const tools = new MapTools(
		() => session,
		() => !spectator,
		() => board?.pointerBoardPoint() ?? null,
	);

	/** Space advances the turn, Z undoes, F draws, E toggles eraser, Tab pings the map, ? opens hotkeys, Escape closes. */
	function onkey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (hotkeysOpen) {
				hotkeysOpen = false;
				return;
			}
			cancel();
			menu = false;
		}
		if (typing(event) || event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === '?' && !spectator) {
			event.preventDefault();
			menu = false;
			hotkeysOpen = !hotkeysOpen;
			return;
		}
		const modalOpen = () => Boolean(document.querySelector('[aria-modal="true"], .tabletop-unboxing'));
		if (event.key === 'Tab' && !spectator && !modalOpen()) {
			event.preventDefault();
			if (!event.repeat) tools.ping();
			return;
		}
		const key = event.key.toLowerCase();
		if (key === 'f' && !event.repeat && !spectator && !modalOpen()) {
			tools.holdPen();
			return;
		}
		if (key === 'e' && !event.repeat && !spectator && tools.hasDrawings && !modalOpen()) {
			tools.toggleEraser();
			return;
		}
		if (onButton(event) || !game) return;
		if (key === 'z' && snap.canUndo && canAct) send({ type: 'UNDO' });
		if (key !== ' ') return;
		if (show.queued > 0 && !show.playing && !spectator) {
			event.preventDefault();
			show.next();
			return;
		}
		if (!canAct) return;
		event.preventDefault();
		const pending = game.pending[0]?.t;
		if (pending === 'epidemicDrawn' || pending === 'epidemicInfect' || pending === 'intensify') {
			send({ type: 'DECIDE', decide: { d: 'skip' } });
			return;
		}
		if (snap.phase === 'playing.actions') send({ type: 'END_ACTIONS', seat: game.active });
		else if (snap.phase === 'playing.draw') send({ type: 'DRAW' });
		else if (snap.phase === 'playing.infect' && !show.playing) send({ type: 'INFECT' });
	}

	function onkeyup(event: KeyboardEvent) {
		if (event.key.toLowerCase() === 'f') {
			tools.releasePen();
		}
	}

	function onblur() {
		tools.letGo();
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

<svelte:window onkeydown={onkey} {onkeyup} {onblur} />

{#snippet actionPanel(side: 'left' | 'right')}
	{#if game && !spectator && actionChoices.length && canAct && snap.phase === 'playing.actions'}
		<div class="actions-slot" transition:fly={{ x: side === 'left' ? -320 : 320, duration: 360, opacity: 0 }}>
			<ActionPanel
				{snap}
				seat={game.active}
				name={seatName(world, game.active)}
				menu={actionChoices}
				{live}
				{canAct}
				aiming={choosing.targeting?.a ?? null}
				onchoose={choice => choosing.step({ t: 'start', a: choice.a, via: 'panel' })}
				{send}
				onlockdown={card => choosing.step({ t: 'lockdown', card })}
				bind:columns={actionColumns}
			/>
		</div>
	{/if}
{/snippet}

{#snippet seated(place: Place)}
	{@const seat = seatAt?.get(place)}
	{#if seat && game}
		<div
			class="place {place}"
			class:open={openSeats.includes(seat)}
			data-place={place}
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
						/>
					</div>
				{/key}
			{/if}
			{#if openSeats.includes(seat)}
				<button
					class="take"
					style:--seat={SEAT_COLORS[game.seats.indexOf(seat)]}
					onclick={() => takeSeat(seat)}
					data-testid={`take-${seat}`}
					transition:fade={{ duration: 200 }}>Sit here as {seatName(world, seat)}</button
				>
			{/if}
		</div>
	{/if}
{/snippet}

<div
	class="game"
	style:--left={`${sides.low.left}px`}
	style:--right={`${sides.low.right}px`}
	style:--high-left={`${sides.high.left}px`}
	style:--high-right={`${sides.high.right}px`}
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
		legacyOut={legacyDeckOut}
		drawPlayer={drawPlayerAction}
		drawInfection={drawInfectionAction}
		hasDrawings={!spectator && tools.hasDrawings}
		erasing={tools.tool === 'eraser'}
		oneraser={() => tools.toggleEraser()}
		onclear={tools.clear}
		onreset={() => resetView++}
		onmenu={() => (menu = !menu)}
		onbox={() => (boxOpen = !boxOpen)}
		ondeck={() => (deckOpen = !deckOpen)}
	/>

	<main class="stage" bind:this={stage} data-dest="map">
		<Board
			view={boardView}
			bind:this={board}
			oncity={city => choosing.step({ t: 'city', city })}
			onrecon={route => choosing.step({ t: 'recon', route })}
			oncityback={city => cancel() || takeBack(city)}
			oncancel={cancel}
			onmiss={choosing.closeRing}
			onpawn={seat => choosing.step({ t: 'pawn', seat: seat as SeatId })}
			ring={choosing.ring && choosing.ringEntries.length
				? {
						city: choosing.ring,
						entries: choosing.ringEntries.map(entry => ({ key: entry.a, label: entry.label, detail: entry.detail })),
					}
				: null}
			onring={key => choosing.step({ t: 'start', a: key, via: 'ring' })}
			onpointer={point => tools.pointer(point)}
			tool={tools.tool}
			ondrawstart={tools.drawStart}
			ondrawmove={tools.drawMove}
			ondrawend={tools.drawEnd}
			onerasestart={tools.eraseStart}
			onerasemove={tools.eraseMove}
			oneraseend={tools.eraseEnd}
			{resetView}
			{covered}
			focus={showFocus ?? focus}
		/>

		{#if game && seatAt && snap.phase !== 'upkeep'}
			<div class="column left" bind:this={leftColumn}>
				{@render seated('tl')}
				{#if seatAt.has('tr')}{@render actionPanel('left')}{/if}
				{@render seated('bl')}
			</div>
			<div class="column right" bind:this={rightColumn}>
				{@render seated('tr')}
				{#if !seatAt.has('tr')}{@render actionPanel('right')}{/if}
				{@render seated('br')}
			</div>
		{/if}
		{#if game && snap.phase !== 'upkeep'}
			<div class="goals" bind:this={goals}>
				<Objectives
					{snap}
					held={briefingOpen &&
						campaign.briefing.some(entry => entry.t === 'unlock' && entry.unlock.t === 'objectives')}
					heldIncidents={show.heldIncidents}
					surge={show.surge}
					onwaive={objective =>
						confirm('Mark this objective impossible for this game? The remaining objectives then decide the win.') &&
						send({ type: 'WAIVE_OBJECTIVE', objective })}
				/>
			</div>
		{/if}

		{#if picking && stage}
			<!-- A browser the table does not know yet, such as a new one, picks an open seat before any control is offered. -->
			<SeatPicker
				{stage}
				seats={openSeats.map(seat => ({
					seat,
					place: [...seatAt!].find(([, at]) => at === seat)![0],
					name: seatName(world, seat),
					color: SEAT_COLORS[game!.seats.indexOf(seat)]!,
				}))}
				onpick={takeSeat}
			/>
		{/if}

		{#if choosing.chooser}
			<div
				class="chooser"
				transition:fly={{ y: 16, duration: 180 }}
				data-testid="chooser"
				{@attach feedback('Chooser', () => ({
					title: choosing.chooser?.title,
					filter: choosing.filter,
					picked: choosing.picked,
				}))}
			>
				<header>
					{choosing.chooser.title}<button onclick={() => choosing.step({ t: 'closeChooser' })} aria-label="Close"
						>×</button
					>
				</header>
				{#if choosing.chooser.options.length > 8}
					<input bind:value={choosing.filter} placeholder="Type to filter" aria-label="Filter the list" />
				{/if}
				<div class="rows">
					{#each choosing.shown as option, index (option)}
						<button
							style:--i={Math.min(index, 12)}
							class:picked={choosing.picked.includes(option)}
							onclick={() => choosing.step({ t: 'option', index: choosing.chooser!.options.indexOf(option) })}
							><strong>{option.label}</strong><span><RichText text={option.detail} /></span></button
						>
					{:else}
						<p>Nothing matches.</p>
					{/each}
				</div>
				{#if choosing.chooser.multi}
					{@const multi = choosing.chooser.multi}
					<button
						class="primary"
						disabled={choosing.picked.length === 0}
						onclick={() => multi.confirm(choosing.picked)}
						data-testid="chooser-confirm"
					>
						{multi.verb}: {choosing.picked.length} of up to {multi.max}
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

		{#if briefingOpen}
			<!-- A spectator reads the briefing beside the board instead of in front of it, so what was just revealed stays in view. -->
			<div
				class="scrim"
				class:passive={spectator}
				class:tabletop={!spectator}
				role="dialog"
				aria-modal={!spectator}
				aria-label="New this game"
				transition:fade={{ duration: 200 }}
			>
				{#if spectator}
					<div in:fly={{ y: 24, duration: 300 }}>
						<Briefing briefing={shownBriefing} {campaign} passive oncontinue={() => (briefingRead = briefingKey)} />
					</div>
				{:else}
					<!-- Each new briefing is unpacked interactively over the map. -->
					{#key briefingKey}
						<Unboxing
							briefing={shownBriefing}
							{campaign}
							table={world.table}
							player={session.player}
							{solo}
							{send}
							ondeckout={out => (legacyDeckOut = out)}
						/>
					{/key}
				{/if}
			</div>
		{:else if choosingCharacters}
			<div
				class="scrim open"
				role="dialog"
				aria-modal="true"
				aria-label="Choose characters"
				in:fade={{ duration: 200 }}
				out:fly={{ y: 120, duration: 360, opacity: 0 }}
			>
				<CharacterSelect
					{snap}
					{send}
					player={session.player}
					rename={name => session.rename(name)}
					onfocus={look => {
						const box = stage?.getBoundingClientRect();
						focus =
							look && box
								? { city: look.city, x: (look.x - box.left) / box.width, y: (look.y - box.top) / box.height }
								: null;
					}}
				/>
			</div>
		{:else if snap.phase === 'lobby' || snap.phase === 'finished'}
			<div class="scrim" role="dialog" aria-modal="true" aria-label="Lobby" transition:fade={{ duration: 200 }}>
				<Lobby {snap} {send} player={session.player} rename={name => session.rename(name)} />
			</div>
		{:else if snap.phase === 'upkeep'}
			<div class="scrim" role="dialog" aria-modal="true" aria-label="Between games" transition:fade={{ duration: 200 }}>
				<Upkeep {snap} {send} />
			</div>
		{/if}

		{@render children?.()}

		{#if boxOpen}
			<div
				class="scrim box-scrim"
				role="dialog"
				aria-modal="true"
				aria-label="The box"
				transition:fade={{ duration: 180 }}
			>
				<div in:fly={{ y: 24, duration: 300 }}>
					<LegacyBox {campaign} onclose={() => (boxOpen = false)} />
				</div>
			</div>
		{/if}

		{#if deckOpen}
			<div
				class="scrim box-scrim"
				role="dialog"
				aria-modal="true"
				aria-label="The Legacy deck"
				transition:fade={{ duration: 180 }}
			>
				<div in:fly={{ y: 24, duration: 300 }}>
					<LegacyDeck {campaign} onclose={() => (deckOpen = false)} />
				</div>
			</div>
		{/if}

		{#if hotkeysOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
			<div
				class="scrim box-scrim"
				role="dialog"
				aria-modal="true"
				aria-label="Keyboard shortcuts"
				tabindex="-1"
				transition:fade={{ duration: 160 }}
				onclick={event => event.target === event.currentTarget && (hotkeysOpen = false)}
			>
				<div in:fly={{ y: 18, duration: 240 }}>
					<Hotkeys onclose={() => (hotkeysOpen = false)} />
				</div>
			</div>
		{/if}

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
				{#if !spectator}
					<button
						onclick={() => {
							menu = false;
							hotkeysOpen = true;
						}}
						data-testid="open-hotkeys">Keyboard shortcuts <kbd>?</kbd></button
					>
				{/if}
				{#if game && !solo && !spectator && mine.length > 0}
					<button
						onclick={() => {
							menu = false;
							send({ type: 'LEAVE', player: session.player });
						}}
						data-testid="vacate-seat">Vacate my seat</button
					>
				{/if}
				<button onclick={download}>Export campaign save</button>
				{#if session.mode !== 'join' && !spectator}
					<button onclick={downloadRecord} data-testid="save-recording">Save this game's recording</button>
					<a href="/replay?src=local" target="_blank" data-testid="open-replay">Replay this game</a>
				{/if}
				{#if session.mode !== 'join'}
					<button onclick={() => fileInput?.click()} title="A save exported from this game">Import campaign save</button
					>
					<button
						onclick={() =>
							confirm(
								'Load the canonical tabletop campaign at the August lobby? The current one is erased unless you exported it.',
							) && session.importSave(scenarios.tabletop())}
						title="A real group's campaign after July, set up in this game"
						data-testid="scenario-tabletop">Load canonical tabletop save</button
					>
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
		{#if !spectator && game}
			<EpidemicSequence {world} />
		{/if}
	</main>

	{#if game && snap.phase !== 'upkeep' && !spectator}
		<!-- No tray: the hand and whatever the turn asks for float over the bottom of the map. -->
		<div class="dock-layer">
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
				aiming={choosing.targeting
					? {
							label: choosing.targeting.label,
							a: choosing.targeting.a,
							prompt: choosing.targeting.pawns
								? `Click one of the ${choosing.targeting.pawns.size} lit pawns on the map.`
								: choosing.targeting.cities.size === 1
									? 'Click the lit city on the map.'
									: `Click one of the ${choosing.targeting.cities.size} lit cities on the map.`,
						}
					: null}
				oncancel={cancel}
				uses={choosing.cardUses}
				onplaycard={(seat, card) => choosing.step({ t: 'play', seat, card })}
				onlockdown={card => choosing.step({ t: 'lockdown', card })}
				drawInfection={snap.phase === 'playing.infect' ? drawInfectionAction : null}
				infectionCount={info
					? info.infection.opening
						? (info.infection.strata[0]?.size ?? 0)
						: info.infection.deck
					: 0}
				setupInfect={snap.phase === 'setup.events' && (show.queued > 0 || show.playing)
					? { left: show.queued, busy: show.playing, onclick: () => show.next() }
					: null}
			/>
		</div>
	{/if}
	<InfectionDraw
		cards={show.stack}
		draw={snap.phase === 'playing.infect' || (snap.phase === 'setup.events' && (show.queued > 0 || show.playing))
			? null
			: drawInfectionAction}
	/>
</div>

<style>
	.game {
		position: fixed;
		/* A page that hosts the game beside something else, such as the replay viewer, sets the inset. */
		inset: var(--game-inset, 0);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		grid-template-columns: minmax(0, 1fr);
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
		font-variant-numeric: tabular-nums;
		overflow: hidden;
	}

	.stage {
		position: relative;
		grid-row: 2;
		grid-column: 1;
		min-height: 0;
	}

	/* Shares the stage's cell, lying over the bottom of the map between the side columns. */
	.dock-layer {
		position: relative;
		z-index: 35;
		grid-row: 2;
		grid-column: 1;
		align-self: end;
		margin-left: calc(var(--left) + 0.7rem);
		margin-right: calc(var(--right) + 0.7rem);
		pointer-events: none;
	}

	/* The seats sit in the corners, with the Actions panel between them on one side. */
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

	/* A seat's character sheet or expanded hand opens above the dock, objectives, actions panel, and prompts. */
	.column:has(:global([data-testid='character-sheet'], [data-testid='corner-full-hand'])) {
		z-index: 52;
	}

	.place:has(:global([data-testid='character-sheet'], [data-testid='corner-full-hand'])) {
		z-index: 10;
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
	/* At least as wide as a seat. A list too long for one column grows another, reaching in over the board. */
	.actions-slot {
		display: flex;
		flex-direction: column;
		width: min-content;
		min-width: 15.5rem;
		min-height: 0;
		flex: 0 1 auto;
	}

	.column.left .actions-slot {
		align-self: flex-start;
	}

	/* On the right it stands on the player's own seat, above the controls that end the turn. */
	.column.right .actions-slot {
		margin-top: auto;
	}

	.column.right .actions-slot + .place.br {
		margin-top: 0;
	}

	/* Centred over the room between the side panels, where the fitted board sits, so a wide panel never reaches it. */
	.goals {
		position: absolute;
		top: 0.6rem;
		left: calc((var(--high-left, 0px) + 100% - var(--high-right, 0px)) / 2);
		z-index: 30;
		transform: translateX(-50%);
	}

	.place {
		position: relative;
	}

	/* An open seat glows in its colour and takes the whole corner as its button. */
	.place.open > .seated {
		filter: saturate(0.6) brightness(0.8);
	}

	.take {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: grid;
		place-items: center;
		min-height: 4rem;
		border: 2px dashed var(--seat);
		border-radius: 4px;
		background: color-mix(in srgb, var(--seat) 16%, rgb(10 8 6 / 0.55));
		color: var(--paper);
		font: inherit;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		animation: beckon 1.6s ease-in-out infinite;
	}

	.take:hover {
		border-style: solid;
		background: color-mix(in srgb, var(--seat) 32%, rgb(10 8 6 / 0.55));
	}

	@keyframes beckon {
		50% {
			box-shadow: 0 0 1.4rem color-mix(in srgb, var(--seat) 70%, transparent);
		}
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
		max-height: min(72vh, 28rem);
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

	/* The top bar's slips, such as a deck's, hang over the board's panels. */
	.game > :global(:first-child) {
		position: relative;
		z-index: 55;
		grid-row: 1;
		grid-column: 1;
	}

	.scrim {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		padding: 1rem;
		overflow: hidden;
		background: rgb(12 10 8 / 0.62);
	}

	.scrim > div {
		display: flex;
		max-width: 100%;
		max-height: 100%;
		min-height: 0;
	}

	.scrim.tabletop {
		display: block;
		padding: 0;
		background: radial-gradient(ellipse at 50% 45%, rgb(12 10 8 / 0.3), rgb(10 8 6 / 0.68));
	}

	.scrim.box-scrim {
		z-index: 70;
	}

	.scrim.open {
		padding: 0;
		background: none;
	}

	.scrim.passive {
		place-items: start center;
		padding-top: 3.2rem;
		background: none;
		pointer-events: none;
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
</style>
