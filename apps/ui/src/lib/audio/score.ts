import type { JobId } from '@repo/game';
import type { NoiseColor } from './engine.ts';
import { CUES, THEMES, TIMBRES, type Cue, type CueDef, type Theme } from './themes.ts';
import { TONES, type Tone, type ToneId } from './tones.ts';
import { burst, cry, sing, type ScoreBus } from './voices.ts';
import { CREATURES, creatureFor, type CreatureId } from './wildlife.ts';

/** Everything the score follows. It holds no game state of its own. */
export type Mood = {
	tone: ToneId;
	/** 0..1: how badly the game in play is going. */
	tension: number;
	/** Whose turn it is. */
	occupation: JobId | null;
	/** 0..1: how much of what surrounds the active pawn is sea. */
	sea: number;
	/** An Epidemic is being resolved. */
	alarm: boolean;
	/** Infection cards are being flipped: the opening of a game, and the end of every turn. */
	infecting: boolean;
	/** Hollow Men walk the board. */
	hollow: boolean;
	/** The inoculation of Package 6 still holds. */
	safe: boolean;
	/** A story is being told, so the score keeps under the voice. */
	hush: boolean;
};

export const tensionOf = (incidents: number, epidemics: number) =>
	Math.min(1, Math.min(1, incidents / 7) * 0.58 + Math.min(1, epidemics / 5) * 0.42);

const dreadOf = (mood: Mood) => Math.min(1, TONES[mood.tone].dread + mood.tension * 0.5 + (mood.infecting ? 0.25 : 0));

/**
 * 0..1: the weather of a game on the brink. Nothing falls until the crisis is at its last level (about six
 * incidents and three Epidemics); from there the rain thickens, and past `THUNDER_FROM` it is a storm.
 */
export const stormOf = (mood: Pick<Mood, 'tension'>) => Math.min(1, Math.max(0, (mood.tension - 0.68) / 0.27));
const THUNDER_FROM = 0.6;
/** Where the wind's whistle sits in still weather. */
const WHISTLE_HZ = 320;
/** Levels of the weather, set from renders against the pad and the themes. */
const WIND = { calm: 0.5, dread: 0.2, storm: 0.85 };
const RAIN = 1.25;
const WAVE = { body: 0.55, crest: 0.035 };
const THUNDER = 1.3;

const hz = (root: number, semitones: number) => root * 2 ** (semitones / 12);

/** The tone's scale as a game's crisis bends it: past the midpoint its second step sinks to a semitone over the root. */
const scaleOf = (tone: Tone, tension: number) =>
	tension > 0.5 ? tone.scale.map((semitones, step) => (step === 1 ? 1 : semitones)) : tone.scale;

function pitch(scale: readonly number[], step: number): number {
	return scale[((step % 7) + 7) % 7]! + 12 * Math.floor(step / 7);
}

export class Score {
	private readonly main: GainNode;
	private readonly sources: AudioScheduledSourceNode[] = [];
	private readonly pad: { osc: OscillatorNode; note: 'root' | 'drone'; octave: number }[] = [];
	private readonly tint: OscillatorNode;
	private readonly safe: OscillatorNode;
	private readonly tintGain: GainNode;
	private readonly safeGain: GainNode;
	private readonly padFilter: BiquadFilterNode;
	private readonly padGain: GainNode;
	private readonly windGain: GainNode;
	private readonly whistle: BiquadFilterNode;
	private readonly rainGain: GainNode;
	/** The slow oscillators that blow the gusts and drive the squalls, each with its rate in still weather. */
	private readonly weather: { osc: OscillatorNode; rate: number }[] = [];
	private nextWave: number;
	private nextThunder: number;
	private melody: GainNode;
	private life: GainNode;
	private cue: { def: CueDef; until: number } | null = null;
	private stated = 0;
	private wander = 4;
	private lastCreature: CreatureId | null = null;
	private nextTheme: number;
	private nextWander: number;
	private nextCall: number;
	private nextPulse: number;
	private nextStep: number;
	private nextToll: number;

	constructor(
		private readonly bus: ScoreBus,
		private mood: Mood,
	) {
		const { ctx } = bus;
		const now = ctx.currentTime;
		const tone: Tone = TONES[mood.tone];

		this.main = ctx.createGain();
		this.main.gain.setValueAtTime(0.0001, now);
		this.main.gain.linearRampToValueAtTime(1, now + 5);
		this.main.connect(bus.out);
		this.melody = this.branch();
		this.life = this.branch();

		this.padFilter = ctx.createBiquadFilter();
		this.padFilter.type = 'lowpass';
		this.padFilter.frequency.value = 300;
		this.padFilter.Q.value = 0.9;
		this.padGain = this.gain(0.065);
		this.padFilter.connect(this.padGain);
		this.padGain.connect(this.main);
		this.padGain.connect(this.gain(0.25)).connect(bus.reverb);

		// Laptop speakers carry little under 150 Hz, so both pad notes sound an octave up as well.
		for (const [note, octave, wave, share, detune] of [
			['root', 0.5, 'sine', 0.3, 0],
			['root', 1, 'triangle', 0.55, 0],
			['root', 2, 'triangle', 0.8, 0],
			['drone', 1, 'triangle', 0.7, -2],
			['drone', 2, 'triangle', 0.45, 2],
		] as const) {
			const osc = this.osc(wave, tone.root * octave);
			osc.detune.value = detune;
			osc.connect(this.gain(share)).connect(this.padFilter);
			this.pad.push({ osc, note, octave });
		}
		// A drift too slow and too slight to hear as a tremble: a wider one flutters once the echo smears it.
		this.osc('sine', 0.027).connect(this.gain(3)).connect(this.pad[1]!.osc.detune);

		this.tint = this.osc('sine', tone.root * 4);
		this.tintGain = this.gain(0.0001);
		this.tint.connect(this.tintGain);
		this.tintGain.connect(this.main);
		this.tintGain.connect(this.gain(0.8)).connect(bus.reverb);

		this.safe = this.osc('sine', tone.root * 3);
		this.safeGain = this.gain(0.0001);
		this.safe.connect(this.safeGain).connect(this.main);

		// Wind is the whole bed in ordinary weather. A steady wash of surf under it read as an engine running, so
		// the sea is no longer part of the bed: it is a wave now and then (`wave`).
		this.windGain = this.gain(0.0001);
		this.windGain.connect(this.main);
		// The gusts never die away altogether: a bed that falls silent and comes back is heard as something starting up.
		const gust = this.gain(0.55);
		this.sway(0.045).connect(this.gain(0.24)).connect(gust.gain);
		this.sway(0.019).connect(this.gain(0.12)).connect(gust.gain);
		gust.connect(this.windGain);
		this.whistle = this.filter('bandpass', WHISTLE_HZ, 1.4);
		this.sway(0.023).connect(this.gain(110)).connect(this.whistle.frequency);
		this.sway(0.07).connect(this.gain(40)).connect(this.whistle.frequency);
		const air = this.noise('pink', 0.9);
		air.connect(this.whistle).connect(gust);
		air
			.connect(this.filter('bandpass', 800, 1))
			.connect(this.gain(0.25))
			.connect(gust);

		// Rain is silent until a game is nearly lost (`stormOf`): a hiss with the patter under it, in squalls.
		this.rainGain = this.gain(0.0001);
		this.rainGain.connect(this.main);
		this.rainGain.connect(this.gain(0.15)).connect(bus.reverb);
		const squall = this.gain(0.75);
		this.sway(0.11).connect(this.gain(0.2)).connect(squall.gain);
		squall.connect(this.rainGain);
		this.noise('white', 1)
			.connect(this.filter('highpass', 3200, 0.7))
			.connect(this.gain(0.05))
			.connect(squall);
		this.noise('pink', 1.4)
			.connect(this.filter('bandpass', 1500, 0.5))
			.connect(this.gain(0.3))
			.connect(squall);

		this.nextWave = now + 12 + Math.random() * 14;
		this.nextThunder = now + 6;
		this.nextTheme = now + 5;
		this.nextWander = now + 9;
		this.nextCall = now + 7;
		this.nextPulse = now + 1.2;
		this.nextStep = now + 5.5;
		this.nextToll = now + 8;
		this.apply(0.2);
	}

	private gain(value: number): GainNode {
		const node = this.bus.ctx.createGain();
		node.gain.value = value;
		return node;
	}

	private filter(type: BiquadFilterType, frequency: number, q: number): BiquadFilterNode {
		const node = this.bus.ctx.createBiquadFilter();
		node.type = type;
		node.frequency.value = frequency;
		node.Q.value = q;
		return node;
	}

	private osc(type: OscillatorType, frequency: number): OscillatorNode {
		const node = this.bus.ctx.createOscillator();
		node.type = type;
		node.frequency.value = frequency;
		node.start();
		this.sources.push(node);
		return node;
	}

	private sway(rate: number): OscillatorNode {
		const osc = this.osc('sine', rate);
		this.weather.push({ osc, rate });
		return osc;
	}

	private noise(color: NoiseColor, rate: number): AudioBufferSourceNode {
		const node = this.bus.ctx.createBufferSource();
		node.buffer = this.bus.noise[color];
		node.loop = true;
		node.playbackRate.value = rate;
		node.start(0, Math.random() * 2);
		this.sources.push(node);
		return node;
	}

	private branch(): GainNode {
		const node = this.gain(1);
		node.connect(this.main);
		return node;
	}

	/** Silences what is sounding on a branch within a few hundredths of a second and hands back a fresh one. */
	private cut(branch: GainNode): GainNode {
		branch.gain.setTargetAtTime(0, this.bus.ctx.currentTime, 0.04);
		return this.branch();
	}

	/** Where a cue or an Epidemic has thrown the pad, if one has. */
	private jolt(): CueDef['pad'] | null {
		return this.cue?.def.pad ?? (this.mood.alarm ? CUES.epidemic.pad : null);
	}

	private apply(glide: number) {
		const now = this.bus.ctx.currentTime;
		const { mood } = this;
		const tone: Tone = TONES[mood.tone];
		const ten = mood.tension;
		const jolt = this.jolt();
		const snap = jolt ? 0.04 : glide;
		const theme = mood.occupation ? THEMES[mood.occupation] : null;

		// The pad's second voice sours as the game goes wrong: flat enough to beat, then a fifth becomes a tritone.
		const sour = ten > 0.62 ? (tone.drone === 7 ? 1 : 0.4) : ten > 0.35 ? 0.4 : 0;
		const tintAt = jolt?.tint ?? (theme ? pitch(scaleOf(tone, ten), theme.tint) : 7);
		// Through an Infect step the pad broods: its second voice sinks to a tritone, it darkens and it swells.
		const brood = mood.infecting && !jolt;
		const droneAt = jolt?.drone ?? (brood ? (tone.drone === 6 ? 5.6 : 6) : tone.drone - sour);
		for (const { osc, note, octave } of this.pad) {
			if (note === 'root') osc.frequency.setTargetAtTime(tone.root * octave, now, glide);
			else osc.frequency.setTargetAtTime(hz(tone.root * octave, droneAt), now, brood ? 0.5 : snap);
		}
		this.safe.frequency.setTargetAtTime(tone.root * 3, now, glide);
		this.tint.frequency.setTargetAtTime(hz(tone.root * 4, tintAt), now, snap);
		this.tintGain.gain.setTargetAtTime(jolt ? 0.018 : theme && !mood.hush ? 0.013 : 0.0001, now, jolt ? 0.04 : 1.2);

		const open = (340 + ten * 1100) * tone.light * (mood.hush ? 0.65 : 1) * (jolt?.light ?? 1) * (brood ? 0.72 : 1);
		this.padFilter.frequency.setTargetAtTime(Math.min(2600, open), now, jolt ? 0.05 : 1.4);
		this.padGain.gain.setTargetAtTime((0.065 + ten * 0.055) * (jolt ? 1.3 : brood ? 1.2 : 1), now, jolt ? 0.05 : 1.6);
		this.safeGain.gain.setTargetAtTime(mood.safe ? 0.03 : 0.0001, now, 1.2);

		// Ordinary weather is a low wind. Dread quickens its gusts, and a game about to be lost brings rain, the wind
		// rising and whistling higher with it.
		const dread = dreadOf(mood);
		const storm = stormOf(mood);
		for (const { osc, rate } of this.weather) osc.frequency.setTargetAtTime(rate * (1 + dread * 1.3), now, 4);
		const still = (jolt ? 0.35 : 1) * (mood.hush ? 0.7 : 1);
		this.whistle.frequency.setTargetAtTime(WHISTLE_HZ + storm * 240, now, 4);
		this.windGain.gain.setTargetAtTime(
			(WIND.calm + dread * WIND.dread + storm * WIND.storm) * still,
			now,
			jolt ? 0.1 : 2.5,
		);
		this.rainGain.gain.setTargetAtTime(storm * RAIN * still, now, jolt ? 0.1 : 3.5);
	}

	/** One wave: it gathers for a few seconds, breaks, and hisses back down the shore. */
	private wave(at: number, size: number) {
		const rise = 2.2 + Math.random() * 1.2;
		burst(this.bus, this.main, {
			color: 'pink',
			at,
			length: rise + 4.5 + Math.random() * 2,
			level: WAVE.body * size,
			attack: rise,
			filter: ['lowpass', 750, 0.5],
			sweepTo: 300,
			echo: 0.2,
		});
		burst(this.bus, this.main, {
			color: 'white',
			at: at + rise * 0.6,
			length: 5,
			level: WAVE.crest * size,
			attack: rise * 0.4 + 0.2,
			filter: ['bandpass', 2000, 0.4],
			sweepTo: 3500,
		});
	}

	/**
	 * Thunder some way off: a crack, then a rumble that rolls, each roll a little after the last. The rumble itself is
	 * under what a laptop speaker carries, so every roll has a band above it that one can hear.
	 */
	private thunder(at: number, storm: number) {
		const level = THUNDER * (0.6 + storm * 0.4);
		burst(this.bus, this.main, {
			color: 'white',
			at,
			length: 0.5,
			level: level * 0.05,
			attack: 0.01,
			filter: ['bandpass', 1600, 0.5],
			echo: 0.8,
		});
		const rolls = 3 + Math.floor(Math.random() * 3);
		let when = at;
		for (let roll = 0; roll < rolls; roll++) {
			const size = level * (roll === 0 ? 1 : 0.45 + Math.random() * 0.4);
			burst(this.bus, this.main, {
				color: 'brown',
				at: when,
				length: 3 + Math.random() * 2,
				level: size,
				attack: 0.12,
				filter: ['lowpass', 300, 0.6],
				sweepTo: 90,
				echo: 0.7,
			});
			burst(this.bus, this.main, {
				color: 'pink',
				at: when,
				length: 2.4 + Math.random(),
				level: size * 1.8,
				attack: 0.08,
				filter: ['bandpass', 420, 0.5],
				sweepTo: 160,
				echo: 0.7,
			});
			when += 0.35 + Math.random() * 0.5;
		}
	}

	set(mood: Mood) {
		const before = this.mood;
		this.mood = mood;
		const now = this.bus.ctx.currentTime;
		if (before.occupation !== mood.occupation) {
			this.melody = this.cut(this.melody);
			this.stated = 0;
			this.nextTheme = now + 2.5;
		}
		if (mood.alarm && !before.alarm) {
			this.melody = this.cut(this.melody);
			this.life = this.cut(this.life);
		}
		if (mood.infecting && !before.infecting) this.melody = this.cut(this.melody);
		if ((before.alarm && !mood.alarm) || (before.infecting && !mood.infecting)) this.settle(now);
		this.apply(1.6);
	}

	/** The quiet after a jolt: the creatures and the themes take a while to come back. */
	private settle(now: number) {
		this.nextCall = Math.max(this.nextCall, now + 6);
		this.nextTheme = Math.max(this.nextTheme, now + 4);
		this.nextWander = Math.max(this.nextWander, now + 3);
	}

	/** A turning point: everything melodic stops dead, the pad jumps, and the cue's tune plays over the top. */
	accent(id: Cue) {
		const now = this.bus.ctx.currentTime;
		const def: CueDef = CUES[id];
		const tone: Tone = TONES[this.mood.tone];
		this.melody = this.cut(this.melody);
		this.life = this.cut(this.life);
		this.cue = { def, until: now + def.hold };
		this.apply(1.6);

		let at = now + 0.03;
		for (const [semitones, beats] of def.notes) {
			const slot = beats * def.beat;
			if (semitones !== null) {
				for (const voice of def.voices) {
					sing(this.bus, TIMBRES[voice.timbre], {
						at,
						hz: hz(tone.root * 2 ** voice.register, semitones),
						slot,
						level: voice.level,
						dest: this.bus.cues,
						echo: 0.6,
					});
				}
			}
			at += slot;
		}
		if (def.thud) {
			cry(this.bus, this.bus.cues, {
				wave: 'sine',
				at: now + 0.02,
				length: 1.1,
				level: 0.22,
				attack: 0.02,
				hold: 0.15,
				contour: [
					[0, 150],
					[1, 42],
				],
			});
		}
	}

	/** One creature's call, for the audition page. */
	hear(id: CreatureId) {
		CREATURES[id].call(this.bus, this.life, this.bus.ctx.currentTime + 0.05);
	}

	/** One wave or one clap of thunder as the weather stands, for the audition page. */
	hearWeather(kind: 'wave' | 'thunder') {
		const at = this.bus.ctx.currentTime + 0.05;
		const storm = stormOf(this.mood);
		if (kind === 'wave') this.wave(at, 0.6 + this.mood.sea * 0.4 + storm * 0.5);
		else this.thunder(at, storm);
	}

	/**
	 * States the occupation's theme in the tone's scale and returns how long it lasts. Through a turn it comes back
	 * whole, as its opening, whole a third higher, then as its ending.
	 */
	private state(theme: Theme, at: number): number {
		const tone: Tone = TONES[this.mood.tone];
		const scale = scaleOf(tone, this.mood.tension);
		const turn = this.stated++ % 4;
		const half = Math.ceil(theme.notes.length / 2);
		const notes = turn === 1 ? theme.notes.slice(0, half) : turn === 3 ? theme.notes.slice(-half) : theme.notes;
		const lift = turn === 2 ? 2 : 0;
		const level = theme.level * (turn === 0 ? 1 : 0.7);
		let when = at;
		for (const [step, beats] of notes) {
			const slot = beats * theme.beat;
			if (step !== null) {
				sing(this.bus, TIMBRES[theme.timbre], {
					at: when,
					hz: hz(tone.root * 2 ** theme.register, pitch(scale, step + lift)),
					slot,
					level,
					dest: this.melody,
				});
			}
			when += slot;
		}
		return when - at;
	}

	/** Schedules what the next moments hold. Call it about twice a second. */
	tick() {
		const now = this.bus.ctx.currentTime;
		const { mood } = this;
		const tone: Tone = TONES[mood.tone];
		const ten = mood.tension;

		if (this.cue && now >= this.cue.until) {
			this.cue = null;
			this.settle(now);
			this.apply(1.6);
		}
		const jolted = this.jolt() !== null;
		const dread = dreadOf(mood);
		// Everything takes its time while things are calm, and comes closer together as they darken.
		const slow = 1 + (1 - dread) * 0.9;

		// A heartbeat under a game going wrong, racing through an Epidemic.
		if (mood.alarm || mood.infecting || ten > 0.22) {
			const period = mood.alarm ? 0.42 : Math.min(mood.infecting ? 1.15 : 9, Math.max(0.72, 2.4 - ten * 1.55));
			const peak = mood.alarm ? 0.1 : Math.max(mood.infecting ? 0.05 : 0, (ten - 0.18) * 0.16);
			if (this.nextPulse < now) this.nextPulse = now + 0.05;
			while (this.nextPulse < now + 1.2) {
				cry(this.bus, this.main, {
					wave: 'sine',
					at: this.nextPulse,
					length: 0.4,
					level: peak,
					attack: 0.02,
					hold: 0.06,
					contour: [
						[0, tone.root * 2],
						[0.6, tone.root * 1.12],
					],
				});
				this.nextPulse += period;
			}
		}

		if (mood.hollow && now >= this.nextStep) {
			burst(this.bus, this.main, {
				color: 'brown',
				at: now + 0.2,
				length: 0.14,
				level: 0.09 + ten * 0.09,
				filter: ['lowpass', 340],
			});
			this.nextStep = now + (4.7 - ten * 2.2) + Math.random() * 2.8;
		}

		if (tone.toll && !jolted && now >= this.nextToll) {
			sing(this.bus, TIMBRES.bell, {
				at: now + 0.1,
				hz: tone.root * 4,
				slot: 1,
				level: 0.03,
				dest: this.melody,
				echo: 0.8,
			});
			this.nextToll = now + 21 + Math.random() * 9;
		}

		// The sea is a wave now and then, more often the more water surrounds the active pawn and the worse the weather.
		const storm = stormOf(mood);
		if (!jolted && now >= this.nextWave) {
			if (Math.random() < mood.sea) this.wave(now + 0.2, 0.6 + mood.sea * 0.4 + storm * 0.5);
			this.nextWave = now + (22 + Math.random() * 24) * (1 - storm * 0.5);
		}
		if (storm > THUNDER_FROM && !jolted && now >= this.nextThunder) {
			this.thunder(now + 0.3, storm);
			this.nextThunder = now + 16 + Math.random() * 22;
		}

		// Nothing sings while the cards are flipped.
		if (jolted || mood.infecting) return;

		const theme = mood.occupation && !mood.hush ? THEMES[mood.occupation] : null;
		if (theme && now >= this.nextTheme) {
			const length = this.state(theme, now + 0.1);
			this.nextTheme = now + length + (14 + Math.random() * 8) * slow;
			this.nextWander = Math.max(this.nextWander, now + length + 2.5);
		}

		// Between themes a single long note wanders the scale, so the bed is never only a drone.
		if (now >= this.nextWander) {
			this.wander = Math.max(0, Math.min(9, this.wander + Math.floor(Math.random() * 5) - 2));
			sing(this.bus, TIMBRES.swell, {
				at: now + 0.15,
				hz: hz(tone.root * 2, pitch(scaleOf(tone, ten), this.wander)),
				slot: 3.2 * slow,
				level: 0.055 + ten * 0.035,
				dest: this.melody,
			});
			this.nextWander = now + (6 + Math.random() * 3) * slow;
		}

		if (now >= this.nextCall) {
			const id = creatureFor(mood.sea, dread, this.lastCreature);
			if (id) {
				CREATURES[id].call(this.bus, this.life, now + 0.2);
				this.lastCreature = id;
			}
			// Life thins out as dread rises, and keeps its distance while a story is told.
			this.nextCall = now + (16 + Math.random() * 16) * (1 + dread * 0.8) * (mood.hush ? 1.5 : 1);
		}
	}

	end() {
		const now = this.bus.ctx.currentTime;
		this.main.gain.cancelScheduledValues(now);
		this.main.gain.setTargetAtTime(0, now, 0.25);
		for (const source of this.sources) source.stop(now + 1.5);
	}
}
