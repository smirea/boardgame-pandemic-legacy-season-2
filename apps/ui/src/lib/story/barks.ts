import type { SpeakerId } from './cast.ts';
import type { StoryBeat, StoryScene } from './script.ts';

/** A moment of play the cast answers over the radio: nothing the Legacy schedule plans, only what this table did. */
export type BarkMoment =
	| 'firstIncident'
	| 'outbreak'
	| 'stockpileDry'
	| 'brink'
	| 'hollow'
	| 'objective'
	| 'connected'
	| 'lowDeck'
	| 'won'
	| 'lost'
	| 'epitaph';

type BarkDef = {
	speaker: SpeakerId;
	style: NonNullable<StoryBeat['style']>;
	direction: string;
	/** Heard once a game. The others may come back, a few turns apart. */
	once: boolean;
	/** Said whatever was said a moment ago. */
	urgent: boolean;
	lines: string[];
};

/**
 * Every line is short enough to say over a move, names no player, character or city, and is spoken by someone the
 * table has known since the prologue, so none of it can give the story away.
 */
export const BARKS: Record<BarkMoment, BarkDef> = {
	firstIncident: {
		speaker: 'kai',
		style: 'radio',
		direction: 'urgent field radio report, clipped, breath held, bad news delivered fast',
		once: true,
		urgent: false,
		lines: [
			'Sparks here. We just lost a city to the plague. First one today.',
			"That's an incident. Keep the supplies moving, people.",
			"Plague's in. One city down. Don't let it be two.",
		],
	},
	outbreak: {
		speaker: 'tomas',
		style: 'radio',
		direction: 'grim, tired medic over the radio, quiet anger under the words',
		once: false,
		urgent: false,
		lines: [
			"It's past the walls. The neighbours are burning through their supplies.",
			'Outbreak. Every city around it just paid for our mistake.',
			'It jumped. Nothing was left there to slow it down.',
		],
	},
	stockpileDry: {
		speaker: 'mara',
		style: 'radio',
		direction: 'hard, level command voice over the radio, no panic, the weight of a bad count',
		once: true,
		urgent: false,
		lines: [
			"Stockpile's empty. Nothing more leaves the havens until we make it.",
			"We're out. What's on that map is all there is.",
			'The stores are bare. Produce, or we watch the grid starve.',
		],
	},
	brink: {
		speaker: 'mara',
		style: 'radio',
		direction: 'low, taut, every word placed, the last warning before disaster',
		once: true,
		urgent: true,
		lines: [
			'One more and we lose the grid. Hold the line.',
			"We can't take another hit. Not one.",
			'This is the edge. Everybody be very careful now.',
		],
	},
	hollow: {
		speaker: 'kai',
		style: 'radio',
		direction: 'low, tense and urgent over the radio, watching something move in the dark, every word spoken clearly',
		once: true,
		urgent: false,
		lines: [
			"Movement on the scopes. Hollow Men, and they're not passing through.",
			'They are here. Do not leave that city without a plan.',
			'Hollow Men sighted. Stay out of reach.',
		],
	},
	objective: {
		speaker: 'mara',
		style: 'radio',
		direction: 'brisk, proud, a rare warm note, already thinking about the next thing',
		once: false,
		urgent: false,
		lines: [
			"That's the job done. Good work. Keep moving.",
			"One down. Don't stop to celebrate.",
			"That's it. That's what we came for.",
		],
	},
	connected: {
		speaker: 'tomas',
		style: 'radio',
		direction: 'quiet relief over the radio, a small smile in the voice',
		once: false,
		urgent: false,
		lines: [
			'Another city on the grid. They can hear us again.',
			"The line holds. That's a city that eats tonight.",
			"Connected. Write it down. That one's ours.",
		],
	},
	lowDeck: {
		speaker: 'tomas',
		style: 'radio',
		direction: 'measured, worried, counting down under his breath',
		once: true,
		urgent: false,
		lines: [
			"The season's nearly over. We're almost out of time.",
			'Not many days left. Finish what you came to do.',
			"Time's nearly up. Make these last days count.",
		],
	},
	won: {
		speaker: 'mara',
		style: 'radio',
		direction: 'exhausted relief breaking into pride, voice rough from a long day',
		once: true,
		urgent: true,
		lines: [
			'The grid held. Bring everyone home.',
			'We made it through the month. Get some rest.',
			"That's a win. We'll take every one we can get.",
		],
	},
	lost: {
		speaker: 'mara',
		style: 'radio',
		direction: 'heavy, flat, refusing to break, an order given through grief',
		once: true,
		urgent: true,
		lines: [
			'We lost this one. Pull back to the havens.',
			"It wasn't enough. We go again.",
			"Fall back. We'll count what's left in the morning.",
		],
	},
	epitaph: {
		speaker: 'chronicler',
		style: 'narrator',
		direction: 'slow, grave eulogy, almost a whisper, long pause after the first sentence',
		once: false,
		urgent: true,
		lines: [
			'The sea keeps no graves. We write the name down, so that something does.',
			'Another name for the wall at the haven. They went further than most.',
			'They knew the price of the mainland. They paid it, so that others would not.',
			'Remember them as they were on the water, not as the plague left them.',
		],
	},
};

export type Bark = { id: string; moment: BarkMoment; speaker: SpeakerId; text: string };

/** The line for a moment. `pick` is any number every browser agrees on, so the whole table hears the same one. */
export function barkFor(moment: BarkMoment, pick: number): Bark {
	const def = BARKS[moment];
	const index = ((pick % def.lines.length) + def.lines.length) % def.lines.length;
	return { id: `bark_${moment}_${index + 1}`, moment, speaker: def.speaker, text: def.lines[index]! };
}

/** The lines as a scene of the script, which is what `gen-voices.ts` records from. */
export const BARK_SCENE: StoryScene = {
	id: 'radio',
	act: 'Radio',
	title: 'Radio traffic',
	beats: (Object.keys(BARKS) as BarkMoment[]).flatMap(moment =>
		BARKS[moment].lines.map((_, index): StoryBeat => {
			const bark = barkFor(moment, index);
			return {
				id: bark.id,
				speaker: bark.speaker,
				text: bark.text,
				style: BARKS[moment].style,
				direction: BARKS[moment].direction,
			};
		}),
	),
};
