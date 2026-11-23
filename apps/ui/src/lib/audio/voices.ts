import type { NoiseColor } from './engine.ts';

/** Where the score plays: the live engine's buses, or an offline context that renders it. */
export type ScoreBus = {
	ctx: BaseAudioContext;
	out: AudioNode;
	/** Joins the mix after the narration duck, so a turning point is heard over a voice. */
	cues: AudioNode;
	reverb: AudioNode;
	noise: Record<NoiseColor, AudioBuffer>;
};

export type Timbre = {
	wave: OscillatorType;
	/** Each partial as [frequency ratio, level]. */
	partials: readonly (readonly [number, number])[];
	attack: number;
	/** Seconds a struck voice rings for, whatever the length of its note. A voice without it is blown: it holds its note and lets go. */
	ring?: number;
	/** Lowpass cutoff as a multiple of the pitch. */
	lowpass?: number;
	vibrato?: readonly [hz: number, cents: number];
	/** Level of breath noise beside the tone. */
	breath?: number;
};

export type Note = { at: number; hz: number; slot: number; level: number; dest: AudioNode; echo?: number };

/**
 * A gain that is silent until its envelope starts. A source that starts between two samples plays its first one
 * before the envelope's first event, which at a gain's default of 1 is a click.
 */
function quiet(ctx: BaseAudioContext): GainNode {
	const env = ctx.createGain();
	env.gain.value = 0;
	return env;
}

function wobble(ctx: BaseAudioContext, at: number, end: number, hz: number, depth: number): GainNode {
	const lfo = ctx.createOscillator();
	lfo.frequency.value = hz;
	const amount = ctx.createGain();
	amount.gain.value = depth;
	lfo.connect(amount);
	lfo.start(at);
	lfo.stop(end);
	return amount;
}

function send(bus: ScoreBus, from: AudioNode, dest: AudioNode, echo: number) {
	from.connect(dest);
	if (echo <= 0) return;
	const wet = bus.ctx.createGain();
	wet.gain.value = echo;
	from.connect(wet);
	wet.connect(bus.reverb);
}

export function sing(bus: ScoreBus, timbre: Timbre, { at, hz, slot, level, dest, echo = 0.5 }: Note) {
	const { ctx } = bus;
	const length = timbre.ring ? Math.max(slot, timbre.ring) : slot * 0.86;
	const end = at + length;
	const env = quiet(ctx);
	env.gain.setValueAtTime(0.0001, at);
	if (timbre.ring) {
		env.gain.linearRampToValueAtTime(level, at + timbre.attack);
		env.gain.exponentialRampToValueAtTime(0.0001, end);
	} else {
		const attack = Math.min(timbre.attack, length * 0.4);
		env.gain.linearRampToValueAtTime(level, at + attack);
		env.gain.setValueAtTime(level, end - Math.min(0.5, length * 0.4));
		env.gain.linearRampToValueAtTime(0.0001, end);
	}

	let into: AudioNode = env;
	if (timbre.lowpass) {
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = Math.min(9000, hz * timbre.lowpass);
		filter.connect(env);
		into = filter;
	}
	const vibrato = timbre.vibrato ? wobble(ctx, at, end + 0.05, timbre.vibrato[0], timbre.vibrato[1]) : null;
	for (const [ratio, share] of timbre.partials) {
		const osc = ctx.createOscillator();
		osc.type = timbre.wave;
		osc.frequency.value = hz * ratio;
		vibrato?.connect(osc.detune);
		const part = ctx.createGain();
		part.gain.value = share;
		osc.connect(part);
		part.connect(into);
		osc.start(at);
		osc.stop(end + 0.05);
	}
	if (timbre.breath) {
		const air = ctx.createBufferSource();
		air.buffer = bus.noise.pink;
		air.loop = true;
		const band = ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.value = hz * 2.2;
		band.Q.value = 0.9;
		const share = ctx.createGain();
		share.gain.value = timbre.breath;
		air.connect(band);
		band.connect(share);
		share.connect(env);
		air.start(at, Math.random() * 2);
		air.stop(end + 0.05);
	}
	send(bus, env, dest, echo);
}

export type Cry = {
	wave: OscillatorType;
	at: number;
	length: number;
	level: number;
	/** The pitch over the cry, as [share of its length, Hz]. */
	contour: readonly (readonly [number, number])[];
	attack?: number;
	/** Share of the length after which the cry dies away. */
	hold?: number;
	band?: readonly [hz: number, q: number];
	vibrato?: readonly [hz: number, cents: number];
	/** Hz of a flutter in loudness, which makes a voice harsh. */
	rasp?: number;
	echo?: number;
};

/** One gliding call: an animal's voice, a groan, a drop. */
export function cry(bus: ScoreBus, dest: AudioNode, c: Cry) {
	const { ctx } = bus;
	const end = c.at + c.length;
	const osc = ctx.createOscillator();
	osc.type = c.wave;
	osc.frequency.setValueAtTime(c.contour[0]![1], c.at);
	for (const [share, hz] of c.contour.slice(1)) osc.frequency.exponentialRampToValueAtTime(hz, c.at + share * c.length);
	if (c.vibrato) wobble(ctx, c.at, end + 0.05, c.vibrato[0], c.vibrato[1]).connect(osc.detune);

	const env = quiet(ctx);
	const attack = Math.min(c.attack ?? 0.04, c.length * 0.5);
	env.gain.setValueAtTime(0.0001, c.at);
	env.gain.linearRampToValueAtTime(c.level, c.at + attack);
	env.gain.setValueAtTime(c.level, Math.max(c.at + attack, c.at + c.length * (c.hold ?? 0.55)));
	env.gain.exponentialRampToValueAtTime(0.0001, end);

	let tail: AudioNode = osc;
	if (c.band) {
		const band = ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.value = c.band[0];
		band.Q.value = c.band[1];
		tail.connect(band);
		tail = band;
	}
	if (c.rasp) {
		const flutter = ctx.createGain();
		flutter.gain.value = 0.55;
		const rasp = ctx.createOscillator();
		rasp.type = 'square';
		rasp.frequency.value = c.rasp;
		const depth = ctx.createGain();
		depth.gain.value = 0.45;
		rasp.connect(depth);
		depth.connect(flutter.gain);
		rasp.start(c.at);
		rasp.stop(end + 0.05);
		tail.connect(flutter);
		tail = flutter;
	}
	tail.connect(env);
	send(bus, env, dest, c.echo ?? 0);
	osc.start(c.at);
	osc.stop(end + 0.05);
}

export type Burst = {
	color: NoiseColor;
	at: number;
	length: number;
	level: number;
	attack?: number;
	filter: readonly [type: BiquadFilterType, hz: number, q?: number];
	echo?: number;
};

export function burst(bus: ScoreBus, dest: AudioNode, b: Burst) {
	const { ctx } = bus;
	const src = ctx.createBufferSource();
	src.buffer = bus.noise[b.color];
	src.loop = true;
	const filter = ctx.createBiquadFilter();
	filter.type = b.filter[0];
	filter.frequency.value = b.filter[1];
	filter.Q.value = b.filter[2] ?? 1;
	const env = quiet(ctx);
	const attack = b.attack ?? 0.006;
	env.gain.setValueAtTime(0.0001, b.at);
	env.gain.linearRampToValueAtTime(b.level, b.at + attack);
	env.gain.exponentialRampToValueAtTime(0.0001, b.at + Math.max(attack + 0.01, b.length));
	src.connect(filter);
	filter.connect(env);
	send(bus, env, dest, b.echo ?? 0);
	src.start(b.at, Math.random() * 2);
	src.stop(b.at + b.length + 0.05);
}
