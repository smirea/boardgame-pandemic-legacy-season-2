import {
	briefingSections,
	characterAt,
	checkEdge,
	cityDef,
	crossesEdge,
	crossesUnexplored,
	grid,
	handLimit,
	insights,
	isForsaken,
	neighbours,
	pack,
	score,
} from '@repo/game';
import type { CardId, CityId, Decision, LogEntry, PublicState, SeatId, World } from '@repo/game';
import type { Option, Who } from './commands.ts';
import { flavorFor } from './flavor.ts';
import { cardName, characterLine, cityName, enc, monthName, seatName } from './names.ts';

const pct = (value: number) => `${Math.round(value * 100)}%`;

const objectiveDef = (id: string) => pack.objectives.find(objective => objective.id === id)!;

export function renderObjectives(world: World): string[] {
	const { campaign, game } = world;
	const lines = [`Objectives: complete ${campaign.required} to win, every one marked * included`];
	for (const id of campaign.objectives) {
		const def = objectiveDef(id);
		const done = game?.completed.includes(id);
		const waived = game?.waived.includes(id);
		const progress = game?.progress[id] ?? campaign.carriedProgress[id] ?? 0;
		lines.push(
			`  [${done ? 'x' : waived ? '-' : ' '}] ${def.mandatory ? '*' : ' '}${def.name} (${id}) ${progress}/${def.target}: ${def.rule}${waived ? ' (waived)' : ''}`,
		);
	}
	// An objective that leaves play the moment it is completed still counts toward this game's win.
	for (const id of game?.completed ?? []) {
		if (campaign.objectives.includes(id)) continue;
		lines.push(`  [x]  ${objectiveDef(id).name} (${id}): done this game and counted. It has now left play for good.`);
	}
	return lines;
}

function pendingLine(world: World, pending: Decision): string {
	const who = 'seat' in pending && pending.seat ? seatName(world, pending.seat) : 'anyone';
	switch (pending.t) {
		case 'discard':
			return `${who} must discard ${pending.count} card(s)`;
		case 'scar':
			return `${who} must take a scar (the group picks the character when no one is named)`;
		case 'replace':
			return `${who} lost their character and must pick a replacement`;
		case 'retrieve':
			return `${who} may take a ${pending.filter === 'city' ? 'City ' : ''}card from the Player discard pile`;
		case 'freeEdge':
			return `${who} may draw a free ${pending.kind === 'land' ? 'supply line' : 'sea lane'} from their location`;
		case 'removeHollow':
			return `${who} may remove up to ${pending.amount} Hollow Men`;
		case 'quarantineCard':
			return `${who} may set aside an Infection card from the discard pile`;
		case 'intensify':
			return 'An Epidemic just struck and its discard pile is about to be reshuffled onto the deck. A player holding Resilience or Mass Inoculation may play it now. Otherwise the active player passes with `do decide:skip`';
		case 'epidemicDrawn':
			return 'An Epidemic was just drawn and has not struck yet. A player holding Antidote may play it now to discard the Epidemic with no effect. Otherwise the active player passes with `do decide:skip` and it strikes';
		case 'cordon':
			return 'Cordon: any player may discard a card to end this Infect step now, or the active player skips';
		case 'shield':
			return `Shield: any player may discard a ${pending.color} City card to save the cubes in ${cityName(world, pending.city)}, or skip`;
	}
}

function handLine(world: World, seat: SeatId): string {
	const hand = world.game!.players[seat]!.hand;
	return hand.length ? hand.map(id => `${enc(id)} [${cardName(world, id)}]`).join(', ') : 'empty';
}

function playerLines(world: World, who: Who | null): string[] {
	const game = world.game!;
	return game.seats.map(seat => {
		const player = game.players[seat]!;
		const character = world.campaign.characters[player.character]!;
		const job = pack.jobs.find(job => job.id === character.job);
		const slots = character.slots.flatMap(slot => (slot ? [slot.id] : []));
		const tags = [
			seat === game.active ? 'ACTIVE' : null,
			who?.seat === seat ? 'YOU' : null,
			character.carrier ? 'carrier' : null,
		].filter(Boolean);
		return [
			`  ${character.name} [${seat}]${tags.length ? ` <${tags.join(', ')}>` : ''} · ${job && !character.jobScar ? job.name : 'no job'}${slots.length ? ` + ${slots.join(', ')}` : ''} · at ${cityName(world, player.location)} (${player.location}) · carrying ${player.supplies} cubes · exposure ${character.exposure}/${character.exposureTrack.length} · hand ${player.hand.length}/${handLimit(world, seat)}`,
			`      ${handLine(world, seat)}`,
		].join('\n');
	});
}

function troubleLines(world: World): string[] {
	const game = world.game!;
	const found = insights(world);
	const odds = found?.infection.odds ?? ({} as Record<CityId, number>);
	const onGrid = grid(world.campaign);
	const rows: { city: CityId; weight: number; text: string }[] = [];
	for (const city of onGrid) {
		const location = game.locations[city]!;
		if (cityDef(city).kind !== 'city' || isForsaken(world.campaign, city)) continue;
		const chance = odds[city] ?? 0;
		if (location.supplies > 0 && location.plague === 0 && location.hollow === 0) continue;
		const parts = [
			`cubes ${location.supplies}`,
			location.plague ? `PLAGUE ${location.plague}` : null,
			location.hollow ? `hollow men ${location.hollow}` : null,
			location.shelter ? 'shelter' : null,
			`${pct(chance)} hit next infect`,
		].filter(Boolean);
		rows.push({
			city,
			weight:
				chance * (location.supplies === 0 ? 2 : 1) +
				location.plague +
				location.hollow * 0.2 +
				(location.supplies === 0 ? 0.5 : 0),
			text: `  ${cityName(world, city)} (${city}): ${parts.join(', ')}`,
		});
	}
	rows.sort((a, b) => b.weight - a.weight);
	return rows.length
		? ['Trouble spots (no cubes, plague, or Hollow Men), worst first:', ...rows.slice(0, 22).map(row => row.text)]
		: [];
}

const SEARCH_FINDS: Record<string, string> = {
	supplies: 'supply cubes, placed on the city',
	stockpile: 'cubes for the stockpile',
	actions: 'extra actions this turn',
	retrieve: 'a card to take from the Player discard pile (a choice follows)',
	quarantineCard: 'the chance to set an Infection card aside until game end (a choice follows)',
	removeHollow: 'the chance to remove Hollow Men (a choice follows)',
	freeEdge: 'a free supply line or sea lane from here (a choice follows)',
	discover: 'a lead (the next line says what it opened, or that it was already followed)',
	companion: 'a companion, who joins your hand',
	infest: 'an infestation: this city now exposes whoever starts a turn in it',
	nothing: 'nothing',
};

export function renderLog(world: World, entry: LogEntry): string {
	const seat = (id: SeatId) => characterAt(world, id, entry.seq)?.name ?? seatName(world, id);
	const city = (id: CityId) => cityName(world, id);
	switch (entry.t) {
		case 'turn':
			return `-- turn: ${seat(entry.seat)}`;
		case 'action':
			return `${seat(entry.seat)}: ${entry.action}${entry.detail ? ` (${entry.detail})` : ''}`;
		case 'move':
			return `${seat(entry.seat)} moved ${city(entry.from)} -> ${city(entry.to)} by ${entry.by}`;
		case 'draw':
			return `${seat(entry.seat)} drew [${cardName(world, entry.card)}]`;
		case 'epidemic':
			return `EPIDEMIC${entry.city ? ` in ${city(entry.city)}` : ''}: ${entry.removed} cubes removed, infection rate now ${entry.rate}`;
		case 'infect': {
			const card = world.campaign.infectionCards[entry.card];
			const improved =
				card?.kind === 'city' && card.improvement
					? pack.infectionImprovements.find(item => item.id === card.improvement)?.name
					: null;
			return `infect ${city(entry.city)}: ${entry.effect}${entry.effect === 'blocked' && improved ? ` by its ${improved} card` : improved ? ` (a ${improved} card)` : ''}`;
		}
		case 'outbreak':
			return `OUTBREAK in ${city(entry.city)}`;
		case 'incident':
			return `incident in ${city(entry.city)} (total ${entry.total})`;
		case 'exposure':
			return `${seat(entry.seat)} was exposed: ${{ empty: 'a blank box, nothing happens', scar: 'a scar', skull: 'death', worker: 'sent home with an empty hand (a haven worker has no exposure track)' }[entry.result]}`;
		case 'death':
			return `${seat(entry.seat)}'s character died in ${city(entry.at)}`;
		case 'event':
			return `${seat(entry.seat)} played ${entry.event}${entry.detail ? ` (${entry.detail})` : ''}`;
		case 'edge':
			return `new ${entry.kind === 'land' ? 'supply line' : 'sea lane'}: ${city(entry.a)} - ${city(entry.b)}`;
		case 'connected':
			return `${city(entry.city)} joined the grid`;
		case 'structure':
			return `${entry.structure} built in ${city(entry.city)}`;
		case 'reveal':
			return `REGION REVEALED: ${entry.region}`;
		case 'unlock':
			return `UNLOCKED: ${pack.bundles.find(bundle => bundle.id === entry.bundle)?.name ?? entry.bundle}${entry.forced ? ' (forced by a perimeter report)' : ''}`;
		case 'objective':
			return `OBJECTIVE COMPLETE: ${objectiveDef(entry.objective).name}`;
		case 'search':
			return `${seat(entry.seat)} searched ${city(entry.city)} and found: ${SEARCH_FINDS[entry.result]}`;
		case 'note':
			return entry.text;
		case 'end':
			return `GAME OVER: ${entry.won ? 'WON' : 'LOST'} (${entry.reason})`;
	}
}

export function renderHeader(state: PublicState): string {
	const { campaign, game } = state.world;
	const month = `${monthName(campaign.month)}, ${campaign.attempt === 1 ? 'first' : 'second'} attempt`;
	return `== ${month} · phase ${state.phase}${game ? ` · turn ${game.turn}` : ''} · rationing ${campaign.rationing} ==`;
}

export function renderLobby(state: PublicState, picks: { name: string; character: string | null }[]): string[] {
	const { world } = state;
	const { campaign } = world;
	const lines = ['Characters in the campaign:'];
	const ids = Object.keys(campaign.characters) as (keyof typeof campaign.characters)[];
	if (!ids.length) lines.push('  none yet');
	for (const id of ids) lines.push(`  ${characterLine(world, id)}`);
	const taken = new Set(Object.values(campaign.characters).map(character => character.job));
	const free = pack.jobs.filter(job => job.starting && !taken.has(job.id));
	const found = campaign.jobsFound.filter(found => !taken.has(found.job));
	if (free.length) {
		lines.push('Jobs open to a new character (create <job> <haven-id> <name>):');
		for (const job of free) lines.push(`  ${job.id}: ${job.text}`);
	}
	if (found.length) lines.push(`Jobs found during the campaign: ${found.map(job => job.job).join(', ')}`);
	const havens = pack.cities.filter(
		city => city.kind === 'haven' && campaign.locations[city.id]?.revealed && !city.lost,
	);
	lines.push(`Starting havens: ${havens.map(city => `${city.id} (${cityName(world, city.id)})`).join(', ')}`);
	lines.push(
		`Seats for this game: ${picks.map(pick => `${pick.name} -> ${pick.character ?? 'NOT PICKED'}`).join(' · ')}`,
	);
	lines.push(
		`Past games: ${campaign.results.map(result => `${monthName(result.month).slice(0, 3)}${result.attempt === 2 ? '(2)' : ''} ${result.won ? 'W' : 'L'}`).join(', ') || 'none'}`,
	);
	return lines;
}

function renderSetup(state: PublicState): string[] {
	const { world, phase } = state;
	const { campaign } = world;
	const game = world.game!;
	if (phase === 'setup.supply') {
		const found = insights(world);
		const free = campaign.freeAbilityUnits;
		const lines = [
			...(free
				? [
						`FREE ABILITY UNITS: ${free} to spend on character abilities right now (\`options buy\`). An ability bought now is permanent, like any other, and is in play this game.`,
					]
				: []),
			`Supply setup: ${game.stockpile} cubes left to place. Cities with no cubes take a Plague cube when infected.`,
			'Place by hand with `supply <city-id> <count>`: a number adds, a negative number takes back, `=2` sets the city to exactly 2. `do autosupply` spreads the rest. Then `do confirm-supply`, which cannot be undone.',
			`Grid cities (cubes now, population, chance to lose a cube in the opening infection${campaign.rules.includes('hollowSetup') ? '. The last 3 of the 9 flips place a Hollow Man and take no cube' : ''}):`,
		];
		for (const city of grid(campaign)) {
			if (cityDef(city).kind !== 'city') continue;
			lines.push(
				`  ${city}: cubes ${game.locations[city]!.supplies}, pop ${campaign.locations[city]!.population}, ${pct(found?.infection.odds[city] ?? 0)}`,
			);
		}
		return lines;
	}
	const reserve = Object.values(campaign.playerCards).filter(
		card => card.kind === 'event' && card.mode === 'rationed' && !campaign.stored.player.includes(card.id),
	);
	const count = Math.min(campaign.rationing, reserve.length);
	return [
		`Event setup: pick ${count} Rationed Events for the Player deck with \`events <card> <card> ...\`, then \`do confirm-events\`.`,
		`Picked now: ${game.pickedEvents.map(enc).join(' ') || 'none'}`,
		'Reserve:',
		...reserve.map(card => {
			const def = card.kind === 'event' ? pack.events.find(event => event.id === card.event) : null;
			return `  ${enc(card.id)}: ${def?.name}: ${def?.text}`;
		}),
	];
}

function renderUpkeep(state: PublicState): string[] {
	const { world } = state;
	const game = world.game!;
	const upkeep = game.upkeep;
	const lines = [`Game end: ${game.outcome?.won ? 'WON' : 'LOST'} (${game.outcome?.reason ?? ''}).`];
	if (!upkeep) {
		lines.push(
			'The lead opens the game-end step with `do continue`. Population changes and production units are worked out then.',
		);
		return lines;
	}
	lines.push(
		`Production units to spend: ${upkeep.units}${world.campaign.freeAbilityUnits ? ` (+${world.campaign.freeAbilityUnits} free units for abilities)` : ''}. Unspent units are lost.`,
	);
	if (upkeep?.populationChanges.length)
		lines.push(
			`Population changes: ${upkeep.populationChanges.map(change => `${cityName(world, change.city)} ${change.delta > 0 ? '+' : ''}${change.delta}`).join(', ')}`,
		);
	const held = (Object.keys(game.locations) as CityId[]).filter(id => {
		const location = game.locations[id]!;
		const lost = upkeep.populationChanges.some(change => change.city === id && change.delta < 0);
		return (location.plague > 0 || location.hollow > 0) && !lost;
	});
	if (held.length)
		lines.push(
			`Plague or Hollow Men but no population lost: ${held
				.map(id => {
					const location = game.locations[id]!;
					const why = location.shelter
						? 'shelter'
						: location.center
							? 'its supply center gained the 1 back'
							: 'already at 0';
					return `${cityName(world, id)} (${why})`;
				})
				.join(', ')}. A city loses at most 1 a game, however many cubes or figures it holds.`,
		);
	const shop = world.campaign;
	const costly = [
		...[...new Set(shop.abilitiesForSale)].map(id => ({
			...pack.abilities.find(entry => entry.id === id)!,
			free: shop.freeAbilityUnits,
		})),
		...[...new Set(shop.cityImprovementsForSale)].map(id => ({
			...pack.cityImprovements.find(entry => entry.id === id)!,
			free: 0,
		})),
		...[...new Set(shop.infectionImprovementsForSale)].map(id => ({
			...pack.infectionImprovements.find(entry => entry.id === id)!,
			free: 0,
		})),
	].filter(item => item.cost > upkeep.units + item.free);
	if (costly.length)
		lines.push(
			`For sale but beyond the units left, so not in \`options buy\`: ${costly.map(item => `${item.name} (${item.cost})`).join(', ')}.`,
		);
	lines.push(
		'The lead buys with `do buy:...` (see `options`) and ends with `do finish-upkeep`. Everyone else advises with `say`.',
	);
	return lines;
}

/** The whole situation in one screen of text, written for the player it is shown to. */
export function renderStatus(state: PublicState, who: Who | null): string {
	const { world, phase } = state;
	const { campaign, game } = world;
	const lines = [renderHeader(state)];
	if (campaign.briefing.length) {
		lines.push('LEGACY BRIEFING (new this game, the lead acknowledges with `do ack`):');
		for (const section of briefingSections(campaign.briefing)) {
			if (section.t === 'group') {
				lines.push(`  ${section.heading}:`, ...section.items.map(item => `    * ${item.text}`));
				continue;
			}
			lines.push(`  * ${section.title}${section.text ? `: ${section.text}` : ''}`);
			const flavor = flavorFor(section.title);
			if (flavor) lines.push(`      "${flavor}"`);
		}
	}
	if (phase === 'finished') {
		const total = score(campaign);
		lines.push(`The campaign is over. Score: ${JSON.stringify(total)}`);
		return lines.join('\n');
	}
	if (!game) return lines.join('\n');
	lines.push(...renderObjectives(world));
	if (phase.startsWith('setup')) lines.push(...renderSetup(state));
	if (phase === 'upkeep' || phase === 'over') lines.push(...renderUpkeep(state));
	const found = insights(world);
	if (found && phase.startsWith('playing')) {
		const deck = found.playerDeck;
		lines.push(
			`Threat: incidents ${game.incidents}/${pack.numbers.incidentLimit} · infection rate ${found.infection.rate} (track ${pack.numbers.infectionRates.map((rate, index) => (index === game.rateIndex ? `[${rate}]` : rate)).join(' ')}; each epidemic moves one step right) · epidemics ${deck.epidemicsDrawn} drawn, ${deck.epidemicsLeft} left · ${pct(deck.epidemicNextDraw)} chance of one in the next draw`,
			`Decks: Player deck ${deck.cards} cards (${deck.turnsLeft} turns; the game is lost when it cannot be drawn) · Infection deck ${found.infection.deck}, discard ${game.infectionDiscard.length} · stockpile ${game.stockpile} cubes, reserve ${game.reserve}`,
			`Pieces left: supply centers ${game.pieces.center}, towers ${game.pieces.tower}, shelters ${game.pieces.shelter}, Hollow Men ${game.pieces.hollow}`,
		);
		const pile = game.playerDeck.piles.find(entry => entry.size > 0);
		if (pile)
			lines.push(
				game.epidemics === 0 && game.playerDeck.piles.every(entry => entry.epidemics === 0)
					? 'Epidemics: this Player deck holds none.'
					: `Epidemics: the Player deck is stacked in equal piles with one epidemic shuffled into each. The pile being drawn has ${pile.size} card(s) left and ${pile.epidemics ? 'still holds its epidemic' : 'has already given up its epidemic'}.`,
			);
		const active = seatName(world, game.active);
		const step =
			phase === 'playing.actions'
				? `${game.actionsLeft} action(s) left`
				: phase === 'playing.draw'
					? `${game.drawsLeft} card(s) to draw`
					: `${game.infectionsLeft} Infection card(s) to flip`;
		lines.push(`Turn: ${active} · ${step}`);
	}
	for (const pending of game.pending.slice(0, 1)) lines.push(`PENDING CHOICE: ${pendingLine(world, pending)}`);
	lines.push('Players:', ...playerLines(world, who));
	const special = game.seats.flatMap(seat =>
		game.players[seat]!.hand.flatMap(id => {
			const card = campaign.playerCards[id]!;
			const def =
				card.kind === 'event'
					? pack.events.find(entry => entry.id === card.event)
					: card.kind === 'companion'
						? pack.companions.find(entry => entry.id === card.companion)
						: null;
			return def ? [`  ${enc(id)} (${seatName(world, seat)}): ${def.name}. ${def.text}`] : [];
		}),
	);
	const traits = game.seats.flatMap(seat => {
		const character = campaign.characters[game.players[seat]!.character]!;
		const job = pack.jobs.find(entry => entry.id === character.job);
		const held = character.slots.flatMap(slot => {
			if (!slot) return [];
			const def =
				slot.kind === 'ability'
					? pack.abilities.find(entry => entry.id === slot.id)
					: pack.scars.find(entry => entry.id === slot.id);
			return def ? [`${slot.kind} ${def.name}: ${def.text}`] : [];
		});
		const parts = [job && !character.jobScar ? `${job.name}: ${job.text}` : null, ...held].filter(Boolean);
		return parts.length ? [`  ${character.name}: ${parts.join(' · ')}`] : [];
	});
	if (traits.length) lines.push('Jobs, abilities and scars (passive ones never show in `options`):', ...traits);
	if (special.length)
		lines.push(
			'Events and companions in hands (played with `play:` keys, at any time, when they have a legal target):',
			...special,
		);
	if (phase.startsWith('playing')) lines.push(...troubleLines(world));
	return lines.join('\n');
}

/** Every revealed location, by region, with what stands on it and where its lines go. */
export function renderBoard(world: World): string {
	const { campaign, game } = world;
	const onGrid = grid(campaign);
	const found = game ? insights(world) : null;
	const lines: string[] = [];
	const pawns = new Map<CityId, string[]>();
	for (const seat of game?.seats ?? []) {
		const at = game!.players[seat]!.location;
		pawns.set(at, [...(pawns.get(at) ?? []), seatName(world, seat)]);
	}
	for (const region of pack.regions) {
		const cities = pack.cities.filter(city => city.region === region.id && campaign.locations[city.id]?.revealed);
		if (!cities.length) continue;
		lines.push(`${region.name}:`);
		for (const city of cities) {
			const record = campaign.locations[city.id]!;
			const location = game?.locations[city.id];
			const links = campaign.edges.flatMap(edge => {
				const other = edge.a === city.id ? edge.b : edge.b === city.id ? edge.a : null;
				return other ? [`${other}${edge.kind === 'sea' ? '~' : ''}`] : [];
			});
			const structures = [
				location?.center ? `center${record.permanent.includes('center') ? '(permanent)' : ''}` : null,
				location?.tower ? `tower${record.permanent.includes('tower') ? '(permanent)' : ''}` : null,
				location?.shelter ? `shelter${record.permanent.includes('shelter') ? '(permanent)' : ''}` : null,
				// Between games nothing stands on the board, but what was made permanent will be there next game.
				...(location ? [] : record.permanent.map(structure => `permanent ${structure}`)),
				record.lab ? 'lab' : null,
			].filter(Boolean);
			const routes = pack.reconRoutes.filter(
				route => route.city === city.id && campaign.routes.includes(route.id) && !campaign.opened.includes(route.opens),
			);
			const parts = [
				city.kind === 'haven' ? 'haven' : `${city.color} pop ${record.population}`,
				city.port ? 'port' : null,
				onGrid.has(city.id) ? null : 'OFF GRID',
				isForsaken(campaign, city.id) ? 'FORSAKEN' : null,
				record.infested ? 'infested' : null,
				location ? `cubes ${location.supplies}` : null,
				location?.plague ? `PLAGUE ${location.plague}` : null,
				location?.hollow ? `hollow men ${location.hollow}` : null,
				...structures,
				pawns.has(city.id) ? `pawns: ${pawns.get(city.id)!.join(', ')}` : null,
				found && onGrid.has(city.id) && city.kind === 'city'
					? `${pct(found.infection.odds[city.id] ?? 0)} next infect`
					: null,
				...routes.map(
					route =>
						`RECON here: ${route.count} ${route.color} cards${route.unique ? ' of different cities' : ''}${route.needsCenter ? (location?.center ? ', and its supply center is built' : ', needs a supply center') : ''} (before any ability changes the count: see options for what you can pay)`,
				),
			].filter(Boolean);
			lines.push(
				`  ${city.id} "${cityName(world, city.id)}" · ${parts.join(' · ')}${links.length ? ` · links: ${links.join(' ')}` : ''}`,
			);
		}
	}
	const reachable = pack.candidateEdges.filter(edge => {
		const a = campaign.locations[edge.a]?.revealed;
		const b = campaign.locations[edge.b]?.revealed;
		return a && b && onGrid.has(edge.a) !== onGrid.has(edge.b);
	});
	if (reachable.length) {
		lines.push(
			'New connections that would join a city to the grid (~ is a sea lane). A line is drawn from the end that is on the grid:',
		);
		for (const edge of reachable) {
			const [from, to] = onGrid.has(edge.a) ? [edge.a, edge.b] : [edge.b, edge.a];
			const note = linkNote(campaign, from, to, edge.kind);
			lines.push(`  ${from} ${edge.kind === 'sea' ? '~' : '-'} ${to}${note ? `   (${note.slice(2)})` : ''}`);
		}
	}
	return lines.join('\n');
}

/**
 * Why a link cannot be drawn, with what the map itself forbids named first: being off the grid is
 * curable, and saying only that would hide a line that can never be drawn.
 */
function linkNote(campaign: World['campaign'], a: CityId, b: CityId, kind: 'land' | 'sea'): string {
	const onGrid = grid(campaign);
	const [from, to] = onGrid.has(a) || !onGrid.has(b) ? [a, b] : [b, a];
	const fixed = crossesUnexplored(campaign, a, b, kind)
		? 'It would cross unexplored map'
		: crossesEdge(campaign, a, b, kind)
			? `It would cross another ${kind === 'land' ? 'supply line' : 'sea lane'}`
			: null;
	const reason = fixed ?? checkEdge(campaign, from, to, kind);
	if (!reason)
		return isForsaken(campaign, from) ? `, not now: ${from} is forsaken, and only Drive or Ferry works there` : '';
	return `, not now: ${reason}`;
}

export function renderOptions(options: Option[], filter?: string, hints: string[] = []): string {
	const shown = filter
		? options.filter(option => option.key.includes(filter) || option.group.includes(filter))
		: options;
	if (!shown.length)
		return [filter ? `No option matches "${filter}".` : 'Nothing to send with `do` right now.', ...hints].join('\n');
	const groups = new Map<string, Option[]>();
	for (const option of shown) groups.set(option.group, [...(groups.get(option.group) ?? []), option]);
	const lines: string[] = [];
	for (const [group, list] of groups) {
		const cost = list[0]!.cost;
		const uniform = list.every(option => option.cost === cost);
		lines.push(`${group}${cost === undefined || !uniform ? '' : ` (cost ${cost})`}:`);
		for (const option of list) {
			const price = uniform || option.cost === undefined ? '' : `cost ${option.cost} · `;
			lines.push(`  ${option.key}${option.desc || price ? `   # ${price}${option.desc}` : ''}`);
		}
	}
	return [...lines, ...hints].join('\n');
}

export function renderCity(world: World, id: CityId): string {
	const { campaign, game } = world;
	const def = cityDef(id);
	const record = campaign.locations[id]!;
	const location = game?.locations[id];
	const cards = Object.values(campaign.playerCards).filter(card => card.kind === 'city' && card.city === id);
	const infection = Object.values(campaign.infectionCards).filter(card => card.kind === 'city' && card.city === id);
	const where = (card: CardId) => {
		if (!game) return 'box';
		if (game.turn === 0) return 'not dealt yet';
		if (game.playerDeck.order.includes(card)) return 'deck';
		if (game.playerDiscard.includes(card)) return 'discard';
		const holder = game.seats.find(seat => game.players[seat]!.hand.includes(card));
		return holder ? `hand of ${seatName(world, holder)}` : 'out of play';
	};
	return [
		`${cityName(world, id)} (${id}) · ${def.kind} · ${def.color ?? 'no colour'} · region ${def.region}${def.port ? ' · port' : ''}`,
		`population ${record.population} · revealed ${record.revealed} · on grid ${grid(campaign).has(id)} · infested ${record.infested} · permanent ${record.permanent.join(', ') || 'none'}${record.lab ? ' · lab' : ''}`,
		location
			? `cubes ${location.supplies} · plague ${location.plague} · hollow men ${location.hollow} · center ${location.center} · tower ${location.tower} · shelter ${location.shelter}`
			: '',
		`links: ${neighbours(campaign, id).join(', ') || 'none'}`,
		...pack.reconRoutes
			.filter(
				route => route.city === id && campaign.routes.includes(route.id) && !campaign.opened.includes(route.opens),
			)
			.map(
				route =>
					`RECON here: ${route.count} ${route.color} cards${route.unique ? ' of different cities' : ''}${route.needsCenter ? (location?.center ? ', and its supply center is built' : ', needs a supply center') : ''} (before any ability changes the count: see options for what you can pay)`,
			),
		`possible new links: ${
			pack.candidateEdges
				.flatMap(edge => (edge.a === id ? [edge] : edge.b === id ? [{ ...edge, b: edge.a }] : []))
				.filter(edge => !neighbours(campaign, id).includes(edge.b) && campaign.locations[edge.b]?.revealed)
				.map(edge => `${edge.b}(${edge.kind}${linkNote(campaign, id, edge.b, edge.kind)})`)
				.join(', ') || 'none'
		}`,
		`Player cards: ${cards.map(card => `${enc(card.id)} in ${where(card.id)}${card.kind === 'city' && card.improvement ? ` +${card.improvement}` : ''}`).join(', ') || 'none'}`,
		`Infection cards: ${infection.length} (${infection.filter(card => game?.infectionDiscard.includes(card.id)).length} in the discard pile)`,
		...[...cards, ...infection].flatMap(card => {
			const id = card.kind === 'city' ? card.improvement : null;
			const def = id ? [...pack.cityImprovements, ...pack.infectionImprovements].find(entry => entry.id === id) : null;
			return def ? [`improved card ${enc(card.id)}: ${def.name}. ${def.text}`] : [];
		}),
	]
		.filter(Boolean)
		.join('\n');
}

export function renderDecks(world: World): string {
	const game = world.game;
	const found = insights(world);
	if (!game || !found) return 'No game in progress.';
	const lines = [
		`Player deck: ${found.playerDeck.cards} cards · by kind ${JSON.stringify(found.playerDeck.byKind)}`,
		`Player discard (${game.playerDiscard.length}): ${game.playerDiscard.map(id => `${enc(id)} [${cardName(world, id)}]`).join(', ') || 'empty'}`,
		`Infection discard (${game.infectionDiscard.length}): ${game.infectionDiscard.map(id => `${enc(id)} [${cardName(world, id)}]`).join(', ') || 'empty'}`,
		`Game End area (${game.gameEndArea.length}; cards out of this game: set aside by Resilience or a search, or of cities that joined the grid this game): ${game.gameEndArea.map(id => cardName(world, id)).join(', ') || 'empty'}`,
		`Storage (inoculated cards, out of the decks${world.campaign.rules.includes('epidemicFromStorage') ? '. With the September rule in play, each Epidemic pulls one stored Infection card back out, strikes its city, and returns the card to the deck' : ' for the rest of the year unless a later rule brings them back'}): ${world.campaign.stored.player.length} Player, ${world.campaign.stored.infection.length} Infection${world.campaign.stored.infection.length ? `: ${world.campaign.stored.infection.map(id => cardName(world, id)).join(', ')}` : ''}`,
		'Infection deck layers, top first (cards known to be in each layer):',
	];
	for (const layer of found.infection.strata)
		lines.push(
			`  ${layer.size} cards: ${Object.entries(layer.cities)
				.map(([city, count]) => `${city}${count > 1 ? `x${count}` : ''}`)
				.join(', ')}`,
		);
	return lines.join('\n');
}
