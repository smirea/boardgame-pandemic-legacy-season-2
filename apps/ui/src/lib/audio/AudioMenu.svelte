<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { fade } from 'svelte/transition';
	import { audioSettings } from './settings.svelte.ts';
	import { sfxUiClick } from './sfx.ts';

	let open = $state(false);
	let wrap = $state<HTMLElement>();

	function onDocClick(event: PointerEvent) {
		if (open && wrap && !wrap.contains(event.target as Node)) open = false;
	}

	// The top bar stacks under the covers over the table (the lobby, a reading), so the mixer hangs from it in the
	// top layer, or it would open behind them.
	function hang(mixer: HTMLElement) {
		const anchor = wrap!.getBoundingClientRect();
		mixer.style.top = `${anchor.bottom + 8}px`;
		mixer.style.right = `${document.documentElement.clientWidth - anchor.right}px`;
		mixer.showPopover();
	}
</script>

<svelte:window onpointerdown={onDocClick} />

<div class="audio-wrap" bind:this={wrap} {@attach feedback('Audio controls', () => ({ muted: audioSettings.muted }))}>
	<button
		type="button"
		class="audio-btn"
		class:muted={audioSettings.muted}
		aria-label={audioSettings.muted ? 'Audio muted — open mixer' : 'Audio controls'}
		aria-expanded={open}
		data-testid="audio-toggle"
		onclick={() => {
			open = !open;
			sfxUiClick();
		}}
	>
		{#if audioSettings.muted}
			<svg viewBox="0 0 18 18" aria-hidden="true">
				<path d="M2.5 6.8h3l4-3.3v11l-4-3.3h-3Z" />
				<path d="M12.2 6.5 16 11.5M16 6.5l-3.8 5" />
			</svg>
		{:else}
			<svg viewBox="0 0 18 18" aria-hidden="true">
				<path d="M2.5 6.8h3l4-3.3v11l-4-3.3h-3Z" />
				<path d="M12.2 6.3a3.6 3.6 0 0 1 0 5.4M14.3 4.3a6.5 6.5 0 0 1 0 9.4" />
			</svg>
		{/if}
	</button>

	{#if open}
		<div
			class="mixer"
			popover="manual"
			role="dialog"
			aria-label="Sound and narration settings"
			transition:fade={{ duration: 130 }}
			{@attach hang}
		>
			<header>
				<strong>Sound & Story</strong>
				<button
					type="button"
					class="mute-pill"
					class:on={audioSettings.muted}
					onclick={() => audioSettings.toggleMute()}
					data-testid="audio-mute"
				>
					{audioSettings.muted ? 'Unmute' : 'Mute all'}
				</button>
			</header>

			<label class="slider">
				<span>Master</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={audioSettings.master}
					oninput={e => audioSettings.setMaster(Number(e.currentTarget.value))}
				/>
			</label>
			<label class="slider">
				<span>Ambient music</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={audioSettings.music}
					oninput={e => audioSettings.setMusic(Number(e.currentTarget.value))}
				/>
			</label>
			<label class="slider">
				<span>Tabletop SFX</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={audioSettings.sfx}
					oninput={e => audioSettings.setSfx(Number(e.currentTarget.value))}
				/>
			</label>
			<label class="slider">
				<span>Voice acting</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={audioSettings.voice}
					oninput={e => audioSettings.setVoice(Number(e.currentTarget.value))}
				/>
			</label>

			<div class="toggles">
				<button
					type="button"
					class="chip"
					class:active={audioSettings.voiceEnabled}
					aria-pressed={audioSettings.voiceEnabled}
					onclick={() => audioSettings.toggleVoice()}
				>
					Voices: {audioSettings.voiceEnabled ? 'On' : 'Off'}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.audio-wrap {
		position: relative;
		display: inline-flex;
	}

	.audio-btn {
		display: inline-grid;
		place-items: center;
		width: 1.9rem;
		height: 1.65rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: transparent;
		color: var(--ink);
		cursor: pointer;
	}

	.audio-btn:hover {
		border-color: var(--line-strong);
	}

	.audio-btn.muted {
		color: var(--muted);
		opacity: 0.72;
	}

	.audio-btn svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.mixer {
		position: fixed;
		inset: auto;
		margin: 0;
		overflow: visible;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		width: 15.5rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background: var(--panel-solid);
		box-shadow: 0 1.2rem 2.8rem rgb(0 0 0 / 0.6);
		color: var(--ink);
		white-space: normal;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	header strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
		color: var(--paper);
	}

	.mute-pill {
		padding: 0.14rem 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		font-size: 0.72rem;
		cursor: pointer;
	}

	.mute-pill.on {
		border-color: var(--danger);
		background: rgb(180 52 40 / 0.25);
		color: #ffb8ae;
	}

	.slider {
		display: grid;
		grid-template-columns: 6.4rem 1fr;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.76rem;
		color: var(--muted);
	}

	.slider input {
		width: 100%;
		accent-color: var(--paper);
		cursor: pointer;
	}

	.toggles {
		display: flex;
		gap: 0.35rem;
		padding-top: 0.25rem;
		border-top: 1px solid var(--line);
	}

	.chip {
		flex: 1;
		padding: 0.26rem 0.4rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--wash);
		color: var(--muted);
		font: inherit;
		font-size: 0.72rem;
		cursor: pointer;
	}

	.chip.active {
		border-color: var(--paper);
		color: var(--paper);
		background: rgb(231 220 198 / 0.14);
	}
</style>
