import { expect, test } from 'bun:test';
import { pack } from './content/pack';
import type { EdgeDef } from './content/types';
import { passage, routeCourse } from './helpers';
import { coursesCross, runAlongside, runsOver } from './lanes';
import { newCampaign } from './legacy';

const startingEdges = pack.edges;
/** Every sea lane the Legacy deck lays itself when a region opens, which no rule checks for crossings. */
const deckEdges = pack.bundles.flatMap(bundle =>
	bundle.unlocks.flatMap(unlock => (unlock.t === 'region' ? (unlock.connect ?? []) : [])),
);
const name = (edge: EdgeDef) => `${edge.a}-${edge.b}`;
const courseOf = (edge: EdgeDef) => routeCourse(edge.a, edge.b, edge.kind);
const pairs = <T>(items: T[]) =>
	items.flatMap((one, index) => items.slice(index + 1).map(other => [one, other] as const));

test('no two lines the board starts with or the deck lays cross', () => {
	const lines = [...startingEdges, ...deckEdges];
	const crossings = pairs(lines)
		.filter(([one, other]) => one.kind === other.kind && coursesCross(courseOf(one), courseOf(other)))
		.map(([one, other]) => `${name(one)} x ${name(other)}`);
	expect(crossings).toEqual([]);
});

test('no starting line runs over a location it does not join', () => {
	const ends = new Set(startingEdges.flatMap(edge => [edge.a, edge.b]));
	const over = startingEdges.flatMap(edge =>
		[...ends].filter(city => runsOver(courseOf(edge), pack.positions[city]!)).map(city => `${name(edge)} over ${city}`),
	);
	expect(over).toEqual([]);
});

test('no two starting lines run alongside each other away from the location they share', () => {
	const together = pairs(startingEdges)
		.filter(
			([one, other]) => runAlongside(courseOf(one), courseOf(other)) || runAlongside(courseOf(other), courseOf(one)),
		)
		.map(([one, other]) => `${name(one)} with ${name(other)}`);
	expect(together).toEqual([]);
});

test('no starting line runs over ground the fog hides at the start', () => {
	const campaign = newCampaign(0);
	const hidden = startingEdges.flatMap(edge =>
		passage(edge.a, edge.b, edge.kind)
			.through.filter(id => !campaign.locations[id]?.revealed)
			.map(id => `${name(edge)} over ${id}`),
	);
	expect(hidden).toEqual([]);
});
