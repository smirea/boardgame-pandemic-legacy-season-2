import { LABS, pack } from '@repo/game';
import type { CityImprovementId, CompanionId, EventId, InfectionImprovementId, SearchResult } from '@repo/game';

export type EventPrint = {
	mode: 'rationed' | 'unrationed' | 'permanent';
	banner: 'Rationed Event' | 'Unrationed Event' | 'Player Card';
	rules: string[];
	destroy?: string;
	timing?: string;
};

export const EVENT_PRINT: Record<EventId, EventPrint> = {
	resilience: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: [
			'Move 1–2 copies of one city from Infection discard to Game End.',
			'Playable between Epidemic steps 2 & 3.',
		],
		timing: 'Free · any time',
	},
	airlift: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Move any 1 pawn to any location.'],
		timing: 'Free · any time',
	},
	handout: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Place up to 2 Supply cubes from the stockpile on any location(s).'],
		timing: 'Free · any time',
	},
	quietNight: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Skip the next Infect Cities step.'],
		timing: 'Free · any time',
	},
	cardSwap: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Any two players swap 1 Player card from their hands.'],
		timing: 'Free · any time',
	},
	spreadOut: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Move 3 Supply cubes from one haven onto any grid location(s).'],
		timing: 'Free · any time',
	},
	cleanse: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Remove up to 2 Plague cubes from the grid.'],
		timing: 'Free · any time',
	},
	forecast: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Look at and reorder the top 8 Infection cards.'],
		timing: 'Free · any time',
	},
	cache: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Add up to 6 Supply cubes from the reserve to any location with a pawn.'],
		timing: 'Free · any time',
	},
	encore: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Take 1 Rationed Event from the discard pile and play it now.'],
		timing: 'Free · any time',
	},
	secondWind: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['The current player gains 3 actions.'],
		timing: 'Free · Actions step',
	},
	massInoculation: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: [
			'Store up to 3 Infection cards from Infection discard in Package 6.',
			'Playable between Epidemic steps 2 & 3.',
		],
		timing: 'Free · any time',
	},
	openWaters: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Current player Charts a Sea Lane for free (no action or Supply cubes); may cross red region lines.'],
		timing: 'Free · any time',
	},
	scavenge: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Current player draws 4 Player cards: keep City cards, discard all others without effect.'],
		timing: 'Free · any time',
	},
	mobileShelters: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Build 2 shelters anywhere on the grid for free.'],
		timing: 'Free · any time',
	},
	purge: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Remove all Plague cubes from 1 location on the grid.'],
		destroy: 'Destroy after use',
		timing: 'Free · any time',
	},
	mentor: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Add an ability costing ≤2 to any in-play Character (may cover a scar).'],
		destroy: 'Destroy after use',
		timing: 'Free · any time',
	},
	safeHouses: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Place up to 3 shelters on any cities on the grid.'],
		destroy: 'Destroy after use',
		timing: 'Free · any time',
	},
	exile: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Destroy up to 3 copies of one city in Infection discard.', 'Playable between Epidemic steps 2 & 3.'],
		destroy: 'Destroy after use',
		timing: 'Free · any time',
	},
	stockUp: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Move up to 8 Supply cubes from the reserve to the stockpile for this game.'],
		destroy: 'Destroy after use',
		timing: 'Free · any time',
	},
	antidote: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Discard 1 Epidemic card without effect.'],
		destroy: 'Destroy after use',
		timing: 'Free · any time',
	},
	riotControl: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Move up to 4 "Utopia" Infection cards from Infection discard to Game End.'],
		destroy: 'Destroy after use',
		timing: 'Free · any time',
	},
	surplus: {
		mode: 'permanent',
		banner: 'Player Card',
		rules: ['During Make Supplies, discard this card to take 3 extra Supply cubes onto your Character card.'],
	},
};

export const EPIDEMIC_STEPS = [
	{
		heading: '1-INCREASE',
		text: 'Advance the Infection Rate marker 1 space.',
	},
	{
		heading: '2-INFECT',
		text: 'Draw the bottom Infection card, remove all Supply cubes from that city, and discard it.',
	},
	{
		heading: '3-INTENSIFY',
		text: 'Shuffle the Infection discard pile and put it on top of the Infection deck.',
	},
] as const;

export const producePrint = (boxesLeft: number) => {
	const usesLeft = Math.max(0, boxesLeft);
	return {
		localTitle: 'Local',
		local: 'At a haven or center, fill this location to population with Supply cubes.',
		systemTitle: 'System-Wide',
		system: 'At a haven or center, fill all havens & centers to population.',
		uses: `${usesLeft} ${usesLeft === 1 ? 'use' : 'uses'} left`,
	};
};

export type SearchRevealPrint = {
	before: string;
	doors?: string[];
	after?: string;
	plain: string;
};

/** Printed instructions revealed under a scratched search box (companions use the companion face instead). */
export function searchResultPrint(result: SearchResult): SearchRevealPrint | null {
	switch (result.t) {
		case 'companion':
			return null;
		case 'supplies': {
			const text = `Put ${result.amount} Supply cubes here from the ${result.from}.`;
			return { before: text, plain: text };
		}
		case 'stockpile': {
			const text = `Add ${result.amount} Supply cubes from the reserve to the stockpile.`;
			return { before: text, plain: text };
		}
		case 'actions': {
			const text = `Gain ${result.amount} extra ${result.amount === 1 ? 'action' : 'actions'} this turn.`;
			return { before: text, plain: text };
		}
		case 'retrieve': {
			const text = 'Take 1 card from the Player discard pile.';
			return { before: text, plain: text };
		}
		case 'quarantineCard': {
			const text = 'Move 1 Infection card from discard to Game End.';
			return { before: text, plain: text };
		}
		case 'removeHollow': {
			const text = `Remove up to ${result.amount} Hollow Men from the board.`;
			return { before: text, plain: text };
		}
		case 'freeEdge': {
			const text = `Draw 1 ${result.kind === 'land' ? 'Supply line' : 'Sea lane'} from here for free.`;
			return { before: text, plain: text };
		}
		case 'discover': {
			const doors = result.seals.flatMap(seal => (seal.t === 'door' ? [seal.id] : []));
			const lab = result.lab
				? Object.entries(LABS)
						.find(([, city]) => city === result.lab)?.[0]
						?.toUpperCase()
				: undefined;
			const open = doors.length > 1 ? 'Open doors' : 'Open door';
			const before = lab ? `Found ${lab} lab. ${open}` : open;
			const after = result.orAction ? '(or +1 action if open).' : '.';
			const plain = `${before} ${doors.join(', ')}${result.orAction ? ` ${after}` : after}`;
			return { before, doors, after, plain };
		}
		case 'infest': {
			const doors = result.opens?.t === 'door' ? [result.opens.id] : [];
			const before = doors.length ? 'Infest this city. Open door' : 'Infest this city.';
			const after = doors.length ? '.' : undefined;
			const plain = doors.length ? `${before} ${doors.join(', ')}.` : before;
			return { before, ...(doors.length ? { doors, after } : {}), plain };
		}
		case 'giveCard': {
			const text = 'Give 1 Player card to another player.';
			return { before: text, plain: text };
		}
		case 'nothing': {
			const text = 'Nothing found.';
			return { before: text, plain: text };
		}
	}
}

export type ImprovementPrint = { text: string; swatch?: 'wild' | 'red' };

export const IMPROVEMENT_PRINT: Record<CityImprovementId, ImprovementPrint> = {
	double: {
		text: 'Counts as 2 cards of its color for Build Supply Center.',
	},
	triple: {
		text: 'Counts as 3 cards of its color for Build Supply Center.',
	},
	wild: {
		text: 'Any color City card for Recon or Build Supply Center.',
		swatch: 'wild',
	},
	redWild: {
		text: 'Counts as both red and its original color.',
		swatch: 'red',
	},
};

export type CompanionPrint = { text: string; reuse: 'in-hand' | 'discard'; cards?: readonly ('A' | 'B')[] };

export const COMPANION_PRINT: Record<CompanionId, CompanionPrint> = {
	builder: {
		reuse: 'in-hand',
		text: 'In hand: 1 fewer card to Build Supply Center (may include this card).',
	},
	lineman: {
		reuse: 'in-hand',
		text: 'In hand: 1 fewer Supply cube to Establish Supply Lines.',
	},
	rigger: {
		reuse: 'in-hand',
		text: 'In hand: 1 fewer Supply cube to Build Satellite Tower.',
	},
	tracker: {
		reuse: 'in-hand',
		text: 'In hand: Search is a free action.',
	},
	fieldSurgeon: {
		reuse: 'in-hand',
		text: 'In hand: no exposure when starting a turn in an infested city.',
	},
	trader: {
		reuse: 'in-hand',
		text: 'Action (in hand): discard a City card (or this) for a same-color City card from Player discard.',
	},
	porter: {
		reuse: 'in-hand',
		text: 'Free action (in hand): move Supply cubes from an adjacent location into yours.',
	},
	medic: {
		reuse: 'discard',
		text: 'Play any time (discard): remove 1 Plague cube from your location.',
	},
	purifier: {
		reuse: 'discard',
		text: 'Play any time (discard): remove all Plague cubes from 1 location on the grid.',
	},
	shelterWright: {
		reuse: 'discard',
		text: 'Play any time (discard): place a shelter on 1 city on the grid.',
	},
	marksman: {
		reuse: 'discard',
		text: 'Play any time (discard): remove 1 Hollow Men figure from anywhere on the grid.',
	},
	quartermaster: {
		reuse: 'in-hand',
		text: 'In hand: discard any color City card (or this) for Build Shelter.',
	},
	doubleAgent: {
		reuse: 'discard',
		text: 'Counts as 2 unique red cards for Recon.',
		cards: ['A', 'B'],
	},
	informant: {
		reuse: 'discard',
		text: 'Play any time (discard): move up to 4 "Utopia" Infection cards from discard to Game End.',
	},
};

export const INFECTION_IMPROVEMENT_PRINT: Record<InfectionImprovementId, { name: string; text: string }> = {
	wellStocked: {
		name: 'Well Stocked',
		text: 'If there are 2 or more Supply cubes in this city when drawn, do not remove any Supply cubes.',
	},
	lockdown: {
		name: 'Lockdown',
		text: 'While in the Infection discard pile, any player may discard a Player card to destroy this card at any time.',
	},
	rebirth: {
		name: 'Rebirth',
		text: 'If the city is recovering (pop 6+), this card will not infect it. Hollow Men Gather still takes effect.',
	},
	cordon: {
		name: 'Broken Link',
		text: 'After discarding this card, any player may discard a Player card to stop drawing Infection cards this turn. (Not setup or epidemics.)',
	},
};

export type ObjectiveDetail =
	| { kind: 'text'; text: string }
	| { kind: 'door'; before: string; door: string; after: string }
	| { kind: 'bullets'; intro: string; items: string[]; joiner?: string };

export type ObjectivePrint = {
	mandatory: boolean;
	sentence: string;
	italicWord?: string;
	trackMax?: number;
	details?: ObjectiveDetail[];
	footer?: string[];
};

export const OBJECTIVE_PRINT: Record<string, ObjectivePrint> = {
	'00-02': {
		mandatory: true,
		sentence: 'Build 3 supply centers.',
		trackMax: 3,
	},
	'01-04': {
		mandatory: true,
		sentence: 'Build 3 new supply centers.',
		italicWord: 'new',
		trackMax: 3,
	},
	'01-05': {
		mandatory: true,
		sentence: 'Recon North America.',
		footer: [
			'Add this card to your pool of objectives.',
			'If you complete it, but lose the first game in January, it counts as complete during your second game in January!',
		],
	},
	'02-04': {
		mandatory: false,
		sentence: 'Recon 1 unknown region.',
		footer: ['Add this card to your pool of objectives.'],
	},
	'02-05': {
		mandatory: false,
		sentence: 'Connect 2 new cities to the grid.',
		trackMax: 2,
		footer: ['Add this card to your pool of objectives.'],
	},
	'03-04': {
		mandatory: false,
		sentence: 'Complete 2 searches.',
		trackMax: 2,
		footer: ['Add this card to your pool of objectives.'],
	},
	'03-05': {
		mandatory: false,
		sentence: 'Access a lost haven.',
		footer: [
			'Add this card to your pool of objectives. Destroy it at the end of the game in which you complete the objective.',
		],
	},
	'07-03': {
		mandatory: false,
		sentence: 'Triangulate signals.',
		details: [
			{
				kind: 'text',
				text: 'This objective is completed when a blue city, a yellow city, and a black city each contain a satellite tower.',
			},
			{ kind: 'door', before: 'When you complete this objective, open door ', door: '35', after: '.' },
		],
		footer: [
			'Add this card to your pool of objectives. Destroy it at the end of the game in which you complete the objective.',
		],
	},
	'09-04': {
		mandatory: true,
		sentence: 'Recon East Asia.',
		footer: [
			'Add this card to your pool of objectives.',
			'If you complete it, but lose the first game in September, it counts as complete during your second game in September!',
		],
	},
	'10-04': {
		mandatory: true,
		sentence: 'Get Hollow Men to defect.',
		details: [
			{
				kind: 'text',
				text: 'This objective is completed when there is at least 1 Hollow Men figure on 3 different havens.',
			},
		],
		footer: [
			'Add this card to your pool of objectives.',
			'If you complete it, but lose the first game in October, it counts as complete during your second game in October!',
		],
	},
	'11-04': {
		mandatory: true,
		sentence: 'Complete the Plan.',
		footer: [
			'Add this card to your pool of objectives. Destroy it at the end of the game in which you complete the objective.',
		],
	},
	'12-04': {
		mandatory: true,
		sentence: 'Deliver the Sample.',
		details: [
			{
				kind: 'bullets',
				intro: 'This objective is completed when:',
				items: ['a player carrying the sample is in Johannesburg,', 'Johannesburg has a supply center.'],
				joiner: 'AND',
			},
		],
		footer: ['This is your last Objective card.', 'If you complete it, you win the game.'],
	},
};

export type ScannerSlot = {
	label: string;
	reveal: { kind: 'cards'; count: number } | { kind: 'door'; door: string };
};

export const SCANNER_SLOTS: readonly ScannerSlot[] = pack.frequencies.map((reward, index) => {
	const label = pack.frequencyLabels[index]!;
	if (reward && 'take' in reward) return { label, reveal: { kind: 'cards', count: reward.take } };
	if (reward?.seal.t === 'door') return { label, reveal: { kind: 'door', door: reward.seal.id } };
	throw new Error(`Monitor frequency ${label} has no printed reward`);
});

export type ReckoningRow = {
	label: string;
	rule: string;
	highlight?: boolean;
};

export const RECKONING_ROWS: readonly ReckoningRow[] = [
	{ label: 'Games Won', rule: '50 points per game won in the first half of the month' },
	{ label: '', rule: '30 points per game won in the second half of the month' },
	{ label: 'Population', rule: 'Total population of all locations on the grid' },
	{ label: 'Bonuses', rule: '100 points for delivering the sample' },
	{ label: '', rule: '25 points for each lab on the board' },
	{ label: 'Subtotal', rule: 'Games Won + Population + Bonuses', highlight: true },
	{ label: 'Penalties', rule: '−5 points for each forsaken city on the grid' },
	{ label: 'Grand Total', rule: 'Subtotal − Penalties', highlight: true },
];

export const eventArtUrl = (id: EventId): string => `/events/${id}.webp`;
export const companionArtUrl = (id: CompanionId): string => `/companions/${id}.webp`;

export function eventPlainText(id: EventId): string {
	return EVENT_PRINT[id].rules.join(' ');
}

for (const event of pack.events)
	if (!EVENT_PRINT[event.id]) throw new Error(`Missing printed rules text for event ${event.id}`);
for (const improvement of pack.cityImprovements)
	if (!IMPROVEMENT_PRINT[improvement.id])
		throw new Error(`Missing printed rules text for improvement ${improvement.id}`);
for (const companion of pack.companions)
	if (!COMPANION_PRINT[companion.id]) throw new Error(`Missing printed rules text for companion ${companion.id}`);
for (const card of pack.legacyDeck)
	if (card.kind === 'objective' && !OBJECTIVE_PRINT[card.id])
		throw new Error(`Missing printed rules text for objective card ${card.id}`);
