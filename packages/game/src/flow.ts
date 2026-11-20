import { current, isDraft } from 'immer';
import { pack } from './content/pack';
import type { ObjectiveId, ScarId } from './content/types';
import { drawBottom, drawPiled, drawTop, newDeck, newPiledDeck, stackOnTop } from './decks';
import { characterOf, cityDef, grid, has, hasRule, isForsaken, isHaven, log, neighbours, player } from './helpers';
import type { BundleId, CardId, CharacterId, CityId, RegionId, SeatId } from './ids';
import { openBundle } from './legacy';
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

const UTOPIA = 'utopia' as BundleId;
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
			return routes.length > 0 && routes.every(route => campaign.opened.includes(route.opens));
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
	if (objective.reward && !campaign.opened.includes(objective.reward)) openBundle(world, objective.reward, false);
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
	const bonus = campaign.stockpileBonus + (campaign.losingStreakBonusGames > 0 ? 10 : 0);
	const stockpile = (numbers.supplyByMonth[campaign.month] ?? 0) + bonus;
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
		reserve: numbers.reserve,
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
			.filter(objective => (campaign.carriedProgress[objective.id] ?? 0) >= objective.target)
			.map(objective => objective.id),
		waived: impossibleObjectives(campaign),
		pending: [],
		skipInfection: false,
		pickedEvents: [],
		centersBuilt: 0,
		searches: 0,
		connectedThisGame: [],
		outcome: null,
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

/** Setup steps 4: build the Infection deck and flip the opening infections. */
export function setupInfection(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const cards = onGridCards(world);
	// Utopia forced open at December setup arrives through the discard pile, so its cards wait for the first epidemic.
	const forcedLate = campaign.month === 12 && campaign.attempt === 1 && campaign.forced.includes(UTOPIA);
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
	const hollowFrom = hasRule(campaign, 'hollowSetup') ? numbers.setupInfections - 3 : numbers.setupInfections;
	for (let flipped = 0; flipped < numbers.setupInfections && !isOver(world); flipped++) {
		const card = drawInfectionCard(world, 'top');
		if (!card) break;
		if (flipped >= hollowFrom) placeHollow(world, card.city, card.id);
		else infectCity(world, card.city, card.id);
		game.infectionDiscard.push(card.id);
	}
}

export function epidemicCount(cityCards: number): number {
	return numbers.epidemicTable.find(row => cityCards <= row.maxCityCards)!.epidemics;
}

/** Setup steps 6 and 7: build the Player deck, deal hands, seed the epidemics, pick the first player. */
export function setupPlayerDeck(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const cards = onGridCards(world);
	const always = cards.playerCards.filter(
		card => card.kind === 'produce' || card.kind === 'companion' || (card.kind === 'event' && card.mode !== 'rationed'),
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
	for (; campaign.owedScars > 0; campaign.owedScars--) game.pending.push({ t: 'scar', seat: null });
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
	if ((here.plague > 0 || infested) && !here.shelter) expose(world, seat);
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
	const box = character.exposureTrack[character.exposure] ?? 'skull';
	character.exposure += 1;
	log(game, { t: 'exposure', seat, result: box });
	if (box === 'scar' && canTakeScar(world, character)) game.pending.push({ t: 'scar', seat });
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

/**
 * Moves a pawn. Leaving a location that holds Hollow Men costs an exposure, and a pawn that dies of
 * it never arrives. Returns whether the pawn reached `to`.
 */
export function movePawn(world: World, seat: SeatId, to: CityId, by: string): boolean {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	const current = player(game, seat);
	const from = current.location;
	const leaving = game.locations[from]!;
	if (leaving.hollow > 0 && !leaving.shelter && !has(world, seat, 'outrider')) {
		expose(world, seat);
		if (characterOf(world, seat).dead || current.location !== from) return false;
	}
	current.location = to;
	log(game, { t: 'move', seat, from, to, by });
	if (has(world, seat, 'haunted') && cityDef(from).kind === 'city' && leaving.supplies === 0 && current.hand.length > 0)
		game.pending.push({ t: 'discard', seat, count: 1 });
	const destination = cityDef(to);
	if (destination.kind === 'haven' && destination.lost) setProgress(world, 'lostHaven', 1);
	if (destination.arrival && !campaign.opened.includes(destination.arrival))
		openBundle(world, destination.arrival, false);
	if (characterOf(world, seat).carrier && to === pack.sampleTo && game.locations[to]!.center) {
		campaign.sampleDelivered = true;
		setProgress(world, 'deliverSample', 1);
	}
	return true;
}

type DrawnCity = { id: CardId; city: CityId };

/**
 * Draws Infection cards until one names a city that can be infected. Forsaken cities' cards wait in
 * the Game End area, and Hollow Men cards met on the way are returned as `gather`.
 */
function drawInfectionCard(world: World, end: 'top' | 'bottom'): (DrawnCity & { gathers: number }) | null {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	let gathers = 0;
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
			if (end === 'bottom') return null;
			gathers += 1;
			if (gathers === 1)
				log(game, {
					t: 'note',
					text: 'A Hollow Men card was flipped: the next city gets a Hollow Man and is not infected',
				});
			continue;
		}
		if (isForsaken(campaign, card.city)) {
			game.gameEndArea.push(id);
			log(game, { t: 'infect', city: card.city, card: id, effect: 'skipped' });
			continue;
		}
		return { id, city: card.city, gathers };
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
			} else if (!isHaven(next)) {
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
	const card = campaign.infectionCards[cardId]!;
	const improvement = card.kind === 'city' ? card.improvement : null;
	if (sparedByCard(world, city, cardId)) return log(game, { t: 'infect', city, card: cardId, effect: 'blocked' });
	if (location.supplies > 0) {
		location.supplies -= 1;
		game.stockpile += 1;
		log(game, { t: 'infect', city, card: cardId, effect: 'supply' });
		const color = cityDef(city).color;
		if (hasRule(campaign, 'topazShield') && color) {
			const canPay = game.seats.some(seat =>
				player(game, seat).hand.some(id => {
					const held = campaign.playerCards[id]!;
					return held.kind === 'city' && cityDef(held.city).color === color;
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
		if (isForsaken(campaign, city)) record.infested = true;
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

/** Flips one card of the turn's Infect step. */
export function infectStep(world: World) {
	const game = world.game!;
	const drawn = drawInfectionCard(world, 'top');
	game.infectionsLeft -= 1;
	if (!drawn) return;
	if (drawn.gathers > 0) placeHollow(world, drawn.city, drawn.id);
	else infectCity(world, drawn.city, drawn.id);
	game.infectionDiscard.push(drawn.id);
	const card = world.campaign.infectionCards[drawn.id];
	const anyCards = game.seats.some(seat => player(game, seat).hand.length > 0);
	if (card?.kind === 'city' && card.improvement === 'cordon' && game.infectionsLeft > 0 && anyCards && !isOver(world))
		game.pending.push({ t: 'cordon' });
}

export function epidemic(world: World) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game };
	game.epidemics += 1;
	game.rateIndex = Math.min(game.rateIndex + 1, numbers.infectionRates.length - 1);
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
	for (const seat of game.seats) {
		const shaken = player(game, seat);
		if (!has(world, seat, 'rattled') || shaken.supplies === 0) continue;
		game.stockpile += shaken.supplies;
		shaken.supplies = 0;
		log(game, { t: 'note', text: `${characterOf(world, seat).name} dropped every cube they carried` });
	}
	struck ??= drawInfectionCard(world, 'bottom');
	let removed = 0;
	if (struck) {
		const location = game.locations[struck.city]!;
		if (!sparedByCard(world, struck.city, struck.id))
			removed = hasRule(campaign, 'gentleEpidemic') ? Math.min(1, location.supplies) : location.supplies;
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
	const resilient = game.seats.some(seat =>
		player(game, seat).hand.some(id => {
			const card = campaign.playerCards[id];
			return card?.kind === 'event' && card.event === 'resilience';
		}),
	);
	const lockable = game.infectionDiscard.some(id => {
		const card = campaign.infectionCards[id];
		return card?.kind === 'city' && card.improvement === 'lockdown';
	});
	// Resilience and Lockdown both act on the discard pile, which is about to be reshuffled away, so the game waits for them.
	if ((resilient || lockable) && game.infectionDiscard.length > 0) game.pending.push({ t: 'intensify' });
	else intensify(world);
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
		epidemic(world);
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
export function settleGrid(world: World, before: Set<CityId>, countsForObjective: boolean) {
	const { campaign, game } = world as { campaign: World['campaign']; game: Game | null };
	if (!game) return;
	for (const city of grid(campaign)) {
		if (before.has(city)) continue;
		game.connectedThisGame.push(city);
		log(game, { t: 'connected', city });
		for (const card of Object.values(campaign.playerCards))
			if (card.kind === 'city' && card.city === city) game.playerDiscard.push(card.id);
		for (const card of Object.values(campaign.infectionCards))
			if (card.kind === 'city' && card.city === city) game.gameEndArea.push(card.id);
		if (countsForObjective && cityDef(city).kind === 'city') bump(world, 'connectCities');
	}
}
