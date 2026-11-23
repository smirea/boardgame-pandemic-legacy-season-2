import { LS } from '#lib/storage.ts';

export type StoryPacing = 'story' | 'punchy';

export type AudioPrefs = {
	muted: boolean;
	master: number;
	music: number;
	sfx: number;
	voice: number;
	voiceEnabled: boolean;
	pacing: StoryPacing;
};

const DEFAULTS: AudioPrefs = {
	muted: false,
	master: 0.78,
	music: 0.52,
	sfx: 0.85,
	voice: 0.95,
	voiceEnabled: true,
	pacing: 'story',
};

function loadPrefs(): AudioPrefs {
	if (typeof window === 'undefined') return { ...DEFAULTS };
	const stored = LS.get('audio', null) as Partial<AudioPrefs> | null;
	if (!stored || typeof stored !== 'object') return { ...DEFAULTS };
	return {
		muted: typeof stored.muted === 'boolean' ? stored.muted : DEFAULTS.muted,
		master: typeof stored.master === 'number' ? clamp01(stored.master) : DEFAULTS.master,
		music: typeof stored.music === 'number' ? clamp01(stored.music) : DEFAULTS.music,
		sfx: typeof stored.sfx === 'number' ? clamp01(stored.sfx) : DEFAULTS.sfx,
		voice: typeof stored.voice === 'number' ? clamp01(stored.voice) : DEFAULTS.voice,
		voiceEnabled: typeof stored.voiceEnabled === 'boolean' ? stored.voiceEnabled : DEFAULTS.voiceEnabled,
		pacing: stored.pacing === 'punchy' ? 'punchy' : 'story',
	};
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

class AudioSettings {
	muted = $state(DEFAULTS.muted);
	master = $state(DEFAULTS.master);
	music = $state(DEFAULTS.music);
	sfx = $state(DEFAULTS.sfx);
	voice = $state(DEFAULTS.voice);
	voiceEnabled = $state(DEFAULTS.voiceEnabled);
	pacing = $state<StoryPacing>(DEFAULTS.pacing);

	private listeners = new Set<() => void>();

	constructor() {
		const initial = loadPrefs();
		this.muted = initial.muted;
		this.master = initial.master;
		this.music = initial.music;
		this.sfx = initial.sfx;
		this.voice = initial.voice;
		this.voiceEnabled = initial.voiceEnabled;
		this.pacing = initial.pacing;
	}

	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private persist() {
		if (typeof window !== 'undefined') {
			LS.set({
				audio: {
					muted: this.muted,
					master: this.master,
					music: this.music,
					sfx: this.sfx,
					voice: this.voice,
					voiceEnabled: this.voiceEnabled,
					pacing: this.pacing,
				},
			});
		}
		for (const fn of this.listeners) fn();
	}

	toggleMute() {
		this.muted = !this.muted;
		this.persist();
	}

	setMaster(value: number) {
		this.master = clamp01(value);
		if (this.master > 0 && this.muted) this.muted = false;
		this.persist();
	}

	setMusic(value: number) {
		this.music = clamp01(value);
		this.persist();
	}

	setSfx(value: number) {
		this.sfx = clamp01(value);
		this.persist();
	}

	setVoice(value: number) {
		this.voice = clamp01(value);
		this.persist();
	}

	toggleVoice() {
		this.voiceEnabled = !this.voiceEnabled;
		this.persist();
	}

	setPacing(pacing: StoryPacing) {
		this.pacing = pacing;
		this.persist();
	}
}

export const audioSettings = new AudioSettings();
