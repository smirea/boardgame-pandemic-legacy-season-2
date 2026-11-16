import { pack } from '@repo/game';
import type { Action, LogEntry, SeatId, World } from '@repo/game';
import { ACTION_NAMES, cityName } from './labels.svelte.ts';

/** One thing the active player did this turn, in the order they did it. */
export type TurnStep = { seq: number; name: string; detail: string; kind: 'action' | 'event' };

const STRUCTURE = { center: 'supply center', tower: 'tower', shelter: 'shelter' } as const;

/** What an action's effects say about it: the engine logs those effects just before the action itself. */
function describe(effects: LogEntry[]): string {
	for (const entry of effects) {
		if (entry.t === 'move') return `to ${cityName(entry.to)}`;
		if (entry.t === 'structure') return `${STRUCTURE[entry.structure]} in ${cityName(entry.city)}`;
		if (entry.t === 'edge') return `${cityName(entry.a)} to ${cityName(entry.b)}`;
		if (entry.t === 'search') return `in ${cityName(entry.city)}`;
	}
	return '';
}

/** The actions and events `seat` has taken since its turn began. */
export function turnSteps(world: World, seat: SeatId): TurnStep[] {
	const log = world.game?.log ?? [];
	const start = log.findLastIndex(entry => entry.t === 'turn');
	if (start < 0 || log[start]!.t !== 'turn' || log[start]!.seat !== seat) return [];
	const steps: TurnStep[] = [];
	let effects: LogEntry[] = [];
	for (const entry of log.slice(start + 1)) {
		if (entry.t === 'action' && entry.seat === seat) {
			steps.push({
				seq: entry.seq,
				name: ACTION_NAMES[entry.action as Action['a']] ?? entry.action,
				detail: describe(effects),
				kind: 'action',
			});
			effects = [];
		} else if (entry.t === 'event' && entry.seat === seat) {
			const event = pack.events.find(item => item.id === entry.event);
			steps.push({ seq: entry.seq, name: event?.name ?? entry.event, detail: entry.detail, kind: 'event' });
			effects = [];
		} else effects.push(entry);
	}
	return steps;
}
