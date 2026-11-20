import {
	createGame,
	newCampaign,
	newTable,
	openBundle,
	pack,
	paddedTrack,
	parseSave,
	readLegacy,
	SEAT_IDS,
	violations,
} from '@repo/game';
import type {
	BundleId,
	CardId,
	Character,
	CharacterId,
	CityId,
	InfectionCard,
	PlayerCard,
	Save,
	SeatId,
	World,
} from '@repo/game';
import { census } from './census';
import { read } from './reading';
import type { CardRead, Reading } from './reading';

/** One fact the import settled: what the table shows, what the game now holds, and how they compare. */
export type ImportRow = {
	topic: string;
	item: string;
	table: string;
	imported: string;
	/**
	 * `same`: the game holds what the table shows. `derived`: worked out from the table, such as rationing from the
	 * calendar. `differs`: the game holds something else, with the reason in `note`. `flag`: needs a person's eye.
	 */
	status: 'same' | 'derived' | 'differs' | 'flag';
	note?: string;
	/** Tabletop Simulator object ids that show it. */
	evidence?: string[];
};

export type Import = { save: Save; rows: ImportRow[] };

/**
 * The bundles our pack opens, in the month the group could have opened them, so no perimeter report forces one the
 * table shows opened by the group. Every region's explorer reward is on the table, so none of them was forced.
 */
const OPENED_BY_MONTH: Record<number, string[]> = {
	1: ['north-america'],
	3: ['south-america'],
	4: ['find-eastern-pacific'],
	5: ['europe'],
	6: ['africa'],
	7: ['middle-east', 'arrive-eastern-pacific', 'forsaken', 'signal-hint'],
};

const SEAT_COLOURS = ['Pink', 'Blue', 'White', 'Red', 'Green', 'Yellow', 'Orange', 'Purple', 'Teal', 'Brown'];

/**
 * Turns a reading of the table into a save that opens in the game's spending step for the month the table stands in.
 * Our Legacy schedule is replayed with the table's calendar, so every unlock our pack holds for those months is in
 * place, and then every fact the table shows replaces what the replay produced. Throws when the table holds
 * something the game cannot represent.
 */
export function importReading(reading: Reading, seed = 1): Import {
	const rows: ImportRow[] = [];
	const row = (entry: ImportRow) => void rows.push(entry);
	const world: World = { campaign: newCampaign(seed), game: null, table: newTable() };
	const { campaign } = world;
	const calendar = reading.calendar;
	const month = calendar.length - 1;
	if (month < 1) throw new Error('The table has not started the campaign yet');
	const current = calendar[month]!;
	if (current.length === 0 || current.at(-1) === undefined)
		throw new Error(`Month ${month} has no result on the calendar`);

	// --- The prologue, then each month the table finished, as the engine would have closed it.
	for (const [index, result] of (calendar[0] ?? []).entries())
		campaign.results.push({
			month: 0,
			attempt: (index + 1) as 1 | 2,
			won: result === 'won',
			gridCities: 0,
			rationing: campaign.rationing,
			characters: [],
		});
	for (let played = 1; played <= month; played++) {
		campaign.month = played;
		campaign.attempt = 1;
		readLegacy(world, 'setup');
		for (const bundle of OPENED_BY_MONTH[played] ?? []) openBundle(world, bundle as BundleId, false);
		const games = calendar[played]!;
		readLegacy(world, 'gameEnd', games[0] === 'won');
		if (played === month) break;
		for (const [index, result] of games.entries()) {
			campaign.results.push({
				month: played,
				attempt: (index + 1) as 1 | 2,
				won: result === 'won',
				gridCities: 0,
				rationing: campaign.rationing,
				characters: [],
			});
			campaign.rationing = Math.max(0, Math.min(10, campaign.rationing + (result === 'won' ? -2 : 2)));
		}
	}
	campaign.month = month;
	campaign.attempt = current.length as 1 | 2;
	campaign.briefing = [];
	campaign.turningPoints = campaign.turningPoints.filter(point => point !== 'firstForsaken');
	row({
		topic: 'Calendar',
		item: 'Games played',
		table: calendar
			.map(
				(games, index) =>
					`${index === 0 ? 'Prologue' : `M${index}`}: ${games.map(game => game[0]!.toUpperCase()).join('')}`,
			)
			.join(', '),
		imported: `${campaign.results.length} games closed, month ${month} attempt ${campaign.attempt} in its spending step`,
		status: 'same',
	});
	row({
		topic: 'Calendar',
		item: 'Rationing',
		table: 'Not on the board (a die beside it reads 1)',
		imported: `${campaign.rationing} now, ${Math.max(0, campaign.rationing + (current.at(-1) === 'won' ? -2 : 2))} once this month closes`,
		status: 'derived',
		note: 'Worked out from the calendar: 4 at the start, 2 less after a win and 2 more after a loss.',
	});

	// --- The map.
	const cityIds = new Set(pack.cities.map(city => city.id as string));
	const asCity = (id: string): CityId => {
		if (!cityIds.has(id)) throw new Error(`The table names a location the game does not have: ${id}`);
		return id as CityId;
	};
	for (const [id, read] of Object.entries(reading.locations)) {
		const city = asCity(id);
		const record = campaign.locations[city]!;
		if (!record.revealed)
			row({
				topic: 'Map',
				item: id,
				table: 'Revealed',
				imported: 'Hidden',
				status: 'differs',
				note: 'Our pack reveals it later',
			});
		const printed = pack.cities.find(entry => entry.id === city)!.population;
		const population = read.population ?? printed;
		if (population !== record.population || read.population !== null)
			row({
				topic: 'Population',
				item: id,
				table: read.population === null ? `${printed} (printed)` : String(read.population),
				imported: String(population),
				status: 'same',
				evidence: read.evidence,
			});
		record.population = population;
		record.infested = read.infested;
		record.permanent = [...read.permanent];
	}
	for (const [id, record] of Object.entries(campaign.locations))
		if (record.revealed && !(id in reading.locations))
			row({
				topic: 'Map',
				item: id,
				table: 'Hidden',
				imported: 'Revealed',
				status: 'flag',
				note: 'Our pack reveals it by now',
			});
	const edgeKey = (a: string, b: string, kind: string) => `${[a, b].toSorted().join('~')}:${kind}`;
	const known = new Set(campaign.edges.map(edge => edgeKey(edge.a, edge.b, edge.kind)));
	const drawable = new Set(
		Object.keys(pack.routeCourses).map(key => {
			const [kind, pair] = key.split(':') as [string, string];
			const [a, b] = pair.split('~') as [string, string];
			return edgeKey(a, b, kind);
		}),
	);
	for (const line of reading.lines) {
		const key = edgeKey(line.a, line.b, line.kind);
		if (!drawable.has(key))
			throw new Error(
				`The table has a ${line.kind} route ${line.a} to ${line.b} that the map has no course for (${line.evidence})`,
			);
		if (known.has(key)) continue;
		known.add(key);
		campaign.edges.push({ a: asCity(line.a), b: asCity(line.b), kind: line.kind });
		row({
			topic: 'Routes',
			item: `${line.a} – ${line.b}`,
			table: `${line.kind} drawn in pen`,
			imported: 'Drawn',
			status: 'same',
			evidence: [line.evidence],
		});
	}
	campaign.names = Object.fromEntries(Object.entries(reading.havenNames).map(([id, name]) => [asCity(id), name]));
	for (const [id, name] of Object.entries(reading.havenNames))
		row({ topic: 'Havens', item: id, table: name, imported: name, status: 'same' });

	// --- Cards. Every card the table holds is rebuilt from what lies on it, so stickers and scratched boxes come along.
	campaign.playerCards = {};
	campaign.infectionCards = {};
	campaign.stored = { player: [], infection: [] };
	let next = 1;
	const add = (read: CardRead, _pile: string): { id: CardId; kind: 'player' | 'infection' } => {
		const face = read.face;
		const id = `${face.t === 'city' || face.t === 'infection' ? face.city : face.t}#${next++}` as CardId;
		switch (face.t) {
			case 'city': {
				const city = asCity(face.city);
				const printed = [...(pack.searches[city] ?? [])];
				const search = face.boxes.map(box => {
					const index = printed.findIndex(entry => entry.scope === box.scope);
					if (index < 0) throw new Error(`${face.city}'s card has a ${box.scope} search box our pack does not`);
					const [def] = printed.splice(index, 1);
					return { scope: box.scope, result: def!.result, scratched: box.scratched };
				});
				const companion = face.boxes.find(box => box.companion)?.companion ?? null;
				const improvement =
					read.improvement && pack.cityImprovements.some(entry => entry.id === read.improvement)
						? read.improvement
						: null;
				campaign.playerCards[id] = {
					id,
					kind: 'city',
					city,
					improvement: improvement as never,
					search,
					companion,
				} satisfies PlayerCard;
				return { id, kind: 'player' };
			}
			case 'infection': {
				const improvement =
					read.improvement && pack.infectionImprovements.some(entry => entry.id === read.improvement)
						? read.improvement
						: null;
				campaign.infectionCards[id] = {
					id,
					kind: 'city',
					city: asCity(face.city),
					improvement: improvement as never,
				} satisfies InfectionCard;
				return { id, kind: 'infection' };
			}
			case 'gather':
				campaign.infectionCards[id] = { id, kind: 'gather' };
				return { id, kind: 'infection' };
			case 'epidemic':
				campaign.playerCards[id] = { id, kind: 'epidemic' };
				return { id, kind: 'player' };
			case 'produce':
				campaign.playerCards[id] = { id, kind: 'produce', boxesLeft: face.boxesLeft };
				return { id, kind: 'player' };
			case 'event':
				campaign.playerCards[id] = { id, kind: 'event', event: face.event, mode: face.mode };
				return { id, kind: 'player' };
			default:
				throw new Error(`A ${face.t} lies among the cards (${read.guid})`);
		}
	};
	const piles = reading.piles;
	const placed = {
		hands: reading.players.map(player => ({
			player,
			cards: player.hand.map(read => add(read, `${player.name}'s hand`).id),
		})),
		playerDeck: piles.playerDeck.map(read => add(read, 'Player deck').id),
		playerDiscard: piles.playerDiscard.map(read => add(read, 'Player discard pile').id),
		infectionDeck: piles.infectionDeck.map(read => add(read, 'Infection deck').id),
		infectionDiscard: piles.infectionDiscard.map(read => add(read, 'Infection discard pile').id),
		forsaken: piles.forsaken.map(read => add(read, 'Forsaken cities').id),
	};
	for (const read of [...piles.offGrid, ...piles.rationedPool, ...piles.pickedEvents, ...piles.spareEpidemics])
		add(read, 'Box or reserve');
	for (const read of piles.stored) {
		const card = add(read, 'Storage');
		campaign.stored[card.kind].push(card.id);
	}
	row({
		topic: 'Cards',
		item: 'Player cards',
		table: String(Object.keys(campaign.playerCards).length),
		imported: String(Object.keys(campaign.playerCards).length),
		status: 'same',
	});
	row({
		topic: 'Cards',
		item: 'Infection cards',
		table: String(Object.keys(campaign.infectionCards).length),
		imported: String(Object.keys(campaign.infectionCards).length),
		status: 'same',
	});
	row({
		topic: 'Cards',
		item: 'In storage',
		table: `${campaign.stored.player.length} Player, ${campaign.stored.infection.length} Infection`,
		imported: `${campaign.stored.player.length} Player, ${campaign.stored.infection.length} Infection`,
		status: 'same',
	});
	const faceName = (read: CardRead): string => {
		const face = read.face;
		if (face.t === 'city') return `${face.city} City card`;
		if (face.t === 'infection') return `${face.city} Infection card${read.improvement ? ` (${read.improvement})` : ''}`;
		if (face.t === 'event') return `${pack.events.find(event => event.id === face.event)?.name ?? face.event} Event`;
		if (face.t === 'produce') return 'Produce Supplies';
		return face.t;
	};
	for (const read of piles.destroyed)
		row({
			topic: 'Destroyed cards',
			item: faceName(read),
			table: 'In the trash',
			imported: 'Not in the game',
			status: 'same',
			evidence: [read.guid],
		});
	row({
		topic: 'Cards',
		item: 'Destroyed',
		table: String(piles.destroyed.length),
		imported: 'Not in the game',
		status: 'same',
	});
	campaign.nextCardId = next;

	// --- Characters. Each keeps its own Character card layout and how far it is scratched.
	campaign.characters = {};
	campaign.characterCards = reading.spareCharacterCards.map(spare => ({
		track: paddedTrack(pack.characterCards[spare.card]!),
		exposure: spare.exposure,
	}));
	const byColour = new Map<string, CharacterId>();
	for (const [index, read] of reading.characters.entries()) {
		const id = `char-${index + 1}` as CharacterId;
		const home = asCity(read.home ?? 'haven-north-atlantic');
		const slots: Character['slots'] = Array.from({ length: pack.numbers.characterSlots }, () => null);
		const stickers = [
			...read.abilities.map(ability => ({ kind: 'ability', id: ability }) as const),
			...read.scars.map(scar => ({ kind: 'scar', id: scar }) as const),
		];
		if (stickers.length > slots.length)
			throw new Error(`${read.name || 'A character'} carries more stickers than slots`);
		stickers.forEach((sticker, slot) => void (slots[slot] = sticker));
		const job = read.job ? pack.jobs.find(entry => entry.id === read.job)!.name : 'no job';
		const name = read.name.trim() || `Unnamed ${job}`;
		campaign.characters[id] = {
			id,
			name,
			job: read.job,
			jobScar: null,
			home,
			portrait: index % pack.numbers.portraits,
			slots,
			exposureTrack: paddedTrack(pack.characterCards[read.card]!),
			exposure: read.exposure,
			dead: false,
			diedAt: null,
			worker: false,
			carrier: false,
			player: null,
		};
		if (read.player) byColour.set(read.player, id);
		row({
			topic: 'Characters',
			item: name,
			table: `${read.player ?? 'parked'}; ${job}; ${[...read.abilities, ...read.scars].join(', ') || 'no stickers'}; card ${read.card}, ${read.exposure} scratched`,
			imported: `${read.job ?? 'no job'}; ${stickers.map(sticker => sticker.id).join(', ') || 'no stickers'}; layout ${paddedTrack(pack.characterCards[read.card]!).join(' ')}; exposure ${read.exposure}; home ${home}`,
			status: read.name.trim() ? 'same' : 'flag',
			note: read.name.trim() ? undefined : 'The card carries no name, so the import names it after its job.',
			evidence: read.evidence,
		});
	}
	row({
		topic: 'Characters',
		item: 'Unused Character cards',
		table: reading.spareCharacterCards.map(spare => `card ${spare.card} (${spare.exposure} scratched)`).join(', '),
		imported: `${campaign.characterCards.length} in the pool, in that order`,
		status: 'same',
	});

	// --- Objectives, turning points, and what is left to buy.
	const triangulated = campaign.opened.includes('signal-hint' as BundleId);
	campaign.objectives = reading.objectives
		.map(entry => entry.objective)
		.filter(id => !(triangulated && id === 'triangulate'));
	row({
		topic: 'Objectives',
		item: 'In play',
		table: reading.objectives.map(entry => entry.objective).join(', '),
		imported: campaign.objectives.join(', '),
		status: triangulated ? 'derived' : 'same',
		note: triangulated ? 'Triangulate was completed this month, which removes it' : undefined,
	});
	row({
		topic: 'Objectives',
		item: 'Required',
		table: 'Not shown',
		imported: String(campaign.required),
		status: 'derived',
		note: 'From our Legacy schedule for the month',
	});
	campaign.turningPoints = [...reading.turningPoints];
	campaign.abilitiesForSale = [...reading.forSale.abilities];
	campaign.scars = [...reading.forSale.scars];
	campaign.cityImprovementsForSale = [...reading.forSale.cityImprovements];
	campaign.infectionImprovementsForSale = [...reading.forSale.infectionImprovements];
	campaign.permanentForSale = [...reading.forSale.permanent];
	for (const [item, table] of Object.entries(reading.forSale))
		row({
			topic: 'Stickers left',
			item,
			table: (table as string[]).join(', ') || 'none',
			imported: (table as string[]).join(', ') || 'none',
			status: 'same',
		});
	const found = new Set(campaign.jobsFound.map(entry => entry.job));
	for (const job of reading.forSale.jobs) {
		const starting = pack.jobs.find(entry => entry.id === job)!.starting;
		row({
			topic: 'Jobs',
			item: job,
			table: 'Sticker unused',
			imported: starting || found.has(job) ? 'Available to a new character' : 'Not available',
			status: starting || found.has(job) ? 'same' : 'differs',
		});
	}
	for (const action of reading.actions)
		if (!campaign.actions.includes(action))
			row({
				topic: 'Actions',
				item: action,
				table: 'Unlocked',
				imported: 'Locked',
				status: 'differs',
				note: 'Our pack unlocks it later',
			});
	for (const rule of reading.rules)
		if (!campaign.rules.includes(rule))
			row({ topic: 'Rules', item: rule, table: 'In force', imported: 'Not yet', status: 'differs' });
	if (reading.stockpileBonus !== campaign.stockpileBonus)
		row({
			topic: 'Supplies',
			item: 'Stockpile bonus',
			table: String(reading.stockpileBonus),
			imported: String(campaign.stockpileBonus),
			status: 'differs',
		});

	// --- The game the table just finished, standing in its spending step.
	const seated = reading.players.filter(player => byColour.has(player.colour));
	seated.sort((a, b) => SEAT_COLOURS.indexOf(a.colour) - SEAT_COLOURS.indexOf(b.colour));
	const seating = seated.map((player, index) => ({
		seat: SEAT_IDS[index]! as SeatId,
		character: byColour.get(player.colour)!,
	}));
	if (seating.length < 2) throw new Error('Fewer than 2 players sit at the table');
	createGame(world, seating);
	const game = world.game!;
	for (const [id, read] of Object.entries(reading.locations)) {
		const location = game.locations[asCity(id)]!;
		Object.assign(location, {
			supplies: read.supplies,
			plague: read.plague,
			hollow: read.hollow,
			center: read.center,
			tower: read.tower,
			shelter: read.shelter,
		});
	}
	for (const { player, cards } of placed.hands) {
		const seat = seating.find(entry => entry.character === byColour.get(player.colour))?.seat;
		if (!seat) continue;
		game.players[seat]!.hand = cards;
		if (player.at) game.players[seat]!.location = asCity(player.at);
	}
	const epidemics = placed.playerDeck.filter(id => campaign.playerCards[id]!.kind === 'epidemic').length;
	game.playerDeck = {
		order: placed.playerDeck,
		piles: placed.playerDeck.length ? [{ size: placed.playerDeck.length, epidemics }] : [],
	};
	game.playerDiscard = placed.playerDiscard;
	game.infectionDeck = {
		order: placed.infectionDeck,
		strata: placed.infectionDeck.length ? [placed.infectionDeck.toSorted()] : [],
	};
	game.infectionDiscard = placed.infectionDiscard;
	game.gameEndArea = placed.forsaken;
	game.stockpile = reading.pools.stockpile;
	game.reserve = reading.pools.reserve;
	game.pieces = {
		center: reading.pools.centers,
		tower: reading.pools.towers,
		shelter: reading.pools.shelters,
		hollow: reading.pools.hollow,
	};
	game.rateIndex = reading.tracks.infectionRate;
	game.incidents = reading.tracks.incidents;
	game.turn = 1;
	const units = Number(/(\d+) points? left/i.exec(reading.notes.join('\n'))?.[1] ?? 0);
	game.outcome = { won: current.at(-1) === 'won', reason: 'Imported from the table' };
	game.upkeep = { units, populationChanges: [] };
	row({
		topic: 'Spending step',
		item: 'Units left',
		table: reading.notes.find(note => /points? left/i.test(note)) ?? 'No note',
		imported: String(units),
		status: 'derived',
	});
	row({
		topic: 'Supplies',
		item: 'Pools',
		table: `stockpile ${reading.pools.stockpile}, reserve ${reading.pools.reserve}`,
		imported: `stockpile ${game.stockpile}, reserve ${game.reserve}`,
		status: 'same',
		note: 'Next game sets both from the supply track',
	});
	for (const problem of reading.problems)
		row({ topic: 'Reader', item: 'Unsettled', table: problem, imported: 'Left out', status: 'flag' });

	const save = parseSave({ v: 1, phase: 'upkeep', world: structuredClone(world) });
	const broken = violations(save.world, new Map()).filter(problem => !problem.startsWith('cubes leaked'));
	if (broken.length) throw new Error(`The imported game breaks the rules: ${broken.join('; ')}`);
	return { save, rows };
}

/** Whether a parsed JSON file is a Tabletop Simulator save rather than one of the game's own. */
export const isTabletopSave = (raw: unknown): boolean =>
	typeof raw === 'object' && raw !== null && Array.isArray((raw as { ObjectStates?: unknown }).ObjectStates);

/** Reads a Tabletop Simulator save and imports it. */
export function importTabletop(raw: unknown, seed = 1): Import & { name: string; date: string } {
	const reading = read(census(raw));
	return { ...importReading(reading, seed), name: reading.save.name, date: reading.save.date };
}
