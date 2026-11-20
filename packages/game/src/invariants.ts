import { pack } from './content/pack';
import { grid } from './helpers';
import type { World } from './state';

/**
 * Rules that must hold after every single command, whatever the players did. Supply cubes only ever
 * move between pools, so `cubeTotals` remembers each game's total from setup, keyed by game number.
 */
export function violations(world: World, cubeTotals: Map<number, number>): string[] {
	const { campaign, game } = world;
	const problems: string[] = [];
	for (const [id, record] of Object.entries(campaign.locations)) {
		if (record.population < 0 || record.population > 8) problems.push(`population of ${id} is ${record.population}`);
	}
	if (!game) return problems;
	const cubes =
		Object.values(game.locations).reduce((sum, location) => sum + location.supplies, 0) +
		Object.values(game.players).reduce((sum, player) => sum + player.supplies, 0);
	if (game.stockpile < 0 || game.reserve < 0 || cubes < 0) problems.push('a cube pool went negative');
	const plague = Object.values(game.locations).reduce((sum, location) => sum + location.plague, 0);
	if (plague > game.incidents) problems.push(`${plague} plague cubes but only ${game.incidents} incidents`);
	for (const [id, location] of Object.entries(game.locations)) {
		if (location.plague > 3 || location.plague < 0) problems.push(`${id} holds ${location.plague} plague cubes`);
		if (location.hollow > 3 || location.hollow < 0) problems.push(`${id} holds ${location.hollow} Hollow Men`);
		if (location.supplies < 0) problems.push(`${id} holds ${location.supplies} cubes`);
	}
	if (Object.values(game.pieces).some(count => count < 0)) problems.push('a piece supply went negative');
	const everywhere = [
		...game.playerDeck.order,
		...game.playerDiscard,
		...Object.values(game.players).flatMap(player => player.hand),
	];
	if (new Set(everywhere).size !== everywhere.length) problems.push('a Player card exists in two places');
	const infection = [
		...game.infectionDeck.order,
		...game.infectionDiscard,
		...game.gameEndArea.filter(id => id in campaign.infectionCards),
	];
	if (new Set(infection).size !== infection.length) problems.push('an Infection card exists in two places');
	if (game.infectionDeck.strata.flat().length !== game.infectionDeck.order.length)
		problems.push('infection strata drifted from the deck');
	if (game.playerDeck.piles.reduce((sum, pile) => sum + pile.size, 0) !== game.playerDeck.order.length)
		problems.push('player piles drifted from the deck');
	const total = game.stockpile + game.reserve + cubes - game.cubesAdded;
	const expected = cubeTotals.get(campaign.results.length) ?? total;
	cubeTotals.set(campaign.results.length, expected);
	if (total !== expected) problems.push(`cubes leaked: ${total} in play, ${expected} at setup`);
	const onGrid = grid(campaign);
	for (const player of Object.values(game.players)) {
		if (!campaign.locations[player.location]?.revealed) problems.push(`a pawn stands on unrevealed ${player.location}`);
		if (player.supplies < 0) problems.push('a character holds negative cubes');
	}
	if (game.incidents > pack.numbers.incidentLimit) problems.push('incidents ran past the limit');
	if (onGrid.size < 12) problems.push('the grid shrank');
	return problems;
}
