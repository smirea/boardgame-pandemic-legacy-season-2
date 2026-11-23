import { audioSettings } from './settings.svelte.ts';

export type NoiseColor = 'white' | 'pink' | 'brown';

type AudioGraph = {
	ctx: AudioContext;
	master: GainNode;
	music: GainNode;
	musicDuck: GainNode;
	/** Music that narration does not duck: the score's turning points. */
	cues: GainNode;
	sfx: GainNode;
	voice: GainNode;
	hullReverb: ConvolverNode;
	voidReverb: ConvolverNode;
	noise: Record<NoiseColor, AudioBuffer>;
};

let graph: AudioGraph | null = null;
let unlocked = false;
let unlockBound = false;
let duckLevel = 1;
const unlockCallbacks = new Set<() => void>();

function makeNoiseBuffer(ctx: AudioContext, color: NoiseColor, seconds: number): AudioBuffer {
	const length = Math.floor(ctx.sampleRate * seconds);
	// Brown noise wanders, so a plain take ends far from where it began and a loop of it thumps at every seam.
	// Each take runs on past its end, and that overrun is faded in over its start.
	const fold = Math.floor(ctx.sampleRate * 0.5);
	const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const take = new Float32Array(length + fold);
		let b0 = 0,
			b1 = 0,
			b2 = 0,
			b3 = 0,
			b4 = 0,
			b5 = 0,
			b6 = 0,
			last = 0;
		for (let i = 0; i < take.length; i++) {
			const w = Math.random() * 2 - 1;
			if (color === 'white') {
				take[i] = w;
			} else if (color === 'pink') {
				b0 = 0.99886 * b0 + w * 0.0555179;
				b1 = 0.99332 * b1 + w * 0.0750759;
				b2 = 0.969 * b2 + w * 0.153852;
				b3 = 0.8665 * b3 + w * 0.3104856;
				b4 = 0.55 * b4 + w * 0.5329522;
				b5 = -0.7616 * b5 - w * 0.016898;
				take[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
				b6 = w * 0.115926;
			} else {
				last = (last + 0.02 * w) / 1.02;
				take[i] = last * 3.4;
			}
		}
		const data = buffer.getChannelData(ch);
		data.set(take.subarray(0, length));
		for (let i = 0; i < fold; i++) {
			const t = i / fold;
			data[i] = take[i]! * Math.sqrt(t) + take[length + i]! * Math.sqrt(1 - t);
		}
	}
	return buffer;
}

function makeImpulseResponse(ctx: AudioContext, seconds: number, decay: number, dark: number): AudioBuffer {
	const length = Math.floor(ctx.sampleRate * seconds);
	const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let ch = 0; ch < 2; ch++) {
		const data = buffer.getChannelData(ch);
		let lp = 0;
		for (let i = 0; i < length; i++) {
			const t = i / length;
			const env = Math.pow(1 - t, decay) * (1 - Math.exp(-i / (ctx.sampleRate * 0.015)));
			const raw = (Math.random() * 2 - 1) * env;
			lp = lp * dark + raw * (1 - dark);
			data[i] = lp;
		}
	}
	return buffer;
}

function applyGains() {
	if (!graph) return;
	const now = graph.ctx.currentTime;
	const masterTarget = audioSettings.muted ? 0 : audioSettings.master;
	graph.master.gain.setTargetAtTime(masterTarget, now, 0.04);
	graph.music.gain.setTargetAtTime(audioSettings.music, now, 0.08);
	graph.musicDuck.gain.setTargetAtTime(duckLevel, now, 0.22);
	graph.cues.gain.setTargetAtTime(audioSettings.music, now, 0.08);
	graph.sfx.gain.setTargetAtTime(audioSettings.sfx, now, 0.03);
	graph.voice.gain.setTargetAtTime(audioSettings.voiceEnabled ? audioSettings.voice : 0, now, 0.04);

	if (audioSettings.muted || (typeof document !== 'undefined' && document.hidden)) {
		if (graph.ctx.state === 'running') void graph.ctx.suspend().catch(() => {});
	} else if (unlocked && graph.ctx.state === 'suspended') {
		void graph.ctx.resume().catch(() => {});
	}
}

function ensureGraph(): AudioGraph | null {
	if (typeof window === 'undefined') return null;
	if (graph) return graph;
	const Ctor =
		window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) return null;

	const ctx = new Ctor();
	const compressor = ctx.createDynamicsCompressor();
	compressor.threshold.value = -14;
	compressor.knee.value = 18;
	compressor.ratio.value = 4;
	compressor.attack.value = 0.008;
	compressor.release.value = 0.22;

	const master = ctx.createGain();
	const music = ctx.createGain();
	const musicDuck = ctx.createGain();
	const cues = ctx.createGain();
	const sfx = ctx.createGain();
	const voice = ctx.createGain();

	const hullReverb = ctx.createConvolver();
	hullReverb.buffer = makeImpulseResponse(ctx, 1.85, 2.7, 0.72);
	const voidReverb = ctx.createConvolver();
	voidReverb.buffer = makeImpulseResponse(ctx, 3.6, 2.2, 0.82);

	const hullWet = ctx.createGain();
	hullWet.gain.value = 0.34;
	const voidWet = ctx.createGain();
	voidWet.gain.value = 0.38;

	music.connect(musicDuck);
	musicDuck.connect(master);
	cues.connect(master);
	sfx.connect(master);
	voice.connect(master);
	hullReverb.connect(hullWet);
	hullWet.connect(master);
	voidReverb.connect(voidWet);
	voidWet.connect(music);

	master.connect(compressor);
	compressor.connect(ctx.destination);

	graph = {
		ctx,
		master,
		music,
		musicDuck,
		cues,
		sfx,
		voice,
		hullReverb,
		voidReverb,
		noise: {
			white: makeNoiseBuffer(ctx, 'white', 3),
			// The sea and the wind loop these for minutes, so they are long enough for a loop not to be heard as one.
			pink: makeNoiseBuffer(ctx, 'pink', 10),
			brown: makeNoiseBuffer(ctx, 'brown', 10),
		},
	};

	audioSettings.subscribe(applyGains);
	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', applyGains);
	}
	applyGains();
	return graph;
}

/** Binds one-time user gesture unlock so audio activates cleanly only after real interaction. */
export function bindAudioUnlock() {
	if (typeof window === 'undefined' || unlockBound) return;
	unlockBound = true;
	const wake = () => {
		unlocked = true;
		const g = ensureGraph();
		if (g && !audioSettings.muted && !document.hidden && g.ctx.state === 'suspended') {
			void g.ctx.resume().catch(() => {});
		}
		for (const cb of unlockCallbacks) cb();
	};
	window.addEventListener('pointerdown', wake, { capture: true, passive: true });
	window.addEventListener('keydown', wake, { capture: true, passive: true });
}

export function onAudioUnlocked(cb: () => void): () => void {
	unlockCallbacks.add(cb);
	if (unlocked) cb();
	return () => unlockCallbacks.delete(cb);
}

export function isAudioUnlocked(): boolean {
	return unlocked;
}

/** Returns the active AudioGraph only if audio is unlocked, unmuted, and tab is visible. */
export function activeAudio(): AudioGraph | null {
	if (!unlocked || audioSettings.muted) return null;
	if (typeof document !== 'undefined' && document.hidden) return null;
	const g = ensureGraph();
	if (!g) return null;
	if (g.ctx.state === 'suspended') void g.ctx.resume().catch(() => {});
	return g;
}

/** Smoothly ducks ambient music while narration or a quiet set-piece plays. */
export function setMusicDuck(ducked: boolean, ratio = 0.34) {
	duckLevel = ducked ? ratio : 1;
	if (!graph) return;
	graph.musicDuck.gain.setTargetAtTime(duckLevel, graph.ctx.currentTime, 0.2);
}

/** Plays a short noise burst routed through an optional biquad filter into `dest`. */
export function playNoiseBurst(
	g: AudioGraph,
	opts: {
		color?: NoiseColor;
		start?: number;
		duration: number;
		gain: number;
		attack?: number;
		filterType?: BiquadFilterType;
		freq?: number;
		freqEnd?: number;
		q?: number;
		dest?: AudioNode;
		reverbSend?: number;
	},
) {
	const t = opts.start ?? g.ctx.currentTime;
	const src = g.ctx.createBufferSource();
	src.buffer = g.noise[opts.color ?? 'pink'];
	src.loop = true;
	const offset = Math.random() * 1.8;

	const env = g.ctx.createGain();
	// Silent until the envelope starts: a source that starts between two samples plays its first one before it.
	env.gain.value = 0;
	const attack = opts.attack ?? 0.006;
	env.gain.setValueAtTime(0.0001, t);
	env.gain.linearRampToValueAtTime(opts.gain, t + attack);
	env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, opts.duration));

	let tail: AudioNode = src;
	if (opts.filterType) {
		const filter = g.ctx.createBiquadFilter();
		filter.type = opts.filterType;
		filter.frequency.setValueAtTime(opts.freq ?? 1200, t);
		if (opts.freqEnd !== undefined) {
			filter.frequency.exponentialRampToValueAtTime(Math.max(30, opts.freqEnd), t + opts.duration);
		}
		filter.Q.value = opts.q ?? 1;
		tail.connect(filter);
		tail = filter;
	}
	tail.connect(env);
	const dest = opts.dest ?? g.sfx;
	env.connect(dest);
	if (opts.reverbSend && opts.reverbSend > 0) {
		const send = g.ctx.createGain();
		send.gain.value = opts.reverbSend;
		env.connect(send);
		send.connect(g.hullReverb);
	}
	src.start(t, offset, opts.duration + 0.04);
}
