/**
 * Short scene-setting lines for playtest bot logs, keyed by the start of a briefing card's title.
 */
const FLAVOR: [prefix: string, line: string][] = [
	[
		'January',
		'The Tidewatch council opens the year with a ledger that does not balance. Scouts are told to look past the edge of the chart.',
	],
	['Supplies arrive', 'A convoy nobody expected ties up at dawn. The quartermasters argue over who signs for it.'],
	['February', 'A watch-post on the western shore reports lights where no one should be living.'],
	['Putting down roots', 'The masons ask for stone instead of canvas. Some depots are meant to outlast this crew.'],
	['March', 'Old harbour charts turn up in a drowned archive. Half the names on them are unknown to anyone alive.'],
	['Stretched too thin', 'Every new city is another mouth and another door left open at night.'],
	['April', 'The southern relay goes quiet for a week, then answers in a voice nobody recognises.'],
	['Rebuilding', 'A town that was written off sends a census. The number on it has gone up.'],
	['May', 'Fishermen talk of a platform far out east, lit and silent.'],
	['Experience', 'The veterans start teaching. The lessons are short and none of them are kind.'],
	['June', 'The fog over the old continent thins enough to count rooftops.'],
	['New arrivals', 'Two strangers walk in off the causeway with their own tools and no questions.'],
	['July', 'Someone is transmitting on a band the council retired years ago.'],
	['Listening', 'The operators sit up through the night and write down nothing they can use.'],
	['August', 'The towers hum. Whatever is out there has started to answer.'],
	['Hard lessons', 'The crews who came back are not the crews who left.'],
	['September', 'The stores that were locked away for safety are the first to spoil.'],
	['Closing in', 'The map has fewer blank places and none of them are empty.'],
	['October', 'The ones outside the walls are not all of one mind. Some of them are listening too.'],
	['A gap in the wall', 'A gate is found unbarred from the inside.'],
	['November', 'Four ledgers, four colours, one harbour. The council calls it the Plan and will not say who wrote it.'],
	['Almost there', 'Nobody sleeps. The boats are loaded twice.'],
	['December', 'One vial, one road, and a courier who will not be coming back the same.'],
	['The final reckoning', 'The council counts the living, city by city, and writes the year into the book.'],
	['North America revealed', 'The western shore resolves into streets, and the streets are not all dark.'],
	['South America revealed', 'River towns appear on the chart, strung along the water like beads.'],
	['Europe revealed', 'The old continent is crowded, tired, and very much awake.'],
	['Africa revealed', 'The southern roads are long, and someone has been keeping them clear.'],
	['Middle East and South Asia revealed', 'Caravan cities come onto the chart with their gates shut.'],
	['East Asia revealed', 'The far coast is brighter than anyone guessed.'],
	['Coral Sea haven found', 'A reef-ringed platform answers the hail on the first try.'],
	['Wellington and the Topaz lab found', 'At the bottom of the chart, a clean room with the lights still on.'],
	['Eastern Pacific haven sighted', 'A dot on the horizon holds its position against the current.'],
	['Eastern Pacific haven reached', 'The gangway is down. Whoever lowered it is gone.'],
	['Indian Ocean haven sighted', 'A beacon blinks a pattern from the old signal book.'],
	['Indian Ocean haven reached', 'The storerooms are full and the bunks are cold.'],
	['Opal lab found', 'Behind a collapsed stairwell, a door with a working lock.'],
	['Jade lab found', 'The notebooks are in three hands and end on the same day.'],
	['Pearl lab reached', 'Ice on the inside of the glass, and one rack still sealed.'],
	[
		'Forsaken cities',
		'The last lamp in a city goes out. The boats stop calling there until someone pays to bring it back.',
	],
	['Signals triangulated', 'Three towers, three bearings, and the lines cross on land.'],
	['The Hollow Men defect', 'They come in unarmed, and they bring maps.'],
	['Utopia opened', 'The harbour at the end of the Plan is real.'],
];

export function flavorFor(title: string): string | null {
	return FLAVOR.find(([prefix]) => title.startsWith(prefix))?.[1] ?? null;
}
