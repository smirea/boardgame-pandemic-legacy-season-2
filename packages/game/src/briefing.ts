import { pack } from './content/pack';
import type { ActionId, RuleId, Unlock } from './content/types';
import type { BriefingEntry, Campaign } from './state';

/** One line on what each unlockable action does, as a briefing announces it under its New actions heading. */
export const actionBriefs: Partial<Record<ActionId, string>> = {
	recon: 'Recon. In a marked city with a supply center, discard the cards its route asks for to reveal a region.',
	establishLine:
		'Supply Line. Spend 2 cubes from your character to join your city to a neighbouring one. Lines may not cross each other.',
	search:
		"Search. Holding a city's card while in that city, scratch one of the card's search boxes and take what it finds.",
	shuttle: 'Shuttle Flight. Fly between havens and cities with a supply center.',
	buildTower: 'Build Tower. Spend 2 cubes from your character to raise a tower in your city.',
	transmit: "Transmit. In a tower city, send a City card of that city's colour to any player.",
	buildShelter:
		"Build Shelter. Discard a card of your city's colour. No one is exposed in or leaving a sheltered city, and it loses no population at game end.",
	inoculate:
		"Inoculate, a free action. Move your city's Player card or Infection card from its discard pile into storage, out of the decks.",
	chartLane:
		'Sea Lane. Spend 2 cubes from your character to join your port to another. A lane may cross one region boundary.',
	monitor:
		'Monitor. In a tower city, tune to a frequency. Four Player cards are discarded and the frequency gives what it holds.',
	broadcast:
		"Broadcast. In a tower city, move a Hollow Man out of a city of that city's colour into a neighbouring location.",
};

export const ruleBriefs: Partial<Record<RuleId, string>> = {
	forsaken:
		'A city at population 0 is forsaken. When one of its Infection cards is flipped it is set aside and another card is flipped in its place, nothing but Drive or Ferry works there, and it becomes infested. Restore at game end brings it back.',
	epidemicScaling: 'The number of Epidemics in the deck grows with the number of City cards in it.',
	hollowSetup: 'The last 3 setup infections place Hollow Men. Running out of Hollow Men figures loses the game.',
	epidemicFromStorage: 'An Epidemic strikes a stored Infection card first, if there is one.',
	topazShield:
		'When a city loses a cube to an infection, any player may discard a City card of its colour to keep the cube.',
	gentleEpidemic: 'An Epidemic removes 1 cube from the city it strikes, not all of them.',
	carrier:
		'A new action at Lake Baikal, Take the sample. That character becomes the carrier. The carrier moves only by Drive or Ferry, must discard a City card of the colour of each city it enters, and dies when the game ends.',
};

/** The heading each kind of unlock is grouped under, in a briefing and in the playtest lab's status. */
const HEADING = {
	objectives: 'Objectives this game',
	action: 'New actions',
	rule: 'New rules',
	event: 'New Event cards',
	ability: 'New abilities for sale',
	cityImprovement: 'New City card improvements for sale',
	infectionImprovement: 'New Infection card improvements for sale',
	permanentStructure: 'New at game end',
	job: 'New characters',
	lab: 'Labs found',
	region: 'Infested from the start',
	route: 'Recon routes now known',
	haven: 'New havens',
	frequencyHint: 'Monitor frequencies',
	gather: 'Hollow Men',
	assemble: 'Hollow Men',
	freeAbilityUnits: 'Production',
	stockpileBonus: 'Stockpile',
} satisfies Partial<Record<Unlock['t'], string>>;

export type BriefedUnlock = Extract<Unlock, { t: keyof typeof HEADING }>;

export type BriefingSection =
	| { t: 'card'; title: string; text: string | null }
	| { t: 'group'; heading: string; items: { unlock: BriefedUnlock; text: string }[] };

/** A briefing as it is read: each Legacy card on its own, and everything unlocked grouped by kind in order of first mention. */
export function briefingSections(briefing: BriefingEntry[]): BriefingSection[] {
	const sections: BriefingSection[] = [];
	const groups = new Map<string, Extract<BriefingSection, { t: 'group' }>>();
	for (const entry of briefing) {
		if (entry.t === 'card') {
			sections.push(entry);
			continue;
		}
		const heading = HEADING[entry.unlock.t];
		let group = groups.get(heading);
		if (!group) {
			group = { t: 'group', heading, items: [] };
			groups.set(heading, group);
			sections.push(group);
		}
		group.items.push({ unlock: entry.unlock, text: entry.text });
	}
	return sections;
}

const named = <T extends { id: string; name: string; text: string }>(list: T[], id: string) => {
	const found = list.find(entry => entry.id === id)!;
	return `${found.name}. ${found.text}`;
};

/** Adds an unlock to the briefing, worded for its heading, when it is something the table should hear about. */
export function briefUnlock(campaign: Campaign, unlock: Unlock) {
	if (!(unlock.t in HEADING)) return;
	const text = unlockLine(campaign, unlock as BriefedUnlock);
	if (text !== null) campaign.briefing.push({ t: 'unlock', unlock: unlock as BriefedUnlock, text });
}

function unlockLine(campaign: Campaign, unlock: BriefedUnlock): string | null {
	switch (unlock.t) {
		case 'event': {
			const mode = unlock.mode === 'rationed' ? 'Rationed' : unlock.mode === 'unrationed' ? 'Unrationed' : 'permanent';
			const owned = Object.values(campaign.playerCards).some(
				card => card.kind === 'event' && card.event === unlock.event,
			);
			const where =
				unlock.mode === 'rationed'
					? 'It joins the Rationed Events the group picks from at each setup, starting next game.'
					: 'It is in the Player deck from the next game on.';
			const event = pack.events.find(entry => entry.id === unlock.event)!;
			return `${event.name}, ${owned ? `another copy of a ${mode} Event` : `a ${mode} Event`}. ${where} When played it reads: ${event.text}`;
		}
		case 'ability':
			return named(pack.abilities, unlock.ability);
		case 'cityImprovement':
			return named(pack.cityImprovements, unlock.improvement);
		case 'infectionImprovement':
			return named(pack.infectionImprovements, unlock.improvement);
		case 'job':
			return `${named(pack.jobs, unlock.job)} A character with a job nobody had before has joined the roster. That text describes the job, not a new rule for everyone.`;
		case 'lab':
			return `${pack.cities.find(entry => entry.id === unlock.city)!.name}. Every lab found counts toward the final score.`;
		case 'action':
			return actionBriefs[unlock.action] ?? null;
		case 'region': {
			const infested = pack.cities
				.filter(city => city.region === unlock.region && city.startsInfested)
				.map(city => city.name);
			return infested.length
				? `${infested.join(', ')}. A character who begins a turn in one of them is exposed.`
				: null;
		}
		case 'objectives': {
			// The briefing shows the objective cards themselves; the text is for readers without them.
			const kept = campaign.objectives.filter(id => !unlock.remove?.includes(id));
			const now = [...kept, ...(unlock.add ?? []).filter(id => !kept.includes(id))];
			return now.map(id => pack.objectives.find(entry => entry.id === id)!.name).join(', ');
		}
		case 'rule':
			return ruleBriefs[unlock.rule] ?? null;
		case 'route': {
			const route = pack.reconRoutes.find(entry => entry.id === unlock.route);
			if (!route) return null;
			const city = pack.cities.find(entry => entry.id === route.city)!.name;
			return `At ${city}, discard ${route.count} ${route.color} cards${route.unique ? ' of different cities' : ''}${route.needsCenter ? '. The city needs a supply center' : ''}.`;
		}
		case 'haven': {
			const reached = pack.bundles.some(
				bundle =>
					bundle.unlocks.includes(unlock) &&
					bundle.unlocks.some(
						other =>
							other.t === 'region' && other.connect?.some(edge => edge.a === unlock.city || edge.b === unlock.city),
					),
			);
			const name = pack.cities.find(entry => entry.id === unlock.city)!.name;
			return reached
				? `${name} is now on the map, and a line already reaches it.`
				: `${name} is now on the map. It is not on the grid until a line reaches it.`;
		}
		case 'frequencyHint': {
			const worth = pack.frequencies.flatMap((reward, index) => (reward && 'bundle' in reward ? [index + 1] : []));
			return `The bearings cross on three Monitor frequencies that open something new: ${worth.join(', ')}. The other seven only return cards.`;
		}
		case 'gather':
			return `${unlock.cards} Gather cards join the Infection cards. They start each game in the discard pile and enter the deck with the first Epidemic. When one is flipped, the next city flipped gets a Hollow Man and is not infected. Leaving a location that holds Hollow Men exposes a character.`;
		case 'assemble':
			return `${unlock.cards} Assemble cards join the Infection cards. They work as Gather cards do.`;
		case 'freeAbilityUnits':
			return `${unlock.amount} free production units for character abilities: spend them now, during setup, on abilities that last all year.`;
		case 'stockpileBonus':
			return `The stockpile grows by ${unlock.amount} cubes now and at every later setup.`;
		case 'permanentStructure':
			return `A ${unlock.structure} can be made permanent, so it starts every later game already built.`;
	}
}
