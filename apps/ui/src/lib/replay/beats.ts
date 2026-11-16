import { edgeKey, pack } from '@repo/game';
import type { CardId, CityId, Command, LogEntry, PublicState, SeatId, StructureKind } from '@repo/game';
import type { BoardPoint } from '#lib/board/projection.ts';
import { travelOf } from '#lib/board/travel.ts';
import type { Travel } from '#lib/board/types.ts';

export type Mark =
	| { k: 'trail'; seat: SeatId; from: CityId; to: CityId; travel: Travel; course: BoardPoint[] | null }
	| { k: 'cubes'; city: CityId; kind: 'supply' | 'plague' | 'hollow'; delta: number }
	| { k: 'build'; city: CityId; structure: StructureKind }
	| { k: 'route'; a: CityId; b: CityId; kind: 'land' | 'sea' }
	| { k: 'hit'; city: CityId; hit: 'infect' | 'plague' | 'outbreak' | 'epidemic' | 'incident' | 'hollow' | 'blocked' }
	| { k: 'spot'; city: CityId; spot: 'search' | 'target' | 'revealed' | 'connected' | 'death' };

export type Moment = 'epidemic' | 'incident' | 'objective' | 'reveal' | 'death' | 'end';

export type Beat = {
	seat: SeatId | null;
	marks: Mark[];
	/** Every city the marks touch, in the order they happened. */
	cities: CityId[];
	moments: Moment[];
};

const STRUCTURES: StructureKind[] = ['center', 'tower', 'shelter'];

function seatOf(state: PublicState, command: Command | null): SeatId | null {
	if (!command) return null;
	if ('seat' in command && typeof command.seat === 'string') return command.seat;
	if (command.type === 'DECIDE' && 'seat' in command.decide && command.decide.seat) return command.decide.seat;
	if (command.type === 'DRAW' || command.type === 'INFECT' || command.type === 'UNDO')
		return state.world.game?.active ?? null;
	return null;
}

/** Cities the command names that the state change alone does not show, such as an event card's target. */
function aimedAt(state: PublicState, command: Command | null): CityId[] {
	if (command?.type === 'PLAY') {
		const play = command.play;
		if ('city' in play) return [play.city];
		if (play.e === 'airlift') return [play.to];
		if (play.e === 'openWaters') return [play.a, play.b];
		if (play.e === 'safeHouses') return play.cities;
		return [];
	}
	if (command?.type !== 'ACTION') return [];
	const action = command.action;
	const { playerCards, infectionCards } = state.world.campaign;
	const cardCity = (id: CardId) => {
		const card = playerCards[id] ?? infectionCards[id];
		return card?.kind === 'city' ? [card.city] : [];
	};
	switch (action.a) {
		case 'deliver':
			return action.to ? [action.to] : [];
		case 'supply':
		case 'transmit':
		case 'inoculate':
			return cardCity(action.card);
		case 'sabotage':
			return [action.city];
		case 'broadcast':
			return [action.from, action.to];
		case 'recon': {
			const route = pack.reconRoutes.find(candidate => candidate.id === action.route);
			return route ? [route.city] : [];
		}
		default:
			return [];
	}
}

function freshLog(before: PublicState, after: PublicState): LogEntry[] {
	const log = after.world.game?.log ?? [];
	if (!before.world.game) return log;
	const seen = before.world.game.log.at(-1)?.seq ?? -1;
	return log.filter(entry => entry.seq > seen);
}

/** What one step did on the map, read from the states on either side of it and the command that caused it. */
export function beatOf(before: PublicState, after: PublicState, command: Command | null): Beat {
	const marks: Mark[] = [];
	const moments = new Set<Moment>();
	const was = before.world.game;
	const now = after.world.game;
	const log = freshLog(before, after);

	// A game being dealt or closed changes every city at once, which is not anything a viewer follows.
	if (was && now) {
		for (const seat of now.seats) {
			const from = was.players[seat]?.location;
			const to = now.players[seat]!.location;
			if (!from || from === to) continue;
			const move = log.findLast(entry => entry.t === 'move' && entry.seat === seat);
			const way =
				move?.t === 'move' ? travelOf(move, after.world.campaign.edges) : { travel: 'air' as const, course: null };
			// A step that moved the pawn more than once draws one trail from where it began, so no one course fits.
			const course = move?.t === 'move' && move.from === from && move.to === to ? way.course : null;
			marks.push({ k: 'trail', seat, from, to, travel: way.travel, course });
		}
		for (const [id, place] of Object.entries(now.locations)) {
			const city = id as CityId;
			const old = was.locations[city];
			if (!old) continue;
			for (const kind of ['supply', 'plague', 'hollow'] as const) {
				const key = kind === 'supply' ? 'supplies' : kind;
				const delta = place[key] - old[key];
				if (delta) marks.push({ k: 'cubes', city, kind, delta });
			}
			for (const structure of STRUCTURES)
				if (place[structure] && !old[structure]) marks.push({ k: 'build', city, structure });
		}
	}

	const known = new Set(before.world.campaign.edges.map(edge => `${edge.kind}:${edgeKey(edge.a, edge.b)}`));
	for (const edge of after.world.campaign.edges)
		if (!known.has(`${edge.kind}:${edgeKey(edge.a, edge.b)}`))
			marks.push({ k: 'route', a: edge.a, b: edge.b, kind: edge.kind });

	if (was && now)
		for (const [id, place] of Object.entries(after.world.campaign.locations))
			if (place.revealed && !before.world.campaign.locations[id as CityId]?.revealed)
				marks.push({ k: 'spot', city: id as CityId, spot: 'revealed' });

	for (const entry of log) {
		if (entry.t === 'infect' && entry.effect !== 'skipped')
			marks.push({ k: 'hit', city: entry.city, hit: entry.effect === 'supply' ? 'infect' : entry.effect });
		else if (entry.t === 'outbreak') marks.push({ k: 'hit', city: entry.city, hit: 'outbreak' });
		else if (entry.t === 'incident') {
			marks.push({ k: 'hit', city: entry.city, hit: 'incident' });
			moments.add('incident');
		} else if (entry.t === 'epidemic') {
			if (entry.city) marks.push({ k: 'hit', city: entry.city, hit: 'epidemic' });
			moments.add('epidemic');
		} else if (entry.t === 'connected') marks.push({ k: 'spot', city: entry.city, spot: 'connected' });
		else if (entry.t === 'search') marks.push({ k: 'spot', city: entry.city, spot: 'search' });
		else if (entry.t === 'death') {
			marks.push({ k: 'spot', city: entry.at, spot: 'death' });
			moments.add('death');
		} else if (entry.t === 'reveal') moments.add('reveal');
		else if (entry.t === 'objective') moments.add('objective');
		else if (entry.t === 'end') moments.add('end');
	}

	const marked = new Set(marks.map(mark => (mark.k === 'route' ? mark.b : mark.k === 'trail' ? mark.to : mark.city)));
	const aimed = aimedAt(before, command);
	// An action with nothing else to show, such as making supplies, still happens somewhere: where its character stands.
	const here = command?.type === 'ACTION' ? was?.players[command.seat]?.location : undefined;
	if (!aimed.length && !marks.length && here) aimed.push(here);
	for (const city of aimed) if (!marked.has(city)) marks.push({ k: 'spot', city, spot: 'target' });

	const cities: CityId[] = [];
	const touch = (city: CityId) => cities.includes(city) || cities.push(city);
	for (const mark of marks) {
		if (mark.k === 'trail') {
			touch(mark.from);
			touch(mark.to);
		} else if (mark.k === 'route') {
			touch(mark.a);
			touch(mark.b);
		} else touch(mark.city);
	}
	return { seat: seatOf(before, command), marks, cities, moments: [...moments] };
}
