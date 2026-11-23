import type { ActionId } from '@repo/game';
import { TIMBRES, type TimbreId } from './themes.ts';
import { burst, cry, sing, type ScoreBus } from './voices.ts';

/** Where and when a sound plays, and the Hz of the music's root, so every pitched sound sits in the month's key. */
export type Play = { bus: ScoreBus; at: number; key: number };

type Sound = (p: Play) => void;

const semis = (hz: number, steps: number) => hz * 2 ** (steps / 12);
const rand = (spread: number) => Math.random() * spread;

/** A note of the key on one of the score's instruments. */
function note(p: Play, after: number, timbre: TimbreId, octave: number, steps: number, slot: number, level: number) {
	sing(p.bus, TIMBRES[timbre], {
		at: p.at + after,
		hz: semis(p.key * 2 ** octave, steps),
		slot,
		level,
		dest: p.bus.out,
		echo: 0.3,
	});
}

type Knock = { ring?: number; drop?: number; click?: number; wave?: OscillatorType };

/** Something struck: a pitch that sags as it dies, and the click of the strike. */
function knock(p: Play, after: number, hz: number, level: number, k: Knock = {}) {
	cry(p.bus, p.bus.out, {
		wave: k.wave ?? 'triangle',
		at: p.at + after,
		length: k.ring ?? 0.09,
		level,
		attack: 0.003,
		hold: 0.05,
		contour: [
			[0, hz],
			[1, hz * (k.drop ?? 0.6)],
		],
	});
	const click = k.click ?? 0.5;
	if (click > 0) {
		burst(p.bus, p.bus.out, {
			color: 'white',
			at: p.at + after,
			length: 0.025,
			level: level * click,
			attack: 0.002,
			filter: ['bandpass', Math.min(6000, hz * 5), 2.4],
		});
	}
}

/** A blow with weight behind it. Its upper half is what a laptop speaker carries. */
function thud(p: Play, after: number, hz: number, length: number, level: number) {
	for (const [ratio, share] of [
		[1, 1],
		[2.1, 0.45],
	] as const) {
		cry(p.bus, p.bus.out, {
			wave: 'sine',
			at: p.at + after,
			length,
			level: level * share,
			attack: 0.006,
			hold: 0.08,
			contour: [
				[0, hz * ratio],
				[1, hz * ratio * 0.42],
			],
		});
	}
}

type Hiss = { color?: 'white' | 'pink' | 'brown'; attack?: number; sweepTo?: number; echo?: number };

function hiss(
	p: Play,
	after: number,
	length: number,
	level: number,
	filter: readonly [BiquadFilterType, number, number?],
	h: Hiss = {},
) {
	burst(p.bus, p.bus.out, {
		color: h.color ?? 'white',
		at: p.at + after,
		length,
		level,
		attack: h.attack,
		filter,
		sweepTo: h.sweepTo,
		echo: h.echo,
	});
}

type Glide = { attack?: number; hold?: number; band?: readonly [number, number]; rasp?: number; echo?: number };

function glide(
	p: Play,
	after: number,
	wave: OscillatorType,
	contour: readonly (readonly [number, number])[],
	length: number,
	level: number,
	g: Glide = {},
) {
	cry(p.bus, p.bus.out, { wave, at: p.at + after, length, level, contour, ...g });
}

const hammer = (p: Play, after: number, hz: number) => {
	knock(p, after, hz, 0.2, { ring: 0.07, drop: 0.7 });
	thud(p, after, 120, 0.09, 0.16);
};
const clank = (p: Play, after: number, hz: number, level = 0.1) => {
	for (const ratio of [1, 2.76, 5.4])
		knock(p, after, hz * ratio, level / ratio, { ring: 0.16, drop: 0.98, wave: 'sine', click: 0.3 });
};
const cardSlide = (p: Play, after: number, up = true) =>
	hiss(p, after, 0.11, 0.13, ['bandpass', up ? 1500 : 2600, 1.3], {
		color: 'pink',
		attack: 0.012,
		sweepTo: up ? 2700 : 1300,
	});
const blip = (p: Play, after: number, steps: number, length = 0.07) => note(p, after, 'blip', 3, steps, length, 0.05);
const heartbeat = (p: Play, after: number) => {
	thud(p, after, 68, 0.19, 0.3);
	thud(p, after + 0.22, 68, 0.19, 0.24);
};

/**
 * Sets a whole sound's level against its neighbours, in dB. The levels come from rendering every sound alone and
 * measuring it: a short tap peaks near -13 dBFS, a move sits near -27, and only a blow to the table goes past -20.
 */
function trim<A extends unknown[]>(db: number, sound: (p: Play, ...rest: A) => void) {
	return (p: Play, ...rest: A) => {
		const out = p.bus.ctx.createGain();
		out.gain.value = 10 ** (db / 20);
		out.connect(p.bus.out);
		sound({ ...p, bus: { ...p.bus, out } }, ...rest);
	};
}

const PENTATONIC = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];

/**
 * The pieces. A run of supply cubes climbs a scale as it is set down and falls down one as it is stripped away, so
 * the ear counts them. `n` is a cube's place in its run.
 */
export const PIECES = {
	supplyPlace: (p: Play, n = 0) => {
		const step = PENTATONIC[n % PENTATONIC.length]!;
		knock(p, 0, semis(p.key * 4, step), 0.2, { ring: 0.12, drop: 0.82 });
		note(p, 0, 'wood', 2, step, 0.1, 0.1);
		knock(p, 0.055, semis(p.key * 4, step) * 1.26, 0.06, { ring: 0.05, drop: 0.85 });
	},
	supplyLift: trim(5, (p: Play, n = 0) => {
		const hz = semis(p.key * 4, 7 + (PENTATONIC[n % PENTATONIC.length]! % 12));
		glide(
			p,
			0,
			'triangle',
			[
				[0, hz * 0.7],
				[1, hz],
			],
			0.07,
			0.14,
			{ attack: 0.004, hold: 0.3 },
		);
		hiss(p, 0, 0.03, 0.08, ['bandpass', hz * 4, 2.2]);
	}),
	supplyPass: trim(8, (p: Play) => {
		knock(p, 0, p.key * 4, 0.1, { ring: 0.06, drop: 0.8, click: 0.3 });
		knock(p, 0.07, p.key * 5, 0.08, { ring: 0.06, drop: 0.8, click: 0.3 });
	}),
	supplyPile: trim(6, (p: Play) => {
		knock(p, 0, p.key * 3, 0.14, { ring: 0.08, drop: 0.7 });
		knock(p, 0.03 + rand(0.02), p.key * 3.6, 0.06, { ring: 0.05, drop: 0.8 });
	}),
	supplyLost: (p: Play, n = 0) => {
		const hz = semis(p.key * 4, -2 * Math.min(n, 6));
		hiss(p, 0, 0.05, 0.34, ['highpass', 1800], { attack: 0.001 });
		for (let i = 0; i < 3; i++)
			hiss(p, 0.03 + i * 0.035 + rand(0.02), 0.02, 0.16 - i * 0.03, ['bandpass', 2600 + rand(1500), 3]);
		glide(
			p,
			0,
			'sawtooth',
			[
				[0, hz],
				[1, hz * 0.45],
			],
			0.28,
			0.16,
			{ attack: 0.004, hold: 0.1, band: [900, 1.5] },
		);
		thud(p, 0.02, 120, 0.3, 0.35);
		hiss(p, 0, 0.5, 0.06, ['lowpass', 700], { attack: 0.01, echo: 0.6 });
	},
	skull: trim(3, (p: Play) => {
		note(p, 0, 'glass', 3, 6, 1.5, 0.05);
		note(p, 0, 'glass', 3, 13, 1.5, 0.04);
		for (let i = 0; i < 7; i++) knock(p, 0.1 + i * 0.11 - i * i * 0.006, 900 - i * 60, 0.07, { ring: 0.03 });
		hiss(p, 0, 1.3, 0.05, ['bandpass', 1400, 1.2], { attack: 1, sweepTo: 3000 });
	}),
	plague: trim(-2, (p: Play) => {
		thud(p, 0, 98, 0.34, 0.4);
		knock(p, 0, 160, 0.22, { ring: 0.3, drop: 0.4, wave: 'sine', click: 0.3 });
		note(p, 0.01, 'chime', 3, 1, 0.1, 0.06);
		note(p, 0.01, 'chime', 3, 7, 0.1, 0.05);
		hiss(p, 0, 0.12, 0.14, ['bandpass', 780, 2], { color: 'pink', sweepTo: 260, echo: 0.3 });
	}),
	hollowArrive: (p: Play) => {
		for (const at of [0, 0.17]) {
			thud(p, at, 78, 0.3, 0.26);
			hiss(p, at, 0.13, 0.2, ['lowpass', 460], { color: 'brown', echo: 0.3 });
			knock(p, at, 150, 0.12, { ring: 0.12, drop: 0.5, click: 0 });
		}
		for (let i = 0; i < 5; i++) hiss(p, 0.05 + i * 0.045 + rand(0.02), 0.018, 0.07, ['bandpass', 3200 + rand(1200), 5]);
		glide(
			p,
			0.1,
			'sawtooth',
			[
				[0, 58],
				[0.5, 50],
				[1, 54],
			],
			0.7,
			0.2,
			{ attack: 0.1, band: [220, 3], rasp: 26 },
		);
	},
	hollowLeave: trim(2, (p: Play) => {
		for (let i = 0; i < 3; i++) {
			thud(p, i * 0.19, 80, 0.2, 0.2 - i * 0.06);
			hiss(p, i * 0.19, 0.1, 0.13 - i * 0.04, ['lowpass', 420], { color: 'brown' });
		}
		hiss(p, 0.5, 0.5, 0.05, ['bandpass', 900, 1], { attack: 0.2, sweepTo: 400 });
	}),
	gather: (p: Play) => {
		for (const at of [0, 0.32, 0.52, 0.66]) {
			thud(p, at, 70, 0.3, 0.3);
			knock(p, at, 130, 0.14, { ring: 0.15, drop: 0.5, click: 0.2 });
		}
		note(p, 0.1, 'horn', 1, 1, 0.5, 0.1);
		note(p, 0.6, 'horn', 1, 0, 0.7, 0.1);
	},
	held: trim(3, (p: Play) => {
		knock(p, 0, 170, 0.2, { ring: 0.18, drop: 0.7, click: 0.25 });
		knock(p, 0, 1250, 0.05, { ring: 0.1, drop: 1, wave: 'sine', click: 0 });
	}),
} satisfies Record<string, (p: Play, n?: number) => void>;

export type PieceId = keyof typeof PIECES;

const wash = (p: Play, seconds: number, level: number) =>
	hiss(p, 0, seconds, level, ['bandpass', 700, 0.7], { color: 'pink', attack: seconds * 0.45, sweepTo: 420 });

/** How a pawn crosses the board, each for as long as its trip takes. */
export const TRAVEL = {
	road: trim(7, (p: Play, seconds: number) => {
		glide(
			p,
			0,
			'sawtooth',
			[
				[0, 52],
				[0.25, 74],
				[0.75, 70],
				[1, 48],
			],
			seconds,
			0.16,
			{
				attack: 0.12,
				hold: 0.8,
				band: [320, 1.2],
				rasp: 27,
			},
		);
		hiss(p, 0, seconds, 0.05, ['bandpass', 1100, 0.8], { color: 'pink', attack: 0.15 });
	}),
	ferry: trim(2, (p: Play, seconds: number) => {
		note(p, 0, 'horn', 1, 7, 0.35, 0.12);
		for (let at = 0.25; at < seconds - 0.1; at += 0.2) {
			thud(p, at, 95, 0.14, 0.12);
			knock(p, at, 190, 0.06, { ring: 0.06, click: 0.3 });
		}
		hiss(p, 0, seconds, 0.07, ['lowpass', 600], { color: 'pink', attack: seconds * 0.4 });
	}),
	sail: trim(4, (p: Play, seconds: number) => {
		note(p, 0, 'bell', 3, 7, 0.1, 0.05);
		wash(p, seconds, 0.1);
		glide(
			p,
			0.2,
			'sawtooth',
			[
				[0, 95],
				[0.5, 120],
				[1, 88],
			],
			0.5,
			0.1,
			{ attack: 0.1, band: [650, 4], rasp: 9 },
		);
	}),
	charter: (p: Play, seconds: number) => {
		note(p, 0, 'horn', 1, 0, 0.9, 0.12);
		note(p, 0, 'horn', 1, 7, 0.9, 0.09);
		wash(p, seconds, 0.09);
	},
	flight: trim(7, (p: Play, seconds: number) => {
		glide(
			p,
			0,
			'sawtooth',
			[
				[0, 90],
				[0.4, 128],
				[1, 84],
			],
			seconds,
			0.14,
			{
				attack: 0.2,
				hold: 0.75,
				band: [480, 1],
				rasp: 43,
			},
		);
		hiss(p, 0, seconds, 0.06, ['bandpass', 1500, 0.8], { attack: seconds * 0.5, sweepTo: 700 });
	}),
	airlift: trim(7, (p: Play, seconds: number) => {
		const chops = Math.floor(seconds / 0.085);
		for (let i = 0; i < chops; i++)
			hiss(p, i * 0.085, 0.05, 0.03 + 0.09 * Math.sin((Math.PI * i) / chops), ['lowpass', 380], { color: 'brown' });
		glide(
			p,
			0,
			'sine',
			[
				[0, 600],
				[0.5, 760],
				[1, 560],
			],
			seconds,
			0.03,
			{ attack: 0.2 },
		);
	}),
	foot: trim(6, (p: Play, seconds: number) => {
		const steps = Math.max(4, Math.min(8, Math.round(seconds / 0.17)));
		for (let i = 0; i < steps; i++) {
			const at = (i * seconds) / steps;
			thud(p, at, 110, 0.1, 0.09);
			hiss(p, at, 0.03, 0.07, ['bandpass', 1900 + (i % 2) * 500, 2]);
		}
	}),
} satisfies Record<string, (p: Play, seconds: number) => void>;

export type TravelId = keyof typeof TRAVEL;

/** The moments of a game that are nobody's action. */
export const MOMENTS = {
	gameStart: p => {
		note(p, 0, 'bell', 3, 7, 0.1, 0.09);
		note(p, 0.5, 'bell', 3, 7, 0.1, 0.07);
		note(p, 0, 'horn', 1, 0, 2.2, 0.09);
		note(p, 0.3, 'horn', 1, 7, 1.9, 0.06);
		hiss(p, 0, 0.5, 0.05, ['bandpass', 1800, 1.2], { attack: 0.1, sweepTo: 2800 });
	},
	infestation: trim(-3, p => {
		note(p, 0, 'cello', 1, 1, 0.75, 0.14);
		note(p, 0.75, 'cello', 1, 0, 1.3, 0.16);
		glide(
			p,
			0,
			'sawtooth',
			[
				[0, 2100],
				[1, 2500],
			],
			1.5,
			0.025,
			{ attack: 1.1, band: [2400, 3], rasp: 57 },
		);
		glide(
			p,
			0.1,
			'sawtooth',
			[
				[0, 1900],
				[1, 2250],
			],
			1.4,
			0.02,
			{ attack: 1, band: [2100, 3], rasp: 49 },
		);
		thud(p, 0.75, 90, 0.5, 0.3);
		for (let i = 0; i < 5; i++) knock(p, 1 + i * 0.07, 700 - i * 50, 0.05, { ring: 0.03 });
	}),
	turnEnd: trim(5, p => {
		knock(p, 0, p.key * 6, 0.1, { ring: 0.1, drop: 0.9 });
		knock(p, 0.11, p.key * 4, 0.1, { ring: 0.1, drop: 0.9 });
		note(p, 0.11, 'felt', 2, 0, 0.1, 0.05);
	}),
	objective: p => {
		note(p, 0, 'chime', 3, 0, 0.1, 0.07);
		note(p, 0.12, 'chime', 3, 7, 0.1, 0.07);
		note(p, 0.24, 'chime', 3, 12, 0.1, 0.09);
	},
	event: p => {
		hiss(p, 0, 0.05, 0.2, ['lowpass', 1500], { color: 'pink' });
		thud(p, 0, 150, 0.12, 0.2);
		note(p, 0.06, 'celesta', 3, 7, 0.1, 0.06);
		note(p, 0.16, 'celesta', 3, 12, 0.1, 0.07);
	},
	rateOpen: trim(9, p => {
		for (let i = 0; i < 5; i++) knock(p, i * 0.05, 520 + i * 70, 0.07, { ring: 0.03, wave: 'sine' });
	}),
	rateMove: p => {
		hiss(p, 0, 0.42, 0.06, ['bandpass', 900, 3], { color: 'pink', attack: 0.05, sweepTo: 1500 });
		knock(p, 0.46, 190, 0.24, { ring: 0.16, drop: 1.5, click: 0.6 });
		thud(p, 0.46, 110, 0.2, 0.2);
	},
	rateRise: p => {
		note(p, 0, 'cello', 1, 0, 0.3, 0.12);
		note(p, 0.3, 'cello', 1, 1, 0.8, 0.14);
	},
	rateShut: trim(10, p => {
		for (let i = 0; i < 3; i++) knock(p, i * 0.05, 660 - i * 90, 0.06, { ring: 0.03, wave: 'sine' });
	}),
	cardLand: trim(24, p => hiss(p, 0, 0.07, 0.07, ['bandpass', 1300, 1.2], { color: 'pink', sweepTo: 700 })),
	exposureSafe: trim(16, p => hiss(p, 0, 0.3, 0.09, ['lowpass', 900], { color: 'pink', attack: 0.05, sweepTo: 350 })),
	scar: p => {
		heartbeat(p, 0);
		hiss(p, 0, 0.16, 0.2, ['bandpass', 2400, 1.4], { attack: 0.003, sweepTo: 900 });
	},
	death: p => {
		heartbeat(p, 0);
		heartbeat(p, 0.6);
		note(p, 0.9, 'bell', 2, 0, 0.1, 0.12);
		note(p, 0.9, 'cello', 1, 0, 2.4, 0.1);
	},
} satisfies Record<string, Sound>;

export type MomentId = keyof typeof MOMENTS;

/**
 * What each action sounds like beyond the pieces it moves. Null where the pieces say it all: a move is heard as its
 * vehicle, and cubes changing hands as the cubes.
 */
export const ACTIONS = {
	drive: null,
	sail: null,
	charter: null,
	shuttle: null,
	administratorMove: null,
	captainSail: null,
	run: null,
	deliver: null,
	pickUp: null,
	transfer: null,
	supply: trim(10, p => blip(p, 0, 7)),
	makeSupplies: p => {
		hiss(p, 0, 0.06, 0.14, ['bandpass', 900, 1.5]);
		thud(p, 0.03, 130, 0.14, 0.2);
	},
	produce: trim(3, p => {
		for (let i = 0; i < 3; i++) clank(p, i * 0.16, 420 + i * 40);
		hiss(p, 0.5, 0.45, 0.07, ['highpass', 3000], { attack: 0.03, sweepTo: 5200 });
	}),
	share: trim(18, p => {
		cardSlide(p, 0, true);
		cardSlide(p, 0.16, false);
	}),
	trade: trim(9, p => {
		cardSlide(p, 0, true);
		cardSlide(p, 0.14, false);
		clank(p, 0.3, 1900, 0.05);
	}),
	broker: trim(8, p => {
		for (let i = 0; i < 3; i++) clank(p, i * 0.09 + rand(0.02), 2100 + i * 260, 0.05);
	}),
	buildCenter: p => {
		for (let i = 0; i < 3; i++) hammer(p, i * 0.17, 320);
		note(p, 0.5, 'felt', 1, 0, 0.1, 0.09);
		note(p, 0.5, 'felt', 1, 7, 0.1, 0.07);
	},
	buildTower: trim(6, p => {
		for (let i = 0; i < 6; i++) knock(p, i * 0.055, 900 + i * 130, 0.07, { ring: 0.03, wave: 'sine' });
		blip(p, 0.4, 12, 0.5);
	}),
	buildShelter: p => {
		hammer(p, 0, 260);
		hammer(p, 0.17, 260);
		hiss(p, 0.34, 0.28, 0.16, ['lowpass', 500], { color: 'brown', attack: 0.02 });
	},
	rehab: trim(3, p => {
		for (let i = 0; i < 4; i++)
			hiss(p, i * 0.13, 0.11, 0.1, ['bandpass', i % 2 ? 1700 : 2300, 4], {
				attack: 0.02,
				sweepTo: i % 2 ? 2300 : 1700,
			});
		hammer(p, 0.58, 300);
	}),
	recon: trim(6, p => {
		knock(p, 0, 2400, 0.07, { ring: 0.02, wave: 'sine' });
		hiss(p, 0.08, 0.4, 0.09, ['bandpass', 1500, 1.4], { color: 'pink', attack: 0.05, sweepTo: 3200 });
		note(p, 0.3, 'horn', 2, 0, 0.3, 0.07);
		note(p, 0.6, 'horn', 2, 7, 0.6, 0.08);
	}),
	establishLine: trim(8, p => {
		glide(
			p,
			0,
			'sawtooth',
			[
				[0, 110],
				[1, 190],
			],
			0.4,
			0.09,
			{ attack: 0.05, band: [700, 5], rasp: 14 },
		);
		hiss(p, 0.3, 0.3, 0.11, ['bandpass', 1600, 2.6], { color: 'pink', attack: 0.02, sweepTo: 2500 });
		knock(p, 0.6, p.key * 4, 0.1, { ring: 0.1 });
	}),
	chartLane: trim(6, p => {
		hiss(p, 0, 0.3, 0.1, ['bandpass', 2100, 3], { color: 'pink', attack: 0.02, sweepTo: 2900 });
		wash(p, 0.8, 0.08);
		note(p, 0.45, 'bell', 3, 0, 0.1, 0.045);
	}),
	search: trim(10, p => {
		for (let i = 0; i < 4; i++)
			hiss(p, i * 0.095, 0.085, 0.12, ['bandpass', 2900 + (i % 2) * 700, 3.4], {
				attack: 0.012,
				sweepTo: 4600 - (i % 2) * 900,
			});
	}),
	investigate: trim(18, p => {
		for (let i = 0; i < 3; i++)
			hiss(p, i * 0.15, 0.09, 0.12, ['bandpass', 1900, 1.4], { color: 'pink', attack: 0.01, sweepTo: 900 });
	}),
	transmit: trim(8, p => {
		for (const [i, steps] of [0, 0, 7, 12, 19].entries()) blip(p, i * 0.085, steps);
	}),
	monitor: trim(5, p => {
		hiss(p, 0, 0.35, 0.1, ['bandpass', 1100, 5.5], { sweepTo: 2400 });
		blip(p, 0.24, 7, 0.3);
		blip(p, 0.36, 14, 0.3);
	}),
	broadcast: trim(9, p => {
		glide(
			p,
			0,
			'sine',
			[
				[0, 1400],
				[1, 1500],
			],
			0.9,
			0.025,
			{ attack: 0.1 },
		);
		for (let i = 0; i < 5; i++)
			glide(
				p,
				0.1 + i * 0.14,
				'sawtooth',
				[
					[0, 170 + rand(60)],
					[1, 150 + rand(60)],
				],
				0.1,
				0.09,
				{
					attack: 0.02,
					band: [900 + rand(900), 4],
				},
			);
	}),
	misinform: trim(10, p => {
		glide(
			p,
			0,
			'sine',
			[
				[0, 1500],
				[1, 1050],
			],
			1,
			0.03,
			{ attack: 0.1, rasp: 13 },
		);
		for (let i = 0; i < 5; i++)
			glide(
				p,
				0.1 + i * 0.15,
				'sawtooth',
				[
					[0, 190 - i * 14],
					[1, 150 - i * 12],
				],
				0.11,
				0.09,
				{
					attack: 0.02,
					band: [1500 - i * 150, 4],
				},
			);
	}),
	sabotage: p => {
		hiss(p, 0, 0.5, 0.06, ['highpass', 2500], { attack: 0.02, sweepTo: 6000 });
		thud(p, 0.5, 100, 0.5, 0.36);
		hiss(p, 0.5, 0.6, 0.24, ['lowpass', 800], { color: 'brown', attack: 0.01, sweepTo: 150, echo: 0.4 });
	},
	selfInject: p => {
		hiss(p, 0, 0.22, 0.1, ['highpass', 4000], { attack: 0.01 });
		heartbeat(p, 0.3);
	},
	inoculate: trim(3, p => {
		hiss(p, 0, 0.14, 0.09, ['highpass', 3200], { attack: 0.01 });
		hiss(p, 0.2, 0.14, 0.09, ['highpass', 3200], { attack: 0.01 });
		note(p, 0.3, 'glass', 2, 0, 0.9, 0.05);
		note(p, 0.45, 'glass', 2, 7, 0.9, 0.05);
	}),
	salvage: trim(4, p => {
		for (const [at, hz] of [
			[0, 520],
			[0.13, 380],
			[0.31, 640],
		] as const)
			clank(p, at + rand(0.03), hz);
		hiss(p, 0.1, 0.3, 0.07, ['bandpass', 1200, 2], { attack: 0.05, sweepTo: 800 });
	}),
	destroyInfection: trim(10, p => {
		for (let i = 0; i < 5; i++)
			hiss(p, i * 0.045, 0.05, 0.14, ['bandpass', 1000 + i * 260, 2], { color: 'pink', sweepTo: 520 });
		for (let i = 0; i < 6; i++) hiss(p, 0.3 + rand(0.5), 0.012, 0.06, ['highpass', 2500]);
	}),
	facilitate: trim(8, p => {
		glide(
			p,
			0,
			'sine',
			[
				[0, 1300],
				[1, 1750],
			],
			0.16,
			0.05,
			{ attack: 0.02 },
		);
		glide(
			p,
			0.2,
			'sine',
			[
				[0, 1750],
				[1, 2300],
			],
			0.2,
			0.05,
			{ attack: 0.02 },
		);
	}),
	coordinate: trim(9, p => {
		hiss(p, 0, 0.03, 0.16, ['bandpass', 1500, 1]);
		hiss(p, 0.15, 0.03, 0.16, ['bandpass', 1500, 1]);
		blip(p, 0.3, 12, 0.12);
	}),
	smuggle: trim(9, p => {
		hiss(p, 0, 0.35, 0.07, ['lowpass', 500], { color: 'brown', attack: 0.08 });
		knock(p, 0.4, 150, 0.09, { ring: 0.08, click: 0.15 });
		knock(p, 0.52, 150, 0.07, { ring: 0.08, click: 0.15 });
	}),
	carry: p => {
		thud(p, 0, 95, 0.2, 0.16);
		hiss(p, 0.05, 0.25, 0.06, ['bandpass', 1100, 0.8], { color: 'pink', attack: 0.05 });
	},
} satisfies Record<ActionId, Sound | null>;
