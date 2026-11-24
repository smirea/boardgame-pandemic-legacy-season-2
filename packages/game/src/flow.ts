import { current, isDraft } from 'immer';
import { pack } from './content/pack';
import type { ObjectiveId, ScarId } from './content/types';
import { drawBottom, drawPiled, drawTop, newDeck, newPiledDeck, stackOnTop } from './decks';
import {
	breakthrough,
	characterOf,
	cityDef,
	grid,
	has,
	hasRule,
	isForsaken,
	log,
	neighbours,
	player,
	reconned,
	isColor,
	infest,
} from './helpers';
import type { CardId, CharacterId, CityId, RegionId, SeatId } from './ids';
import { isOpen, openSeal } from './legacy';
import { nextInt, shuffle } from './rng';
import type { Character, Game, GameLocation, World } from './state';

const numbers = pack.numbers;

export function setOutcome(world: World, won: boolean, reason: string) {
	const game = world.game!;
	if (game.outcome) return;
	game.outcome = { won, reason };
	game.pending = [];
	log(game, { t: 'end', won, reason });
}

export const isOver = (world: World) => world.game?.outcome != null;

const UTOPIA_REGION = 'utopia' as RegionId;
/**
 * Recon objectives that no recon is left to complete, such as January's replayed after its region
 * was opened in the lost first game. They stop counting, so the remaining objectives decide the win.
 */
function impossibleObjectives(campaign: World['campaign']): ObjectiveId[] {
	return pack.objectives
		.filter(objective => campaign.objectives.includes(objective.id) && !objective.stepsCarry)
		.filter(objective => (campaign.carriedProgress[objective.id] ?? 0) < objective.target)
		.filter(objective => {
			const routes = pack.reconRoutes.filter(route => route.counts.includes(objective.id));
			return routes.length > 0 && routes.every(route => reconned(campaign, route));
		})
		.map(objective => objective.id);
}

const SIGNAL_COLOURS = new Set(['blue', 'yellow', 'black']);

/** How many of the three signal colours have a tower standing, permanent towers included. */
export function towerColours(game: Game): number {
	const colours = (Object.keys(game.locations) as CityId[])
		.filter(id => game.locations[id]!.tower)
		.map(id => cityDef(id).color);
	return new Set(colours.filter(colour => colour && SIGNAL_COLOURS.has(colour))).size;
}

/** How many havens hold at least one Hollow Man. */
export function havensWithHollow(game: Game): number {
	return pack.cities.filter(city => city.kind === 'haven' && game.locations[city.id]!.hollow > 0).length;
}

export function checkWin(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const active = pack.objectives.filter(
		objective => campaign.objectives.includes(objective.id) && !game.waived.includes(objective.id),
	);
	const mandatoryDone = active
		.filter(objective => objective.mandatory)
		.every(objective => game.completed.includes(objective.id));
	const needed = Math.min(campaign.required, active.length);
	if (mandatoryDone && game.completed.length >= needed && active.length > 0)
		setOutcome(world, true, 'Objectives complete');
}

export function setProgress(world: World, id: ObjectiveId, value: number) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	if (!campaign.objectives.includes(id) || game.completed.includes(id)) return;
	const objective = pack.objectives.find(candidate => candidate.id === id)!;
	game.progress[id] = Math.max(game.progress[id] ?? 0, Math.min(value, objective.target));
	if (game.progress[id]! < objective.target) return;
	game.completed.push(id);
	log(game, { t: 'objective', objective: id });
	if (objective.reward) openSeal(world, objective.reward, false);
	checkWin(world);
}

export const bump = (world: World, id: ObjectiveId, by = 1) =>
	setProgress(world, id, (world.game!.progress[id] ?? 0) + by);

function blankLocation(): GameLocation {
	return { supplies: 0, plague: 0, hollow: 0, center: false, tower: false, shelter: false };
}

export function createGame(world: World, seating: { seat: SeatId; character: CharacterId }[]) {
	const campaign = world.campaign;
	const locations = Object.fromEntries(
		pack.cities.map(city => {
			const location = blankLocation();
			for (const structure of campaign.locations[city.id]!.permanent) location[structure] = true;
			return [city.id, location];
		}),
	) as Record<CityId, GameLocation>;
	const permanent = (kind: 'center' | 'tower' | 'shelter') =>
		Object.values(locations).filter(location => location[kind]).length;
	const track = numbers.supplyByMonth[campaign.month] ?? 0;
	// Every cube the group owns that the supply track does not put in the stockpile waits in the reserve.
	const unused = numbers.supplyByMonth[0]! - track;
	// Give Us the Tools moves up to 10 cubes from the reserve into the stockpile.
	const relief = campaign.losingStreakBonusGames > 0 ? Math.min(10, unused) : 0;
	const stockpile = track + campaign.stockpileBonus + relief;
	const reserve = unused - relief;
	const seats = seating.map(entry => entry.seat);
	world.game = {
		seats,
		players: Object.fromEntries(
			seating.map(({ seat, character }) => [
				seat,
				{ seat, character, location: campaign.characters[character]!.home, hand: [], supplies: 0, used: [] },
			]),
		) as Game['players'],
		active: seats[0]!,
		turn: 0,
		actionsLeft: 0,
		drawsLeft: 0,
		infectionsLeft: 0,
		locations,
		stockpile,
		reserve,
		pieces: {
			center: numbers.pieces.center - permanent('center'),
			tower: numbers.pieces.tower - permanent('tower'),
			shelter: numbers.pieces.shelter - permanent('shelter'),
			hollow: numbers.pieces.hollow,
		},
		playerDeck: { order: [], piles: [] },
		playerDiscard: [],
		infectionDeck: { order: [], strata: [] },
		infectionDiscard: [],
		gameEndArea: [],
		rateIndex: 0,
		incidents: 0,
		epidemics: 0,
		progress: { ...campaign.carriedProgress },
		completed: pack.objectives
			.filter(objective => campaign.objectives.includes(objective.id))
			.filter(
				objective =>
					(campaign.carriedProgress[objective.id] ?? 0) >= objective.target ||
					(objective.doneIfReconned && impossibleObjectives(campaign).includes(objective.id)),
			)
			.map(objective => objective.id),
		waived: impossibleObjectives(campaign).filter(
			id => !pack.objectives.find(objective => objective.id === id)!.doneIfReconned,
		),
		pending: [],
		skipInfection: false,
		gathering: false,
		pickedEvents: [],
		centersBuilt: 0,
		searches: 0,
		connectedThisGame: [],
		cubesAdded: 0,
		outcome: null,
		ended: [],
		log: [],
		nextSeq: 1,
		upkeep: null,
		prologueRestore: campaign.month === 0 ? (isDraft(campaign) ? current(campaign) : structuredClone(campaign)) : null,
	};
}

function onGridCards(world: World) {
	const { campaign } = world;
	const onGrid = grid(campaign);
	const stored = new Set([...campaign.stored.player, ...campaign.stored.infection]);
	const playerCards = Object.values(campaign.playerCards).filter(card => !stored.has(card.id));
	const infectionCards = Object.values(campaign.infectionCards).filter(card => !stored.has(card.id));
	return {
		cityCards: playerCards.filter(card => card.kind === 'city' && onGrid.has(card.city)).map(card => card.id),
		infection: infectionCards.filter(card => card.kind === 'city' && onGrid.has(card.city)).map(card => card.id),
		hollowCards: infectionCards.filter(card => card.kind !== 'city').map(card => card.id),
		playerCards,
	};
}

/** Setup step 4: build the Infection deck. Its opening cards are then flipped one command at a time, so every screen sees each one. */
export function setupInfection(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const cards = onGridCards(world);
	// Utopia forced open at December setup arrives through the discard pile, so its cards wait for the first epidemic.
	const forcedLate = campaign.month === 12 && campaign.attempt === 1 && campaign.forced.includes('package:8');
	const late = cards.infection.filter(id => {
		const card = campaign.infectionCards[id]!;
		return forcedLate && card.kind === 'city' && cityDef(card.city).region === UTOPIA_REGION;
	});
	game.infectionDeck = newDeck(
		campaign.rng,
		cards.infection.filter(id => !late.includes(id)),
	);
	game.infectionDiscard = [...cards.hollowCards, ...late];
	if (late.length)
		log(game, {
			t: 'note',
			text: `Utopia was opened by the perimeter report, so its ${late.length} Infection cards start in the discard pile and enter the deck with the first Epidemic`,
		});
	game.infectionsLeft = numbers.setupInfections;
}

/** How many of the opening flips still to come infect a city. From September the last 3 place a Hollow Man instead. */
export function openingInfectionsLeft(world: World): number {
	const hollow = hasRule(world.campaign, 'hollowSetup') ? 3 : 0;
	return Math.max(0, world.game!.infectionsLeft - hollow);
}

/** Flips one of the cards that open a game. */
export function openingInfectStep(world: World) {
	const game = world.game!;
	const infects = openingInfectionsLeft(world) > 0;
	const card = drawInfectionCard(world, 'top');
	if (!card?.city) return void (game.infectionsLeft = 0);
	game.infectionsLeft -= 1;
	if (infects) infectCity(world, card.city, card.id);
	else placeHollow(world, card.city, card.id);
	game.infectionDiscard.push(card.id);
}

export function epidemicCount(cityCards: number): number {
	return numbers.epidemicTable.find(row => cityCards <= row.maxCityCards)!.epidemics;
}

/** Setup steps 6 and 7: build the Player deck, deal hands, seed the epidemics, pick the first player. */
export function setupPlayerDeck(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const cards = onGridCards(world);
	const always = cards.playerCards.filter(
		card => card.kind === 'produce' || (card.kind === 'event' && card.mode !== 'rationed'),
	);
	const deck = shuffle(campaign.rng, [...cards.cityCards, ...always.map(card => card.id), ...game.pickedEvents]);
	const deal = numbers.dealByPlayers[game.seats.length] ?? 2;
	for (const seat of game.seats) player(game, seat).hand = deck.splice(0, deal);
	const epidemics = hasRule(campaign, 'epidemicScaling') ? epidemicCount(cards.cityCards.length) : 5;
	const epidemicCards = Object.values(campaign.playerCards)
		.filter(card => card.kind === 'epidemic')
		.slice(0, epidemics)
		.map(card => card.id);
	game.playerDeck = newPiledDeck(campaign.rng, deck, epidemicCards);
	game.active = game.seats[nextInt(campaign.rng, game.seats.length)]!;
	for (; campaign.owedScars > 0; campaign.owedScars--) game.pending.push({ t: 'scarVote', votes: {}, not: [] });
	setProgress(world, 'triangulate', towerColours(game));
	beginTurn(world);
}

export function beginTurn(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const seat = game.active;
	const current = player(game, seat);
	game.turn += 1;
	game.actionsLeft = numbers.actionsPerTurn;
	current.used = [];
	log(game, { t: 'turn', seat });
	const here = game.locations[current.location]!;
	const lost =
		(has(world, seat, 'portBound') && !cityDef(current.location).port ? 1 : 0) +
		(has(world, seat, 'plagueShy') && here.plague > 0 ? 1 : 0);
	game.actionsLeft = Math.max(0, game.actionsLeft - lost);
	const infested = campaign.locations[current.location]!.infested && !has(world, seat, 'fieldSurgeon');
	if ((here.plague > 0 || infested) && !here.shelter) {
		expose(world, seat);
		if (infested && has(world, seat, 'susceptible') && !characterOf(world, seat).dead) expose(world, seat);
	}
}

export function nextSeat(game: Game): SeatId {
	return game.seats[(game.seats.indexOf(game.active) + 1) % game.seats.length]!;
}

export function expose(world: World, seat: SeatId) {
	const { game } = world as { game: Game };
	const character = characterOf(world, seat);
	const current = player(game, seat);
	if (character.worker) {
		game.playerDiscard.push(...current.hand.splice(0));
		if (game.active === seat) game.actionsLeft = 0;
		current.location = character.home;
		log(game, { t: 'exposure', seat, result: 'worker' });
		return;
	}
	// The Prologue card: characters cannot get exposed.
	if (world.campaign.month === 0) return;
	const box = character.exposureTrack[character.exposure] ?? 'skull';
	character.exposure += 1;
	log(game, { t: 'exposure', seat, result: box });
	if (box === 'scar' && canTakeScar(world, character)) game.pending.push({ t: 'scar', seat, at: current.location });
	if (box === 'skull') kill(world, seat);
}

const CARRY_LIMIT = 3;

/** A frail character carries only so many cubes. Whatever else lands on it goes back to the stockpile. */
export function settleCarried(world: World) {
	const game = world.game!;
	for (const seat of game.seats) {
		const carrier = player(game, seat);
		if (carrier.supplies <= CARRY_LIMIT || !has(world, seat, 'frail')) continue;
		game.stockpile += carrier.supplies - CARRY_LIMIT;
		carrier.supplies = CARRY_LIMIT;
	}
}

/** The characters of this game a scar the Legacy deck owes may go to. */
export function scarCandidates(world: World, vote: { not: SeatId[] }): SeatId[] {
	const game = world.game!;
	return game.seats.filter(seat => {
		const character = characterOf(world, seat);
		// A scar on someone already dead, or on a haven worker who is gone after the game, would be wasted.
		return !vote.not.includes(seat) && !character.dead && !character.worker && canTakeScar(world, character);
	});
}

export const hasScar = (character: Character, scar: ScarId) =>
	character.jobScar === scar || character.slots.some(slot => slot?.kind === 'scar' && slot.id === scar);

/** A character can take a scar when one it does not already carry is in the box and there is somewhere to put it. */
export function canTakeScar(world: World, character: Character): boolean {
	const scars = world.campaign.scars.filter(scar => scar !== 'carrier' && !hasScar(character, scar));
	return scars.length > 0 && scarTargets(character).length > 0;
}

/** Slot indexes a scar may cover, plus `job` when the job is still showing. A scar never covers a scar. */
export function scarTargets(character: Character): (number | 'job')[] {
	const targets: (number | 'job')[] = character.slots.flatMap((slot, index) => (slot?.kind === 'scar' ? [] : [index]));
	if (character.job && !character.jobScar) targets.push('job');
	return targets;
}

export function kill(world: World, seat: SeatId) {
	const { game } = world as { game: Game };
	const character = characterOf(world, seat);
	const current = player(game, seat);
	character.dead = true;
	character.diedAt = current.location;
	game.playerDiscard.push(...current.hand.splice(0));
	game.stockpile += current.supplies;
	current.supplies = 0;
	if (game.active === seat) game.actionsLeft = 0;
	log(game, { t: 'death', seat, character: character.id, at: current.location });
	game.pending.push({ t: 'replace', seat });
}

/** Living characters nobody is playing. An empty list means the seat falls back to a haven worker. */
export function freeCharacters(world: World): Character[] {
	const taken = new Set(Object.values(world.game!.players).map(entry => entry.character));
	return Object.values(world.campaign.characters).filter(
		character => !character.dead && !character.worker && !taken.has(character.id),
	);
}

/** The City cards a Soldier may discard to leave where they stand without being exposed. */
export function guardCards(world: World, seat: SeatId): CardId[] {
	if (!has(world, seat, 'soldier')) return [];
	const current = player(world.game!, seat);
	const color = cityDef(current.location).color;
	return current.hand.filter(id => {
		const card = world.campaign.playerCards[id];
		return card?.kind === 'city' && isColor(card, color);
	});
}

/**
 * Moves a pawn. Leaving a location that holds Hollow Men costs an exposure, and a pawn that dies of
 * it never arrives. A Soldier who could pay instead waits for their player's choice (`guard`). Returns whether the
 * pawn reached `to`.
 */
export function movePawn(world: World, seat: SeatId, to: CityId, by: string): boolean {
	const { game } = world as { game: Game };
	const current = player(game, seat);
	const from = current.location;
	const leaving = game.locations[from]!;
	if (leaving.hollow > 0 && !leaving.shelter) {
		// First in the queue, so an Event played between an Epidemic's steps that moves a Soldier is settled at once.
		if (guardCards(world, seat).length) {
			game.pending.unshift({ t: 'guard', seat, to, by });
			return false;
		}
		expose(world, seat);
		if (characterOf(world, seat).dead || current.location !== from) return false;
	}
	return arrive(world, seat, to, by);
}

/** The rest of a move, once the pawn has got away from where it stood. */
export function arrive(world: World, seat: SeatId, to: CityId, by: string): boolean {
	const { game } = world as { game: Game };
	const current = player(game, seat);
	const from = current.location;
	const leaving = game.locations[from]!;
	current.location = to;
	log(game, { t: 'move', seat, from, to, by });
	if (has(world, seat, 'haunted') && cityDef(from).kind === 'city' && leaving.supplies === 0 && current.hand.length > 0)
		game.pending.push({ t: 'discard', seat, count: 1 });
	const destination = cityDef(to);
	if (destination.kind === 'haven' && destination.lost) setProgress(world, 'lostHaven', 1);
	if (destination.arrival && (!destination.arrivalAfter || isOpen(world.campaign, destination.arrivalAfter)))
		openSeal(world, destination.arrival, false, seat);
	checkDelivery(world);
	return true;
}

/** The sample is delivered once a carrier stands in Johannesburg and Johannesburg has a supply center, in either order. */
export function checkDelivery(world: World) {
	const game = world.game!;
	if (world.campaign.sampleDelivered || !game.locations[pack.sampleTo]!.center) return;
	const carrierThere = game.seats.some(
		seat => player(game, seat).location === pack.sampleTo && characterOf(world, seat).carrier,
	);
	if (!carrierThere) return;
	world.campaign.sampleDelivered = true;
	setProgress(world, 'deliverSample', 1);
}

type DrawnCity = { id: CardId; city: CityId };

/**
 * Turns over one Infection card. A forsaken city's card goes to the Game End area and the next card is turned
 * instead; a Gather card is returned with no city, and from the bottom of the deck it is discarded without effect.
 */
function drawInfectionCard(world: World, end: 'bottom'): DrawnCity | null;
function drawInfectionCard(world: World, end: 'top'): DrawnCity | { id: CardId; city: null } | null;
function drawInfectionCard(world: World, end: 'top' | 'bottom'): DrawnCity | { id: CardId; city: null } | null {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	for (;;) {
		if (game.infectionDeck.order.length === 0) {
			// With every city forsaken the discard pile holds only Hollow Men cards, and reshuffling them would never end.
			const infectable = game.infectionDiscard.some(id => {
				const card = campaign.infectionCards[id]!;
				return card.kind === 'city' && !isForsaken(campaign, card.city);
			});
			if (!infectable) return null;
			game.infectionDeck = newDeck(campaign.rng, game.infectionDiscard.splice(0));
			game.rateIndex = Math.min(game.rateIndex + 1, numbers.infectionRates.length - 1);
			log(game, {
				t: 'note',
				text: 'The Infection deck ran out: its discard pile is reshuffled into a new deck and the infection rate moves one step',
			});
		}
		const id = end === 'top' ? drawTop(game.infectionDeck)! : drawBottom(game.infectionDeck)!;
		const card = campaign.infectionCards[id]!;
		if (card.kind !== 'city') {
			game.infectionDiscard.push(id);
			return end === 'bottom' ? null : { id, city: null };
		}
		if (isForsaken(campaign, card.city)) {
			game.gameEndArea.push(id);
			log(game, { t: 'infect', city: card.city, card: id, effect: 'skipped' });
			continue;
		}
		return { id, city: card.city };
	}
}

function incident(world: World, city: CityId) {
	const game = world.game!;
	game.locations[city]!.plague += 1;
	game.incidents += 1;
	log(game, { t: 'incident', city, total: game.incidents });
	if (game.incidents >= numbers.incidentLimit) setOutcome(world, false, 'The incident track is full');
}

function outbreak(world: World, origin: CityId) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const outbroken = new Set<CityId>();
	const queue = [origin];
	while (queue.length && !isOver(world)) {
		const city = queue.shift()!;
		if (outbroken.has(city)) continue;
		outbroken.add(city);
		log(game, { t: 'outbreak', city });
		for (const next of neighbours(campaign, city)) {
			if (isOver(world)) break;
			const location = game.locations[next]!;
			if (location.supplies > 0) {
				location.supplies -= 1;
				game.stockpile += 1;
			} else if (outbroken.has(next)) {
				continue;
			} else if (location.plague < numbers.maxPlaguePerCity) {
				incident(world, next);
			} else {
				queue.push(next);
			}
		}
	}
}

/** Whether the improvement on this Infection card stops it from doing anything. It applies however the card is drawn. */
function sparedByCard(world: World, city: CityId, cardId: CardId): boolean {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const card = campaign.infectionCards[cardId]!;
	const improvement = card.kind === 'city' ? card.improvement : null;
	return (
		(improvement === 'wellStocked' && game.locations[city]!.supplies >= 2) ||
		(improvement === 'rebirth' && campaign.locations[city]!.population >= numbers.rebirthPopulation)
	);
}

export function infectCity(world: World, city: CityId, cardId: CardId) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const location = game.locations[city]!;
	if (sparedByCard(world, city, cardId)) return log(game, { t: 'infect', city, card: cardId, effect: 'blocked' });
	if (location.supplies > 0) {
		location.supplies -= 1;
		game.stockpile += 1;
		log(game, { t: 'infect', city, card: cardId, effect: 'supply' });
		const color = cityDef(city).color;
		if (breakthrough(campaign, 'topaz') && color) {
			const canPay = game.seats.some(seat =>
				player(game, seat).hand.some(id => {
					const held = campaign.playerCards[id]!;
					return held.kind === 'city' && isColor(held, color);
				}),
			);
			if (canPay) game.pending.push({ t: 'shield', city, color });
		}
	} else if (location.plague < numbers.maxPlaguePerCity) {
		log(game, { t: 'infect', city, card: cardId, effect: 'plague' });
		incident(world, city);
	} else {
		log(game, { t: 'infect', city, card: cardId, effect: 'outbreak' });
		outbreak(world, city);
	}
}

export function placeHollow(world: World, city: CityId, cardId: CardId) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const location = game.locations[city]!;
	log(game, { t: 'infect', city, card: cardId, effect: 'hollow' });
	if (location.hollow >= numbers.maxHollowPerCity) {
		const record = campaign.locations[city]!;
		if (!location.shelter) record.population = Math.max(0, record.population - 1);
		// A city that is forsaken the moment its last person leaves is infested from that moment too.
		if (isForsaken(campaign, city)) infest(campaign, city);
		return;
	}
	if (game.pieces.hollow === 0) {
		// Running out of figures only becomes a loss with the September rule.
		if (hasRule(campaign, 'hollowSetup')) setOutcome(world, false, 'No Hollow Men figures are left to place');
		return;
	}
	game.pieces.hollow -= 1;
	location.hollow += 1;
}

/**
 * Flips one card of the turn's Infect step. A Gather card is a flip of its own that does not count toward the
 * rate: it waits face up for the next flip, whose city gets a Hollow Man instead of being infected.
 */
export function infectStep(world: World) {
	const game = world.game!;
	const drawn = drawInfectionCard(world, 'top');
	if (!drawn) {
		game.gathering = false;
		game.infectionsLeft -= 1;
		return;
	}
	if (drawn.city === null) {
		log(game, { t: 'gather', card: drawn.id });
		if (game.gathering)
			log(game, { t: 'note', text: 'Another Gather card was flipped: it is discarded without effect' });
		game.gathering = true;
		return;
	}
	game.infectionsLeft -= 1;
	if (game.gathering) placeHollow(world, drawn.city, drawn.id);
	else infectCity(world, drawn.city, drawn.id);
	game.gathering = false;
	game.infectionDiscard.push(drawn.id);
	const card = world.campaign.infectionCards[drawn.id];
	const anyCards = game.seats.some(seat => player(game, seat).hand.length > 0);
	if (card?.kind === 'city' && card.improvement === 'cordon' && game.infectionsLeft > 0 && anyCards && !isOver(world))
		game.pending.push({ t: 'cordon' });
}

/** Step 1 of an Epidemic: advance the infection rate and apply Demoralized, then wait for Step 2 (Infect). */
export function epidemicIncrease(world: World) {
	const { game } = world as { campaign: World['campaign']; game: Game };
	game.epidemics += 1;
	game.rateIndex = Math.min(game.rateIndex + 1, numbers.infectionRates.length - 1);
	for (const seat of game.seats) {
		const shaken = player(game, seat);
		if (!has(world, seat, 'rattled') || shaken.supplies === 0) continue;
		game.stockpile += shaken.supplies;
		shaken.supplies = 0;
		log(game, { t: 'note', text: `${characterOf(world, seat).name} dropped every cube they carried` });
	}
	game.pending.push({ t: 'epidemicInfect' });
}

/** Step 2 of an Epidemic: draw the bottom (or stored) Infection card, strip its cubes, then wait for Step 3 (Intensify). */
export function epidemicInfect(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	let struck: DrawnCity | null = null;
	const stored = campaign.stored.infection;
	if (hasRule(campaign, 'epidemicFromStorage')) {
		while (stored.length && !struck) {
			const id = stored.splice(nextInt(campaign.rng, stored.length), 1)[0]!;
			const card = campaign.infectionCards[id]!;
			if (card.kind !== 'city') continue;
			if (isForsaken(campaign, card.city)) game.gameEndArea.push(id);
			else {
				struck = { id, city: card.city };
				log(game, {
					t: 'note',
					text: `The Epidemic pulled ${cityDef(card.city).name}'s Infection card back out of storage`,
				});
			}
		}
	}
	struck ??= drawInfectionCard(world, 'bottom');
	let removed = 0;
	if (struck) {
		const location = game.locations[struck.city]!;
		if (!sparedByCard(world, struck.city, struck.id))
			removed = breakthrough(campaign, 'jade') ? Math.min(1, location.supplies) : location.supplies;
		game.stockpile += removed;
		location.supplies -= removed;
		game.infectionDiscard.push(struck.id);
	}
	log(game, {
		t: 'epidemic',
		city: struck?.city ?? null,
		card: struck?.id ?? null,
		rate: numbers.infectionRates[game.rateIndex]!,
		removed,
	});
	game.pending.push({ t: 'intensify' });
}

/** The last step of an Epidemic: the Infection discard pile goes back on top of the deck, shuffled. */
export function intensify(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	stackOnTop(game.infectionDeck, campaign.rng, game.infectionDiscard.splice(0));
}

export function startDrawStep(world: World) {
	const game = world.game!;
	if (game.playerDeck.order.length < 2) return setOutcome(world, false, 'The Player deck ran out');
	game.drawsLeft = 2;
}

export function drawPlayerCard(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const id = drawPiled(game.playerDeck, card => campaign.playerCards[card]!.kind === 'epidemic');
	game.drawsLeft -= 1;
	// An Event played between the two draws can empty the deck. A draw that cannot be made loses the game.
	if (!id) return setOutcome(world, false, 'The Player deck ran out');
	log(game, { t: 'draw', seat: game.active, card: id });
	if (campaign.playerCards[id]!.kind === 'epidemic') {
		game.playerDiscard.push(id);
		game.pending.push({ t: 'epidemicDrawn' });
	} else {
		player(game, game.active).hand.push(id);
	}
}

export function startInfectStep(world: World) {
	const game = world.game!;
	game.infectionsLeft = game.skipInfection ? 0 : numbers.infectionRates[game.rateIndex]!;
	game.skipInfection = false;
}

export function endTurn(world: World) {
	const game = world.game!;
	const ending = player(game, game.active);
	if (has(world, game.active, 'oddHand') && ending.hand.length > 0 && ending.hand.length % 2 === 0)
		game.pending.push({ t: 'discard', seat: game.active, count: 1 });
	game.active = nextSeat(game);
	beginTurn(world);
}

/** Cities that just gained a path to a haven get their cards: City cards to the discard pile, Infection cards to the Game End area. */
export function settleGrid(world: World, before: ReadonlySet<CityId>, countsForObjective: boolean) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game | null };
	if (!game) return;
	for (const city of grid(campaign)) {
		if (before.has(city)) continue;
		game.connectedThisGame.push(city);
		log(game, { t: 'connected', city });
		for (const card of Object.values(campaign.playerCards))
			if (card.kind === 'city' && card.city === city) game.playerDiscard.push(card.id);
		// Utopia's report puts its Infection cards in the discard pile, where the next Epidemic shuffles them in.
		const pile = cityDef(city).region === UTOPIA_REGION ? game.infectionDiscard : game.gameEndArea;
		for (const card of Object.values(campaign.infectionCards))
			if (card.kind === 'city' && card.city === city) pile.push(card.id);
		if (countsForObjective && cityDef(city).kind === 'city') bump(world, 'connectCities');
	}
}
