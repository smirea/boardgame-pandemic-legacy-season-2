import { framesOf, pack, parseRecord } from '@repo/game';
import type {
	BriefingSource,
	CityId,
	Command,
	GameRecord,
	PlayerId,
	PublicState,
	RecordNote,
	SeatId,
	World,
} from '@repo/game';
import type { BoardMarks, MarkTone } from '#lib/board/types.ts';
import { beatOf } from './beats.ts';
import type { Beat, Mark, Moment } from './beats.ts';
import { plain } from '#lib/hud/rich.ts';

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
	SEAT_COLORS,
	seatName,
} from '#lib/hud/labels.svelte.ts';
import type { SessionView } from '#lib/session/session.svelte.ts';

/** Stands where a live session would, so the real game screen can show any moment of a recording. */
export class ReplaySession implements SessionView {
	state = $state.raw<PublicState | null>(null);
	readonly status = 'connected' as const;
	readonly peers = [];
	readonly cursors = {};
	readonly drawings = {};
	readonly pings = [];
	readonly notice = null;
	readonly mode = 'join' as const;
	readonly player = '' as PlayerId;

	send() {}
	rename() {}
	pointer() {}
	stroke() {}
	redraw() {}
	clearDrawings() {}
	ping() {}
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
		case 'SEAT': {
			const seat = command.seat.replace('seat-', 'Seat ');
			if (command.choice === null) return { who: null, text: `${seat} emptied` };
			const name = command.choice === 'worker' ? 'a haven worker' : world.campaign.characters[command.choice]?.name;
			return { who: null, text: `${seat}: ${name ?? 'a character'}` };
		}
		case 'START_GAME':
			return { who: null, text: 'The game is set up' };
		case 'JOIN':
			return { who: null, text: `${command.name} sits at the table` };
		case 'ADD_SEAT':
			return { who: null, text: 'Another seat is played from the same screen' };
		case 'TAKE_SEAT':
			return { who: null, text: `${command.name} takes ${seatName(world, command.seat)}'s seat` };
		case 'LEAVE':
			return { who: null, text: 'A player gets up from the table' };
		case 'CLAIM':
			return {
				who: null,
				text: command.character
					? `${world.campaign.characters[command.character]?.name ?? 'A character'} is taken for the next game`
					: 'A player lets their character go',
			};
		case 'READY':
			return {
				who: null,
				text:
					command.start === null
						? 'A player is no longer ready'
						: `A player is ready for ${command.start === 'prologue' ? 'the prologue' : 'the month'}`,
			};
		case 'ACK_BRIEFING':
			return { who: null, text: 'Legacy briefing read' };
		case 'BRIEFING_STEP':
			return { who: null, text: 'Drew or flipped a Legacy card' };
		case 'BRIEFING_READY':
			return { who: null, text: command.ready ? 'Ready to put Legacy cards away' : 'No longer ready' };
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
			const detail = plain(actionDetail(world, action));
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
			// Before the first turn the cards that open a game are flipped by the table, not by a player.
			return { who: world.game?.turn ? seatName(world, world.game.active) : null, text: 'Flips an Infection card' };
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
	notes: SaidNote[];
	beat: Beat;
};

/** A note placed on the frame it was said at: the one just before the step it led to. */
export type SaidNote = RecordNote & { frame: number; key: number };

/** Someone at the table: the player, the character they played this game, and the colour of its pawn. */
export type CastMember = { name: string; seat: SeatId | null; color: string };

export type PanelTab = 'timeline' | 'notes' | 'games';

export type Marker = { frame: number; kind: Moment | 'turn'; label: string };

export type Loaded = {
	record: GameRecord;
	frames: PublicState[];
	timeline: TimelineStep[];
	trailing: SaidNote[];
	notes: SaidNote[];
	cast: CastMember[];
	markers: Marker[];
};

const NEUTRAL = '#8a9aa8';
const DANGER = '#cf5b3e';
const HOLLOW = '#a68bc0';

/**
 * Who played which seat. A step names the player who sent it and its command names the seat, so the
 * recording says it; a run's list of games fills in anyone who never acted, in seat order. A seat nobody
 * claimed, as in a game played on one screen, goes by its character's name.
 */
function castOf(record: GameRecord, frames: PublicState[], timeline: TimelineStep[], seated: string[]): CastMember[] {
	const dealt = frames.find(frame => frame.world.game)?.world;
	const seats = dealt?.game?.seats ?? [];
	const votes = new Map<string, Map<SeatId, number>>();
	for (const step of record.steps) {
		const command = step.command;
		if (!step.by || !command || !('seat' in command) || typeof command.seat !== 'string') continue;
		const tally = votes.get(step.by) ?? new Map<SeatId, number>();
		tally.set(command.seat, (tally.get(command.seat) ?? 0) + 1);
		votes.set(step.by, tally);
	}
	const seatOf = new Map<string, SeatId>();
	for (const [name, tally] of votes) seatOf.set(name, [...tally].toSorted((a, b) => b[1] - a[1])[0]![0]);
	for (const [index, name] of seated.entries()) if (!seatOf.has(name) && seats[index]) seatOf.set(name, seats[index]);
	const names = [...seated];
	for (const entry of [...timeline, ...record.notes]) if (entry.by && !names.includes(entry.by)) names.push(entry.by);
	const claimed = new Set(seatOf.values());
	for (const seat of seats)
		if (!claimed.has(seat)) {
			const name = seatName(dealt!, seat);
			seatOf.set(name, seat);
			if (!names.includes(name)) names.push(name);
		}
	return names
		.map(name => {
			const seat = seatOf.get(name) ?? null;
			const at = seat ? seats.indexOf(seat) : -1;
			return {
				name,
				seat,
				color: at >= 0 ? SEAT_COLORS[at]! : NEUTRAL,
				order: at >= 0 ? at : 10 + names.indexOf(name),
			};
		})
		.toSorted((a, b) => a.order - b.order)
		.map(({ name, seat, color }) => ({ name, seat, color }));
}

const MOMENT_LABEL: Record<Moment, string> = {
	epidemic: 'Epidemic',
	incident: 'Incident',
	objective: 'Objective complete',
	reveal: 'Region revealed',
	death: 'A character dies',
	end: 'Game over',
};

function markersOf(timeline: TimelineStep[]): Marker[] {
	const markers: Marker[] = [];
	let turn = 0;
	for (const step of timeline) {
		if (step.turn !== turn && step.turn > 0)
			markers.push({ frame: step.frame, kind: 'turn', label: `Turn ${step.turn}` });
		turn = step.turn;
		for (const moment of step.beat.moments) {
			const hit = step.beat.marks.find(mark => mark.k === 'hit' && mark.hit === moment);
			const where = hit && hit.k === 'hit' ? ` in ${cityName(hit.city)}` : '';
			markers.push({ frame: step.frame, kind: moment, label: `${MOMENT_LABEL[moment]}${where}, turn ${step.turn}` });
		}
	}
	return markers;
}

/** Plays the whole recording once and lays it out as a timeline with each note under the step it led to. */
export function load(raw: unknown, seated: string[] = []): Loaded {
	const record = parseRecord(typeof raw === 'string' ? JSON.parse(raw) : raw);
	const frames = framesOf(record);
	// Recordings play back as written. Older ones hold the briefing as plain lines, or cards without their source.
	const legacy: BriefingSource = { t: 'legacy', card: '' };
	for (const frame of frames) {
		const campaign = frame.world.campaign;
		campaign.briefing = campaign.briefing.map(entry =>
			typeof entry === 'string'
				? { t: 'card', title: entry, text: null, from: legacy }
				: entry.t === 'card' && !entry.from
					? { ...entry, from: legacy }
					: entry,
		);
	}
	const notes = record.notes.toSorted((a, b) => a.at - b.at).map((note, key) => ({ ...note, frame: 0, key }));
	let next = 0;
	const timeline = record.steps.map((step, index): TimelineStep => {
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
		const mine: SaidNote[] = [];
		while (next < notes.length && notes[next]!.at <= step.at) {
			notes[next]!.frame = index;
			mine.push(notes[next++]!);
		}
		return {
			frame: index + 1,
			at: step.at,
			by: step.by,
			...label,
			turn: after.world.game?.turn ?? 0,
			results,
			notes: mine,
			beat: beatOf(before, after, step.command),
		};
	});
	const trailing = notes.slice(next);
	for (const note of trailing) note.frame = record.steps.length;
	return {
		record,
		frames,
		timeline,
		trailing,
		notes,
		cast: castOf(record, frames, timeline, seated),
		markers: markersOf(timeline),
	};
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const STRUCTURE_NAMES = { center: 'Supply center', tower: 'Tower', shelter: 'Shelter' } as const;
const HIT_NAMES = {
	infect: 'Infected',
	plague: 'Plague cube',
	outbreak: 'Outbreak',
	epidemic: 'Epidemic',
	incident: 'Incident',
	hollow: 'Hollow Men',
	blocked: 'Infection held off',
} as const;

/** What a step's flag says at one city. Cubes an infection took are said by the infection's own flag. */
function flagsOf(step: TimelineStep): BoardMarks['flags'] {
	const flags: BoardMarks['flags'] = [];
	const marks = step.beat.marks;
	const hitAt = (city: CityId) => marks.some(mark => mark.k === 'hit' && mark.city === city);
	const lost = (city: CityId) =>
		marks.find(mark => mark.k === 'cubes' && mark.city === city && mark.kind === 'supply' && mark.delta < 0);
	const add = (city: CityId, text: string, tone: MarkTone) =>
		flags.push({ id: `${step.frame}:${flags.length}`, city, text, tone });
	for (const mark of marks) {
		if (mark.k === 'cubes') {
			// The infection's own flag already says what it did to the city.
			if (mark.delta < 0 && mark.kind === 'supply' && hitAt(mark.city)) continue;
			if (mark.delta > 0 && mark.kind !== 'supply' && hitAt(mark.city)) continue;
			const size = Math.abs(mark.delta);
			if (mark.kind === 'supply')
				add(mark.city, `${mark.delta > 0 ? '+' : '−'}${plural(size, 'supply cube')}`, mark.delta > 0 ? 'good' : 'ink');
			else if (mark.kind === 'plague')
				add(mark.city, `${mark.delta > 0 ? '+' : '−'}${plural(size, 'plague cube')}`, mark.delta > 0 ? 'bad' : 'good');
			else
				add(
					mark.city,
					mark.delta > 0 ? `+${plural(size, 'Hollow Man')}` : `−${plural(size, 'Hollow Man')}`,
					mark.delta > 0 ? 'hollow' : 'good',
				);
		} else if (mark.k === 'build') add(mark.city, `${STRUCTURE_NAMES[mark.structure]} built`, 'good');
		else if (mark.k === 'route') add(mark.b, mark.kind === 'sea' ? 'Sea lane charted' : 'Supply line built', 'good');
		else if (mark.k === 'hit') {
			const taken = lost(mark.city);
			const tone = mark.hit === 'blocked' ? 'ink' : mark.hit === 'hollow' ? 'hollow' : 'bad';
			add(
				mark.city,
				`${HIT_NAMES[mark.hit]}${taken && taken.k === 'cubes' ? `, −${plural(-taken.delta, 'cube')}` : ''}`,
				tone,
			);
		} else if (mark.k === 'spot') {
			if (mark.spot === 'connected') add(mark.city, 'Joins the grid', 'good');
			else if (mark.spot === 'search') add(mark.city, 'Searched', 'warn');
			else if (mark.spot === 'death') add(mark.city, 'A character dies here', 'bad');
			else if (mark.spot === 'target') add(mark.city, targetText(step), 'ink');
		}
	}
	const seen = new Set<string>();
	return flags.filter(flag => !seen.has(`${flag.city}:${flag.text}`) && seen.add(`${flag.city}:${flag.text}`));
}

/** The step's own label names the action. The flag keeps it short and drops the detail in brackets. */
function targetText(step: TimelineStep): string {
	const text = step.text.replace(/\s*\(.*\)$/, '');
	return text.length > 28 ? `${text.slice(0, 27)}…` : text;
}

function ringColor(mark: Mark, actor: string | null): string | null {
	if (mark.k === 'hit') return mark.hit === 'hollow' ? HOLLOW : mark.hit === 'blocked' ? (actor ?? NEUTRAL) : DANGER;
	if (mark.k === 'spot' && mark.spot === 'revealed') return null;
	if (mark.k === 'spot' && mark.spot === 'death') return DANGER;
	return actor ?? NEUTRAL;
}

/** Everything drawn over the board at one frame: this step's marks, and the path its character took earlier this turn. */
export function marksAt(loaded: Loaded, frame: number): BoardMarks {
	const step = loaded.timeline[frame - 1];
	if (!step) return { trails: [], rings: [], flags: [] };
	const world = loaded.frames[frame]!.world;
	const colorOf = (seat: SeatId | null) => {
		const at = seat ? (world.game?.seats.indexOf(seat) ?? -1) : -1;
		return at >= 0 ? SEAT_COLORS[at]! : null;
	};
	const actor = colorOf(step.beat.seat);
	const trails: BoardMarks['trails'] = [];
	for (let back = frame - 1; back >= 0; back--) {
		const earlier = loaded.timeline[back]!;
		if (earlier.turn !== step.turn) break;
		for (const [index, mark] of earlier.beat.marks.entries())
			if (mark.k === 'trail')
				trails.push({
					id: `${earlier.frame}:${index}`,
					from: mark.from,
					to: mark.to,
					color: colorOf(mark.seat) ?? NEUTRAL,
					travel: mark.travel,
					course: mark.course,
					fresh: earlier === step,
				});
	}
	const rings = new Map<CityId, string>();
	for (const mark of step.beat.marks) {
		const color = ringColor(mark, actor);
		const city = mark.k === 'trail' ? mark.to : mark.k === 'route' ? mark.b : mark.city;
		if (color && !rings.has(city)) rings.set(city, color);
		if (mark.k === 'route' && color && !rings.has(mark.a)) rings.set(mark.a, color);
	}
	return {
		trails: trails.toReversed(),
		rings: [...rings].map(([city, color]) => ({ city, color })),
		flags: flagsOf(step),
	};
}
