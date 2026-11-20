import type { Action } from './actions';
import type { CardId, CityId, SeatId } from './ids';
import type { Command, GameActor, Phase } from './machine';
import { paddedTrack } from './legacy';
import { createGameActor, phaseOf, reject } from './machine';
import { decemberSave } from './scenarios';
import type { Game, World } from './state';

export const A = 'seat-1' as SeatId;
export const B = 'seat-2' as SeatId;
export const C = 'seat-3' as SeatId;
export const city = (id: string) => id as CityId;

export const worldOf = (actor: GameActor) => actor.getSnapshot().context.world;
export const gameOf = (actor: GameActor) => worldOf(actor).game!;
export const phase = (actor: GameActor) => phaseOf(actor.getSnapshot());

export function send(actor: GameActor, command: Command) {
	const reason = reject(worldOf(actor), phase(actor), command);
	if (reason) throw new Error(`${command.type} rejected: ${reason}`);
	actor.send(command);
}

export const act = (actor: GameActor, action: Action, seat = A) => send(actor, { type: 'ACTION', seat, action });
export const refuses = (actor: GameActor, action: Action, seat = A) =>
	reject(worldOf(actor), phase(actor), { type: 'ACTION', seat, action });
export const character = (world: World, seat: SeatId) =>
	world.campaign.characters[world.game!.players[seat]!.character]!;

export function cityCards(world: World, id: string, count = 1): CardId[] {
	return Object.values(world.campaign.playerCards)
		.filter(card => card.kind === 'city' && card.city === id)
		.slice(0, count)
		.map(card => card.id);
}

export function infectionCards(world: World, id: string, count = 1): CardId[] {
	return Object.values(world.campaign.infectionCards)
		.filter(card => card.kind === 'city' && card.city === id)
		.slice(0, count)
		.map(card => card.id);
}

/** Moves cards into a hand from wherever they are, so no card ever exists twice. */
export function give(world: World, seat: SeatId, cards: CardId[]) {
	const game = world.game!;
	const taken = new Set(cards);
	for (const player of Object.values(game.players)) player.hand = player.hand.filter(card => !taken.has(card));
	game.playerDeck.order = game.playerDeck.order.filter(card => !taken.has(card));
	game.playerDeck.piles = [
		{
			size: game.playerDeck.order.length,
			epidemics: game.playerDeck.order.filter(card => world.campaign.playerCards[card]?.kind === 'epidemic').length,
		},
	];
	game.playerDiscard = game.playerDiscard.filter(card => !taken.has(card));
	game.players[seat]!.hand.push(...cards);
}

export function emptyHand(world: World, seat: SeatId) {
	world.game!.playerDiscard.push(...world.game!.players[seat]!.hand.splice(0));
}

/** Puts a new Event or companion card straight into a hand. */
export function conjure(
	world: World,
	seat: SeatId,
	card: { kind: 'event'; event: string } | { kind: 'companion'; companion: string },
): CardId {
	const id = `test#${world.campaign.nextCardId++}` as CardId;
	world.campaign.playerCards[id] = (
		card.kind === 'event'
			? { id, kind: 'event', event: card.event, mode: 'rationed' }
			: { id, kind: 'companion', companion: card.companion }
	) as never;
	world.game!.players[seat]!.hand.push(id);
	return id;
}

/** Puts the named cities' Infection cards on top of the deck, in order, with everything else below. */
export function stackInfection(world: World, cities: string[]) {
	const game = world.game!;
	const cards = cities.map(
		(id, index) => infectionCards(world, id, 9)[cities.slice(0, index).filter(other => other === id).length]!,
	);
	const rest = [...game.infectionDeck.order, ...game.infectionDiscard].filter(card => !cards.includes(card));
	game.infectionDiscard = [];
	game.infectionDeck = {
		order: [...cards, ...rest],
		strata: [cards.toSorted(), rest.toSorted()].filter(stratum => stratum.length),
	};
}

/**
 * A three-player December game on its first action step: every region explored, every action
 * unlocked, calm board. Seats A, B, C are Ada (administrator), Bo (farmer), Cy (instructor).
 * Every character holds the same Character card, so a first exposure never asks for a scar.
 */
export function late(edit?: (world: World, game: Game) => void, at: Phase = 'playing.actions'): GameActor {
	const actor = createGameActor({ seed: 21, save: decemberSave() }).start();
	const seats = [A, B, C];
	actor.send({
		type: 'START_GAME',
		seating: Object.values(worldOf(actor).campaign.characters)
			.slice(0, 3)
			.map((entry, index) => ({ seat: seats[index]!, character: entry.id })),
	});
	for (const type of ['ACK_BRIEFING', 'AUTO_SUPPLY', 'CONFIRM_SUPPLY', 'CONFIRM_EVENTS'] as const) actor.send({ type });
	const world = JSON.parse(JSON.stringify(worldOf(actor))) as World;
	const game = world.game!;
	game.active = A;
	game.actionsLeft = 4;
	game.pending = [];
	game.incidents = 0;
	game.stockpile = 20;
	for (const location of Object.values(game.locations)) Object.assign(location, { supplies: 2, plague: 0, hollow: 0 });
	for (const seat of seats) emptyHand(world, seat);
	for (const entry of Object.values(world.campaign.characters))
		if (!entry.worker) entry.exposureTrack = paddedTrack(['empty', 'scar', 'empty', 'scar', 'empty', 'skull']);
	edit?.(world, game);
	return createGameActor({ seed: 1, save: { v: 1, phase: at, world } }).start();
}
