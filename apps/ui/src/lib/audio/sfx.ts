import { activeAudio, playNoiseBurst } from './engine.ts';

function jitter(base: number, pct = 0.04): number {
	return base * (1 + (Math.random() * 2 - 1) * pct);
}

/** Tactile wooden/acrylic cube pickup, pitched gently higher with stack count. */
export function sfxCubePickup(count = 1) {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	const pitch = 1 + Math.min(count, 8) * 0.045;

	const osc = g.ctx.createOscillator();
	osc.type = 'triangle';
	osc.frequency.setValueAtTime(jitter(420 * pitch, 0.03), t);
	osc.frequency.exponentialRampToValueAtTime(640 * pitch, t + 0.055);
	const gain = g.ctx.createGain();
	gain.gain.setValueAtTime(0.0001, t);
	gain.gain.linearRampToValueAtTime(0.16, t + 0.005);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
	osc.connect(gain);
	gain.connect(g.sfx);
	osc.start(t);
	osc.stop(t + 0.095);

	playNoiseBurst(g, {
		color: 'white',
		start: t,
		duration: 0.03,
		gain: 0.09,
		attack: 0.002,
		filterType: 'bandpass',
		freq: 2400 * pitch,
		q: 2.2,
	});
}

/** Tactile board-game cube placement with distinct acoustic materials per piece type. */
export function sfxCubeDrop(kind: 'supply' | 'plague' | 'hollow', count = 1) {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;

	if (kind === 'supply') {
		const pitch = 1 + Math.min(count, 6) * 0.03;
		// Primary wood/acrylic tap + crisp micro-bounce 42ms later
		for (const [offset, vol, freqMul] of [
			[0, 0.22, 1],
			[0.042, 0.08, 1.24],
		] as const) {
			const at = t + offset;
			const osc = g.ctx.createOscillator();
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(jitter(310 * pitch * freqMul, 0.04), at);
			osc.frequency.exponentialRampToValueAtTime(145 * freqMul, at + 0.048);
			const env = g.ctx.createGain();
			env.gain.setValueAtTime(0.0001, at);
			env.gain.linearRampToValueAtTime(vol, at + 0.003);
			env.gain.exponentialRampToValueAtTime(0.0001, at + 0.065);
			osc.connect(env);
			env.connect(g.sfx);
			osc.start(at);
			osc.stop(at + 0.075);

			playNoiseBurst(g, {
				color: 'white',
				start: at,
				duration: 0.025,
				gain: vol * 0.55,
				attack: 0.002,
				filterType: 'bandpass',
				freq: 1950 * freqMul,
				q: 2.6,
			});
		}
		return;
	}

	if (kind === 'plague') {
		// Hollow obsidian thud + eerie dissonant tritone shimmer
		const sub = g.ctx.createOscillator();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(98, t);
		sub.frequency.exponentialRampToValueAtTime(42, t + 0.32);
		const subEnv = g.ctx.createGain();
		subEnv.gain.setValueAtTime(0.0001, t);
		subEnv.gain.linearRampToValueAtTime(0.32, t + 0.006);
		subEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
		sub.connect(subEnv);
		subEnv.connect(g.sfx);
		sub.start(t);
		sub.stop(t + 0.38);

		for (const freq of [311.1, 440.0]) {
			const chime = g.ctx.createOscillator();
			chime.type = 'triangle';
			chime.frequency.setValueAtTime(jitter(freq, 0.01), t);
			const env = g.ctx.createGain();
			env.gain.setValueAtTime(0.0001, t);
			env.gain.linearRampToValueAtTime(0.075, t + 0.012);
			env.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
			chime.connect(env);
			env.connect(g.sfx);
			env.connect(g.hullReverb);
			chime.start(t);
			chime.stop(t + 0.58);
		}
		playNoiseBurst(g, {
			color: 'pink',
			start: t,
			duration: 0.09,
			gain: 0.14,
			filterType: 'bandpass',
			freq: 780,
			freqEnd: 260,
			q: 2,
			reverbSend: 0.25,
		});
		return;
	}

	// Hollow Men: heavy muffled boot/stone stomp + metallic rattle
	const stomp = g.ctx.createOscillator();
	stomp.type = 'sine';
	stomp.frequency.setValueAtTime(76, t);
	stomp.frequency.exponentialRampToValueAtTime(34, t + 0.22);
	const stompEnv = g.ctx.createGain();
	stompEnv.gain.setValueAtTime(0.0001, t);
	stompEnv.gain.linearRampToValueAtTime(0.3, t + 0.008);
	stompEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
	stomp.connect(stompEnv);
	stompEnv.connect(g.sfx);
	stomp.start(t);
	stomp.stop(t + 0.28);

	playNoiseBurst(g, {
		color: 'brown',
		start: t,
		duration: 0.14,
		gain: 0.22,
		filterType: 'lowpass',
		freq: 460,
		reverbSend: 0.3,
	});
}

/** Escalating dark metallic toll when an incident hits the track (1..8). */
export function sfxIncident(incidentCount = 1) {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	const urgency = Math.min(1, Math.max(0, (incidentCount - 1) / 7));
	const base = 110 * Math.pow(1.06, incidentCount - 1);

	for (const [ratio, vol, dur] of [
		[1, 0.22, 1.3],
		[1.414, 0.11 + urgency * 0.08, 1.05],
		[2.76, 0.06 + urgency * 0.06, 0.75],
	] as const) {
		const osc = g.ctx.createOscillator();
		osc.type = ratio === 1 ? 'sawtooth' : 'triangle';
		osc.frequency.setValueAtTime(base * ratio, t);
		const lp = g.ctx.createBiquadFilter();
		lp.type = 'lowpass';
		lp.frequency.setValueAtTime(900 + urgency * 1200, t);
		lp.frequency.exponentialRampToValueAtTime(220, t + dur);
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, t);
		env.gain.linearRampToValueAtTime(vol, t + 0.015);
		env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		osc.connect(lp);
		lp.connect(env);
		env.connect(g.sfx);
		env.connect(g.hullReverb);
		osc.start(t);
		osc.stop(t + dur + 0.05);
	}
}

/** Chain outbreak alarm resonance. */
export function sfxOutbreak() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	for (let i = 0; i < 3; i++) {
		const at = t + i * 0.14;
		const osc = g.ctx.createOscillator();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(220 * Math.pow(1.18, i), at);
		osc.frequency.exponentialRampToValueAtTime(165 * Math.pow(1.12, i), at + 0.35);
		const lp = g.ctx.createBiquadFilter();
		lp.type = 'bandpass';
		lp.frequency.value = 650 + i * 240;
		lp.Q.value = 2.4;
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, at);
		env.gain.linearRampToValueAtTime(0.22, at + 0.015);
		env.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
		osc.connect(lp);
		lp.connect(env);
		env.connect(g.sfx);
		env.connect(g.hullReverb);
		osc.start(at);
		osc.stop(at + 0.45);
	}
}

/** High-impact Epidemic audio across its stages. */
export function sfxEpidemic(stage: 'draw' | 'increase' | 'infect' | 'intensify' = 'draw') {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;

	if (stage === 'draw') {
		// Card snap + massive sub-drop + rusted maritime klaxon cluster
		playNoiseBurst(g, {
			color: 'white',
			start: t,
			duration: 0.06,
			gain: 0.24,
			attack: 0.003,
			filterType: 'bandpass',
			freq: 2600,
			freqEnd: 900,
			q: 1.5,
		});

		const sub = g.ctx.createOscillator();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(112, t + 0.04);
		sub.frequency.exponentialRampToValueAtTime(30, t + 1.35);
		const subEnv = g.ctx.createGain();
		subEnv.gain.setValueAtTime(0.0001, t + 0.04);
		subEnv.gain.linearRampToValueAtTime(0.42, t + 0.08);
		subEnv.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
		sub.connect(subEnv);
		subEnv.connect(g.sfx);
		sub.start(t + 0.04);
		sub.stop(t + 1.55);

		// Struck metal + distant foghorn fifth/tritone
		for (const [freq, detune, vol, delay] of [
			[73.42, -6, 0.19, 0.14],
			[103.83, 8, 0.14, 0.16],
			[146.83, -12, 0.1, 0.18],
			[207.65, 14, 0.07, 0.2],
		] as const) {
			const osc = g.ctx.createOscillator();
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(freq, t + delay);
			osc.detune.setValueAtTime(detune, t + delay);
			osc.detune.linearRampToValueAtTime(detune - 28, t + delay + 1.7);
			const lp = g.ctx.createBiquadFilter();
			lp.type = 'lowpass';
			lp.frequency.setValueAtTime(1400, t + delay);
			lp.frequency.exponentialRampToValueAtTime(240, t + delay + 1.8);
			const env = g.ctx.createGain();
			env.gain.setValueAtTime(0.0001, t + delay);
			env.gain.linearRampToValueAtTime(vol, t + delay + 0.18);
			env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 1.9);
			osc.connect(lp);
			lp.connect(env);
			env.connect(g.sfx);
			env.connect(g.hullReverb);
			osc.start(t + delay);
			osc.stop(t + delay + 1.95);
		}
		return;
	}

	if (stage === 'increase') {
		// Heavy iron notch advancing the rate track
		const osc = g.ctx.createOscillator();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(190, t);
		osc.frequency.exponentialRampToValueAtTime(285, t + 0.09);
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, t);
		env.gain.linearRampToValueAtTime(0.2, t + 0.008);
		env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
		osc.connect(env);
		env.connect(g.sfx);
		osc.start(t);
		osc.stop(t + 0.18);
		playNoiseBurst(g, {
			color: 'white',
			start: t,
			duration: 0.045,
			gain: 0.13,
			filterType: 'bandpass',
			freq: 1400,
			q: 3,
		});
		return;
	}

	if (stage === 'infect') {
		sfxCardFlip();
		const sub = g.ctx.createOscillator();
		sub.type = 'sine';
		sub.frequency.setValueAtTime(84, t + 0.05);
		sub.frequency.exponentialRampToValueAtTime(38, t + 0.5);
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, t + 0.05);
		env.gain.linearRampToValueAtTime(0.28, t + 0.07);
		env.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
		sub.connect(env);
		env.connect(g.sfx);
		sub.start(t + 0.05);
		sub.stop(t + 0.58);
		return;
	}

	// Intensify: rapid tactile riffle shuffle of the infection discard back onto deck
	for (let i = 0; i < 9; i++) {
		playNoiseBurst(g, {
			color: 'pink',
			start: t + i * 0.042 + Math.random() * 0.01,
			duration: 0.04,
			gain: 0.13 - i * 0.006,
			attack: 0.003,
			filterType: 'bandpass',
			freq: jitter(1750 + i * 95, 0.08),
			q: 1.8,
		});
	}
}

/** Crisp cardstock slide & flick when drawing a card. */
export function sfxCardDraw() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	playNoiseBurst(g, {
		color: 'pink',
		start: t,
		duration: 0.11,
		gain: 0.16,
		attack: 0.012,
		filterType: 'bandpass',
		freq: jitter(1550, 0.1),
		freqEnd: 2800,
		q: 1.3,
	});
}

/** Sharp cardstock flip snap. */
export function sfxCardFlip() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	playNoiseBurst(g, {
		color: 'white',
		start: t,
		duration: 0.075,
		gain: 0.15,
		attack: 0.005,
		filterType: 'bandpass',
		freq: jitter(2200, 0.1),
		freqEnd: 950,
		q: 1.6,
	});
	const thump = g.ctx.createOscillator();
	thump.type = 'sine';
	thump.frequency.setValueAtTime(jitter(165, 0.08), t + 0.015);
	thump.frequency.exponentialRampToValueAtTime(75, t + 0.07);
	const env = g.ctx.createGain();
	env.gain.setValueAtTime(0.0001, t + 0.015);
	env.gain.linearRampToValueAtTime(0.09, t + 0.02);
	env.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
	thump.connect(env);
	env.connect(g.sfx);
	thump.start(t + 0.015);
	thump.stop(t + 0.085);
}

/** Metallic coin scraping a silver scratch-off coating. */
export function sfxScratchBox() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	for (let i = 0; i < 4; i++) {
		const at = t + i * 0.095;
		playNoiseBurst(g, {
			color: 'white',
			start: at,
			duration: 0.085,
			gain: 0.13,
			attack: 0.012,
			filterType: 'bandpass',
			freq: 2900 + (i % 2) * 700,
			freqEnd: 4600 - (i % 2) * 900,
			q: 3.4,
		});
	}
}

/** Perforated cardstock dossier door tearing open. */
export function sfxDoorTear() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	for (let i = 0; i < 6; i++) {
		playNoiseBurst(g, {
			color: 'pink',
			start: t + i * 0.048,
			duration: 0.055,
			gain: 0.16 + i * 0.015,
			attack: 0.004,
			filterType: 'bandpass',
			freq: 950 + i * 240,
			freqEnd: 520,
			q: 2.1,
			reverbSend: 0.15,
		});
	}
	// Final crisp flap pop
	playNoiseBurst(g, {
		color: 'white',
		start: t + 0.31,
		duration: 0.04,
		gain: 0.22,
		attack: 0.002,
		filterType: 'highpass',
		freq: 1400,
	});
}

/** Cardboard crate tape peeling + lid opening + reveal swell. */
export function sfxCrateOpen() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	// Tape peel
	playNoiseBurst(g, {
		color: 'white',
		start: t,
		duration: 0.22,
		gain: 0.15,
		attack: 0.02,
		filterType: 'bandpass',
		freq: 2400,
		freqEnd: 4200,
		q: 2.8,
	});
	// Lid lift thump
	const thud = g.ctx.createOscillator();
	thud.type = 'sine';
	thud.frequency.setValueAtTime(125, t + 0.22);
	thud.frequency.exponentialRampToValueAtTime(52, t + 0.48);
	const env = g.ctx.createGain();
	env.gain.setValueAtTime(0.0001, t + 0.22);
	env.gain.linearRampToValueAtTime(0.24, t + 0.24);
	env.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
	thud.connect(env);
	env.connect(g.sfx);
	env.connect(g.hullReverb);
	thud.start(t + 0.22);
	thud.stop(t + 0.55);
}

/** Masking-tape peel + heavy slap onto an Epidemic card ("2-It's wearing off"). */
export function sfxTapeSlap(pitchOffset = 0) {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	const mult = Math.pow(1.03, pitchOffset);

	// Tape peel rip
	playNoiseBurst(g, {
		color: 'white',
		start: t,
		duration: 0.11,
		gain: 0.16,
		attack: 0.006,
		filterType: 'bandpass',
		freq: 3100 * mult,
		freqEnd: 1800 * mult,
		q: 3.2,
	});

	// Heavy palm slap onto card
	const slapAt = t + 0.115;
	const thump = g.ctx.createOscillator();
	thump.type = 'sine';
	thump.frequency.setValueAtTime(155 * mult, slapAt);
	thump.frequency.exponentialRampToValueAtTime(46, slapAt + 0.16);
	const env = g.ctx.createGain();
	env.gain.setValueAtTime(0.0001, slapAt);
	env.gain.linearRampToValueAtTime(0.36, slapAt + 0.004);
	env.gain.exponentialRampToValueAtTime(0.0001, slapAt + 0.2);
	thump.connect(env);
	env.connect(g.sfx);
	thump.start(slapAt);
	thump.stop(slapAt + 0.22);

	playNoiseBurst(g, {
		color: 'pink',
		start: slapAt,
		duration: 0.07,
		gain: 0.26,
		attack: 0.002,
		filterType: 'lowpass',
		freq: 1400,
		reverbSend: 0.2,
	});
}

/** Felt-tip pen / chalk line drawn across chart paper. */
export function sfxRouteDraw() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	playNoiseBurst(g, {
		color: 'pink',
		start: t,
		duration: 0.34,
		gain: 0.14,
		attack: 0.02,
		filterType: 'bandpass',
		freq: 1600,
		freqEnd: 2500,
		q: 2.6,
	});
}

/** Solid structure build anchor (Supply Center, Satellite Tower, Shelter). */
export function sfxBuildStructure(kind: 'center' | 'tower' | 'shelter') {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	const base = kind === 'center' ? 164.8 : kind === 'tower' ? 293.7 : 220;

	const osc = g.ctx.createOscillator();
	osc.type = 'triangle';
	osc.frequency.setValueAtTime(base, t);
	osc.frequency.exponentialRampToValueAtTime(base * 0.65, t + 0.16);
	const env = g.ctx.createGain();
	env.gain.setValueAtTime(0.0001, t);
	env.gain.linearRampToValueAtTime(0.24, t + 0.006);
	env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
	osc.connect(env);
	env.connect(g.sfx);
	osc.start(t);
	osc.stop(t + 0.24);

	if (kind === 'tower') {
		const ping = g.ctx.createOscillator();
		ping.type = 'sine';
		ping.frequency.setValueAtTime(880, t + 0.08);
		const pEnv = g.ctx.createGain();
		pEnv.gain.setValueAtTime(0.0001, t + 0.08);
		pEnv.gain.linearRampToValueAtTime(0.11, t + 0.095);
		pEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
		ping.connect(pEnv);
		pEnv.connect(g.sfx);
		pEnv.connect(g.hullReverb);
		ping.start(t + 0.08);
		ping.stop(t + 0.65);
	}
}

/** Character exposure scratch result. */
export function sfxExposure(outcome: 'safe' | 'scar' | 'death') {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	if (outcome === 'safe') {
		playNoiseBurst(g, {
			color: 'pink',
			start: t,
			duration: 0.18,
			gain: 0.09,
			filterType: 'lowpass',
			freq: 900,
			freqEnd: 350,
		});
		return;
	}
	// Double heartbeat thump
	for (const offset of [0, 0.22]) {
		const beat = g.ctx.createOscillator();
		beat.type = 'sine';
		beat.frequency.setValueAtTime(68, t + offset);
		beat.frequency.exponentialRampToValueAtTime(34, t + offset + 0.16);
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, t + offset);
		env.gain.linearRampToValueAtTime(0.35, t + offset + 0.01);
		env.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.19);
		beat.connect(env);
		env.connect(g.sfx);
		beat.start(t + offset);
		beat.stop(t + offset + 0.21);
	}
	if (outcome === 'death') {
		const toll = g.ctx.createOscillator();
		toll.type = 'triangle';
		toll.frequency.setValueAtTime(92.5, t + 0.35);
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, t + 0.35);
		env.gain.linearRampToValueAtTime(0.24, t + 0.38);
		env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
		toll.connect(env);
		env.connect(g.sfx);
		env.connect(g.hullReverb);
		toll.start(t + 0.35);
		toll.stop(t + 2.45);
	}
}

/** Shortwave radio tuning lock. */
export function sfxRadioTune(decoded = false) {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	playNoiseBurst(g, {
		color: 'white',
		start: t,
		duration: 0.35,
		gain: 0.11,
		filterType: 'bandpass',
		freq: 1100,
		freqEnd: 2400,
		q: 5.5,
	});
	if (decoded) {
		for (const [offset, freq] of [
			[0.24, 659.25],
			[0.36, 987.77],
		] as const) {
			const osc = g.ctx.createOscillator();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(freq, t + offset);
			const env = g.ctx.createGain();
			env.gain.setValueAtTime(0.0001, t + offset);
			env.gain.linearRampToValueAtTime(0.12, t + offset + 0.01);
			env.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.4);
			osc.connect(env);
			env.connect(g.sfx);
			env.connect(g.hullReverb);
			osc.start(t + offset);
			osc.stop(t + offset + 0.44);
		}
	}
}

/** Package 6 sterile pure-fifth motif — intentionally echoed and broken in September. */
export function sfxInoculationMotif(broken = false) {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	const notes = broken ? [293.66, 440, 277.18] : [293.66, 440, 587.33];
	notes.forEach((freq, idx) => {
		const at = t + idx * 0.22;
		const osc = g.ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(freq, at);
		if (broken) {
			osc.frequency.exponentialRampToValueAtTime(freq * 0.89, at + 1.1);
		}
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, at);
		env.gain.linearRampToValueAtTime(0.13, at + 0.04);
		env.gain.exponentialRampToValueAtTime(0.0001, at + (broken ? 1.2 : 1.5));
		osc.connect(env);
		env.connect(g.sfx);
		env.connect(g.hullReverb);
		osc.start(at);
		osc.stop(at + 1.55);
	});
}

/** Glass vaccine vial clink for PEARL Lab / Door 22. */
export function sfxVialClink(index = 0) {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	const base = 1860 + index * 140;
	for (const [ratio, vol] of [
		[1, 0.1],
		[2.32, 0.05],
	] as const) {
		const osc = g.ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(base * ratio, t);
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, t);
		env.gain.linearRampToValueAtTime(vol, t + 0.003);
		env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
		osc.connect(env);
		env.connect(g.sfx);
		env.connect(g.hullReverb);
		osc.start(t);
		osc.stop(t + 0.45);
	}
}

/** Heavy detonation + rubble collapse for Door 21 (Frankfurt destroyed). */
export function sfxCityDestroyed() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	const boom = g.ctx.createOscillator();
	boom.type = 'sine';
	boom.frequency.setValueAtTime(95, t);
	boom.frequency.exponentialRampToValueAtTime(24, t + 1.4);
	const env = g.ctx.createGain();
	env.gain.setValueAtTime(0.0001, t);
	env.gain.linearRampToValueAtTime(0.45, t + 0.02);
	env.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
	boom.connect(env);
	env.connect(g.sfx);
	boom.start(t);
	boom.stop(t + 1.65);

	playNoiseBurst(g, {
		color: 'brown',
		start: t,
		duration: 1.5,
		gain: 0.35,
		attack: 0.015,
		filterType: 'lowpass',
		freq: 920,
		freqEnd: 110,
		reverbSend: 0.45,
	});
}

/** Package 8: deceptively radiant Utopia chime that curdles into dark dread. */
export function sfxUtopiaCorrupt() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	const chord = [261.63, 329.63, 392.0, 523.25];
	chord.forEach((freq, i) => {
		const osc = g.ctx.createOscillator();
		osc.type = 'triangle';
		osc.frequency.setValueAtTime(freq, t);
		// Holds hopeful for 0.9s, then bends sourly downward into dissonant cluster
		osc.frequency.setValueAtTime(freq, t + 0.9);
		osc.frequency.exponentialRampToValueAtTime(freq * (i % 2 === 0 ? 0.87 : 0.78), t + 2.4);
		const env = g.ctx.createGain();
		env.gain.setValueAtTime(0.0001, t);
		env.gain.linearRampToValueAtTime(0.095, t + 0.15);
		env.gain.setValueAtTime(0.095, t + 1.1);
		env.gain.exponentialRampToValueAtTime(0.0001, t + 2.7);
		osc.connect(env);
		env.connect(g.sfx);
		env.connect(g.hullReverb);
		osc.start(t);
		osc.stop(t + 2.75);
	});
}

/** Subtle wooden/brass UI interaction click. */
export function sfxUiClick() {
	const g = activeAudio();
	if (!g) return;
	const t = g.ctx.currentTime;
	playNoiseBurst(g, {
		color: 'white',
		start: t,
		duration: 0.018,
		gain: 0.06,
		attack: 0.002,
		filterType: 'bandpass',
		freq: 2200,
		q: 2.5,
	});
}
