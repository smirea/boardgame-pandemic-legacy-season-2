import { botCommand, campaignAt, createGameActor, phaseOf, publicState } from '@repo/game';
import { expect, test } from 'bun:test';
import { StateFeed, StateMirror } from './sync';
import type { StateMsg } from './sync';

const overTheWire = (msg: StateMsg) => JSON.parse(JSON.stringify(msg)) as StateMsg;

function play(onState: (state: ReturnType<typeof publicState>) => void, steps: number) {
	const rng = { seed: 3 };
	const actor = createGameActor({ seed: 5, save: campaignAt(7) });
	actor.subscribe(snapshot => onState(publicState(snapshot)));
	actor.start();
	for (let step = 0; step < steps; step++) {
		const snapshot = actor.getSnapshot();
		const phase = phaseOf(snapshot);
		if (!phase.startsWith('playing') && !phase.startsWith('setup') && phase !== 'lobby') break;
		const world = snapshot.context.world;
		actor.send(world.campaign.briefing.length ? { type: 'ACK_BRIEFING' } : botCommand(world, phase, rng, 4));
	}
}

test('a peer that applies every message the host sends holds the host state after each one', () => {
	const feed = new StateFeed();
	const mirror = new StateMirror();
	let changes = 0;
	play(state => {
		const msg = feed.next(state);
		if (!msg) return;
		changes++;
		expect(mirror.apply(overTheWire(msg))).toEqual(JSON.parse(JSON.stringify(state)));
	}, 120);
	expect(changes).toBeGreaterThan(60);
});

test('a peer that connects mid-game is sent the whole state and follows from there', () => {
	const feed = new StateFeed();
	let late: StateMirror | null = null;
	let seen = 0;
	play(state => {
		const msg = feed.next(state);
		if (++seen === 30) {
			late = new StateMirror();
			expect(late.apply(overTheWire(feed.whole()!))).toEqual(JSON.parse(JSON.stringify(state)));
		} else if (late && msg) expect(late.apply(overTheWire(msg))).toEqual(JSON.parse(JSON.stringify(state)));
	}, 80);
	expect(late).not.toBeNull();
});

test('a peer that missed a change asks for the whole state instead of applying a later one', () => {
	const feed = new StateFeed();
	const mirror = new StateMirror();
	const sent: StateMsg[] = [];
	play(state => {
		const msg = feed.next(state);
		if (msg) sent.push(overTheWire(msg));
	}, 20);
	expect(mirror.apply(sent[0]!)).not.toBe('lost');
	expect(mirror.apply(sent[2]!)).toBe('lost');
	expect(mirror.apply(sent[1]!)).not.toBe('lost');
});
