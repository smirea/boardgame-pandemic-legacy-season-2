import type { JobId } from '@repo/game';
import type { Timbre } from './voices.ts';

export const TIMBRES = {
	felt: {
		wave: 'triangle',
		partials: [
			[1, 1],
			[2, 0.18],
		],
		attack: 0.012,
		ring: 1.7,
		lowpass: 5,
	},
	blip: { wave: 'sine', partials: [[1, 1]], attack: 0.008 },
	wood: {
		wave: 'sine',
		partials: [
			[1, 1],
			[3.9, 0.22],
		],
		attack: 0.004,
		ring: 0.55,
	},
	flute: {
		wave: 'sine',
		partials: [
			[1, 1],
			[2, 0.12],
		],
		attack: 0.11,
		vibrato: [5, 11],
		breath: 0.22,
	},
	chime: {
		wave: 'sine',
		partials: [
			[1, 1],
			[2.76, 0.42],
			[5.4, 0.18],
		],
		attack: 0.003,
		ring: 2.4,
	},
	glass: {
		wave: 'sine',
		partials: [
			[1, 1],
			[2.003, 0.08],
		],
		attack: 0.5,
		vibrato: [6.1, 5],
	},
	horn: {
		wave: 'sawtooth',
		partials: [
			[1, 1],
			[2, 0.25],
		],
		attack: 0.35,
		lowpass: 3.2,
		vibrato: [4.6, 9],
	},
	kalimba: {
		wave: 'sine',
		partials: [
			[1, 1],
			[5.8, 0.14],
		],
		attack: 0.004,
		ring: 1.1,
	},
	celesta: {
		wave: 'triangle',
		partials: [
			[1, 0.7],
			[4, 0.3],
		],
		attack: 0.003,
		ring: 1.5,
		lowpass: 9,
	},
	pluck: { wave: 'sawtooth', partials: [[1, 1]], attack: 0.004, ring: 0.45, lowpass: 2.2 },
	swell: { wave: 'triangle', partials: [[1, 1]], attack: 2.2, lowpass: 2.6 },
	bell: {
		wave: 'sine',
		partials: [
			[1, 1],
			[2.76, 0.5],
			[5.4, 0.2],
			[8.9, 0.08],
		],
		attack: 0.004,
		ring: 5.5,
	},
	brass: {
		wave: 'sawtooth',
		partials: [
			[1, 1],
			[1.005, 0.6],
		],
		attack: 0.05,
		lowpass: 5.5,
		vibrato: [5.2, 7],
	},
	alarm: {
		wave: 'square',
		partials: [
			[1, 1],
			[1.012, 0.7],
		],
		attack: 0.004,
		ring: 0.16,
		lowpass: 6,
	},
	cello: {
		wave: 'sawtooth',
		partials: [
			[1, 1],
			[0.5, 0.5],
		],
		attack: 0.12,
		lowpass: 3,
		vibrato: [5, 10],
	},
} satisfies Record<string, Timbre>;

export type TimbreId = keyof typeof TIMBRES;

export type Theme = {
	timbre: TimbreId;
	/** Octaves above the pad's root. */
	register: number;
	level: number;
	/** Seconds per beat. */
	beat: number;
	/** Each note as [step of the tone's scale, beats]: 0 is the root, 7 the octave, null a rest. */
	notes: readonly (readonly [number | null, number])[];
	/** The step of the scale the pad leans on through the turn. */
	tint: number;
};

/**
 * One motif per occupation, written in steps of whatever scale the campaign's tone has, so a theme keeps its
 * contour, rhythm and instrument all year and takes the colour of the month.
 */
export const THEMES = {
	administrator: {
		timbre: 'felt',
		register: 2,
		level: 0.16,
		beat: 0.5,
		notes: [
			[0, 1],
			[4, 1],
			[2, 1],
			[4, 1],
			[0, 2],
		],
		tint: 4,
	},
	radioOperator: {
		timbre: 'blip',
		register: 3,
		level: 0.064,
		beat: 0.16,
		notes: [
			[4, 1],
			[4, 1],
			[4, 3],
			[null, 1],
			[7, 1],
			[4, 3],
		],
		tint: 1,
	},
	laborer: {
		timbre: 'wood',
		register: 1,
		level: 0.165,
		beat: 0.42,
		notes: [
			[0, 1],
			[0, 1],
			[4, 2],
			[0, 1],
			[3, 1],
			[0, 2],
		],
		tint: 3,
	},
	farmer: {
		timbre: 'flute',
		register: 3,
		level: 0.07,
		beat: 0.6,
		notes: [
			[0, 2],
			[2, 1],
			[4, 1],
			[5, 2],
			[4, 3],
		],
		tint: 2,
	},
	instructor: {
		timbre: 'chime',
		register: 3,
		level: 0.083,
		beat: 0.45,
		notes: [
			[4, 1],
			[2, 1],
			[4, 1],
			[7, 3],
		],
		tint: 5,
	},
	immunologist: {
		timbre: 'glass',
		register: 3,
		level: 0.062,
		beat: 0.9,
		notes: [
			[7, 2],
			[6, 1],
			[7, 1],
			[4, 3],
		],
		tint: 6,
	},
	captain: {
		timbre: 'horn',
		register: 1,
		level: 0.107,
		beat: 0.8,
		notes: [
			[0, 3],
			[4, 1],
			[7, 4],
		],
		tint: 0,
	},
	sanitationOfficer: {
		timbre: 'kalimba',
		register: 3,
		level: 0.108,
		beat: 0.3,
		notes: [
			[7, 1],
			[5, 1],
			[4, 1],
			[2, 1],
			[0, 2],
			[2, 1],
			[0, 3],
		],
		tint: 3,
	},
	scientist: {
		timbre: 'celesta',
		register: 3,
		level: 0.12,
		beat: 0.22,
		notes: [
			[0, 1],
			[4, 1],
			[8, 1],
			[11, 1],
			[9, 4],
		],
		tint: 5,
	},
	vectorControl: {
		timbre: 'pluck',
		register: 2,
		level: 0.21,
		beat: 0.26,
		notes: [
			[0, 1],
			[1, 1],
			[0, 1],
			[2, 1],
			[null, 1],
			[0, 1],
			[-1, 3],
		],
		tint: 1,
	},
} satisfies Record<JobId, Theme>;

export type CueDef = {
	label: string;
	/** Seconds the pad stays where the cue threw it. */
	hold: number;
	beat: number;
	/** Each note as [semitones above the root, beats]. A cue ignores the tone's scale: it means the same all year. */
	notes: readonly (readonly [number | null, number])[];
	voices: readonly { timbre: TimbreId; register: number; level: number }[];
	/** Where the pad jumps to at once: its second voice and its tint in semitones, and its filter as a factor. */
	pad: { drone: number; tint: number; light: number };
	thud: boolean;
};

export const CUES = {
	epidemic: {
		label: 'Epidemic',
		hold: 4,
		beat: 0.105,
		notes: [
			[12, 1],
			[6, 1],
			[13, 1],
			[7, 1],
			[12, 1],
			[6, 1],
			[1, 1],
			[0, 1],
			[0, 1],
			[-6, 1],
			[1, 1],
			[-5, 1],
			[0, 2],
			[-11, 2],
			[-12, 4],
		],
		voices: [{ timbre: 'alarm', register: 2, level: 0.075 }],
		pad: { drone: 6, tint: 13, light: 1.8 },
		thud: true,
	},
	setback: {
		label: 'Setback',
		hold: 9,
		beat: 0.38,
		notes: [
			[7, 2],
			[8, 1],
			[7, 1],
			[3, 2],
			[1, 1],
			[0, 4],
		],
		voices: [{ timbre: 'cello', register: 2, level: 0.085 }],
		pad: { drone: 8, tint: 15, light: 0.5 },
		thud: true,
	},
	triumph: {
		label: 'Triumph',
		hold: 10,
		beat: 0.17,
		notes: [
			[0, 1],
			[4, 1],
			[7, 1],
			[12, 2],
			[null, 1],
			[7, 1],
			[12, 1],
			[16, 5],
		],
		voices: [
			{ timbre: 'brass', register: 2, level: 0.235 },
			{ timbre: 'chime', register: 3, level: 0.12 },
		],
		pad: { drone: 7, tint: 16, light: 2.2 },
		thud: false,
	},
} satisfies Record<string, CueDef>;

export type Cue = keyof typeof CUES;
