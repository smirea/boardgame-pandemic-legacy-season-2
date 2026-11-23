import { pack } from './pack';
import type { RuleId, Seal } from './types';

/** The lettered slots the printed rulebook leaves for the rule stickers the campaign hands out. */
export type StickerSlot =
	| 'A'
	| 'B'
	| 'C'
	| 'D'
	| 'E'
	| 'F'
	| 'G'
	| 'H'
	| 'I'
	| 'J'
	| 'K'
	| 'L'
	| 'M'
	| 'N'
	| 'O'
	| 'P'
	| 'Q'
	| 'R'
	| 'S'
	| 'T'
	| 'U'
	| 'V'
	| 'W';

const door = (id: string): Seal => ({ t: 'door', id });
const pkg = (id: number): Seal => ({ t: 'package', id });

/** The package or door that holds each rule sticker: the sticker is in the book once that seal is open. */
export const RULE_STICKERS: Record<StickerSlot, Seal> = {
	A: door('A'),
	B: pkg(6),
	C: pkg(2),
	D: door('D'),
	E: door('E'),
	F: door('F'),
	G: pkg(2),
	H: pkg(4),
	I: pkg(6),
	J: door('J'),
	K: door('K'),
	L: door('L'),
	M: door('M'),
	N: pkg(3),
	O: pkg(7),
	P: door('P'),
	Q: door('Q'),
	R: door('R'),
	S: pkg(2),
	T: pkg(2),
	U: door('U'),
	V: pkg(3),
	W: pkg(2),
};

/** When a part of the book applies: once a seal is open, or only in the prologue. */
export type RuleGate = { t: 'seal'; seal: Seal } | { t: 'prologue' };

export type RuleText =
	| { t: 'p'; text: string; lead?: string }
	| { t: 'list'; items: string[]; ordered?: boolean }
	| { t: 'table'; head: string[]; rows: string[][] };

export type RuleBlock = RuleText & {
	/** A rule sticker: the block is in the book only once the sticker is, and the slot shows empty before that. */
	sticker?: StickerSlot;
	/** Printed text that this sticker covers once it is placed. */
	replacedBy?: StickerSlot;
	when?: RuleGate;
	/** A rule that uses up a supply gets what the box has left of it added after the text. */
	count?: RuleId;
};

export type RuleSection = { id: string; title: string; blocks: RuleBlock[]; when?: RuleGate };
export type RuleChapter = { id: string; title: string; sections: RuleSection[] };

const { numbers } = pack;
const p = (text: string, extra: Omit<RuleBlock, 't' | 'text'> = {}): RuleBlock => ({ t: 'p', text, ...extra });
const term = (lead: string, text: string, extra: Omit<RuleBlock, 't' | 'text' | 'lead'> = {}): RuleBlock => ({
	t: 'p',
	lead,
	text,
	...extra,
});
const list = (items: string[], ordered = false): RuleBlock => ({ t: 'list', items, ordered });
const opened = (seal: Seal): RuleGate => ({ t: 'seal', seal });
const range = (from: number, to: number) => (to === Number.POSITIVE_INFINITY ? `${from} or more` : `${from} to ${to}`);
const bands = <T extends Record<K, number>, K extends keyof T>(rows: T[], key: K) =>
	rows.map((row, index) => ({ row, from: index === 0 ? 1 : (rows[index - 1]![key] as number) + 1, to: row[key] }));

/**
 * The rulebook as the group's copy reads with every rule sticker placed, in the printed book's order. Each sticker
 * and each rule a package or door brings is gated on the seal that holds it, so `rulebook` shows only what the
 * campaign has opened.
 */
export const RULEBOOK: RuleChapter[] = [
	{
		id: 'story',
		title: 'The World Almost Ended 71 Years Ago',
		sections: [
			{
				id: 'prologue-story',
				title: 'Instructions for a Better Life on the Havens',
				blocks: [
					p(
						"The plague came out of nowhere and ravaged the world. Fever, cough, sores, and death—once infected, most died within a week. Nothing could stop it. The world did its best. It wasn't good enough.",
					),
					p(
						"The last fragments of our people have desperately kept the world from collapsing completely. For three generations we have lived on the seas, on floating stations they called \"havens.\" Far from the plague, we are able to provide supplies to the mainland—antibiotics, food, medicine, and tools—to keep them (and us) from succumbing completely. We keep a network of the largest known cities in the world alive. Things have been tough the past few years. Cities far away from the havens have fallen off our grid. We don't know what's happened to them. We don't know why the supplies aren't reaching them. We have only a few cities left on our grid. We are failing.",
					),
					p("The supplies aren't keeping the plague away like they used to. What's more, they're running out."),
					p('Our leadership tried to hide this fact from us, but we all knew.'),
					p(
						"Last week, the leaders and thinkers of the havens gathered together as they do every year to discuss the state of the havens and the state of the world. They did not return. What's worse is that our main security team was with them. Without our soldiers, the Hollow Men—roving bands of savages bent on our elimination—will expand their attacks, tearing down what we build and stealing what we offer.",
					),
					p(
						'Those of us left met on the havens to discuss what to do next. After hours of debate, we realized that all eyes had turned to a select few to lead. Us.',
					),
					p('Not because we are able to lead but because we are willing.'),
					p('We are starting this journal to record our attempts to keep the world from ending.'),
					p("We know we can't save all the cities but we will do what we can to save most of them."),
					p(
						'If we fail, we hope that someone, somewhere, finds these notes to know that we may not have succeeded but that we tried.',
					),
				],
			},
		],
	},
	{
		id: 'campaign',
		title: 'Playing the campaign',
		sections: [
			{
				id: 'legacy-game',
				title: 'A Legacy game',
				blocks: [
					p(
						'Choices carry from game to game. Players write on components, place stickers on cards, characters, the board and this rulebook, scratch boxes and destroy cards, and those changes are permanent.',
					),
					p(
						'Some material is sealed in numbered packages and dossier doors. Open one only when an instruction says to. Some rules are missing from this book at the start: when a rule sticker is found, it goes in its lettered slot and takes effect at once, even mid-game.',
					),
				],
			},
			{
				id: 'legacy-deck',
				title: 'The Legacy deck',
				blocks: [
					p(
						'The Legacy deck keeps a fixed order. Never shuffle it or look through it. During setup, read its cards one at a time until a card whose back says PAUSE or STOP.',
					),
					list([
						'PAUSE: read on at step 2 of the Game End steps of this game.',
						'STOP: read on during setup of the next month.',
					]),
					p('Legacy cards never go back. Replaying a month does not replay them.'),
				],
			},
			{
				id: 'persists',
				title: 'What stays and what resets',
				blocks: [
					term(
						'Stays:',
						'stickers, writing (names, places of death, drawn supply lines and sea lanes), scratched boxes, destroyed components, opened packages and doors, and cards a rule keeps somewhere, such as stored cards.',
					),
					term(
						'Resets every game:',
						'every piece on the board, hands, decks and discard piles, the Incident and Infection Rate markers, and objective trackers.',
					),
					p('A destroyed component never returns.'),
				],
			},
			{
				id: 'months',
				title: 'Game months',
				blocks: [
					p(
						'The campaign runs from January to December. Each month allows up to two games, with the same rules and objectives.',
					),
					{
						t: 'table',
						head: ['Result', 'Next'],
						rows: [
							['Win', 'The next month. Rationing level −2 (not below 0).'],
							['First loss of a month', 'Play the same month again. Rationing level +2 (not above 10).'],
							['Second loss of a month', 'The next month anyway. Rationing level +2.'],
							['December finished, win or lose', 'The campaign ends and is scored.'],
						],
					},
					p(
						`The rationing level starts at ${numbers.startingRationing}. It is the number of Rationed Event cards the group picks for each game. A group that finds it broke a rule may raise or lower it for the next game.`,
					),
					p(
						'The final score is mostly the months won, a first-game win scoring more than a win on the retry. Population on the grid counts for less, and other criteria add or take away points.',
					),
				],
			},
			{
				id: 'prologue',
				title: 'The prologue',
				when: { t: 'prologue' },
				blocks: [
					p(
						'Play the prologue as many times as the group wants before January. It makes no permanent changes. Its objective: build 3 supply centers, of any colour.',
					),
					list([
						'Do not open the Legacy deck.',
						'Characters cannot be exposed.',
						'Recon is not available.',
						'System-Wide Production is not available on Produce Supplies cards.',
						'Skip the Game End steps.',
					]),
				],
			},
		],
	},
	{
		id: 'board',
		title: 'The board',
		sections: [
			{
				id: 'locations',
				title: 'Locations',
				blocks: [
					term(
						'Location:',
						'a city or a haven. A rule that names a city never applies to a haven, and the reverse. Havens have no City or Infection cards, so they are never infected by a card.',
					),
					term('Port:', 'a location marked with an anchor. Every haven is a port.'),
					term(
						'Population:',
						'every location has one, from 0 to 8: 6 to 8 recovering, 3 to 5 surviving, 2 struggling, 1 falling, 0 forsaken.',
					),
					p(
						'A city at population 0 is forsaken. It becomes infested at once, while Infested stickers last. When its Infection card is drawn, at setup, in an Epidemic or in the Infect step, do not infect it: put the card in the Game End area and draw another. In a forsaken city the only action is Drive or Ferry out of it, with no free actions. Events still work. It does not count toward production units. At game end, 2 production units restore it to population 1; it stays infested. A haven at population 0 is neither forsaken nor infested.',
						{ sticker: 'A', count: 'forsaken' },
					),
					term('Infested city:', 'marked with a rat. Infested is permanent: restoring population does not remove it.', {
						when: opened(door('14')),
					}),
				],
			},
			{
				id: 'grid',
				title: 'Supply lines, sea lanes and the grid',
				blocks: [
					term('Supply line:', 'a land connection between two cities, drawn on the board for good.'),
					term('Sea lane:', 'a water connection between two ports. A chain of sea lanes is a sea route.'),
					term('Adjacent:', 'two locations joined by one supply line or one sea lane.'),
					term(
						'The grid:',
						'every location connected through supply lines and sea lanes to a starting haven. A revealed city that is not connected is not on the grid: its cards stay out of the decks and outbreaks cannot reach it.',
					),
					p(
						'When a city joins the grid during a game, its City cards go to the Player discard pile and its Infection cards to the Game End area, which shuffles them into the Infection deck after the game. A city already connected at setup has its cards shuffled into the decks.',
					),
				],
			},
			{
				id: 'cubes',
				title: 'Cubes and incidents',
				blocks: [
					term(
						'Supply cubes',
						'sit on locations, on character cards, in this game’s stockpile, or in the reserve. A location holds any number. Cubes an effect spends go back to the stockpile unless it says otherwise.',
					),
					term(
						'Plague cubes:',
						`at most ${numbers.maxPlaguePerCity} in a location. Only an effect that says so removes one.`,
					),
					term(
						'Incident:',
						`every Plague cube placed, for any reason, moves the Incident marker 1 space. It never moves back. The game is lost on the ${numbers.incidentLimit}th incident.`,
					),
				],
			},
			{
				id: 'hollow-men',
				title: 'Hollow Men',
				when: opened(pkg(2)),
				blocks: [
					p(
						`There are ${numbers.pieces.hollow} Hollow Men figures. A location holds at most ${numbers.maxHollowPerCity}. Placing one is not an incident. Hollow Men Gather cards in the Infection deck bring them onto the board.`,
					),
				],
			},
			{
				id: 'structures',
				title: 'Structures',
				blocks: [
					p(
						`There are ${numbers.pieces.center} supply centers, at most one in a city. With all of them on the board, building another moves one.`,
					),
					p(
						`There are ${numbers.pieces.tower} satellite towers, at most one in a city. With all of them on the board, building another moves one.`,
						{ when: opened(pkg(7)) },
					),
					p(
						`There are ${numbers.pieces.shelter} shelters, at most one in a city. With all of them on the board, building another moves one. No one is exposed in a sheltered city or when leaving it.`,
						{ when: opened(pkg(3)) },
					),
				],
			},
			{
				id: 'labs',
				title: 'Labs',
				when: opened(door('13')),
				blocks: [
					p('Each lab found gives its breakthrough for the rest of the campaign.'),
					list([
						'Opal: Make Supplies at a haven or a city with a supply center takes 1 more cube.',
						'Jade: an Epidemic’s Infect step removes only 1 cube from the city it strikes.',
						'Topaz: when a city would lose a cube to an infection, any player may discard a City card of its colour to keep it.',
					]),
				],
			},
		],
	},
	{
		id: 'characters',
		title: 'Characters',
		sections: [
			{
				id: 'character-card',
				title: 'The character card',
				blocks: [
					p(
						`A character has a name, a home haven, a job, ${numbers.characterSlots} slots for abilities and scars, and an exposure track of ${numbers.exposureBoxes} boxes to scratch. Under each box is nothing, a scar or a skull, hidden until scratched. A character holds any number of supply cubes.`,
					),
					p(
						'Any living character may be played each game, at its home haven. Characters found during the campaign come with their job and home.',
					),
				],
			},
			{
				id: 'exposure',
				title: 'Exposure',
				blocks: [
					p('When a character is exposed, scratch the leftmost unscratched box on its track.'),
					list(['Empty: nothing happens.', 'Scar: the character takes a scar.', 'Skull: the character dies.']),
					p('Each source of exposure counts on its own, so a character can be exposed more than once a turn.'),
				],
			},
			{
				id: 'scars',
				title: 'Scars',
				blocks: [
					p(
						'Choose a scar from the box and place it in an empty slot, or over the job or an ability, never over another scar. What it covers stops working.',
					),
				],
			},
			{
				id: 'death',
				title: 'Death',
				blocks: [
					list(
						[
							'Write the place of death. The character is never played again.',
							'Discard its hand and return its cubes to the stockpile.',
							'Its player loses the rest of the actions this turn, but still draws and infects.',
							'The player takes another living character not in play, at its home, or else a haven worker at any haven on the grid.',
						],
						true,
					),
				],
			},
			{
				id: 'workers',
				title: 'Haven workers',
				blocks: [
					p(
						'A haven worker starts at a haven and has no job, abilities or scars. When exposed, it discards its hand, loses the rest of its actions and goes back to its haven.',
					),
				],
			},
		],
	},
	{
		id: 'setup',
		title: 'Setup',
		sections: [
			{
				id: 'setup-1',
				title: '1. Set up the board',
				blocks: [
					p(
						'Put supply cubes in the stockpile as this month’s space on the supply track shows. The rest go in the reserve.',
					),
					p('Add every bonus printed beside the supply track to the stockpile, taking the cubes from the reserve.', {
						sticker: 'B',
					}),
					p(
						'Take from the reserve the cards that go on the board: Turning Point cards to the Game End area, Objective cards to the objectives area.',
					),
					p('Put every Hollow Men Gather card in the Infection discard pile.', { sticker: 'C' }),
					p(
						'Put the Incident marker on 0 and the Infection Rate marker on its first space. Put a tracker on 0 of every objective track.',
					),
				],
			},
			{
				id: 'setup-2',
				title: '2. Read the Legacy deck',
				blocks: [p('Read Legacy cards one at a time until a PAUSE or STOP card.')],
			},
			{
				id: 'setup-3',
				title: '3. Supply the grid',
				blocks: [
					p(
						'Players place every cube in the stockpile on locations on the grid, any number on each. Havens may take cubes.',
					),
				],
			},
			{
				id: 'setup-4',
				title: '4. Infect the grid',
				blocks: [
					p(
						`Shuffle the Infection deck and flip ${numbers.setupInfections} cards one at a time. For each, the city loses 1 supply cube, or if it has none, gets 1 Plague cube. Put the cards in the Infection discard pile.`,
						{ replacedBy: 'D' },
					),
					p(
						`Shuffle the Infection deck and flip ${numbers.setupInfections} cards one at a time. For each of the first 6, the city loses 1 supply cube, or if it has none, gets 1 Plague cube. On each city of the last 3, place 1 Hollow Man instead. Put the cards in the Infection discard pile.`,
						{ sticker: 'D' },
					),
				],
			},
			{
				id: 'setup-5',
				title: '5. Count the Epidemics',
				blocks: [
					p(
						'Count the City cards that will go in the Player deck. Set aside that many Epidemic cards as the table shows; step 7 makes that many piles.',
						{ sticker: 'E' },
					),
					{
						t: 'table',
						head: ['City cards', 'Epidemics'],
						rows: bands(numbers.epidemicTable, 'maxCityCards').map(({ row, from, to }) => [
							from === 1 ? `up to ${to}` : range(from, to),
							String(row.epidemics),
						]),
						sticker: 'E',
					},
				],
			},
			{
				id: 'setup-6',
				title: '6. Prepare the Player deck and deal',
				blocks: [
					p(
						'The group picks as many Rationed Event cards as the rationing level. Unrationed Event cards in the reserve always go in, on top of that.',
					),
					p(
						'Shuffle the chosen Events, the Produce Supplies cards and the City cards of every city on the grid. Deal face up: 4 cards each to 2 players, 3 each to 3 players, 2 each to 4 players.',
					),
				],
			},
			{
				id: 'setup-7',
				title: '7. Add the Epidemics',
				blocks: [
					p(
						'Split the rest of the Player deck into as many face-down piles as there are Epidemics, as equal as possible. Shuffle one Epidemic into each and stack them, smaller piles at the bottom.',
					),
				],
			},
			{
				id: 'setup-8',
				title: '8. Choose characters',
				blocks: [p('Each player takes a living character and puts its pawn on its home haven.')],
			},
			{
				id: 'setup-9',
				title: '9. Begin',
				blocks: [p('A random player goes first. Play goes clockwise.')],
			},
		],
	},
	{
		id: 'turn',
		title: 'A turn',
		sections: [
			{
				id: 'turn-order',
				title: 'Turn order',
				blocks: [list(['Check for exposure.', 'Do up to 4 actions.', 'Draw 2 Player cards.', 'Infect cities.'], true)],
			},
			{
				id: 'check-exposure',
				title: 'Check for exposure',
				blocks: [
					p('A character that starts its turn in a location with any Plague cubes is exposed once.'),
					p(
						'A character that starts its turn in an infested city is exposed once. With Plague cubes there too, it is still exposed only once.',
						{ sticker: 'F' },
					),
				],
			},
			{
				id: 'actions',
				title: 'Actions',
				blocks: [
					p(
						`A turn has ${numbers.actionsPerTurn} actions, and an action may be repeated. One action ends before the next starts. A job or an ability can change how an action works; an ability costs an action only if it says so. Cards discarded for actions go to the Player discard pile.`,
					),
					p(
						'An ability or card may be used only if all of it can be carried out: paying a cost for an effect that does nothing is not allowed.',
					),
				],
			},
			{
				id: 'movement',
				title: 'Movement actions',
				blocks: [
					p(
						'Leaving a location with any Hollow Men exposes the character once, whatever the movement and whoever’s turn it is. Sail and Charter Boat leave only the starting location. A shelter in the location left prevents it.',
						{ sticker: 'G' },
					),
					term('Drive or Ferry:', 'move to a location joined to yours by a supply line or sea lane.'),
					term(
						'Sail:',
						'discard a City card to move from a port to that card’s city, a port joined to yours by a sea route. Ports passed on the way are not entered.',
					),
					term(
						'Charter Boat:',
						'discard the City card of your port to move to any location on a sea route from it, havens included.',
					),
					p('Sail and Charter Boat never cross land or use supply lines.'),
				],
			},
			{
				id: 'shuttle',
				title: 'Shuttle Flight',
				blocks: [
					p(
						'From a haven or a city with a supply center, move to any other haven or city with a supply center on the grid.',
						{ sticker: 'H' },
					),
				],
			},
			{
				id: 'other-actions',
				title: 'Other actions',
				blocks: [
					term('Make Supplies:', 'move 1 cube from the stockpile to your character card.'),
					term(
						'Produce Supplies:',
						'in a haven or a city with a supply center, discard a Produce Supplies card and choose. Local Production fills your location up to its population with cubes from the stockpile; the card comes back next game. System-Wide Production fills every haven and supply center city on the grid up to its population and scratches a box on the card, which is destroyed with its last box. A short stockpile places what it has.',
					),
					term('Deliver Supplies:', 'move any number of your cubes to your location, Plague cubes or not.'),
					term(
						'Share Knowledge:',
						'with another player in your city, give them or take from them the City card of that city.',
					),
					term(
						'Build Supply Center:',
						`discard ${numbers.costs.center} City cards of your city’s colour to build a supply center there.`,
					),
					term(
						'Recon:',
						'in a city with a printed recon route and a supply center, discard the cards the route shows, all at once, and open the package or door it names. A star means any city of that colour; a letter means each card of that colour must be a different city.',
					),
				],
			},
			{
				id: 'free-actions',
				title: 'Free actions',
				blocks: [
					p(
						'Free actions cost nothing and have no limit, only on your own turn, before, between or after actions, never in the middle of one.',
					),
					term('Pick Up Supplies:', 'move any number of cubes from your location to your character card.'),
					term('Transfer Supplies:', 'give cubes to or take cubes from another character in your location.'),
					term(
						'Inoculate:',
						`in a city, move a Player card or an Infection card of that city from its discard pile into storage (Package 6), out of the decks. Storage holds at most ${numbers.storageCap} Player cards and ${numbers.storageCap} Infection cards; Gather cards cannot be stored. Stored cards may be looked at but not improved.`,
						{ sticker: 'I' },
					),
				],
			},
			{
				id: 'new-actions',
				title: 'New actions',
				blocks: [
					term(
						'Establish Supply Line:',
						`spend ${numbers.costs.line} cubes from your character to draw a supply line from your city on the grid to a revealed city. It may not cross water, unexplored map, another city or another supply line, and may not end at a haven.`,
						{ sticker: 'J' },
					),
					term(
						'Chart Sea Lane:',
						`spend ${numbers.costs.lane} cubes from your character to draw a sea lane from your port on the grid to another revealed port. It may not cross land, unexplored map, a city or another sea lane, and may cross at most one red region line.`,
						{ sticker: 'K' },
					),
					term(
						'Search:',
						'in the city of a City card in your hand, scratch one of that card’s search boxes and do what it reveals at once. Keep the card. A companion found this way stays on that card for good and helps whoever holds it.',
						{ sticker: 'L' },
					),
					term(
						'Monitor:',
						'in a city with a satellite tower, draw the top 4 Player cards and discard them all in any order; Epidemics among them do nothing. Then scratch a frequency on the Frequency Scanner and do what it shows. Once all its frequencies are scratched, Monitor can no longer be done.',
						{ sticker: 'M' },
					),
					term(
						'Build Shelter:',
						'discard a City card of your city’s colour to build a shelter there. No one is exposed in a sheltered city or when leaving it.',
						{ sticker: 'N' },
					),
					term(
						'Build Satellite Tower:',
						`spend ${numbers.costs.tower} cubes from your character to build a tower in your city.`,
						{ sticker: 'O' },
					),
					term(
						'Transmit:',
						'in a city with a satellite tower, give a City card of that city’s colour to any player, anywhere.',
						{ sticker: 'O' },
					),
					term(
						'Broadcast Misinformation:',
						'in a city with a satellite tower, move a Hollow Man from a city of that city’s colour to an adjacent location, havens included, with fewer than 3 Hollow Men.',
						{ sticker: 'P' },
					),
					term(
						'Self-Infect:',
						`at the Pearl lab (Lake Baikal), use one of the sample’s ${numbers.selfInfectDoses} doses: scratch exposure boxes until the first scar or skull. A skull kills the character. A scar makes the character the carrier, a scar that covers two slots (empty slots first, then abilities). The carrier moves only by Drive or Ferry, discards a City card of the colour of each city it enters, and dies when the game ends.`,
						{ sticker: 'Q', count: 'carrier' },
					),
				],
			},
		],
	},
	{
		id: 'draw',
		title: 'Drawing Player cards',
		sections: [
			{
				id: 'draw-step',
				title: 'Draw 2 Player cards',
				blocks: [
					p(
						'Draw the top 2 Player cards together. If the deck holds fewer than 2, the game is lost; the discard pile is never reshuffled. Resolve every Epidemic drawn, then keep to the hand limit.',
					),
				],
			},
			{
				id: 'epidemics',
				title: 'Epidemic cards',
				blocks: [
					p('Resolve in order, then discard the Epidemic. Two Epidemics drawn together resolve one after the other.'),
					term('1. Increase:', 'move the Infection Rate marker 1 space.'),
					term(
						'2. Infect:',
						'draw the bottom card of the Infection deck. Remove every supply cube from that city, placing no Plague cube. Put the card in the Infection discard pile.',
						{ replacedBy: 'R' },
					),
					term(
						'2. Infect:',
						'draw a random Infection card from storage (Package 6), or the bottom card of the Infection deck if storage has none. Remove every supply cube from that city, placing no Plague cube. Put the card in the Infection discard pile.',
						{ sticker: 'R' },
					),
					term('3. Intensify:', 'shuffle the Infection discard pile and put it on top of the Infection deck.'),
				],
			},
			{
				id: 'events',
				title: 'Event cards',
				blocks: [
					p(
						'Playing an Event is not an action. Any player may play one at any time, except while a drawn card is resolving; once an Epidemic is under way, an Event may be played between its steps. The player who plays it decides how it is used. A Rationed Event goes to the Player discard pile; an Unrationed Event is destroyed. No Event may be played once the game is over.',
					),
				],
			},
			{
				id: 'hand-limit',
				title: 'Hand limit',
				blocks: [
					p(
						`A hand holds at most ${numbers.handLimit} cards, at all times. A player over it discards cards or plays Events at once. Hands are face up, and anyone may look through the discard piles and the reserve, never the decks.`,
					),
				],
			},
		],
	},
	{
		id: 'infections',
		title: 'Infections',
		sections: [
			{
				id: 'infect-cities',
				title: 'Infect cities',
				blocks: [
					p(
						'At the end of the turn, flip as many Infection cards as the infection rate, one at a time, and infect each city named.',
					),
					list(
						[
							'If the city has a supply cube, return 1 to the stockpile.',
							'Otherwise, if it has fewer than 3 Plague cubes, place 1 Plague cube: an incident.',
							'Otherwise it outbreaks.',
						],
						true,
					),
					p(
						'When a Gather card is drawn, keep drawing until an Infection card of a city comes up, discarding any further Gather cards. Place 1 Hollow Man on that city instead of infecting it: no cube is removed or placed, and Infection card improvements do nothing. A city that already holds 3 Hollow Men loses 1 population instead, unless it has a shelter.',
						{ sticker: 'S' },
					),
					p(
						'Gather cards do not count toward the infection rate; only the city card drawn after them does. A Gather card drawn in an Epidemic’s Infect step is discarded and does nothing.',
						{ sticker: 'T' },
					),
				],
			},
			{
				id: 'outbreaks',
				title: 'Outbreaks',
				blocks: [
					p(
						'Every location adjacent to a city that outbreaks, havens included, loses a supply cube, or if it has none, gets a Plague cube. A city that would get a 4th Plague cube outbreaks in turn. While one card resolves, a location that has already outbroken gets no more Plague cubes. An outbreak is not an incident itself; only the Plague cubes it places are.',
					),
				],
			},
			{
				id: 'empty-deck',
				title: 'An empty Infection deck',
				blocks: [
					p(
						'When a card must be drawn and the Infection deck is empty, shuffle the discard pile into a new deck and move the Infection Rate marker 1 space. The rest of that step keeps the old rate.',
					),
				],
			},
		],
	},
	{
		id: 'winning',
		title: 'Winning and losing',
		sections: [
			{
				id: 'win',
				title: 'Winning',
				blocks: [
					p(
						'The game is won the moment the group completes the month’s number of objectives, every mandatory one among them, even mid-turn. Objective progress resets between games unless the card says it carries over. If an objective becomes impossible, completing all the others that are still possible wins.',
					),
				],
			},
			{
				id: 'loss',
				title: 'Losing',
				blocks: [
					p('The game is lost the moment:'),
					list([
						'the Incident marker reaches the skull, or',
						'a player must draw 2 Player cards and the deck holds fewer.',
					]),
					p('A Hollow Man must be placed and none are left in the supply.', { sticker: 'U' }),
				],
			},
		],
	},
	{
		id: 'game-end',
		title: 'Game End',
		sections: [
			{
				id: 'game-end-steps',
				title: 'After every game',
				blocks: [
					p(
						'Win or lose, return City and Infection cards from hands and discard piles to their decks, then do the Game End steps in order. Then clear the board; stickers stay.',
					),
				],
			},
			{
				id: 'adjust-population',
				title: '1. Adjust population',
				blocks: [
					term('a.', 'A city with a shelter skips steps b and c.', { sticker: 'V' }),
					term('b.', 'Every location with any Plague cubes loses 1 population.'),
					term(
						'c.',
						'Every location with any Hollow Men loses 1 population. A location with Plague cubes and Hollow Men still loses only 1.',
						{ sticker: 'W' },
					),
					term(
						'd.',
						'Every city with a supply center gains 1 population. A location that both loses and gains stays the same. Population stays between 0 and 8.',
					),
				],
			},
			{
				id: 'check-legacy',
				title: '2. Check the Legacy deck',
				blocks: [p('If the last card read was a PAUSE card, read on until the next PAUSE or STOP.')],
			},
			{
				id: 'game-end-area',
				title: '3. Resolve the Game End area',
				blocks: [
					p(
						'Shuffle the Infection cards in the Game End area into the Infection deck. Check each Turning Point card there: if its condition was met, follow it, lowest number first. The others go back to the reserve until the next game.',
					),
				],
			},
			{
				id: 'production',
				title: '4. Spend production units',
				blocks: [
					p(
						'Count the cities on the grid, leaving out havens and forsaken cities, and look up the units the group gets. Add 1 for a win. Units left unspent are lost.',
					),
					{
						t: 'table',
						head: ['Cities on the grid', 'Production units'],
						rows: bands(numbers.productionTable, 'maxCities').map(({ row, from, to }) => [
							range(from, to),
							String(row.units),
						]),
					},
					term('Character ability', '(cost beside the sticker): on any living character, in an empty slot.'),
					term(
						'City card improvement',
						'(cost beside the sticker): on a City card of a city on the grid with an empty improvement slot.',
					),
					term('Infection card improvement', '(cost beside the sticker): on an Infection card with an empty slot.'),
					term('Population +1', `(${numbers.costs.population} each): on a location that is not forsaken, up to 8.`),
					term('Restore a forsaken city', `(${numbers.costs.restore}): back to population 1.`, {
						when: opened(door('A')),
					}),
					term(
						'Permanent supply center',
						`(${numbers.costs.permanent.center}): on a city that had a supply center this game. It starts every game with one, and does not count as a new supply center for objectives.`,
						{ when: opened(door('34')) },
					),
					term(
						'Permanent satellite tower',
						`(${numbers.costs.permanent.tower}): on a city that had a tower this game. It starts every game with one.`,
						{ when: opened(pkg(7)) },
					),
					term(
						'Permanent shelter',
						`(${numbers.costs.permanent.shelter}): on a city that had a shelter this game. It starts every game with one.`,
						{ when: opened(pkg(3)) },
					),
				],
			},
		],
	},
];
