import {
	actionCost,
	grid,
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
	Decide,
	JobId,
	ObjectiveId,
	Play,
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
		if (phase === 'upkeep' || phase === 'setup.supply') {
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
		for (const action of legalActions(world, who.seat)) {
			const tuned =
				action.a === 'monitor'
					? ` · frequency ${action.frequency + 1} of ${pack.frequencies.length}: the top 4 Player cards are discarded, then the frequency gives what it holds`
					: '';
			const sheltered =
				action.a === 'buildShelter'
					? ` · builds the shelter in the city you stand in${action.card ? ' and discards this card, which only has to match that city in colour' : ''}. A haven has no colour, so this action cannot shelter one`
					: '';
			const stored =
				action.a === 'inoculate'
					? ` · this city's ${action.card in campaign.playerCards ? 'PLAYER card from the Player discard pile' : 'Infection card from the Infection discard pile'} goes into storage, out of the decks`
					: '';
			add(
				keyOf(action.a, action, 'a'),
				action.a,
				`${describe(state, action, 'a')}${stored}${tuned}${sheltered}`,
				{ type: 'ACTION', seat: who.seat, action },
				actionCost(world, who.seat, action),
			);
		}
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
			decide.d === 'scar' ? scarText(state, decide, who) : describe(state, decide, 'd') || 'pass on this choice',
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

/** A scar choice in words: which scar, on whom, and what it would cover. */
function scarText(state: PublicState, decide: Extract<Decide, { d: 'scar' }>, who: Who): string {
	const { world } = state;
	const game = world.game!;
	const pending = game.pending[0];
	const seat = decide.seat ?? (pending && 'seat' in pending ? pending.seat : null) ?? who.seat;
	const character = world.campaign.characters[game.players[seat]!.character]!;
	const scar = pack.scars.find(entry => entry.id === decide.scar)!;
	const slot = decide.target === 'job' ? null : character.slots[decide.target];
	const where =
		decide.target === 'job'
			? `over ${character.name}'s job, which switches the job off`
			: `in ${character.name}'s slot ${decide.target + 1}, ${slot ? `covering ${slot.id}, which is lost` : 'which is empty'}`;
	return `${scar.name} (${scar.text}) ${where}`;
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
			return 'Bring a forsaken city back to population 1. It stays infested for good: starting a turn there still exposes a character.';
		case 'permanent':
			return `This ${purchase.structure} starts every later game already built.`;
	}
}

/**
 * A choice that takes several targets, written as one key with the targets joined by `+`, such as
 * `play:safeHouses.241:cairo+lagos+london`. Built from the single-target options it combines.
 */
export function composite(options: Option[], key: string): Command | null {
	const cut = key.lastIndexOf(':');
	const targets = key.slice(cut + 1).split('+');
	if (cut < 0 || targets.length < 2) return null;
	const bases = targets.map(target => options.find(option => option.key === `${key.slice(0, cut)}:${target}`));
	const first = bases[0]?.command;
	if (!first || bases.some(base => !base)) return null;
	const merged = structuredClone(first);
	const inner = (command: Command) =>
		(command.type === 'PLAY' ? command.play : command.type === 'DECIDE' ? command.decide : null) as Record<
			string,
			unknown
		> | null;
	const target = inner(merged);
	const field =
		target && Object.keys(target).find(name => Array.isArray(target[name]) && (target[name] as unknown[]).length === 1);
	if (!target || !field) return null;
	target[field] = bases.map(base => (inner(base!.command)![field] as unknown[])[0]);
	return merged;
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
			const [city, amount = ''] = rest;
			// `=2` sets the city to 2 cubes, whichever way that moves them. A plain number adds, a negative one takes back.
			const exact = amount.startsWith('=');
			const number = Number(exact ? amount.slice(1) : amount);
			if (!city || !isCity(city) || amount === '' || !Number.isInteger(number))
				return {
					v: 'error',
					message:
						'usage: supply <city-id> <count>. `supply london 2` adds 2, `supply london -1` takes 1 back, `supply london =2` sets it to exactly 2.',
				};
			const count = exact ? number - (state.world.game?.locations[city]?.supplies ?? 0) : number;
			if (count === 0) return { v: 'error', message: `${city} already holds ${number} cubes.` };
			return { v: 'command', command: { type: 'PLACE_SUPPLY', city, count } };
		}
		case 'events': {
			const reserve = Object.values(campaign.playerCards).filter(
				card => card.kind === 'event' && card.mode === 'rationed' && !campaign.stored.player.includes(card.id),
			);
			const count = Math.min(campaign.rationing, reserve.length);
			const cards = rest.map(dec) as CardId[];
			const unknown = cards.filter(card => !reserve.some(entry => entry.id === card));
			const ids = reserve.map(card => enc(card.id)).join(' ');
			if (unknown.length)
				return {
					v: 'error',
					message: `usage: events <id> <id> ... Not in the reserve: ${unknown.map(enc).join(', ')}. Use the ids, not the names. The reserve holds: ${ids}`,
				};
			if (cards.length !== count || new Set(cards).size !== cards.length)
				return {
					v: 'error',
					message: `usage: events <id> <id> ... Name exactly ${count} different cards in one command (you named ${cards.length}). The reserve holds: ${ids}`,
				};
			return { v: 'command', command: { type: 'PICK_EVENTS', cards } };
		}
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
				const command = JSON.parse(rest.join(' ')) as Command;
				if (typeof command?.type !== 'string')
					return {
						v: 'error',
						message:
							'raw needs a whole command, such as {"type":"ACTION","seat":"seat-1","action":{"a":"drive","to":"london"}}',
					};
				return { v: 'command', command };
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

/** Event and companion cards in hand that cannot be played right now, with the engine's reason where there is one. */
export function heldUnplayable(state: PublicState, seat: SeatId): string[] {
	const { world, phase } = state;
	const game = world.game;
	if (!game || !phase.startsWith('playing')) return [];
	const playable = new Set(legalPlays(world, phase).map(option => option.card));
	const anywhere = [...grid(world.campaign)][0]!;
	const lines = (game.players[seat]?.hand ?? []).flatMap(card => {
		const held = world.campaign.playerCards[card];
		const companion = held?.kind === 'city' ? held.companion : null;
		if (!held || (held.kind !== 'event' && !companion) || playable.has(card)) return [];
		if (companion && !pack.companions.find(entry => entry.id === companion)?.spent) return [];
		// These take cubes from the reserve or the stockpile, or wait for their moment, which is the usual reason they cannot be played.
		const samples: Partial<Record<string, Play>> = {
			handout: { e: 'handout', cities: [anywhere] },
			stockUp: { e: 'stockUp' },
			antidote: { e: 'antidote' },
			surplus: { e: 'surplus' },
		};
		const sample = held.kind === 'event' ? (samples[held.event] ?? null) : null;
		const reason = sample ? reject(world, phase, { type: 'PLAY', seat, card, play: sample }) : null;
		const name =
			held.kind === 'event'
				? pack.events.find(entry => entry.id === held.event)!.name
				: pack.companions.find(entry => entry.id === companion)!.name;
		return [`${name}${reason ? ` (${reason})` : ''}`];
	});
	return lines.length ? [`In your hand but not playable right now: ${lines.join(', ')}.`] : [];
}
