import { activeAudio, isAudioUnlocked, onAudioUnlocked } from './engine.ts';
import { Score, type Mood } from './score.ts';
import { audioSettings } from './settings.svelte.ts';
import type { Cue } from './themes.ts';
import type { CreatureId } from './wildlife.ts';

/** Keeps one `Score` playing on the live engine for as long as there is a mood and sound is on. */
class AmbientMusic {
	private mood: Mood | null = null;
	private score: Score | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private bound = false;

	private bind() {
		if (this.bound) return;
		this.bound = true;
		onAudioUnlocked(() => this.sync());
		audioSettings.subscribe(() => this.sync());
		if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.sync());
	}

	update(mood: Mood) {
		this.bind();
		this.mood = mood;
		this.sync();
	}

	accent(cue: Cue) {
		if (activeAudio()) this.score?.accent(cue);
	}

	hear(creature: CreatureId) {
		if (activeAudio()) this.score?.hear(creature);
	}

	hearWeather(kind: 'wave' | 'thunder') {
		if (activeAudio()) this.score?.hearWeather(kind);
	}

	stop() {
		this.mood = null;
		this.sync();
	}

	private sync() {
		if (!this.mood || audioSettings.music <= 0.005 || !isAudioUnlocked()) {
			this.score?.end();
			this.score = null;
			this.pause();
			return;
		}
		const g = activeAudio();
		if (!g) {
			// Hidden or muted: the engine suspends the context, which freezes the score where it is, so it picks up from there.
			this.pause();
			return;
		}
		if (this.score) {
			this.score.set(this.mood);
		} else {
			this.score = new Score(
				{ ctx: g.ctx, out: g.music, cues: g.cues, reverb: g.voidReverb, noise: g.noise },
				this.mood,
			);
		}
		this.timer ??= setInterval(() => this.score?.tick(), 500);
	}

	private pause() {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}

export const ambientMusic = new AmbientMusic();
