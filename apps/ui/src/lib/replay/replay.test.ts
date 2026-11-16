/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { botCommand, createGameActor, framesOf, publicState, recordStep, scenarios, startRecord } from '@repo/game';
import type { CityId, GameRecord, PublicState, RecordNote } from '@repo/game';
import { beatOf } from './beats.ts';
import type { Beat } from './beats.ts';
import { bubblesAt, dwellAt } from './pacing.ts';
import type { Paced } from './pacing.ts';
import type { SaidNote } from './replay.svelte.ts';

/** One bot-played October game through to its close, recorded the way the host records it. October has every mechanic open. */
function playedGame(seed: number): { record: GameRecord; frames: PublicState[] } {
	const actor = createGameActor({ seed, save: scenarios.october(seed) }).start();
	const rng = { seed: seed + 1 };
	let before = publicState(actor.getSnapshot());
	const record = startRecord(before, 0);
	for (let at = 1; at < 5000; at++) {
		const command = botCommand(before.world, before.phase, rng, 3);
		actor.send(command);
		const after = publicState(actor.getSnapshot());
		recordStep(record, before, after, { at, by: 'bot', command });
		if (after.world.campaign.results.length > before.world.campaign.results.length) break;
		before = after;
	}
	return { record, frames: framesOf(record) };
}

const { record, frames } = playedGame(8);
const beats = record.steps.map((step, index) => beatOf(frames[index]!, frames[index + 1]!, step.command));

describe('what a replay shows on the map', () => {
	test('every pawn that moved draws a trail from where it stood to where it ended', () => {
		let moves = 0;
		for (const [index, beat] of beats.entries()) {
			const was = frames[index]!.world.game;
			const now = frames[index + 1]!.world.game;
			if (!was || !now) continue;
			const moved = now.seats.filter(seat => was.players[seat]!.location !== now.players[seat]!.location);
			const trails = beat.marks.filter(mark => mark.k === 'trail');
			expect(trails.map(mark => [mark.seat, mark.from, mark.to])).toEqual(
				moved.map(seat => [seat, was.players[seat]!.location, now.players[seat]!.location]),
			);
			moves += moved.length;
		}
		expect(moves).toBeGreaterThan(5);
	});

	test('a new supply line or sea lane is drawn between its two cities, and both are highlighted', () => {
		const before = frames.find(frame => frame.world.game?.turn === 2)!;
		const after = structuredClone(before);
		const joined = new Set(before.world.campaign.edges.flatMap(edge => [edge.a, edge.b]));
		const [a, b] = (Object.keys(before.world.campaign.locations) as CityId[]).filter(city => !joined.has(city));
		after.world.campaign.edges.push({ a: a!, b: b!, kind: 'sea' });
		const beat = beatOf(before, after, null);
		expect(beat.marks).toContainEqual({ k: 'route', a, b, kind: 'sea' });
		expect(beat.cities).toEqual([a, b]);
	});

	test('cubes arriving or leaving a city show at that city with the right count', () => {
		for (const [index, beat] of beats.entries()) {
			const was = frames[index]!.world.game;
			const now = frames[index + 1]!.world.game;
			if (!was || !now) continue;
			for (const mark of beat.marks)
				if (mark.k === 'cubes' && mark.kind === 'supply')
					expect(now.locations[mark.city]!.supplies - was.locations[mark.city]!.supplies).toBe(mark.delta);
		}
		expect(beats.some(beat => beat.marks.some(mark => mark.k === 'cubes' && mark.delta > 0))).toBe(true);
	});

	test('every infection flipped hits its city, and epidemics and the game end are moments to jump to', () => {
		const infections = beats.flatMap(beat => beat.marks.filter(mark => mark.k === 'hit'));
		expect(infections.length).toBeGreaterThan(5);
		const moments = beats.flatMap(beat => beat.moments);
		expect(moments).toContain('epidemic');
		expect(moments.filter(moment => moment === 'end')).toHaveLength(1);
	});

	test('an action names whose it was, and always marks somewhere on the map', () => {
		for (const [index, step] of record.steps.entries()) {
			if (step.command?.type !== 'ACTION') continue;
			expect(beats[index]!.seat).toBe(step.command.seat);
			expect(beats[index]!.cities.length).toBeGreaterThan(0);
		}
	});
});

describe('bubbles and autoplay pacing', () => {
	const idle: Beat = { seat: null, marks: [], cities: [], moments: [] };
	const paced = (notes: Omit<SaidNote, 'key' | 'at'>[], steps = 20): Paced => ({
		notes: notes.map((note, key) => ({ ...note, at: key, key })),
		timeline: Array.from({ length: steps }, () => ({ by: 'Vex', turn: 1, beat: idle })),
	});
	const note = (by: string, frame: number, kind: RecordNote['kind'], text = 'I take the boat to Lagos.') => ({
		by,
		frame,
		kind,
		text,
	});

	test('each player shows their newest note, with what they said just before it folded above', () => {
		const loaded = paced([
			note('Vex', 2, 'chat', 'first'),
			note('Vex', 4, 'chat', 'second'),
			note('Vex', 4, 'why', 'third'),
			note('Sol', 4, 'chat', 'hello'),
		]);
		const up = bubblesAt(loaded, 5, null);
		expect(up.get('Vex')!.map(said => said.text)).toEqual(['second', 'third']);
		expect(up.get('Sol')!.map(said => said.text)).toEqual(['hello']);
	});

	test('a note shows from the frame it was said and clears a few steps later, wherever the viewer scrubs from', () => {
		const loaded = paced([note('Vex', 3, 'chat')]);
		expect(bubblesAt(loaded, 2, null).size).toBe(0);
		expect(bubblesAt(loaded, 3, null).size).toBe(1);
		expect(bubblesAt(loaded, 6, null).size).toBe(1);
		expect(bubblesAt(loaded, 12, null).size).toBe(0);
	});

	test('following a player shows only their bubbles', () => {
		const loaded = paced([note('Vex', 3, 'chat'), note('Sol', 3, 'why')]);
		expect([...bubblesAt(loaded, 3, 'Sol').keys()]).toEqual(['Sol']);
	});

	test('autoplay waits longer where there is more to read, and less when bubbles are hidden', () => {
		const long = 'word '.repeat(60);
		const loaded = paced([note('Vex', 4, 'why', long)]);
		const quiet = dwellAt(loaded, 3, { bubbles: true, follow: null });
		const reading = dwellAt(loaded, 4, { bubbles: true, follow: null });
		expect(reading).toBeGreaterThan(quiet + 5000);
		expect(dwellAt(loaded, 4, { bubbles: false, follow: null })).toBe(quiet);
	});

	test("following a player hurries through everyone else's steps", () => {
		const loaded = paced([]);
		expect(dwellAt(loaded, 3, { bubbles: true, follow: 'Sol' })).toBeLessThan(
			dwellAt(loaded, 3, { bubbles: true, follow: 'Vex' }),
		);
	});
});
