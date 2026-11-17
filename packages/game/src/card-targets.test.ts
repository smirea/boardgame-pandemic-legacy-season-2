import { expect, test } from 'bun:test';
import { cardTargets } from './options';
import { campaignAt } from './scenarios';
import { botCommand } from './bot';
import { createGameActor, phaseOf } from './machine';
import { conjure, give } from './testkit';
import { pack } from './content/pack';
import { grid } from './helpers';

test('card hints use explored cities, production sites, legal player targets and no targets for anywhere events', () => {
	const actor = createGameActor({ seed: 11, save: campaignAt(1, 11) }).start();
	const rng = { seed: 11 };
	for (let i = 0; i < 200 && phaseOf(actor.getSnapshot()) !== 'playing.actions'; i++)
		actor.send(botCommand(actor.getSnapshot().context.world, phaseOf(actor.getSnapshot()), rng, 4));
	const world = structuredClone(actor.getSnapshot().context.world);
	const seat = world.game!.active;
	const productionSite = pack.cities.find(city => city.kind === 'city' && world.campaign.locations[city.id]?.revealed)!;
	world.game!.locations[productionSite.id]!.center = true;
	world.game!.pieces.center -= 1;

	for (const card of Object.values(world.campaign.playerCards)) {
		if (card.kind === 'city')
			expect(cardTargets(world, 'playing.actions', card.id).cities).toEqual(
				world.campaign.locations[card.city]!.revealed ? [card.city] : [],
			);
		if (card.kind === 'produce') {
			give(world, seat, [card.id]);
			expect(cardTargets(world, 'playing.actions', card.id).cities).toEqual(
				pack.cities
					.filter(
						city =>
							grid(world.campaign).has(city.id) && (city.kind === 'haven' || world.game!.locations[city.id]?.center),
					)
					.map(city => city.id),
			);
		}
	}
	const airlift = conjure(world, seat, { kind: 'event', event: 'airlift' });
	expect(cardTargets(world, 'playing.actions', airlift).seats).toEqual(world.game!.seats);
	expect(cardTargets(world, 'playing.actions', airlift).cities).toEqual([]);
	const quiet = conjure(world, seat, { kind: 'event', event: 'quietNight' });
	expect(cardTargets(world, 'playing.actions', quiet)).toEqual({ cities: [], seats: [] });

	const other = world.game!.seats.find(candidate => candidate !== seat)!;
	const wind = conjure(world, other, { kind: 'event', event: 'secondWind' });
	expect(cardTargets(world, 'playing.actions', wind).seats).toEqual([seat]);
	world.game!.stockpile += 3;
	world.game!.reserve -= 3;
	const surplus = conjure(world, other, { kind: 'companion', companion: 'surplus' });
	expect(cardTargets(world, 'playing.actions', surplus).seats).toEqual([other]);
	const here = world.game!.players[other]!.location;
	world.game!.locations[here]!.plague = 1;
	const medic = conjure(world, other, { kind: 'companion', companion: 'medic' });
	expect(cardTargets(world, 'playing.actions', medic).cities).toEqual([here]);
	actor.stop();
});
