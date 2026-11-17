import { characterAt, cityDef, handLimit, pack, routeCost } from '@repo/game';
import type { Action, CardId, CityId, Decide, Decision, LogEntry, Play, Purchase, SeatId, World } from '@repo/game';

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
	strike: 'Remove Hollow Man',
};

/** What each kind of action does, in a line short enough to sit beside its name. */
export const ACTION_TEXT: Record<Action['a'], string> = {
	drive: 'Move along a line or lane to a neighbour',
	sail: 'Discard a City card to sail to that port',
	charter: "Discard this port's card to sail to any port",
	captainSail: 'Discard any City card to sail to a port',
	makeSupplies: 'Take a cube from the stockpile',
	produce: 'Discard Produce Supplies to fill cities',
	deliver: 'Put carried cubes here or next door',
	share: "Give or take this city's card",
	buildCenter: 'Discard cards of its colour to build one',
	recon: 'Discard City cards to open a region',
	establishLine: 'Spend cubes on a line to a city',
	chartLane: 'Spend cubes on a lane to a port',
	search: "Use a box on this city's card",
	shuttle: 'Fly between havens and supply centers',
	buildTower: 'Spend cubes to raise a tower here',
	transmit: 'Send a City card from a tower',
	monitor: 'Look at the top Player cards',
	broadcast: 'Move Hollow Men from a tower',
	buildShelter: 'Build a shelter in this city',
	administratorMove: "Move a pawn to another's location",
	sabotage: 'Discard a City card to remove Hollow Men',
	broker: 'Swap a City card for one of its colour',
	investigate: 'Swap a City card for a discarded one',
	supply: "Discard a grid city's card to supply it",
	facilitate: 'Take a card from a player here',
	run: 'Discard a City card to reach the grid',
	strike: 'Remove a Hollow Man here',
	selfInject: 'Carry the sample, taking a scar',
	pickUp: 'Take cubes from this city',
	transfer: 'Pass cubes to or from a player',
	inoculate: "Store this city's card out of the decks",
	salvage: 'Discard 2 cards to take one back',
	destroyInfection: "Destroy this city's Infection card",
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
	strike: 13,
	selfInject: 12,
	pickUp: 5,
	transfer: 6,
	inoculate: 12,
	salvage: 13,
	destroyInfection: 14,
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
		if (card.kind === 'companion') return pack.companions.find(companion => companion.id === card.companion)!.name;
		return card.kind === 'produce' ? 'Produce Supplies' : 'Epidemic';
	}
	const infection = world.campaign.infectionCards[id];
	if (infection) return infection.kind === 'city' ? cityName(infection.city) : 'Hollow Men';
	return 'card';
}

const cubes = (count: number) => `${count} cube${count === 1 ? '' : 's'}`;
const cards = (world: World, ids: CardId[]) => ids.map(id => cardName(world, id)).join(', ');

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
			return action.to;
		case 'supply': {
			const card = world.campaign.playerCards[action.card];
			return card?.kind === 'city' ? card.city : null;
		}
		case 'sail': {
			const card = world.campaign.playerCards[action.card];
			return card?.kind === 'city' ? card.city : null;
		}
		case 'deliver':
			return action.to ?? null;
		default:
			return null;
	}
}

/** What sets this variant apart from others of the same action, short enough for a menu row. */
export function actionDetail(world: World, action: Action): string {
	switch (action.a) {
		case 'drive':
			return action.card ? `discard ${cardName(world, action.card)}` : '';
		case 'establishLine':
		case 'chartLane': {
			const cost = routeCost(world, world.game!.active, action.a === 'establishLine' ? 'land' : 'sea');
			return cost === 0 ? 'free' : cubes(cost);
		}
		case 'sail':
		case 'charter':
		case 'captainSail':
			return `discard ${cardName(world, action.card)}`;
		case 'produce':
			return action.mode === 'local' ? 'here only' : 'every haven and supply center';
		case 'deliver':
			return `${cubes(action.count)} ${action.to ? `to ${cityName(action.to)}` : 'here'}`;
		case 'pickUp':
			return cubes(action.count);
		case 'transfer':
			return `${action.give ? 'give' : 'take'} ${cubes(action.count)} ${action.give ? 'to' : 'from'} ${seatName(world, action.with)}`;
		case 'share': {
			const receiver = action.give ? action.with : world.game!.active;
			const full = world.game!.players[receiver]!.hand.length >= handLimit(world, receiver);
			const text = `${action.give ? 'give' : 'take'} ${cardName(world, action.card)} ${action.give ? 'to' : 'from'} ${seatName(world, action.with)}`;
			return full ? `${text}, who must then discard` : text;
		}
		case 'buildCenter':
			return `${action.laborer ? '2 cubes and ' : ''}${cards(world, action.cards)}${action.moveFrom ? `, moved from ${cityName(action.moveFrom)}` : ''}`;
		case 'recon': {
			const route = pack.reconRoutes.find(candidate => candidate.id === action.route)!;
			return `${pack.bundles.find(bundle => bundle.id === route.opens)!.name}: ${cards(world, action.cards)}`;
		}
		case 'search': {
			const card = world.campaign.playerCards[action.card];
			return card?.kind === 'city' ? `${card.search[action.box]!.scope} box` : '';
		}
		case 'transmit':
			return `${cardName(world, action.card)} to ${seatName(world, action.to)}`;
		case 'monitor':
			return `frequency ${action.frequency + 1}`;
		case 'broadcast':
			return `${cityName(action.from)} to ${cityName(action.to)}`;
		case 'buildShelter':
			return action.card ? `discard ${cardName(world, action.card)}` : '';
		case 'administratorMove':
			return `${seatName(world, action.pawn)} to ${seatName(world, action.to)}`;
		case 'sabotage':
			return `${cityName(action.city)}, discard ${cardName(world, action.card)}`;
		case 'broker':
			return `${cardName(world, action.card)} for ${cardName(world, action.take)}`;
		case 'investigate':
			return `${cardName(world, action.card)} for ${cardName(world, action.take)}`;
		case 'facilitate':
			return `${cardName(world, action.card)} from ${seatName(world, action.with)}`;
		case 'run':
			return `discard ${cardName(world, action.card)}`;
		case 'supply':
			return '1 cube from the reserve';
		case 'inoculate':
		case 'destroyInfection':
			return cardName(world, action.card);
		case 'salvage':
			return `discard ${cards(world, action.discard)}, take ${cardName(world, action.take)}`;
		default:
			return '';
	}
}

export function playTarget(play: Play): CityId | null {
	if ('city' in play) return play.city;
	if (play.e === 'airlift') return play.to;
	if (play.e === 'openWaters') return play.b;
	if (play.e === 'safeHouses') return play.cities[0]!;
	return null;
}

/** The choice a play needs before its city, such as which pawn to airlift. Empty when there is none. */
export function playGroup(world: World, play: Play): string {
	if (play.e === 'airlift') return seatName(world, play.pawn);
	if (play.e === 'openWaters') return `from ${cityName(play.a)}`;
	if (play.e === 'resilience') return cards(world, play.cards);
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
			return `Remove one from ${decide.cities.map(cityName).join(', ')}`;
		case 'quarantineCard':
			return `Set aside ${cardName(world, decide.card)}`;
		case 'shield':
			return `${seatName(world, decide.seat)} discards ${cardName(world, decide.card)}`;
		case 'skip':
			return 'Skip';
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
	shield: 'Discard a matching card to keep the cube?',
	cordon: 'Discard any card to stop the rest of this Infect step?',
	intensify: 'An Epidemic struck. Play Resilience now, or pass to reshuffle the discard pile',
};

/** The prompt for a pending choice, naming who and where it concerns. */
export function decisionTitle(world: World, pending: Decision): string {
	if (pending.t === 'shield')
		return `${cityName(pending.city)} just lost a cube. Discard a ${pending.color} City card to put it back?`;
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
