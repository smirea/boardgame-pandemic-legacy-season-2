import {
	characterAt,
	cityDef,
	handLimit,
	has,
	pack,
	revealDone,
	routeCost,
	sealDef,
	SEAT_IDS,
	suppliesMade,
} from '@repo/game';
import type { Action, CardId, CityId, Decide, Decision, LogEntry, Play, Purchase, SeatId, World } from '@repo/game';
import { cityColor } from '#lib/board/CityMarker.svelte';
import { cardColor } from './PlayerCard.svelte';
import { HOLLOW_COLOR } from './rich.ts';
import type { GlyphPart, Rich } from './rich.ts';

export const MONTHS = [
	'Prologue',
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

export const SEAT_COLORS = ['#d9573f', '#4f93c4', '#e3b23c', '#9a7cc9'];
/**
 * A seat's colour. It goes with the seat, not with how many seats a game fills, so a player is the same colour in the
 * lobby, on the board and on every vote.
 */
export const seatColor = (seat: SeatId): string => SEAT_COLORS[SEAT_IDS.indexOf(seat)]!;

export const ACTION_NAMES: Record<Action['a'], string> = {
	drive: 'Drive / Ferry',
	sail: 'Sail',
	charter: 'Charter boat',
	captainSail: 'Captain’s passage',
	makeSupplies: 'Make supplies',
	produce: 'Produce supplies',
	deliver: 'Deliver',
	share: 'Share knowledge',
	buildCenter: 'Build supply center',
	recon: 'Recon',
	establishLine: 'Supply line',
	chartLane: 'Sea lane',
	search: 'Search',
	shuttle: 'Shuttle flight',
	buildTower: 'Build tower',
	transmit: 'Transmit',
	monitor: 'Monitor',
	broadcast: 'Broadcast',
	buildShelter: 'Build shelter',
	administratorMove: 'Move a pawn',
	sabotage: 'Sabotage',
	broker: 'Broker',
	selfInject: 'Take the sample',
	pickUp: 'Pick up',
	transfer: 'Transfer',
	inoculate: 'Inoculate',
	salvage: 'Salvage',
	destroyInfection: 'Destroy card',
	investigate: 'Investigate',
	supply: 'Supply a city',
	facilitate: 'Take a card',
	run: 'Run',
	misinform: 'Misinform',
	rehab: 'Rehab',
	coordinate: 'Call a pawn over',
	smuggle: 'Smuggle a cube',
	trade: 'Trade a card',
	carry: 'Carry cubes over',
};

/** What a kind of action does for this character, where an ability or piece count changes it. */
export function actionText(world: World, seat: SeatId, a: Action['a']): string {
	if (a === 'deliver' && has(world, seat, 'courier')) return 'Put carried cubes here or next door';
	if (a === 'selfInject') {
		const left = Math.max(0, pack.numbers.selfInfectDoses - world.campaign.dosesUsed);
		return `Carry the sample, taking a scar (${left} of ${pack.numbers.selfInfectDoses} doses left)`;
	}
	const pieces = world.game?.pieces;
	if (pieces) {
		if (a === 'buildCenter') {
			if (pieces.center === 0) return 'Discard cards of its colour to move a center here (0 left)';
			if (pieces.center <= 2) return `${ACTION_TEXT.buildCenter} (${pieces.center} left)`;
		} else if (a === 'buildTower') {
			if (pieces.tower === 0) return 'Spend cubes to move a tower here (0 left)';
			if (pieces.tower <= 2) return `${ACTION_TEXT.buildTower} (${pieces.tower} left)`;
		} else if (a === 'buildShelter') {
			if (pieces.shelter === 0) return 'Move an existing shelter to this city (0 left)';
			if (pieces.shelter <= 2) return `${ACTION_TEXT.buildShelter} (${pieces.shelter} left)`;
		}
	}
	return ACTION_TEXT[a];
}

/** What each kind of action does, in a line short enough to sit beside its name. */
export const ACTION_TEXT: Record<Action['a'], string> = {
	drive: 'Move along a line or lane to a neighbour',
	sail: 'Discard a City card to sail to that port',
	charter: "Discard this port's card to sail to any port",
	captainSail: 'Discard any City card to sail to a port',
	makeSupplies: 'Take a cube from the stockpile',
	produce: 'Discard Produce Supplies to fill cities',
	deliver: 'Put carried cubes in this city',
	share: "Give or take this city's card",
	buildCenter: 'Discard cards of its colour to build one',
	recon: 'Discard City cards to open a region',
	establishLine: 'Spend cubes on a line to a city',
	chartLane: 'Spend cubes on a lane to a port',
	search: "Use a box on this city's card",
	shuttle: 'Fly between havens and supply centers',
	buildTower: 'Spend cubes to raise a tower here',
	transmit: 'Send a City card from a tower',
	monitor: 'At a tower, discard 4 Player cards and scratch a frequency',
	broadcast: 'Move Hollow Men from a tower',
	buildShelter: 'Build a shelter in this city',
	administratorMove: "Move a pawn to another's location",
	sabotage: 'Discard a City card to remove Hollow Men',
	broker: 'Swap a City card for one of its colour',
	investigate: 'Swap a City card for a discarded one',
	supply: "Show a grid city's card to supply it",
	facilitate: 'Take a card from a player here',
	run: 'Discard a City card to reach the grid',
	misinform: 'Lead a Hollow Man to a neighbouring city',
	rehab: 'Discard 2 cards to take a stored City card',
	selfInject: 'Carry the sample, taking a scar',
	pickUp: 'Take cubes from this city',
	transfer: 'Give cubes to a player, or take theirs',
	inoculate: "Store this city's card out of the decks",
	salvage: 'Discard 2 cards to take one back',
	destroyInfection: "Destroy this city's Infection card",
	coordinate: 'Move a pawn next door to this location',
	smuggle: 'Discard a City card to supply that city',
	trade: 'Swap a City card for one of its colour in the discard pile',
	carry: 'Bring cubes from next door to here',
};

/** Each action's cell in the generated icon strip, `static/actions/icons.webp`, 16 icons wide. */
export const ACTION_ICON: Record<Action['a'], number> = {
	drive: 0,
	sail: 2,
	charter: 3,
	captainSail: 1,
	makeSupplies: 4,
	produce: 4,
	deliver: 5,
	share: 15,
	buildCenter: 7,
	recon: 10,
	establishLine: 11,
	chartLane: 11,
	search: 10,
	shuttle: 1,
	buildTower: 8,
	transmit: 8,
	monitor: 8,
	broadcast: 8,
	buildShelter: 9,
	administratorMove: 0,
	sabotage: 14,
	broker: 15,
	investigate: 15,
	supply: 4,
	facilitate: 15,
	run: 0,
	misinform: 8,
	rehab: 12,
	selfInject: 12,
	pickUp: 5,
	transfer: 6,
	inoculate: 12,
	salvage: 13,
	destroyInfection: 14,
	coordinate: 0,
	smuggle: 4,
	trade: 15,
	carry: 5,
};

/** Names the group gave to havens. Reactive, so every label that reads `cityName` follows a rename. */
const renamed = $state<{ names: Partial<Record<CityId, string>> }>({ names: {} });

export function setNames(names: Partial<Record<CityId, string>>) {
	renamed.names = names;
}

export const cityName = (id: CityId) => renamed.names[id] ?? cityDef(id).name;

export function seatName(world: World, seat: SeatId): string {
	const player = world.game?.players[seat];
	return player ? (world.campaign.characters[player.character]?.name ?? seat) : seat;
}

export function cardName(world: World, id: CardId): string {
	const card = world.campaign.playerCards[id];
	if (card) {
		if (card.kind === 'city') return cityName(card.city);
		if (card.kind === 'event') return pack.events.find(event => event.id === card.event)!.name;
		return card.kind === 'produce' ? 'Produce Supplies' : 'Epidemic';
	}
	const infection = world.campaign.infectionCards[id];
	if (infection) return infection.kind === 'city' ? cityName(infection.city) : 'Hollow Men';
	return 'card';
}

const cubes = (count: number) => `${count} cube${count === 1 ? '' : 's'}`;
const cards = (world: World, ids: CardId[]) => ids.map(id => cardName(world, id)).join(', ');

/** A card named in a line of text: its glyph in the colour it is known by, then its name. */
export function cardRef(world: World, id: CardId): GlyphPart {
	const card = world.campaign.playerCards[id];
	if (card) return { glyph: 'card', color: cardColor(card), text: cardName(world, id) };
	const infection = world.campaign.infectionCards[id];
	const color = infection?.kind === 'city' ? cityColor(infection.city) : HOLLOW_COLOR;
	return { glyph: 'infection', color, text: cardName(world, id) };
}
const cardList = (world: World, ids: CardId[]): Rich =>
	ids.flatMap((id, index) => (index ? [', ', cardRef(world, id)] : [cardRef(world, id)]));
// The no-break space keeps a count on the same line as its cube.
const cubeCount = (count: number): Rich => [
	`${count}\u00a0`,
	{ glyph: 'supplies', alt: count === 1 ? 'cube' : 'cubes' },
];

/** Action heading aimed at a single city, e.g. "Drive / Ferry to Cairo" or "Sabotage in Cairo". */
export const actionAt = (a: Action['a'], target: CityId) =>
	`${ACTION_NAMES[a]} ${a === 'sabotage' ? 'in' : a === 'carry' ? 'from' : 'to'} ${cityName(target)}`;

/** The city an action is aimed at, when clicking that city on the board should trigger it. */
export function actionTarget(world: World, action: Action): CityId | null {
	switch (action.a) {
		case 'drive':
		case 'charter':
		case 'captainSail':
		case 'shuttle':
		case 'establishLine':
		case 'chartLane':
			return action.to;
		case 'run':
		case 'misinform':
			return action.to;
		case 'carry':
			return action.from;
		case 'sabotage':
			return action.city;
		case 'supply': {
			const card = world.campaign.playerCards[action.card];
			return card?.kind === 'city' ? card.city : null;
		}
		case 'sail': {
			const card = world.campaign.playerCards[action.card];
			return card?.kind === 'city' ? card.city : null;
		}
		case 'deliver':
			return action.to ?? world.game?.players[world.game.active]?.location ?? null;
		default:
			return null;
	}
}

/** What sets this variant apart from others of the same action, short enough for a menu row. */
export function actionDetail(world: World, action: Action): Rich {
	const game = world.game!;
	switch (action.a) {
		case 'drive':
			return action.card ? ['Discard ', cardRef(world, action.card)] : [];
		case 'establishLine':
		case 'chartLane': {
			const cost = routeCost(world, game.active, action.a === 'establishLine' ? 'land' : 'sea');
			return cost === 0 ? ['free'] : cubeCount(cost);
		}
		case 'sail':
		case 'charter':
		case 'captainSail':
		case 'run':
			return ['Discard ', cardRef(world, action.card)];
		case 'makeSupplies': {
			const pile = has(world, game.active, 'immunologist') ? 'reserve' : 'stockpile';
			const made = suppliesMade(world, game.active);
			return [
				made > 1 ? `Take ${made} ` : 'Take a ',
				{ glyph: 'supplies', text: made > 1 ? 'cubes' : 'cube' },
				` from the ${pile}, ${game[pile]} left`,
			];
		}
		case 'produce': {
			// Two of these in hand are two choices only by the uses left on each, and System-Wide spends one.
			const card = world.campaign.playerCards[action.card];
			const uses = card?.kind === 'produce' ? card.boxesLeft : 0;
			return [
				`${action.mode === 'local' ? 'Here only' : 'Every haven and supply center'} · ${uses} use${uses === 1 ? '' : 's'} left`,
			];
		}
		case 'deliver':
			return cubeCount(action.count);
		case 'pickUp': {
			const here = game.locations[game.players[game.active]!.location]!.supplies;
			return ['Take ', ...cubeCount(action.count), ` of ${here} here`];
		}
		case 'transfer':
			return [
				action.give ? 'Give ' : 'Take ',
				...cubeCount(action.count),
				` ${action.give ? 'to' : 'from'} ${seatName(world, action.with)}`,
			];
		case 'share': {
			const receiver = action.give ? action.with : game.active;
			const full = game.players[receiver]!.hand.length >= handLimit(world, receiver);
			return [
				action.give ? 'Give ' : 'Take ',
				cardRef(world, action.card),
				` ${action.give ? 'to' : 'from'} ${seatName(world, action.with)}`,
				// The one who receives the card goes over the limit: the other player on a give, this one on a take.
				full ? (action.give ? ', who must then discard' : ', then discard') : '',
			];
		}
		case 'buildCenter':
			return [
				...(action.laborer ? [...cubeCount(2), ' and '] : []),
				...cardList(world, action.cards),
				action.moveFrom ? `, moved from ${cityName(action.moveFrom)}` : '',
			];
		case 'recon': {
			const route = pack.reconRoutes.find(candidate => candidate.id === action.route)!;
			const planColor = `${route.color[0]!.toUpperCase()}${route.color.slice(1)}`;
			return [
				`${route.opens ? sealDef(route.opens).name : `The Plan (${planColor})`}: `,
				...cardList(world, action.cards),
			];
		}
		case 'search': {
			const card = world.campaign.playerCards[action.card];
			return card?.kind === 'city' ? [cardRef(world, action.card), `, ${card.search[action.box]!.scope} box`] : [];
		}
		case 'buildTower':
			return action.moveFrom ? [`Moved from ${cityName(action.moveFrom)}`] : [];
		case 'transmit':
			return [cardRef(world, action.card), ` to ${seatName(world, action.to)}`];
		case 'monitor':
			return [`Frequency ${pack.frequencyLabels[action.frequency]}`];
		case 'broadcast':
			return [{ glyph: 'hollow', text: 'Hollow Men' }, ` from ${cityName(action.from)} to ${cityName(action.to)}`];
		case 'buildShelter':
			return [
				...(action.card ? ['Discard ', cardRef(world, action.card)] : []),
				...(action.moveFrom ? [`${action.card ? ', moved' : 'Moved'} from ${cityName(action.moveFrom)}`] : []),
			];
		case 'selfInject': {
			const left = Math.max(0, pack.numbers.selfInfectDoses - world.campaign.dosesUsed);
			return [`${left} of ${pack.numbers.selfInfectDoses} doses left · takes Carrier scar`];
		}
		case 'administratorMove':
			return [`${seatName(world, action.pawn)} to ${seatName(world, action.to)}`];
		case 'sabotage':
			return [{ glyph: 'hollow', text: cityName(action.city) }, ', discard ', cardRef(world, action.card)];
		case 'broker':
		case 'trade':
		case 'investigate':
			return [cardRef(world, action.card), ' for ', cardRef(world, action.take)];
		case 'carry':
			return [...cubeCount(action.count), ` from ${cityName(action.from)}`];
		case 'facilitate':
			return [cardRef(world, action.card), ` from ${seatName(world, action.with)}`];
		case 'supply':
			return [...cubeCount(1), ' from the stockpile to ', cardRef(world, action.card)];
		case 'smuggle':
			return ['Discard ', cardRef(world, action.card), ' for ', ...cubeCount(1), ' from the reserve'];
		case 'coordinate':
			return [`${seatName(world, action.pawn)} to here`];
		case 'inoculate':
		case 'destroyInfection':
			return [
				cardRef(world, action.card),
				world.campaign.playerCards[action.card] ? ' from the Player discard' : ' from the Infection discard',
			];
		case 'salvage':
		case 'rehab':
			return ['Discard ', ...cardList(world, action.discard), ', take ', cardRef(world, action.take)];
		case 'misinform':
			return [{ glyph: 'hollow', text: 'A Hollow Man' }, ` to ${cityName(action.to)}`];
		default:
			return [];
	}
}

/** The cards an action discards, for the actions whose cost is cards. */
function discarded(action: Action): CardId[] {
	switch (action.a) {
		case 'drive':
		case 'buildShelter':
			return action.card ? [action.card] : [];
		case 'sail':
		case 'charter':
		case 'captainSail':
		case 'run':
		case 'sabotage':
		case 'smuggle':
			return [action.card];
		case 'buildCenter':
		case 'recon':
			return action.cards;
		case 'salvage':
		case 'rehab':
			return action.discard;
		case 'investigate':
			return [action.card];
		default:
			return [];
	}
}

/** What every way of taking an action spends alike, as Charter boat always discards the card of the port it leaves. */
/** So many cards of one colour, as a cost: "5 ▮ cards". */
function cardsOf(world: World, ids: CardId[]): Rich {
	const card = world.campaign.playerCards[ids[0]!];
	return [`${ids.length}\u00a0`, { glyph: 'card', ...(card ? { color: cardColor(card) } : {}), text: 'cards' }];
}

/**
 * What an action costs when the player picks which cards pay, as a count of cards of a colour rather than one
 * set of them: Build supply center and Recon. Null for any other action, or Recon routes that differ.
 */
export function offerDetail(world: World, offered: Action[]): Rich | null {
	if (offered.length && offered.every(action => action.a === 'buildCenter')) {
		const centers = offered as Extract<Action, { a: 'buildCenter' }>[];
		const plain = centers.find(action => !action.laborer);
		const laborer = centers.find(action => action.laborer);
		const moved = new Set(centers.flatMap(action => (action.moveFrom ? [action.moveFrom] : [])));
		return [
			...(plain ? cardsOf(world, plain.cards) : []),
			...(plain && laborer ? [' or '] : []),
			...(laborer ? [...cardsOf(world, laborer.cards), ' and ', ...cubeCount(2)] : []),
			...(moved.size === 1 ? [`, moved from ${cityName([...moved][0]!)}`] : moved.size ? [', moving a center'] : []),
		];
	}
	if (offered.length && offered.every(action => action.a === 'recon')) {
		const recons = offered as Extract<Action, { a: 'recon' }>[];
		if (recons.some(action => action.route !== recons[0]!.route)) return null;
		const [name] = actionDetail(world, recons[0]!);
		return [name!, ...cardsOf(world, recons[0]!.cards)];
	}
	return null;
}

export function sharedCost(world: World, variants: Action[]): Rich | null {
	const spent = variants.map(action => discarded(action).toSorted().join(','));
	if (!spent[0] || spent.some(key => key !== spent[0])) return null;
	return ['Discard ', ...cardList(world, discarded(variants[0]!))];
}

export function playTarget(play: Play): CityId | null {
	if (play.e === 'encore') return playTarget(play.played);
	if ('city' in play) return play.city;
	if (play.e === 'airlift') return play.to;
	if (play.e === 'openWaters') return play.to;
	if (play.e === 'safeHouses' || play.e === 'mobileShelters' || play.e === 'handout' || play.e === 'cleanse')
		return play.cities[0]!;
	if (play.e === 'spreadOut') return play.to[0]!;
	return null;
}

/** The choice a play needs before its city, such as which pawn to airlift. Empty when there is none. */
export function playGroup(world: World, play: Play): string {
	if (play.e === 'airlift') return seatName(world, play.pawn);
	if (play.e === 'spreadOut') return `from ${cityName(play.from)}`;
	if (play.e === 'resilience' || play.e === 'massInoculation' || play.e === 'exile') return cards(world, play.cards);
	if (play.e === 'encore') {
		const then = playGroup(world, play.played);
		return then ? `${cardName(world, play.card)}: ${then}` : cardName(world, play.card);
	}
	if (play.e === 'mentor') {
		const ability = pack.abilities.find(entry => entry.id === play.ability)!;
		return `${seatName(world, play.seat)}: ${ability.name} in slot ${play.slot + 1}`;
	}
	if (play.e === 'cardSwap')
		return `${seatName(world, play.a)}: ${cardName(world, play.cardA)} ↔ ${seatName(world, play.b)}: ${cardName(world, play.cardB)}`;
	return '';
}

export function decideLabel(world: World, decide: Decide): string {
	switch (decide.d) {
		case 'discard':
			return `Discard ${cards(world, decide.cards)}`;
		case 'scar': {
			const scar = pack.scars.find(candidate => candidate.id === decide.scar)!;
			const who = decide.seat ? `${seatName(world, decide.seat)}: ` : '';
			return `${who}${scar.name} (${scar.text}) ${decide.target === 'job' ? 'over the job' : `in slot ${decide.target + 1}`}`;
		}
		case 'cordon':
			return `${seatName(world, decide.seat)} discards ${cardName(world, decide.card)}`;
		case 'replace':
			return decide.character
				? `Continue as ${world.campaign.characters[decide.character]!.name}`
				: 'Continue as a haven worker';
		case 'retrieve':
			return `Take ${cardName(world, decide.card)}`;
		case 'freeEdge':
			return `Draw it to ${cityName(decide.to)}`;
		case 'removeHollow':
			return `Remove one from ${cityName(decide.city)}`;
		case 'quarantineCard':
			return `Set aside ${cardName(world, decide.card)}`;
		case 'giveCard':
			return `Give ${cardName(world, decide.card)} to ${seatName(world, decide.to)}`;
		case 'shield':
		case 'guard':
			return `${seatName(world, decide.seat)} discards ${cardName(world, decide.card)}`;
		case 'reveal': {
			const pending = world.game?.pending[0];
			return pending?.t === 'reveal' && !revealDone(world.game!, pending)
				? 'Turn over the next card'
				: 'Put the cards away';
		}
		case 'search':
			return 'Continue';
		case 'skip': {
			const pending = world.game?.pending[0]?.t;
			if (pending === 'epidemicDrawn') return 'Start Epidemic';
			if (pending === 'epidemicInfect') return 'Draw bottom card';
			if (pending === 'intensify') return 'Intensify';
			if (pending === 'removeHollow') return 'Remove no more';
			if (pending === 'guard') return 'Keep them and be exposed';
			return 'Skip';
		}
	}
}

const DECISION_TITLES: Record<Decision['t'], string> = {
	discard: 'Discard a card',
	scar: 'A scar: choose it and where it goes',
	replace: 'Choose who steps in',
	retrieve: 'Take a card from the discard pile',
	freeEdge: 'Draw a free route from here',
	removeHollow: 'Remove Hollow Men',
	quarantineCard: 'Set an Infection card aside until game end',
	giveCard: 'Give a card to another player',
	shield: 'Discard a matching card to keep the cube?',
	cordon: 'Discard any card to stop the rest of this Infect step?',
	guard: 'Discard a matching card to slip past the Hollow Men?',
	scarVote: 'A scar is owed: vote for the character who takes it',
	epidemicDrawn: 'Epidemic drawn — play TOPAZ Experimental Vaccine to cancel, or start the Epidemic.',
	epidemicInfect: 'Epidemic Step 2: Infect — draw the bottom Infection card.',
	intensify:
		'Epidemic Step 3: Intensify — play Resilient Population, Inoculation Unit, Relocation, or Lockdown now, or reshuffle.',
	reveal: 'Turn over the top Player cards',
	search: 'Show the table what the search found',
};

/** The prompt for a pending choice, naming who and where it concerns. */
export function decisionTitle(world: World, pending: Decision): string {
	if (pending.t === 'shield')
		return `${cityName(pending.city)} just lost a cube. Discard a ${pending.color} City card to put it back?`;
	if (pending.t === 'guard') {
		const here = world.game!.players[pending.seat]!.location;
		return `${seatName(world, pending.seat)}: Hollow Men stand in ${cityName(here)}. Discard a ${cityDef(here).color} City card to slip past them, or be exposed?`;
	}
	if (pending.t === 'removeHollow')
		return `${seatName(world, pending.seat)}: Remove up to ${pending.amount} Hollow ${pending.amount === 1 ? 'Man' : 'Men'}, one at a time`;
	if (pending.t === 'scar' && !pending.seat)
		return 'A scar is owed. Choose who takes it, which scar, and where it goes';
	const who = 'seat' in pending && pending.seat ? `${seatName(world, pending.seat)}: ` : '';
	return who + DECISION_TITLES[pending.t];
}

export function purchaseLabel(world: World, purchase: Purchase): string {
	switch (purchase.t) {
		case 'ability':
			return `${world.campaign.characters[purchase.character]!.name}, slot ${purchase.slot + 1}`;
		case 'cityImprovement':
		case 'infectionImprovement':
			return cardName(world, purchase.card);
		case 'population':
			return `${cityName(purchase.city)} +${purchase.steps}`;
		case 'restore':
			return cityName(purchase.city);
		case 'permanent':
			return cityName(purchase.city);
	}
}

/** One log entry as a short line, or null for entries that only repeat another line. */
export function logLine(world: World, entry: LogEntry): { tone: '' | 'head' | 'good' | 'bad'; text: string } | null {
	const who = (seat: SeatId) => characterAt(world, seat, entry.seq)?.name ?? seatName(world, seat);
	switch (entry.t) {
		case 'turn':
			return { tone: 'head', text: `${who(entry.seat)}'s turn` };
		case 'move':
			return { tone: '', text: `${who(entry.seat)} to ${cityName(entry.to)}` };
		case 'draw':
			return { tone: '', text: `${who(entry.seat)} draws ${cardName(world, entry.card)}` };
		case 'epidemic':
			return {
				tone: 'bad',
				text: `Epidemic${entry.city ? ` in ${cityName(entry.city)}, ${entry.removed} cubes lost` : ''}. Rate ${entry.rate}`,
			};
		case 'infect':
			return {
				tone: entry.effect === 'supply' || entry.effect === 'blocked' ? '' : 'bad',
				text: `${cityName(entry.city)}: ${{ supply: 'lost a cube', plague: 'plague cube', outbreak: 'outbreak', hollow: 'Hollow Men arrive', skipped: 'forsaken, skipped', blocked: 'held firm' }[entry.effect]}`,
			};
		case 'gather':
			return { tone: 'bad', text: 'Hollow Men gather: the next city flipped gets a Hollow Man' };
		case 'incident':
			return { tone: 'bad', text: `Incident ${entry.total} in ${cityName(entry.city)}` };
		case 'exposure':
			return {
				tone: entry.result === 'empty' ? '' : 'bad',
				text: `${who(entry.seat)} is exposed: ${{ empty: 'nothing', scar: 'a scar', skull: 'death', worker: 'sent home with an empty hand' }[entry.result]}`,
			};
		case 'connected':
			return { tone: 'good', text: `${cityName(entry.city)} joins the grid` };
		case 'structure':
			return {
				tone: 'good',
				text: `${{ center: 'Supply center', tower: 'Tower', shelter: 'Shelter' }[entry.structure]} in ${cityName(entry.city)}`,
			};
		case 'objective':
			return { tone: 'good', text: 'Objective complete' };
		case 'unlock':
			return {
				tone: 'good',
				text: `New content opened${entry.forced ? ' by a perimeter report' : ''}`,
			};
		case 'search':
			return {
				tone: '',
				text: `${who(entry.seat)} searches ${cityName(entry.city)}`,
			};
		case 'end':
			return {
				tone: entry.won ? 'good' : 'bad',
				text: entry.won ? 'Victory' : `Defeat: ${entry.reason}`,
			};
		default:
			return null;
	}
}
