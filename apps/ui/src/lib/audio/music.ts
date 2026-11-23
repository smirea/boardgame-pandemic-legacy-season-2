import { activeAudio, onAudioUnlocked, playNoiseBurst } from './engine.ts';
import { audioSettings } from './settings.svelte.ts';

export type MusicMood = {
	active: boolean;
	incidents: number;
	epidemics: number;
	month: number;
	hollowPresent: boolean;
	inoculationSafe: boolean;
	wearingOff: boolean;
	storyOpen: boolean;
};

const SCALE_CALM = [146.83, 164.81, 174.61, 220.0, 261.63, 293.66, 329.63, 349.23]; // D Aeolian
const SCALE_TENSE = [146.83, 155.56, 174.61, 207.65, 220.0, 261.63, 277.18, 293.66]; // D Phrygian/diminished

class AdaptiveMusic {
	private mood: MusicMood = {
		active: false,
		incidents: 0,
		epidemics: 0,
		month: 0,
		hollowPresent: false,
		inoculationSafe: false,
		wearingOff: false,
		storyOpen: false,
	};

	private running = false;
	private timer: ReturnType<typeof setInterval> | null = null;
	private padOscA: OscillatorNode | null = null;
	private padOscB: OscillatorNode | null = null;
	private padOscSub: OscillatorNode | null = null;
	private safeOsc: OscillatorNode | null = null;
	private safeGain: GainNode | null = null;
	private padFilter: BiquadFilterNode | null = null;
	private padGain: GainNode | null = null;
	private airSrc: AudioBufferSourceNode | null = null;
	private airGain: GainNode | null = null;
	private lfo: OscillatorNode | null = null;
	private step = 0;
	private nextMotifAt = 0;
	private nextPulseAt = 0;
	private nextHollowAt = 0;
	private nextRoomAt = 0;
	private bound = false;

	private ensureBound() {
		if (this.bound) return;
		this.bound = true;
		onAudioUnlocked(() => this.sync());
		audioSettings.subscribe(() => this.sync());
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', () => this.sync());
		}
	}

	update(next: MusicMood) {
		this.ensureBound();
		this.mood = next;
		this.sync();
	}

	/** Triggers the mid-game epidemic harmonic shift (brief ears-ringing filter dip + struck metal). */
	triggerEpidemicShift() {
		const g = activeAudio();
		if (!g || !this.padFilter) return;
		const now = g.ctx.currentTime;
		const baseFreq = this.targetFilterFreq();
		this.padFilter.frequency.cancelScheduledValues(now);
		this.padFilter.frequency.setValueAtTime(this.padFilter.frequency.value, now);
		this.padFilter.frequency.exponentialRampToValueAtTime(160, now + 0.55);
		this.padFilter.frequency.exponentialRampToValueAtTime(Math.min(1800, baseFreq * 1.25), now + 7.5);
	}

	/** Computes continuous 0..1 tension from incidents (0..8) and epidemics drawn (0..6+). */
	tension(): number {
		const inc = Math.min(1, this.mood.incidents / 7);
		const epi = Math.min(1, this.mood.epidemics / 5);
		const late = Math.min(0.2, Math.max(0, (this.mood.month - 6) / 30));
		return Math.min(1, inc * 0.58 + epi * 0.42 + late);
	}

	private targetFilterFreq(): number {
		const ten = this.tension();
		const storySoften = this.mood.storyOpen ? 0.65 : 1;
		return (280 + ten * 1150) * storySoften;
	}

	private sync() {
		const shouldRun =
			this.mood.active &&
			!audioSettings.muted &&
			audioSettings.music > 0.005 &&
			(typeof document === 'undefined' || !document.hidden);

		if (!shouldRun) {
			this.stop();
			return;
		}
		const g = activeAudio();
		if (!g) return;
		if (!this.running) this.start(g);
		this.retune(g);
	}

	private start(g: NonNullable<ReturnType<typeof activeAudio>>) {
		this.running = true;
		const now = g.ctx.currentTime;

		const filter = g.ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(this.targetFilterFreq(), now);
		filter.Q.value = 1.4;

		const padGain = g.ctx.createGain();
		padGain.gain.setValueAtTime(0.0001, now);
		padGain.gain.linearRampToValueAtTime(0.15, now + 2.4);

		// Organic wandering detune (±7 cents) so drones feel like bowed strings / hull resonance
		const lfo = g.ctx.createOscillator();
		lfo.type = 'sine';
		lfo.frequency.value = 0.073; // prime-ish slow drift
		const lfoDepth = g.ctx.createGain();
		lfoDepth.gain.value = 7.5;
		lfo.connect(lfoDepth);

		const oscA = g.ctx.createOscillator();
		oscA.type = 'sawtooth';
		oscA.frequency.setValueAtTime(73.42, now); // D2
		lfoDepth.connect(oscA.detune);

		const oscB = g.ctx.createOscillator();
		oscB.type = 'triangle';
		oscB.frequency.setValueAtTime(110.0, now); // A2 (shifts darker at high tension)
		oscB.detune.value = -5;

		const oscSub = g.ctx.createOscillator();
		oscSub.type = 'sine';
		oscSub.frequency.setValueAtTime(36.71, now); // D1 ocean hull sub
		const subGain = g.ctx.createGain();
		subGain.gain.value = 0.55;

		// Sterile pure-fifth inoculation hum (only audible while Package 6 safe and before September)
		const safeOsc = g.ctx.createOscillator();
		safeOsc.type = 'sine';
		safeOsc.frequency.setValueAtTime(220.0, now);
		const safeGain = g.ctx.createGain();
		safeGain.gain.setValueAtTime(this.mood.inoculationSafe && !this.mood.wearingOff ? 0.028 : 0.0001, now);
		safeOsc.connect(safeGain);
		safeGain.connect(g.music);

		// Subtle maritime ocean room tone
		const airSrc = g.ctx.createBufferSource();
		airSrc.buffer = g.noise.brown;
		airSrc.loop = true;
		const airFilter = g.ctx.createBiquadFilter();
		airFilter.type = 'bandpass';
		airFilter.frequency.value = 210;
		airFilter.Q.value = 0.7;
		const airGain = g.ctx.createGain();
		airGain.gain.setValueAtTime(0.0001, now);
		airGain.gain.linearRampToValueAtTime(0.045, now + 3);
		airSrc.connect(airFilter);
		airFilter.connect(airGain);
		airGain.connect(g.music);

		oscA.connect(filter);
		oscB.connect(filter);
		oscSub.connect(subGain);
		subGain.connect(filter);
		filter.connect(padGain);
		padGain.connect(g.music);
		padGain.connect(g.voidReverb);

		oscA.start(now);
		oscB.start(now);
		oscSub.start(now);
		safeOsc.start(now);
		lfo.start(now);
		airSrc.start(now);

		this.padOscA = oscA;
		this.padOscB = oscB;
		this.padOscSub = oscSub;
		this.safeOsc = safeOsc;
		this.safeGain = safeGain;
		this.padFilter = filter;
		this.padGain = padGain;
		this.airSrc = airSrc;
		this.airGain = airGain;
		this.lfo = lfo;

		this.nextMotifAt = now + 2.2;
		this.nextPulseAt = now + 1.2;
		this.nextHollowAt = now + 5.5;
		this.nextRoomAt = now + 11;

		this.timer = setInterval(() => this.tick(), 900);
	}

	private retune(g: NonNullable<ReturnType<typeof activeAudio>>) {
		if (!this.running || !this.padFilter || !this.padOscB || !this.padGain || !this.safeGain) return;
		const now = g.ctx.currentTime;
		const ten = this.tension();

		this.padFilter.frequency.setTargetAtTime(this.targetFilterFreq(), now, 1.4);
		this.padGain.gain.setTargetAtTime(0.13 + ten * 0.09, now, 1.6);

		// Fifth (A2 = 110Hz) drifts into unsettling tritone (Ab2 = 103.83Hz) as crisis deepens
		const upperTarget = ten > 0.62 ? 103.83 : ten > 0.35 ? 106.5 : 110.0;
		this.padOscB.frequency.setTargetAtTime(upperTarget, now, 2.2);

		const safeTarget = this.mood.inoculationSafe && !this.mood.wearingOff ? 0.03 : 0.0001;
		this.safeGain.gain.setTargetAtTime(safeTarget, now, 1.2);
	}

	private tick() {
		if (!this.running) return;
		const g = activeAudio();
		if (!g) {
			this.stop();
			return;
		}
		const now = g.ctx.currentTime;
		const ten = this.tension();
		this.step++;

		// 1. Prime-interval melodic/harmonic note swells (never a rigid 4-bar loop)
		if (now >= this.nextMotifAt) {
			const scale = ten > 0.45 ? SCALE_TENSE : SCALE_CALM;
			const note = scale[(this.step * 5 + Math.floor(Math.random() * 3)) % scale.length]!;
			const octave = ten > 0.7 && Math.random() < 0.35 ? 2 : 1;
			this.playSwellingNote(g, now + 0.15, note * octave, 0.036 + ten * 0.032, 3.8 - ten * 1.2);
			// Prime-ish spacing: ~7s calm down to ~3.4s at peak crisis
			this.nextMotifAt = now + (7.3 - ten * 3.8) + Math.random() * 2.1;
		}

		// 2. Escalating rhythmic pulse once tension > 0.22 (heartbeat / sonar tension bed)
		if (ten > 0.22 && now >= this.nextPulseAt) {
			const period = Math.max(0.72, 2.4 - ten * 1.55);
			const beats = Math.max(1, Math.min(3, Math.floor(1.8 / period)));
			for (let i = 0; i < beats; i++) {
				const at = now + 0.1 + i * period;
				const osc = g.ctx.createOscillator();
				osc.type = 'sine';
				osc.frequency.setValueAtTime(73.42, at);
				osc.frequency.exponentialRampToValueAtTime(41.2, at + 0.24);
				const env = g.ctx.createGain();
				const peak = (ten - 0.18) * 0.16;
				env.gain.setValueAtTime(0.0001, at);
				env.gain.linearRampToValueAtTime(peak, at + 0.02);
				env.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
				osc.connect(env);
				env.connect(g.music);
				osc.start(at);
				osc.stop(at + 0.42);
			}
			this.nextPulseAt = now + beats * period;
		}

		// 3. Irregular Hollow Men muffled footsteps / percussion once they enter play
		if (this.mood.hollowPresent && now >= this.nextHollowAt) {
			const at = now + 0.2;
			playNoiseBurst(g, {
				color: 'brown',
				start: at,
				duration: 0.12,
				gain: 0.06 + ten * 0.07,
				filterType: 'lowpass',
				freq: 340,
				dest: g.music,
				reverbSend: 0.35,
			});
			this.nextHollowAt = now + (4.7 - ten * 2.2) + Math.random() * 2.8;
		}

		// 4. Sparse inhabited-room texture (distant ship creak / radio crackle every 17-37s)
		if (now >= this.nextRoomAt) {
			playNoiseBurst(g, {
				color: 'pink',
				start: now + 0.3,
				duration: 0.38,
				gain: 0.025,
				attack: 0.06,
				filterType: 'bandpass',
				freq: 620 + Math.random() * 900,
				q: 4.5,
				dest: g.music,
			});
			this.nextRoomAt = now + 17 + Math.random() * 20;
		}
	}

	private playSwellingNote(
		g: NonNullable<ReturnType<typeof activeAudio>>,
		start: number,
		freq: number,
		vol: number,
		dur: number,
	) {
		const osc = g.ctx.createOscillator();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(freq, start);
		osc.detune.setValueAtTime((Math.random() * 2 - 1) * 8, start);
		const lp = g.ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.setValueAtTime(freq * 2.6, start);
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, start);
		env.gain.linearRampToValueAtTime(vol, start + dur * 0.32);
		env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
		osc.connect(lp);
		lp.connect(env);
		env.connect(g.music);
		env.connect(g.voidReverb);
		osc.start(start);
		osc.stop(start + dur + 0.06);
	}

	stop() {
		if (!this.running) return;
		this.running = false;
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		const nodes = [this.padOscA, this.padOscB, this.padOscSub, this.safeOsc, this.airSrc, this.lfo];
		for (const node of nodes) {
			if (!node) continue;
			try {
				node.stop();
				node.disconnect();
			} catch {
				// Already stopped.
			}
		}
		this.padGain?.disconnect();
		this.safeGain?.disconnect();
		this.airGain?.disconnect();
		this.padFilter?.disconnect();
		this.padOscA = null;
		this.padOscB = null;
		this.padOscSub = null;
		this.safeOsc = null;
		this.safeGain = null;
		this.padFilter = null;
		this.padGain = null;
		this.airSrc = null;
		this.airGain = null;
		this.lfo = null;
	}
}

export const ambientMusic = new AdaptiveMusic();
