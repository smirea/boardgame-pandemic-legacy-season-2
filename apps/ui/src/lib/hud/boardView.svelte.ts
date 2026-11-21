import { isForsaken, pack } from '@repo/game';
import type { CityId, EdgeDef, Insights, ReconBox, SeatId, World } from '@repo/game';
import { travelOf } from '#lib/board/travel.ts';
import type { BoardMarks, BoardView, CityView, Fx } from '#lib/board/types.ts';
import { reconciler } from '#lib/reconcile.ts';
import type { SessionView } from '#lib/session/session.svelte.ts';
import type { Lag } from './infectionShow.svelte.ts';
import { cityName, SEAT_COLORS, seatName } from './labels.svelte.ts';

/** What the board is drawn from. Each is read where it is used, so a part of the board follows only what it shows. */
export type BoardSource = {
	readonly world: World;
	readonly playing: boolean;
	readonly info: Insights | null;
	readonly onGrid: ReadonlySet<CityId>;
	/** Changes the state already holds that the infection show has not played yet. */
	readonly lag: Lag;
	readonly skull: BoardView['skull'];
	/** The city whose ring of actions is open. */
	readonly selected: CityId | null;
	/** The cities lit as places an action or card can go. */
	readonly targets: ReadonlySet<CityId>;
	readonly ghostEdges: EdgeDef[];
	readonly recons: ReconBox[];
	readonly spectator: boolean;
	readonly canAct: boolean;
	readonly solo: boolean;
	litPawn(seat: SeatId): boolean;
	pickablePawn(seat: SeatId): boolean;
	readonly session: Pick<SessionView, 'cursors' | 'drawings' | 'pings' | 'peers' | 'player'>;
	readonly fx: Fx[];
	readonly marks: BoardMarks | undefined;
};

const NO_CARDS = { inDeck: 0, inHands: 0, discarded: 0 };

/**
 * The board's view of the game. Every part is worked out on its own and handed over as the same object for as long
 * as it holds the same values, so a pointer crossing the table, a peer's cursor or a card being drawn redraws only
 * the pieces it changed. One object rebuilt whole on every change made every city repaint its name.
 */
export function createBoardView(source: BoardSource): BoardView {
	const game = $derived(source.world.game);
	const campaign = $derived(source.world.campaign);

	const colorOf = (player: string) => {
		const seat = source.world.table.seats.find(entry => entry.player === player)?.seat;
		const index = seat && game ? game.seats.indexOf(seat) : -1;
		if (index >= 0) return SEAT_COLORS[index]!;
		if (player === source.session.player) return SEAT_COLORS[0]!;
		const peer = source.session.peers.findIndex(entry => entry.id === player);
		return SEAT_COLORS[(Math.max(0, peer) + 1) % SEAT_COLORS.length]!;
	};
	const nameOf = (player: string) =>
		source.world.table.seats.find(entry => entry.player === player)?.name ??
		source.session.peers.find(peer => peer.id === player)?.name ??
		'Player';

	const sameCities = reconciler<Record<CityId, CityView>>();
	const cities = $derived.by(() => {
		const info = source.playing ? source.info : null;
		const { lag, onGrid, selected, targets } = source;
		return sameCities(
			Object.fromEntries(
				pack.cities.map((city): [CityId, CityView] => {
					const record = campaign.locations[city.id]!;
					const location = game?.locations[city.id];
					const held = lag.cities[city.id];
					return [
						city.id,
						{
							name: cityName(city.id),
							revealed: record.revealed,
							onGrid: onGrid.has(city.id),
							supplies: (location?.supplies ?? 0) - (held?.supplies ?? 0),
							plague: (location?.plague ?? 0) - (held?.plague ?? 0),
							hollow: (location?.hollow ?? 0) - (held?.hollow ?? 0),
							population: record.population,
							port: city.port,
							structures: (['center', 'tower', 'shelter'] as const)
								.filter(kind => location?.[kind] ?? record.permanent.includes(kind))
								.map(kind => ({ kind, permanent: record.permanent.includes(kind) })),
							infested: record.infested,
							forsaken: isForsaken(campaign, city.id),
							lab: record.lab,
							highlight: selected === city.id ? 'selected' : targets.has(city.id) ? 'target' : null,
							infection: info
								? {
										odds: info.infection.odds[city.id] ?? 0,
										inDeck: info.infection.strata.reduce((sum, stratum) => sum + (stratum.cities[city.id] ?? 0), 0),
										discarded: info.infection.discard[city.id] ?? 0,
									}
								: null,
							cards: info ? (info.playerDeck.cities[city.id] ?? NO_CARDS) : null,
						},
					];
				}),
			) as Record<CityId, CityView>,
		);
	});

	const sameRecon = reconciler<BoardView['recon']>();
	const recon = $derived(
		sameRecon(
			source.recons.map(box => ({
				route: box.route.id,
				city: box.route.city,
				cityName: cityName(box.route.city),
				name: box.name,
				color: box.route.color,
				count: box.route.count,
				unique: box.route.unique,
				needsCenter: box.route.needsCenter,
				reveals: box.reveals,
				...(source.spectator
					? { state: 'idle' as const, reason: null }
					: !source.canAct
						? { state: 'blocked' as const, reason: 'Not your turn' }
						: box.actions.length
							? { state: 'ready' as const, reason: null }
							: { state: 'blocked' as const, reason: box.reason }),
			})),
		),
	);

	// How each pawn made its most recent move, which picks its vehicle and the way it goes. Worked out apart from the
	// pawns, since it reads the whole log and a pawn lights up far more often than it moves.
	const sameMoves = reconciler<Partial<Record<SeatId, ReturnType<typeof travelOf>>>>();
	const lastMoves = $derived.by(() => {
		const moves: Partial<Record<SeatId, ReturnType<typeof travelOf>>> = {};
		const log = game?.log ?? [];
		const seats = new Set(game?.seats ?? []);
		for (let index = log.length - 1; index >= 0 && seats.size > 0; index--) {
			const entry = log[index]!;
			if (entry.t !== 'move' || !seats.delete(entry.seat)) continue;
			moves[entry.seat] = travelOf(entry, campaign.edges);
		}
		return sameMoves(moves);
	});

	const samePawns = reconciler<BoardView['pawns']>();
	const pawns = $derived(
		samePawns(
			(game?.seats ?? []).map((seat, index) => ({
				id: seat,
				city: game!.players[seat]!.location,
				color: SEAT_COLORS[index]!,
				name: seatName(source.world, seat),
				active: game!.active === seat && source.playing,
				lit: source.litPawn(seat),
				pickable: source.pickablePawn(seat),
				carried: game!.players[seat]!.supplies,
				...(lastMoves[seat] ?? { travel: 'land' as const, course: null }),
			})),
		),
	);

	const sameCursors = reconciler<BoardView['cursors']>();
	const cursors = $derived(
		sameCursors(
			Object.entries(source.session.cursors).map(([id, point]) => ({
				id,
				name: nameOf(id),
				color: colorOf(id),
				...point,
			})),
		),
	);

	const sameDrawings = reconciler<NonNullable<BoardView['drawings']>>();
	const drawings = $derived(
		sameDrawings(
			Object.entries(source.session.drawings)
				.filter(([, strokes]) => strokes.length > 0)
				.map(([id, strokes]) => ({ id, color: colorOf(id), strokes })),
		),
	);

	const pings = $derived(
		source.session.pings.map(ping => ({
			id: ping.id,
			x: ping.x,
			z: ping.z,
			color: colorOf(ping.player),
			name: source.solo ? null : nameOf(ping.player),
			createdAt: ping.createdAt,
			duration: ping.duration,
		})),
	);

	const stockpile = $derived(game ? game.stockpile - source.lag.stockpile : null);

	return {
		get cities() {
			return cities;
		},
		get edges() {
			return campaign.edges;
		},
		get ghostEdges() {
			return source.ghostEdges;
		},
		get recon() {
			return recon;
		},
		get pawns() {
			return pawns;
		},
		get stockpile() {
			return stockpile;
		},
		get cursors() {
			return cursors;
		},
		get drawings() {
			return drawings;
		},
		get pings() {
			return pings;
		},
		get fx() {
			return source.fx;
		},
		get skull() {
			return source.skull;
		},
		get marks() {
			return source.marks;
		},
	};
}
