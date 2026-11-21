import { pack } from '@repo/game';
import type { CityImprovementId, CompanionId, EventId } from '@repo/game';

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
			'Move 1 or 2 copies of a specific city in the Infection discard pile to the Game End area.',
			'You may play this card between step 2 and step 3 of an epidemic.',
		],
		timing: 'Play at any time. Not an action.',
	},
	airlift: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Move any 1 pawn to any location.', "Get permission before moving another player's pawn."],
		timing: 'Play at any time. Not an action.',
	},
	handout: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Take up to 2 Supply cubes from the stockpile and put them onto any location(s).'],
		timing: 'Play at any time. Not an action.',
	},
	quietNight: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Skip the next "Infect Cities" step (do not flip over any Infection cards).'],
		timing: 'Play at any time. Not an action.',
	},
	cardSwap: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Two players (anywhere on the board) can swap 1 Player card from their hands.'],
		timing: 'Play at any time. Not an action.',
	},
	spreadOut: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Move 3 Supply cubes from one haven into one or more locations on the grid.'],
		timing: 'Play at any time. Not an action.',
	},
	cleanse: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Remove up to 2 Plague cubes from the grid.'],
		timing: 'Play at any time. Not an action.',
	},
	forecast: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: [
			'Draw, look at, and rearrange the top 8 cards of the Infection deck.',
			'Put them back on top of the Infection deck.',
		],
		timing: 'Play at any time. Not an action.',
	},
	cache: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Take up to 6 Supply cubes from the reserve and add them to a location containing a player pawn.'],
		timing: 'Play at any time. Not an action.',
	},
	encore: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Take 1 Rationed Event card from the discard pile and play it immediately.'],
		timing: 'Play at any time. Not an action.',
	},
	secondWind: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['The current player gains 3 actions.'],
		timing: 'Play during any player\'s "Actions" step. Not an action.',
	},
	massInoculation: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: [
			'Put up to 3 Infection cards from the Infection discard pile into Package 6.',
			'You may play this card between step 2 and step 3 of an epidemic.',
		],
		timing: 'Play at any time. Not an action.',
	},
	openWaters: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: [
			'The current player may do the Chart Sea Lane action for free. (Do not spend an action or any Supply cubes.)',
			'The sea lane may cross any number of red region lines.',
		],
		timing: 'Play at any time. Not an action.',
	},
	scavenge: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: [
			'The current player draws the next 4 Player cards, adding any City cards to their hand. Discard any other cards to the Player discard pile without effect.',
		],
		timing: 'Play at any time. Not an action.',
	},
	mobileShelters: {
		mode: 'rationed',
		banner: 'Rationed Event',
		rules: ['Build 2 shelters anywhere on the grid for free.'],
		timing: 'Play at any time. Not an action.',
	},
	purge: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Remove all Plague cubes from 1 location on the grid.'],
		destroy: 'Destroy this card after use.',
		timing: 'Play at any time. Not an action.',
	},
	mentor: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: [
			'Place a character ability worth 2 or less on a Character card currently in play. You may place this ability over a scar.',
		],
		destroy: 'Destroy this card after use.',
		timing: 'Play at any time. Not an action.',
	},
	safeHouses: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Place up to 3 shelters onto any cities on the grid.'],
		destroy: 'Destroy this card after use.',
		timing: 'Play at any time. Not an action.',
	},
	exile: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: [
			'Destroy up to 3 copies of one specific city in the Infection discard pile.',
			'You may play this card between step 2 and step 3 of an epidemic.',
		],
		destroy: 'Destroy this card after use.',
		timing: 'Play at any time. Not an action.',
	},
	stockUp: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Move up to 8 Supply cubes from the reserve to the stockpile for use in this game.'],
		destroy: 'Destroy this card after use.',
		timing: 'Play at any time. Not an action.',
	},
	antidote: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Discard 1 Epidemic card without effect.'],
		destroy: 'Destroy this card after use.',
		timing: 'Play at any time. Not an action.',
	},
	riotControl: {
		mode: 'unrationed',
		banner: 'Unrationed Event',
		rules: ['Move up to 4 "Utopia" Infection cards from the Infection discard pile to the Game End area.'],
		destroy: 'Destroy this card after use.',
		timing: 'Play at any time. Not an action.',
	},
	surplus: {
		mode: 'permanent',
		banner: 'Player Card',
		rules: [
			'When doing the Make Supplies action, discard this card to put 3 more Supply cubes onto your Character card.',
		],
	},
};

export const EPIDEMIC_STEPS = [
	{
		heading: '1-INCREASE',
		text: 'Move the Infection Rate marker forward 1 space.',
	},
	{
		heading: '2-INFECT',
		text: 'Draw the bottom card from the Infection deck and remove all the Supply cubes (if any) from that city. Discard that card.',
	},
	{
		heading: '3-INTENSIFY',
		text: 'Shuffle the cards in the Infection discard pile and put them on top of the Infection deck.',
	},
] as const;

export const producePrint = (boxesLeft: number) => ({
	lead: 'For an action, do one of the following:',
	local:
		'Local Production: at a haven or supply center, fill your current location to its population with Supply cubes.',
	system:
		'System-Wide Production: at a haven or supply center, fill all havens and supply centers to their population with Supply cubes.',
	check: boxesLeft === 1 ? 'Then, check the box below.' : 'Then, check a box below.',
	footer:
		boxesLeft === 1 ? 'When this box is checked, destroy this card.' : 'When all boxes are checked, destroy this card.',
});

export type ImprovementPrint = { text: string; swatch?: 'wild' | 'red' };

export const IMPROVEMENT_PRINT: Record<CityImprovementId, ImprovementPrint> = {
	double: {
		text: 'This card counts as 2 cards of its color for the Build Supply Center action.',
	},
	triple: {
		text: 'This card counts as 3 cards of its color for the Build Supply Center action.',
	},
	wild: {
		text: 'You may use this card as a City card of any color when doing the Recon or Build Supply Center action.',
		swatch: 'wild',
	},
	redWild: {
		text: 'This card is both a red City card and a card of its original color.',
		swatch: 'red',
	},
};

export type CompanionPrint = { text: string; cards?: readonly ('A' | 'B')[] };

export const COMPANION_PRINT: Record<CompanionId, CompanionPrint> = {
	builder: {
		text: 'When you do the Build Supply Center action, you need 1 fewer card if you have this card in your hand. (This card can be one of the cards used.)',
	},
	lineman: {
		text: 'You may do the Establish Supply Lines action with 1 fewer Supply cube if you have this card in your hand.',
	},
	rigger: {
		text: 'When doing the Build Satellite Tower action, spend 1 fewer Supply cube if you have this card in your hand.',
	},
	tracker: {
		text: 'You may do the Search action for free if you have this card in your hand.',
	},
	fieldSurgeon: {
		text: 'You do not get exposed when you begin your turn in an infested city if you have this card in your hand.',
	},
	trader: {
		text: 'As an action, you can discard a City card (including this card) to draw a City card of the same color from the Player discard pile, if you have this card in your hand.',
	},
	porter: {
		text: 'As a free action, you may take Supply cubes from an adjacent location and place them into your location if you have this card in your hand.',
	},
	medic: {
		text: 'Play this card at any time to remove a Plague cube from your location.',
	},
	purifier: {
		text: 'Play this card at any time to remove all Plague cubes from 1 location on the grid.',
	},
	shelterWright: {
		text: 'Play this card at any time to place a shelter onto one city on the grid.',
	},
	marksman: {
		text: 'Play this card at any time to remove 1 Hollow Men figure from anywhere on the grid.',
	},
	quartermaster: {
		text: 'When you do the Build Shelter action, you may discard any color City card (including this one) if you have this card in your hand.',
	},
	doubleAgent: {
		text: 'This card counts as 2 unique red cards for the Recon action.',
		cards: ['A', 'B'],
	},
	informant: {
		text: 'Play this card at any time to move up to 4 "Utopia" Infection cards from the Infection discard pile to the Game End area.',
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

export function eventPlainText(id: EventId): string {
	const entry = EVENT_PRINT[id];
	return [...entry.rules, entry.destroy, entry.timing].filter(Boolean).join(' ');
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
