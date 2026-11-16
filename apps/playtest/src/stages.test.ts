import { describe, expect, test } from 'bun:test';
import { cityDef, createGameActor, legalDecides, phaseOf, publicState, reject } from '@repo/game';
import type { Action, CardId, CityId, Command, Decide, GameActor, Play, Save, SeatId, World } from '@repo/game';
import { newAudit, observe } from './audit.ts';
import { stages, tourNovember, tourOctober, workerTrap } from './stages.ts';

const [A, B, C] = ['seat-1', 'seat-2', 'seat-3'] as SeatId[];
const city = (id: string) => id as CityId;

/** Drives a game the way the lab does: every command is checked with `reject`, and the audit watches every change. */
function table(save: Save) {
	let actor: GameActor = createGameActor({ seed: 3, save }).start();
	const audit = newAudit();
	const dealt = new Set<CardId>();
	const state = () => publicState(actor.getSnapshot());
	const world = () => actor.getSnapshot().context.world;
	const send = (command: Command) => {
		const before = state();
		const refused = reject(world(), phaseOf(actor.getSnapshot()), command);
		if (refused) throw new Error(`${JSON.stringify(command)} refused: ${refused}`);
		actor.send(command);
		observe(audit, before, state(), command);
	};
	const card = (id: string, of: SeatId) => {
		const found = world().game!.players[of]!.hand.find(held => {
			const def = world().campaign.playerCards[held]!;
			return (def.kind === 'city' && def.city === id) || (def.kind === 'companion' && def.companion === id);
		});
		if (!found) throw new Error(`${of} holds no ${id} card`);
		return found;
	};
	return {
		audit,
		world,
		send,
		card,
		act: (seat: SeatId, action: Action) => send({ type: 'ACTION', seat, action }),
		play: (seat: SeatId, held: CardId, play: Play) => send({ type: 'PLAY', seat, card: held, play }),
		decide: (decide: Decide) => send({ type: 'DECIDE', decide }),
		pending: () => world().game!.pending[0]?.t ?? null,
		/** Ends the turn, answering whatever comes up with the first legal answer that keeps the staged cards in hand. */
		endTurn(seat: SeatId, answers: Partial<Record<string, (options: Decide[]) => Decide>> = {}) {
			send({ type: 'END_ACTIONS', seat });
			for (let guard = 0; guard < 60 && !world().game!.outcome; guard++) {
				const waiting = world().game!.pending[0];
				const options = legalDecides(world());
				if (options.length) {
					const spared = options.find(option => option.d !== 'discard' || !option.cards.some(held => dealt.has(held)));
					send({ type: 'DECIDE', decide: answers[waiting?.t ?? 'discard']?.(options) ?? spared ?? options[0]! });
					continue;
				}
				const phase = phaseOf(actor.getSnapshot());
				if (phase === 'playing.draw') send({ type: 'DRAW' });
				else if (phase === 'playing.infect') send({ type: 'INFECT' });
				else break;
			}
		},
		stage(name: string) {
			const staged = JSON.parse(JSON.stringify(world())) as World;
			stages[name]!(staged).apply(staged);
			const before = state();
			actor = createGameActor({ seed: 3, save: { v: 1, phase: 'playing.actions', world: staged } }).start();
			observe(audit, before, state(), null);
			for (const player of Object.values(world().game!.players)) for (const held of player.hand) dealt.add(held);
		},
	};
}

function seated(save: Save, names: string[]) {
	const game = table(save);
	const characters = Object.values(game.world().campaign.characters);
	game.send({
		type: 'START_GAME',
		seating: names.map((name, index) => ({
			seat: [A, B, C][index]!,
			character: characters.find(character => character.name === name)!.id,
		})),
	});
	while (game.world().campaign.briefing.length) game.send({ type: 'ACK_BRIEFING' });
	for (const type of ['AUTO_SUPPLY', 'CONFIRM_SUPPLY', 'CONFIRM_EVENTS'] as const) game.send({ type });
	return game;
}

describe('tour stages', () => {
	test('October: every list in the brief can be played, and reaches the untaken branches', () => {
		const game = seated(tourOctober(7), ['Rook', 'Wren', 'Pike']);
		game.stage('tour-october');
		const { act, card, world } = game;

		game.send({ type: 'WAIVE_OBJECTIVE', objective: 'buildCenters' as never });
		act(A, { a: 'recon', route: 'coral-sea', cards: [card('bangkok', A), card('manila', A)] });
		act(A, { a: 'drive', to: city('haven-coral-sea') });
		act(A, { a: 'recon', route: 'new-zealand', cards: [card('seoul', A), card('tokyo', A)] });
		act(A, { a: 'sabotage', card: card('osaka', A), city: city('osaka') });
		game.endTurn(A);
		expect(game.audit.exercised['infect:outbreak']).toBe(1);

		act(B, { a: 'search', card: card('riyadh', B), box: 0 });
		expect(game.pending()).toBe('freeEdge');
		game.decide(legalDecides(world()).find(option => option.d === 'freeEdge')!);
		act(B, { a: 'drive', to: city('baghdad') });
		act(B, { a: 'search', card: card('baghdad', B), box: 0 });
		game.play(B, card('medic', B), { e: 'medic' });
		const istanbul = world().game!.playerDiscard.find(held => {
			const def = world().campaign.playerCards[held]!;
			return def.kind === 'city' && def.city === 'istanbul';
		})!;
		act(B, { a: 'broker', card: card('tehran', B), take: istanbul });
		game.endTurn(B);

		act(C, { a: 'search', card: card('delhi', C), box: 0 });
		game.play(C, card('marksman', C), { e: 'marksman', city: city('tokyo') });
		act(C, { a: 'drive', to: city('tehran') });
		act(C, { a: 'drive', to: city('kolkata') });
		act(C, { a: 'search', card: card('kolkata', C), box: 0 });
		game.play(C, card('purifier', C), { e: 'purifier', city: city('hong-kong') });
		game.endTurn(C);

		act(A, { a: 'drive', to: city('jakarta') });
		act(A, { a: 'drive', to: city('kolkata') });
		act(A, { a: 'drive', to: city('ho-chi-minh-city') });
		act(A, { a: 'search', card: card('ho-chi-minh-city', A), box: 0 });
		game.play(A, card('shelterWright', A), { e: 'shelterWright', city: city('ho-chi-minh-city') });
		game.endTurn(A);

		act(B, { a: 'drive', to: city('cairo') });
		act(B, { a: 'shuttle', to: city('johannesburg') });
		act(B, { a: 'search', card: card('johannesburg', B), box: 0 });
		game.endTurn(B);
		game.endTurn(C);

		act(A, { a: 'drive', to: city('osaka') });
		game.endTurn(A);
		game.endTurn(B);
		// Rook starts the next turn in infested Osaka and dies. A free character takes the seat.
		game.endTurn(C, { replace: options => options.find(option => option.d === 'replace' && option.character)! });
		const characters = world().campaign.characters;
		expect(Object.values(characters).find(character => character.name === 'Rook')!.dead).toBe(true);
		expect(characters[world().game!.players[A]!.character]!.dead).toBe(false);

		for (const key of [
			'command:WAIVE_OBJECTIVE',
			'bundle:coral-sea',
			'bundle:new-zealand',
			'bundle:jade',
			'action:sabotage',
			'action:broker',
			'play:medic',
			'play:marksman',
			'play:purifier',
			'play:shelterWright',
			'decide:freeEdge',
			'decide:replace',
			'exposure:skull',
			'log:death',
			'infect:outbreak',
		])
			expect(game.audit.exercised[key], key).toBeGreaterThan(0);
		expect(game.audit.problems).toEqual([]);
	});

	test('November: the Plan, both new jobs, the shield and a haven worker can all be played', () => {
		const game = seated(tourNovember(7), ['Scientist', 'Vector Control Expert', 'Pike']);
		game.stage('tour-november');
		const { act, world } = game;
		const colored = (seat: SeatId, color: string) =>
			world().game!.players[seat]!.hand.filter(held => {
				const def = world().campaign.playerCards[held]!;
				return def.kind === 'city' && cityDef(def.city).color === color;
			});
		const shanghai = world().game!.infectionDiscard.find(held => {
			const def = world().campaign.infectionCards[held]!;
			return def.kind === 'city' && def.city === 'shanghai';
		})!;
		const trap = workerTrap(world());

		act(A, { a: 'destroyInfection', card: shanghai });
		let shielded = false;
		const shieldOnce = (options: Decide[]) => {
			const answer = options.find(option => option.d === (shielded ? 'skip' : 'shield'))!;
			shielded = true;
			return answer;
		};
		game.endTurn(A, { shield: shieldOnce });
		expect(game.audit.exercised['decide:shield']).toBeGreaterThan(0);

		act(B, { a: 'buildShelter' });
		act(B, { a: 'recon', route: 'hidden:plan-yellow', cards: colored(B, 'yellow').slice(0, 3) });
		act(B, { a: 'recon', route: 'hidden:plan-blue', cards: colored(B, 'blue').slice(0, 3) });
		game.endTurn(B, { shield: shieldOnce });

		act(C, { a: 'facilitate', with: A, card: colored(A, 'black')[0]! });
		act(C, { a: 'recon', route: 'hidden:plan-black', cards: colored(C, 'black').slice(0, 4) });
		act(C, { a: 'drive', to: city('osaka') });
		game.endTurn(C);
		game.endTurn(A);
		// Pike starts the next turn in Osaka and dies. Nobody is free, so the seat falls to a haven worker.
		game.endTurn(B, { replace: () => ({ d: 'replace', character: null }) });
		expect(world().campaign.characters[world().game!.players[C]!.character]!.worker).toBe(true);
		game.endTurn(C);
		game.endTurn(A);
		game.endTurn(B);
		act(C, { a: 'drive', to: trap });
		game.endTurn(C);
		game.endTurn(A);
		game.endTurn(B);
		expect(game.audit.exercised['exposure:worker']).toBe(1);
		game.endTurn(C);

		act(A, { a: 'recon', route: 'hidden:plan-red', cards: colored(A, 'red').slice(0, 5) });
		expect(world().game!.outcome).toMatchObject({ won: true });

		for (const key of [
			'job:scientist',
			'job:vectorControl',
			'action:destroyInfection',
			'action:facilitate',
			'bundle:plan-red',
			'bundle:plan-blue',
			'objective:plan',
			'decide:shield',
			'decide:replace',
			'exposure:skull',
			'exposure:worker',
			'log:death',
		])
			expect(game.audit.exercised[key], key).toBeGreaterThan(0);
		expect(game.audit.problems).toEqual([]);
	});
});
