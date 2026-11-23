<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { onDestroy, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import {
		sfxCardFlip,
		sfxCityDestroyed,
		sfxCrateOpen,
		sfxCubeDrop,
		sfxDoorTear,
		sfxEpidemic,
		sfxExposure,
		sfxInoculationMotif,
		sfxOutcome,
		sfxRadioTune,
		sfxScratchBox,
		sfxUtopiaCorrupt,
		sfxVialClink,
	} from '#lib/audio/sfx.ts';
	import { audioSettings } from '#lib/audio/settings.svelte.ts';
	import { CAST } from './cast.ts';
	import type { SpeakerId } from './cast.ts';
	import type { SetPieceId, SfxCue, StoryScene } from './script.ts';
	import SetPieceLayer from './SetPieceLayer.svelte';
	import { voicePlayer } from './voice.svelte.ts';

	type Props = {
		scene: StoryScene;
		/** True when rendered over Unboxing (leaves center free for cards/seals unless a set-piece runs). */
		overlay?: boolean;
		/** Optional campaign flag for Final Reckoning visuals. */
		delivered?: boolean;
		/** Called when the player finishes or skips past the last beat. */
		ondone?: () => void;
		/** Called when a user explicitly dismisses a standalone scene. */
		onclose?: () => void;
	};

	let { scene, overlay = false, delivered = true, ondone, onclose }: Props = $props();

	let index = $state(0);
	let autoAdvance = $state(true);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let sceneKey = '';

	const beat = $derived(scene.beats[index] ?? scene.beats[0]!);
	const speaker = $derived(CAST[beat.speaker]);
	const listener = $derived(beat.listener ? CAST[beat.listener] : null);
	const styleKind = $derived(beat.style ?? speaker.defaultStyle);
	const isLast = $derived(index >= scene.beats.length - 1);

	const leftActor = $derived.by((): { id: SpeakerId; active: boolean } | null => {
		if (speaker.side === 'left' && speaker.image) return { id: speaker.id, active: true };
		if (listener && listener.side === 'left' && listener.image) return { id: listener.id, active: false };
		return null;
	});

	const rightActor = $derived.by((): { id: SpeakerId; active: boolean } | null => {
		if (speaker.side === 'right' && speaker.image) return { id: speaker.id, active: true };
		if (listener && listener.side === 'right' && listener.image) return { id: listener.id, active: false };
		return null;
	});

	const activeSetPiece = $derived.by((): SetPieceId | null => {
		for (let i = index; i >= 0; i--) {
			const sp = scene.beats[i]?.setPiece;
			if (sp) return sp;
		}
		return null;
	});

	function fireCue(cue: SfxCue | undefined) {
		switch (cue) {
			case 'cardFlip':
				sfxCardFlip();
				break;
			case 'crateOpen':
				sfxCrateOpen();
				break;
			case 'doorTear':
				sfxDoorTear();
				break;
			case 'scratch':
				sfxScratchBox();
				break;
			case 'epidemicDraw':
				sfxEpidemic('draw');
				break;
			case 'inoculationSafe':
				sfxInoculationMotif(false);
				break;
			case 'wearingOffSnap':
				sfxInoculationMotif(true);
				break;
			case 'cityDestroyed':
				sfxCityDestroyed();
				break;
			case 'hollowDrop':
				sfxCubeDrop('hollow');
				break;
			case 'radioDecode':
				sfxRadioTune(true);
				break;
			case 'utopiaCorrupt':
				sfxUtopiaCorrupt();
				break;
			case 'vialClink':
				sfxVialClink(1);
				break;
			case 'exposureScar':
				sfxExposure('scar');
				break;
			case 'victory':
				sfxOutcome(true);
				break;
			case 'defeat':
				sfxOutcome(false);
				break;
		}
	}

	function clearTimer() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	/** Advances to the next beat if one remains; returns true if advanced, false if already on the last beat. */
	export function advance(): boolean {
		if (index < scene.beats.length - 1) {
			next();
			return true;
		}
		return false;
	}

	export function next() {
		clearTimer();
		voicePlayer.stop();
		if (index < scene.beats.length - 1) {
			index += 1;
		} else {
			ondone?.();
		}
	}

	export function prev() {
		clearTimer();
		voicePlayer.stop();
		if (index > 0) index -= 1;
	}

	export function replayVoice() {
		clearTimer();
		voicePlayer.play(beat.id);
	}

	$effect(() => {
		const id = scene.id;
		if (id !== sceneKey) {
			sceneKey = id;
			index = 0;
		}
	});

	$effect(() => {
		const current = beat;
		const total = scene.beats.length;
		const currentIndex = index;
		clearTimer();
		if (!current) return;

		untrack(() => {
			fireCue(current.cue);

			const onFinished = () => {
				if (!autoAdvance || currentIndex >= total - 1) return;
				const pauseMs = audioSettings.pacing === 'punchy' ? 450 : 900;
				timer = setTimeout(() => {
					if (index === currentIndex && index < total - 1) index += 1;
				}, pauseMs);
			};

			const startedVoice = voicePlayer.play(current.id, onFinished);
			if (!startedVoice && autoAdvance && currentIndex < total - 1 && !overlay) {
				// Gentle reading fallback when voice is muted or audio hasn't been generated yet.
				const words = current.text.split(/\s+/).length;
				const baseMs = audioSettings.pacing === 'punchy' ? Math.max(2400, words * 110) : Math.max(4200, words * 210);
				const ms = current.setPiece ? Math.max(5800, baseMs) : baseMs;
				timer = setTimeout(() => {
					if (index === currentIndex && index < total - 1) index += 1;
				}, ms);
			}
		});

		return () => {
			clearTimer();
		};
	});

	onDestroy(() => {
		clearTimer();
		voicePlayer.stop();
	});
</script>

<section
	class="story-stage"
	class:overlay
	class:has-setpiece={Boolean(activeSetPiece)}
	aria-label={`Story scene: ${scene.title}`}
	data-testid="story-stage"
	data-scene={scene.id}
	data-speaker={speaker.id}
	{@attach feedback('Story stage', () => ({ scene: scene.id, beat: beat.id, speaker: speaker.id }))}
>
	{#if !overlay}
		<div class="stage-backdrop" transition:fade={{ duration: 280 }}></div>
		<header class="act-header" in:fade={{ duration: 300 }}>
			<span class="act-kicker">{scene.act}</span>
			<h2>{scene.title}</h2>
			{#if scene.subtitle}<span class="act-sub">{scene.subtitle}</span>{/if}
		</header>
		{#if onclose}
			<button type="button" class="close-btn" onclick={onclose} aria-label="Close story scene">×</button>
		{/if}
	{/if}

	<!-- Boxless full-height cast cutouts living directly on the screen flanks -->
	<div class="flank left" aria-hidden="true">
		{#if leftActor}
			{@const actor = CAST[leftActor.id]}
			{#key leftActor.id}
				<img
					class="cutout"
					class:active={leftActor.active}
					class:silhouette={!leftActor.active}
					class:radio-ghost={leftActor.id === 'archive'}
					src={actor.image!}
					alt=""
					style:--glow={actor.accent}
					in:fly={{ x: -75, duration: 460, easing: cubicOut }}
					out:fade={{ duration: 240 }}
				/>
			{/key}
		{/if}
	</div>

	<div class="flank right" aria-hidden="true">
		{#if rightActor}
			{@const actor = CAST[rightActor.id]}
			{#key rightActor.id}
				<img
					class="cutout"
					class:active={rightActor.active}
					class:silhouette={!rightActor.active}
					class:radio-ghost={rightActor.id === 'archive'}
					src={actor.image!}
					alt=""
					style:--glow={actor.accent}
					in:fly={{ x: 75, duration: 460, easing: cubicOut }}
					out:fade={{ duration: 240 }}
				/>
			{/key}
		{/if}
	</div>

	<!-- Center stage set-piece (e.g. September 5 Epidemic Cards Masking-Tape Swap) -->
	{#if activeSetPiece}
		<div class="setpiece-anchor">
			<SetPieceLayer piece={activeSetPiece} {delivered} compact={overlay} />
		</div>
	{/if}

	<!-- Floating dialogue / thought / radio / chronicler narrator bubble -->
	<div class="dialogue-dock side-{speaker.side}" style:--accent={speaker.accent} data-testid="story-bubble">
		{#key beat.id}
			<article class="bubble kind-{styleKind}" in:fly={{ y: 14, duration: 280, easing: cubicOut }}>
				{#if styleKind === 'thought'}
					<span class="thought-dots" aria-hidden="true"><i></i><i></i><i></i></span>
				{/if}

				<div class="speaker-row">
					{#if styleKind === 'narrator'}
						<svg class="compass" viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.4" />
							<path d="M12 3.5 14 10l6.5 2-6.5 2-2 6.5L10 14l-6.5-2L10 10Z" fill="currentColor" />
						</svg>
					{:else if styleKind === 'radio'}
						<span class="radio-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
					{/if}
					<strong class="speaker-name">{speaker.name}</strong>
					<span class="speaker-role">{speaker.title}</span>
					{#if voicePlayer.playingId === beat.id}
						<span class="speaking-tag" aria-label="Voice playing">LIVE</span>
					{/if}
				</div>

				<p class="line" data-testid="story-line">{beat.text}</p>

				<footer class="bubble-controls">
					<div class="pips" role="tablist" aria-label="Story lines">
						{#each scene.beats as entry, idx (entry.id)}
							<button
								type="button"
								class="pip"
								class:on={idx === index}
								class:done={idx < index}
								aria-label={`Line ${idx + 1} of ${scene.beats.length}`}
								onclick={() => {
									clearTimer();
									voicePlayer.stop();
									index = idx;
								}}
							></button>
						{/each}
					</div>

					<div class="actions">
						{#if voicePlayer.hasAudio(beat.id)}
							<button type="button" class="ctrl" onclick={replayVoice} aria-label="Replay voice line"> Replay </button>
						{/if}
						<button
							type="button"
							class="ctrl"
							class:on={audioSettings.voiceEnabled}
							onclick={() => audioSettings.toggleVoice()}
						>
							{audioSettings.voiceEnabled ? 'Voice on' : 'Voice off'}
						</button>
						{#if index > 0}
							<button type="button" class="ctrl" onclick={prev}>Back</button>
						{/if}
						{#if !isLast}
							<button type="button" class="ctrl primary" onclick={next} data-testid="story-next"> Next › </button>
						{:else if ondone || onclose}
							<button
								type="button"
								class="ctrl primary"
								onclick={() => (ondone ? ondone() : onclose?.())}
								data-testid="story-finish"
							>
								{overlay ? 'Continue' : 'Close'}
							</button>
						{/if}
					</div>
				</footer>
			</article>
		{/key}
	</div>
</section>

<style>
	.story-stage {
		position: fixed;
		inset: 0;
		z-index: 68;
		pointer-events: none;
		overflow: hidden;
		font-family: var(--font-ui);
	}

	.story-stage.overlay {
		position: absolute;
		z-index: 12;
	}

	.stage-backdrop {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 68% 58% at 50% 42%, rgb(16 14 12 / 0.56), rgb(8 7 6 / 0.88)),
			linear-gradient(180deg, rgb(10 9 8 / 0.72), rgb(8 7 6 / 0.82));
		backdrop-filter: blur(3px);
		pointer-events: auto;
	}

	.act-header {
		position: absolute;
		top: 1.05rem;
		left: 50%;
		z-index: 6;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.14rem;
		width: min(36rem, calc(100vw - 7.5rem));
		padding: 0.4rem 0.6rem 0.5rem;
		border-bottom: 1px solid rgb(231 220 198 / 0.22);
		text-align: center;
		pointer-events: auto;
	}

	.act-kicker {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #d6b66f;
	}

	.act-header h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 2.5vw, 2.05rem);
		font-weight: 400;
		color: #f6ebd4;
		line-height: 1.05;
	}

	.act-sub {
		font-size: 0.78rem;
		color: #b7a98e;
	}

	.close-btn {
		position: absolute;
		top: 1rem;
		right: 1.15rem;
		z-index: 12;
		width: 2.2rem;
		height: 2.2rem;
		border: 1px solid rgb(231 220 198 / 0.35);
		border-radius: 50%;
		background: rgb(18 15 12 / 0.88);
		color: #f4e8cd;
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
		pointer-events: auto;
	}

	.close-btn:hover {
		border-color: #f4e8cd;
	}

	/* === Boxless Massive Character Flanks (NO boxes, NO frames) === */
	.flank {
		position: absolute;
		bottom: 0;
		z-index: 3;
		display: flex;
		align-items: flex-end;
		width: clamp(13rem, 25vw, 24rem);
		height: clamp(20rem, 66vh, 42rem);
		pointer-events: none;
	}

	.flank.left {
		left: -0.6rem;
		justify-content: flex-start;
	}

	.flank.right {
		right: -0.6rem;
		justify-content: flex-end;
	}

	.cutout {
		display: block;
		max-height: 100%;
		max-width: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		object-position: bottom;
		transform-origin: bottom center;
		transition:
			transform 420ms cubic-bezier(0.2, 0.9, 0.3, 1.05),
			filter 420ms ease,
			opacity 420ms ease;
	}

	.cutout.active {
		transform: translateY(0) scale(1.03);
		filter: drop-shadow(0 0.9rem 2.2rem rgb(0 0 0 / 0.78))
			drop-shadow(0 0 1.4rem color-mix(in srgb, var(--glow, #e2c36a) 32%, transparent));
		opacity: 1;
	}

	/* Listening character on the opposite flank recedes into moody silhouette */
	.cutout.silhouette {
		transform: translateY(1.2rem) scale(0.92);
		filter: brightness(0.24) contrast(1.25) saturate(0.25) drop-shadow(0 0.7rem 1.8rem rgb(0 0 0 / 0.8));
		opacity: 0.72;
	}

	.cutout.radio-ghost.active {
		filter: sepia(0.22) hue-rotate(138deg) saturate(0.85) contrast(1.08) drop-shadow(0 0 1.6rem rgb(126 201 194 / 0.42))
			drop-shadow(0 0.8rem 2rem rgb(0 0 0 / 0.8));
	}

	/* === Center Set-Piece Layer === */
	.setpiece-anchor {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 5;
		transform: translate(-50%, -62%);
		width: min(46rem, 92vw);
		pointer-events: auto;
	}

	.story-stage.overlay .setpiece-anchor {
		top: 46%;
		transform: translate(-50%, -50%);
		z-index: 8;
	}

	/* === Floating Speech / Thought / Radio / Narrator Bubbles === */
	.dialogue-dock {
		position: absolute;
		bottom: 1.2rem;
		left: 50%;
		z-index: 9;
		transform: translateX(-50%);
		width: min(39rem, calc(100vw - 2rem));
		pointer-events: auto;
	}

	.story-stage.overlay .dialogue-dock {
		bottom: 4.55rem;
		width: min(37rem, calc(100vw - 26rem));
	}

	.dialogue-dock.side-left {
		transform: translateX(-46%);
	}

	.dialogue-dock.side-right {
		transform: translateX(-54%);
	}

	.bubble {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.48rem;
		padding: 0.85rem 1.15rem 0.72rem;
		border: 1.5px solid color-mix(in srgb, var(--accent) 55%, rgb(240 230 206 / 0.25));
		border-radius: 10px;
		background: linear-gradient(172deg, rgb(22 18 15 / 0.94), rgb(14 11 9 / 0.96));
		box-shadow:
			0 1.1rem 2.8rem rgb(0 0 0 / 0.7),
			inset 0 1px 0 rgb(255 248 232 / 0.08);
		color: #f4ead6;
	}

	/* Speech tail pointing cleanly toward the speaker flank */
	.side-left .bubble.kind-speech::before,
	.side-right .bubble.kind-speech::before {
		content: '';
		position: absolute;
		bottom: 1.2rem;
		width: 0.9rem;
		height: 0.9rem;
		background: rgb(17 14 11 / 0.95);
		border: 1.5px solid color-mix(in srgb, var(--accent) 55%, rgb(240 230 206 / 0.25));
		transform: rotate(45deg);
	}

	.side-left .bubble.kind-speech::before {
		left: -0.5rem;
		border-right: 0;
		border-top: 0;
	}

	.side-right .bubble.kind-speech::before {
		right: -0.5rem;
		border-left: 0;
		border-bottom: 0;
	}

	/* Thought bubble variant */
	.bubble.kind-thought {
		border-style: dashed;
		border-radius: 18px;
		background: linear-gradient(172deg, rgb(24 22 26 / 0.94), rgb(15 14 18 / 0.96));
	}

	.bubble.kind-thought .line {
		font-style: italic;
		color: #e4dceb;
	}

	.thought-dots {
		position: absolute;
		bottom: 1rem;
		display: flex;
		gap: 0.28rem;
		align-items: center;
	}

	.side-left .thought-dots {
		left: -2rem;
		flex-direction: row-reverse;
	}

	.side-right .thought-dots {
		right: -2rem;
	}

	.thought-dots i {
		display: block;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
		background: rgb(22 20 24 / 0.92);
	}

	.thought-dots i:nth-child(1) {
		width: 0.62rem;
		height: 0.62rem;
	}
	.thought-dots i:nth-child(2) {
		width: 0.44rem;
		height: 0.44rem;
	}
	.thought-dots i:nth-child(3) {
		width: 0.28rem;
		height: 0.28rem;
	}

	/* Narrator / Chronicler banner variant */
	.bubble.kind-narrator {
		border-color: rgb(226 195 106 / 0.55);
		border-radius: 4px;
		background:
			radial-gradient(ellipse at 50% 0%, rgb(226 195 106 / 0.14), transparent 70%),
			linear-gradient(180deg, rgb(26 21 15 / 0.96), rgb(16 13 9 / 0.97));
		text-align: center;
	}

	.bubble.kind-narrator .speaker-row {
		justify-content: center;
	}

	.bubble.kind-narrator .line {
		font-family: var(--font-display);
		font-size: 1.08rem;
		line-height: 1.42;
		color: #f8edd2;
	}

	/* Archive / Radio transmission variant */
	.bubble.kind-radio {
		border-color: rgb(126 201 194 / 0.6);
		background:
			repeating-linear-gradient(180deg, rgb(126 201 194 / 0.04) 0 2px, transparent 2px 5px),
			linear-gradient(175deg, rgb(12 24 24 / 0.96), rgb(8 16 17 / 0.97));
	}

	.bubble.kind-radio .line {
		color: #d6f1ee;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.87rem;
		line-height: 1.5;
	}

	.speaker-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.compass {
		width: 1.05rem;
		height: 1.05rem;
		color: var(--accent);
		flex: none;
	}

	.radio-wave {
		display: inline-flex;
		align-items: flex-end;
		gap: 2px;
		height: 0.85rem;
	}

	.radio-wave i {
		width: 2px;
		background: var(--accent);
		border-radius: 1px;
	}
	.radio-wave i:nth-child(1) {
		height: 40%;
	}
	.radio-wave i:nth-child(2) {
		height: 95%;
	}
	.radio-wave i:nth-child(3) {
		height: 60%;
	}
	.radio-wave i:nth-child(4) {
		height: 80%;
	}

	.speaker-name {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
		color: var(--accent);
		letter-spacing: 0.02em;
	}

	.speaker-role {
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #a89c86;
	}

	.speaking-tag {
		margin-left: auto;
		padding: 0.06rem 0.42rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 24%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 60%, transparent);
		color: var(--accent);
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.1em;
	}

	.line {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.46;
		color: #f4ebd8;
	}

	.bubble-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.3rem;
		border-top: 1px solid rgb(240 230 206 / 0.12);
	}

	.pips {
		display: flex;
		align-items: center;
		gap: 0.32rem;
	}

	.pip {
		width: 0.46rem;
		height: 0.46rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: rgb(240 230 206 / 0.24);
		cursor: pointer;
		transition:
			width 180ms ease,
			background 180ms ease;
	}

	.pip.done {
		background: rgb(240 230 206 / 0.55);
	}

	.pip.on {
		width: 1.2rem;
		background: var(--accent);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.ctrl {
		padding: 0.22rem 0.65rem;
		border: 1px solid rgb(231 220 198 / 0.28);
		border-radius: 3px;
		background: rgb(255 255 255 / 0.04);
		color: #e6dac2;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.ctrl:hover {
		border-color: rgb(231 220 198 / 0.65);
	}

	.ctrl.on {
		border-color: color-mix(in srgb, var(--accent) 60%, transparent);
		color: var(--accent);
	}

	.ctrl.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #16110a;
		font-weight: 800;
	}

	/* === Phone / Narrow Screen Adaptation === */
	@media (max-width: 960px) {
		.flank {
			width: 10.5rem;
			height: 15rem;
			bottom: 8.5rem;
		}

		.flank .cutout.silhouette {
			opacity: 0;
		}

		.story-stage.overlay .dialogue-dock,
		.dialogue-dock,
		.dialogue-dock.side-left,
		.dialogue-dock.side-right {
			width: calc(100vw - 1.2rem);
			left: 50%;
			transform: translateX(-50%);
			bottom: 0.7rem;
		}

		.story-stage.overlay .dialogue-dock {
			bottom: 4.1rem;
		}

		.bubble.kind-speech::before,
		.thought-dots {
			display: none;
		}
	}
</style>
