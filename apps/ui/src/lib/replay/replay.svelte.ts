import { framesOf, pack, parseRecord } from '@repo/game';
import type { Command, GameRecord, PublicState, RecordNote, World } from '@repo/game';

export type { GameNotes, IndexGame, ReplayIndex } from '@repo/game';
import {
	ACTION_NAMES,
	actionDetail,
	actionTarget,
	cardName,
	cityName,
	decideLabel,
	logLine,
	MONTHS,
	playGroup,
	purchaseLabel,
	seatName,
} from '#lib/hud/labels.svelte.ts';
import type { SessionView } from '#lib/session/session.svelte.ts';

/** Stands where a live session would, so the real game screen can show any moment of a recording. */
export class ReplaySession implements SessionView {
	state = $state.raw<PublicState | null>(null);
	readonly status = 'connected' as const;
	readonly peers = [];
	readonly cursors = {};
	readonly notice = null;
	readonly mode = 'join' as const;

	send() {}
	pointer() {}
	importSave() {}
	newCampaign() {}
	exportRecord() {
		return null;
	}
	exportSave() {
		return JSON.stringify(this.state ? { v: 1, phase: this.state.phase, world: this.state.world } : null);
	}
}

export const gameTitle = (game: { month: number; attempt: 1 | 2 }) =>
	`${MONTHS[game.month] ?? `Month ${game.month}`}${game.attempt === 2 ? ', second attempt' : ''}`;

const event = (id: string) => [...pack.events, ...pack.companions].find(entry => entry.id === id)?.name ?? id;

/** Who did it and what they did, read against the state the command was sent in. */
export function commandLabel(world: World, command: Command | null): { who: string | null; text: string } {
	if (!command) return { who: null, text: 'A change the recorder did not see the cause of' };
	switch (command.type) {
		case 'CREATE_CHARACTER':
			return {
				who: null,
				text: `New character: ${command.name}, ${pack.jobs.find(job => job.id === command.job)?.name ?? command.job}`,
			};
		case 'SET_RATIONING':
			return { who: null, text: `Rationing set to ${command.value}` };
		case 'RENAME_HAVEN':
			return { who: null, text: `Haven named ${command.name}` };
		case 'BEGIN_CAMPAIGN':
			return { who: null, text: 'The campaign begins' };
		case 'START_GAME':
			return { who: null, text: 'The game is set up' };
		case 'ACK_BRIEFING':
			return { who: null, text: 'Legacy briefing read' };
		case 'PLACE_SUPPLY':
			return {
				who: null,
				text: `${command.count} cube${Math.abs(command.count) === 1 ? '' : 's'} on ${cityName(command.city)}`,
			};
		case 'AUTO_SUPPLY':
			return { who: null, text: 'The remaining cubes are spread over the grid' };
		case 'CONFIRM_SUPPLY':
			return { who: null, text: 'Supplies placed. Opening infection' };
		case 'PICK_EVENTS':
			return {
				who: null,
				text: `Events picked: ${command.cards.map(card => cardName(world, card)).join(', ') || 'none'}`,
			};
		case 'CONFIRM_EVENTS':
			return { who: null, text: 'Hands dealt. First turn' };
		case 'ACTION': {
			const action = command.action;
			const target = actionTarget(world, action);
			const detail = actionDetail(world, action);
			return {
				who: seatName(world, command.seat),
				text: [ACTION_NAMES[action.a], target ? `to ${cityName(target)}` : '', detail ? `(${detail})` : '']
					.filter(Boolean)
					.join(' '),
			};
		}
		case 'END_ACTIONS':
			return { who: seatName(world, command.seat), text: 'Ends the action step' };
		case 'DRAW':
			return { who: world.game ? seatName(world, world.game.active) : null, text: 'Draws a Player card' };
		case 'INFECT':
			return { who: world.game ? seatName(world, world.game.active) : null, text: 'Flips an Infection card' };
		case 'PLAY': {
			const detail = playGroup(world, command.play);
			return {
				who: seatName(world, command.seat),
				text: `Plays ${event(command.play.e)}${detail ? ` (${detail})` : ''}`,
			};
		}
		case 'DECIDE': {
			const decide = command.decide;
			const who = 'seat' in decide && decide.seat ? seatName(world, decide.seat) : null;
			return { who, text: decide.d === 'skip' ? 'Passes on the choice' : decideLabel(world, decide) };
		}
		case 'LOCKDOWN':
			return { who: null, text: `Lockdown destroys ${cardName(world, command.card)}` };
		case 'WAIVE_OBJECTIVE':
			return {
				who: null,
				text: `Objective given up: ${pack.objectives.find(objective => objective.id === command.objective)?.name}`,
			};
		case 'UNDO':
			return { who: world.game ? seatName(world, world.game.active) : null, text: 'Takes back the last action' };
		case 'CONTINUE':
			return { who: null, text: 'Game end: population and production' };
		case 'PURCHASE': {
			const purchase = command.purchase;
			const what =
				purchase.t === 'ability'
					? pack.abilities.find(ability => ability.id === purchase.ability)!.name
					: purchase.t === 'cityImprovement'
						? pack.cityImprovements.find(item => item.id === purchase.improvement)!.name
						: purchase.t === 'infectionImprovement'
							? pack.infectionImprovements.find(item => item.id === purchase.improvement)!.name
							: purchase.t === 'population'
								? '+1 population'
								: purchase.t === 'restore'
									? 'Restore'
									: `Permanent ${purchase.structure}`;
			return { who: null, text: `Buys ${what}: ${purchaseLabel(world, purchase)}` };
		}
		case 'FINISH_UPKEEP':
			return { who: null, text: 'The game is closed' };
	}
}

export type TimelineStep = {
	/** The frame this step produces: frame 0 is the start. */
	frame: number;
	at: number;
	by: string | null;
	who: string | null;
	text: string;
	turn: number;
	/** What the game logged because of this step. */
	results: { tone: string; text: string }[];
	/** What was said or noted since the step before, which is the thinking behind this one. */
	notes: RecordNote[];
};

export type Loaded = { record: GameRecord; frames: PublicState[]; timeline: TimelineStep[]; trailing: RecordNote[] };

/** Plays the whole recording once and lays it out as a timeline with each note under the step it led to. */
export function load(raw: unknown): Loaded {
	const record = parseRecord(typeof raw === 'string' ? JSON.parse(raw) : raw);
	const frames = framesOf(record);
	const notes = record.notes.toSorted((a, b) => a.at - b.at);
	let next = 0;
	const timeline = record.steps.map((step, index) => {
		const before = frames[index]!;
		const after = frames[index + 1]!;
		const label = commandLabel(before.world, step.command);
		const seen = before.world.game && after.world.game?.log.length ? (before.world.game.log.at(-1)?.seq ?? -1) : -1;
		const results = (after.world.game?.log ?? [])
			// The step's own label already says where a pawn went.
			.filter(entry => entry.seq > seen && entry.t !== 'move')
			.flatMap(entry => {
				const line = logLine(after.world, entry);
				return line ? [line] : [];
			});
		const mine: RecordNote[] = [];
		while (next < notes.length && notes[next]!.at <= step.at) mine.push(notes[next++]!);
		return {
			frame: index + 1,
			at: step.at,
			by: step.by,
			...label,
			turn: after.world.game?.turn ?? 0,
			results,
			notes: mine,
		};
	});
	return { record, frames, timeline, trailing: notes.slice(next) };
}
