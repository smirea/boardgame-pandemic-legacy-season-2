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
	private cut: (() => void) | null = null;
	private startListeners = new Set<() => void>();
	private hushed = false;

	constructor() {
		audioSettings.subscribe(() => this.syncVolume());
	}

	/** While hushed nothing is spoken and a line under way stops, as if the voices were turned off. */
	hush(on: boolean) {
		this.hushed = on;
		if (on) this.stop();
	}

	/** Invoked whenever a story, search, or radio voice track starts playing. */
	onStart(fn: () => void): () => void {
		this.startListeners.add(fn);
		return () => this.startListeners.delete(fn);
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

	/**
	 * Plays the generated MP3 for `beatId`, ducking ambient music while active. Returns true if audio started.
	 * `onEnd` runs when the clip plays to its end, `onCut` when something stops it first: another clip, the mute.
	 */
	play(beatId: string, onEnd?: () => void, onCut?: () => void): boolean {
		return untrack(() => {
			this.stop();
			if (typeof window === 'undefined') return false;
			if (this.hushed || audioSettings.muted || !audioSettings.voiceEnabled) return false;
			const entry = voiceManifest[beatId];
			if (!entry) return false;

			const run = ++this.token;
			for (const fn of this.startListeners) fn();
			const audio = new Audio(entry.src);
			audio.volume = Math.max(0, Math.min(1, audioSettings.master * audioSettings.voice));
			audio.preload = 'auto';
			this.el = audio;
			this.active = true;
			this.cut = onCut ?? null;
			this.playingId = beatId;
			this.busy = true;
			setMusicDuck(true, 0.28);

			const finish = () => {
				if (this.token !== run) return;
				this.cut = null;
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
			const cut = this.cut;
			this.cut = null;
			cut?.();
		});
	}
}

export const voicePlayer = new VoicePlayer();
