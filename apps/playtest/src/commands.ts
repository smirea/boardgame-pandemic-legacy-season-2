import {
	actionCost,
	legalActions,
	legalDecides,
	legalPlays,
	legalPurchases,
	pack,
	purchaseCost,
	reject,
} from '@repo/game';
import type {
	CardId,
	CharacterId,
	CityId,
	Command,
	JobId,
	ObjectiveId,
	PublicState,
	Purchase,
	SeatId,
} from '@repo/game';
import { enc, human, isCity } from './names.ts';

/** One player at the table, as the lab sees them. Seats follow the order of the config. */
export type Who = { index: number; id: string; name: string; seat: SeatId; lead: boolean };

export type Option = { key: string; group: string; desc: string; command: Command; cost?: number };

export const seatOf = (index: number) => `seat-${index + 1}` as SeatId;

const part = (value: unknown): string => (Array.isArray(value) ? value.map(part).join('+') : enc(String(value)));

function keyOf(prefix: string, object: object, tag: string) {
	const parts = Object.entries(object)
		.filter(([name]) => name !== tag)
		.map(([, value]) => part(value));
	return [prefix, ...parts].join(':');
}

function describe(state: PublicState, object: object, tag: string) {
	return Object.entries(object)
		.filter(([name]) => name !== tag)
		.map(([name, value]) => `${name}=${human(state.world, value)}`)
		.join(' ');
}

/** Whether the pending choice is this player's to answer. A choice with no owner is anyone's. */
function ownsPending(state: PublicState, who: Who): boolean {
	const pending = state.world.game?.pending[0];
	if (!pending) return false;
	return !('seat' in pending) || pending.seat === null || pending.seat === who.seat;
}

/**
 * Every command this player may send right now, each under a stable key. Setup and game-end
 * commands belong to the lead so three players do not race each other.
 */
export function optionsFor(state: PublicState, who: Who, seating: (CharacterId | null)[]): Option[] {
	const { world, phase } = state;
	const { campaign, game } = world;
	const options: Option[] = [];
	const seen = new Set<string>();
	const add = (key: string, group: string, desc: string, command: Command, cost?: number) => {
		// The engine lists some moves twice, such as picking up 1 cube when 1 is all there is.
		if (seen.has(key) || reject(world, phase, command) !== null) return;
		seen.add(key);
		options.push({ key, group, desc, command, ...(cost === undefined ? {} : { cost }) });
	};

	if (campaign.briefing.length && who.lead)
		add('ack', 'flow', 'acknowledge the Legacy briefing', { type: 'ACK_BRIEFING' });

	if (who.lead) {
		add('begin', 'flow', 'leave the prologue and start January', { type: 'BEGIN_CAMPAIGN' });
		if (seating.every(character => character !== null)) {
			add('start', 'flow', 'start the game with the picked characters', {
				type: 'START_GAME',
				seating: seating.map((character, index) => ({ seat: seatOf(index), character })),
			});
		}
		add('autosupply', 'setup', 'spread the remaining stockpile cubes over the grid', { type: 'AUTO_SUPPLY' });
		add('confirm-supply', 'setup', 'finish placing supplies and run the opening infection', { type: 'CONFIRM_SUPPLY' });
		add('confirm-events', 'setup', 'deal hands and begin', { type: 'CONFIRM_EVENTS' });
		add('continue', 'flow', 'go to the game-end step', { type: 'CONTINUE' });
		add('finish-upkeep', 'flow', 'end the game-end step; unspent units are lost', { type: 'FINISH_UPKEEP' });
		if (phase === 'upkeep') {
			for (const purchase of legalPurchases(world))
				add(
					keyOf(`buy:${purchase.t}`, purchase, 't'),
					`buy ${purchase.t}`,
					`${describe(state, purchase, 't')} · ${purchaseText(purchase)}`,
					{ type: 'PURCHASE', purchase },
					purchaseCost(purchase),
				);
		}
	}

	if (!game || !phase.startsWith('playing')) return options;

	const mine = game.active === who.seat;
	if (mine) {
		for (const action of legalActions(world, who.seat))
			add(
				keyOf(action.a, action, 'a'),
				action.a,
				describe(state, action, 'a'),
				{ type: 'ACTION', seat: who.seat, action },
				actionCost(world, who.seat, action),
			);
		add('end', 'flow', 'end your actions and move to the draw step', { type: 'END_ACTIONS', seat: who.seat });
		add('draw', 'flow', 'draw one Player card', { type: 'DRAW' });
		add('infect', 'flow', 'flip one Infection card', { type: 'INFECT' });
		if (state.canUndo) add('undo', 'flow', 'take back your last action', { type: 'UNDO' });
	}
	for (const { seat, card, play } of legalPlays(world, phase)) {
		if (seat !== who.seat) continue;
		const text = [...pack.events, ...pack.companions].find(entry => entry.id === play.e)?.text ?? '';
		add(
			keyOf(`play:${enc(card)}`, play, 'e'),
			`play ${play.e}`,
			[describe(state, play, 'e'), text].filter(Boolean).join(' · '),
			{
				type: 'PLAY',
				seat,
				card,
				play,
			},
		);
	}
	for (const decide of legalDecides(world)) {
		const named = 'seat' in decide && decide.seat !== undefined;
		if (named ? decide.seat !== who.seat : !ownsPending(state, who)) continue;
		add(
			keyOf(`decide:${decide.d}`, decide, 'd'),
			`decide ${decide.d}`,
			describe(state, decide, 'd') || 'pass on this choice',
			{
				type: 'DECIDE',
				decide,
			},
		);
	}
	for (const id of game.infectionDiscard)
		add(`lockdown:${enc(id)}`, 'lockdown', `destroy ${human(world, id)}`, { type: 'LOCKDOWN', card: id });
	return options;
}

function purchaseText(purchase: Purchase): string {
	switch (purchase.t) {
		case 'ability':
			return pack.abilities.find(ability => ability.id === purchase.ability)!.text;
		case 'cityImprovement':
			return pack.cityImprovements.find(item => item.id === purchase.improvement)!.text;
		case 'infectionImprovement':
			return pack.infectionImprovements.find(item => item.id === purchase.improvement)!.text;
		case 'population':
			return 'Raise the population by 1.';
		case 'restore':
			return 'Bring a forsaken city back to population 1.';
		case 'permanent':
			return `This ${purchase.structure} starts every later game already built.`;
	}
}

export type Verb =
	| { v: 'command'; command: Command }
	| { v: 'pick'; character: CharacterId }
	| { v: 'error'; message: string };

const dec = (value: string) => value.replace(/\.(\d+)$/, '#$1');

/** Commands with free-form arguments, which cannot be listed as options. */
export function parseVerb(state: PublicState, words: string[]): Verb | null {
	const [verb, ...rest] = words;
	const { campaign } = state.world;
	switch (verb) {
		case 'create': {
			const [job, home, ...name] = rest;
			if (!job || !home || !name.length) return { v: 'error', message: 'usage: create <job> <haven-id> <name>' };
			return {
				v: 'command',
				command: { type: 'CREATE_CHARACTER', name: name.join(' '), job: job as JobId, home: home as CityId },
			};
		}
		case 'pick': {
			const id = rest[0] as CharacterId | undefined;
			const character = id ? campaign.characters[id] : undefined;
			if (!character || character.dead || character.worker)
				return {
					v: 'error',
					message: `pick a living character: ${Object.keys(campaign.characters).join(', ') || 'none yet, use create'}`,
				};
			return { v: 'pick', character: id! };
		}
		case 'supply': {
			const [city, count] = rest;
			if (!city || !isCity(city) || !Number.isInteger(Number(count)))
				return { v: 'error', message: 'usage: supply <city-id> <count> (a negative count takes cubes back)' };
			return { v: 'command', command: { type: 'PLACE_SUPPLY', city, count: Number(count) } };
		}
		case 'events':
			return { v: 'command', command: { type: 'PICK_EVENTS', cards: rest.map(dec) as CardId[] } };
		case 'rename': {
			const [city, ...name] = rest;
			if (!city || !isCity(city) || !name.length) return { v: 'error', message: 'usage: rename <haven-id> <name>' };
			return { v: 'command', command: { type: 'RENAME_HAVEN', city, name: name.join(' ') } };
		}
		case 'rationing':
			return { v: 'command', command: { type: 'SET_RATIONING', value: Number(rest[0]) } };
		case 'waive':
			return { v: 'command', command: { type: 'WAIVE_OBJECTIVE', objective: rest[0] as ObjectiveId } };
		case 'raw':
			try {
				return { v: 'command', command: JSON.parse(rest.join(' ')) as Command };
			} catch {
				return { v: 'error', message: 'raw needs one JSON command, quoted for the shell' };
			}
		default:
			return null;
	}
}

/** Who may send a command that did not come from the options list. */
export function mayRaw(state: PublicState, who: Who, command: Command): string | null {
	const game = state.world.game;
	switch (command.type) {
		case 'CREATE_CHARACTER':
		case 'RENAME_HAVEN':
			return null;
		case 'ACTION':
		case 'END_ACTIONS':
			return command.seat === who.seat ? null : 'That is not your seat';
		case 'DRAW':
		case 'INFECT':
		case 'UNDO':
			return game?.active === who.seat ? null : 'It is not your turn';
		case 'PLAY':
			return command.seat === who.seat ? null : 'That card is in another hand';
		case 'DECIDE': {
			const decide = command.decide;
			if ('seat' in decide && decide.seat !== undefined)
				return decide.seat === who.seat ? null : 'That choice names another seat';
			return ownsPending(state, who) ? null : 'That choice belongs to another player';
		}
		case 'LOCKDOWN':
			return null;
		default:
			return who.lead ? null : 'Only this game’s lead sends setup and game-end commands';
	}
}

export const starterJobs = () => pack.jobs.filter(job => job.starting);
