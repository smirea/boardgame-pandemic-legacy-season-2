import { untrack } from 'svelte';
import { setMusicDuck } from '#lib/audio/engine.ts';
import { audioSettings } from '#lib/audio/settings.svelte.ts';
import { voiceManifest } from './voices.generated.ts';

class VoicePlayer {
	playingId = $state<string | null>(null);
	busy = $state(false);

	private el: HTMLAudioElement | null = null;
	private token = 0;
	private active = false;

	constructor() {
		audioSettings.subscribe(() => this.syncVolume());
	}

	hasAudio(beatId: string): boolean {
		return beatId in voiceManifest;
	}

	private syncVolume() {
		if (!this.el) return;
		if (audioSettings.muted || !audioSettings.voiceEnabled) {
			this.stop();
			return;
		}
		this.el.volume = Math.max(0, Math.min(1, audioSettings.master * audioSettings.voice));
	}

	/** Plays the generated MP3 for `beatId`, ducking ambient music while active. Returns true if audio started. */
	play(beatId: string, onEnd?: () => void): boolean {
		return untrack(() => {
			this.stop();
			if (typeof window === 'undefined') return false;
			if (audioSettings.muted || !audioSettings.voiceEnabled) return false;
			const entry = voiceManifest[beatId];
			if (!entry) return false;

			const run = ++this.token;
			const audio = new Audio(entry.src);
			audio.volume = Math.max(0, Math.min(1, audioSettings.master * audioSettings.voice));
			audio.preload = 'auto';
			this.el = audio;
			this.active = true;
			this.playingId = beatId;
			this.busy = true;
			setMusicDuck(true, 0.28);

			const finish = () => {
				if (this.token !== run) return;
				this.active = false;
				this.playingId = null;
				this.busy = false;
				setMusicDuck(false);
				onEnd?.();
			};
			audio.addEventListener('ended', finish, { once: true });
			audio.addEventListener('error', finish, { once: true });
			void audio.play().catch(finish);
			return true;
		});
	}

	stop() {
		untrack(() => {
			this.token++;
			if (this.el) {
				try {
					this.el.pause();
					this.el.currentTime = 0;
				} catch {
					// Already stopped.
				}
				this.el = null;
			}
			if (this.active) {
				this.active = false;
				this.playingId = null;
				this.busy = false;
				setMusicDuck(false);
			}
		});
	}
}

export const voicePlayer = new VoicePlayer();
