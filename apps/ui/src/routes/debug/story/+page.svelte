<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { onDestroy, onMount } from 'svelte';
	import AudioMenu from '#lib/audio/AudioMenu.svelte';
	import { bindAudioUnlock } from '#lib/audio/engine.ts';
	import { ambientMusic } from '#lib/audio/music.ts';
	import {
		sfxBuildStructure,
		sfxCardDraw,
		sfxCardFlip,
		sfxCityDestroyed,
		sfxCrateOpen,
		sfxCubeDrop,
		sfxCubePickup,
		sfxDoorTear,
		sfxEpidemic,
		sfxExposure,
		sfxIncident,
		sfxInoculationMotif,
		sfxOutbreak,
		sfxOutcome,
		sfxRadioTune,
		sfxRouteDraw,
		sfxScratchBox,
		sfxTapeSlap,
		sfxUtopiaCorrupt,
		sfxVialClink,
	} from '#lib/audio/sfx.ts';
	import { CAST_LIST } from '#lib/story/cast.ts';
	import { STORY_SCENES } from '#lib/story/script.ts';
	import type { SetPieceId, StoryScene } from '#lib/story/script.ts';
	import SetPieceLayer from '#lib/story/SetPieceLayer.svelte';
	import StoryStage from '#lib/story/StoryStage.svelte';
	import { voiceManifest } from '#lib/story/voices.generated.ts';

	const allScenes = Object.values(STORY_SCENES);
	const voiceCount = Object.keys(voiceManifest).length;

	let activeScene = $state<StoryScene | null>(null);
	let activePiece = $state<SetPieceId | null>(null);
	let delivered = $state(true);

	// Adaptive Music Simulator state
	let musicActive = $state(false);
	let incidents = $state(0);
	let epidemics = $state(0);
	let month = $state(1);
	let hollowPresent = $state(false);
	let inoculationSafe = $state(false);
	let wearingOff = $state(false);

	const tensionPct = $derived(
		Math.round(
			Math.min(
				1,
				Math.min(1, incidents / 7) * 0.58 +
					Math.min(1, epidemics / 5) * 0.42 +
					Math.min(0.2, Math.max(0, (month - 6) / 30)),
			) * 100,
		),
	);

	onMount(() => bindAudioUnlock());

	$effect(() => {
		ambientMusic.update({
			active: musicActive,
			incidents,
			epidemics,
			month,
			hollowPresent,
			inoculationSafe,
			wearingOff,
			storyOpen: activeScene !== null,
		});
	});

	onDestroy(() => ambientMusic.stop());

	const SET_PIECES: { id: SetPieceId; label: string }[] = [
		{ id: 'wearingOff', label: "Sep 09-03 · 2-It's wearing off" },
		{ id: 'epidemicsArrive', label: 'Mar 03-06 · Epidemics Arrive' },
		{ id: 'betrayal', label: "May 05-02 · Leaders' Betrayal" },
		{ id: 'ghostHaven', label: 'Pkg 6 · Ghost Haven + Inoculation' },
		{ id: 'frankfurtDestroyed', label: 'Door 21 · Frankfurt Destroyed' },
		{ id: 'forsakenCities', label: 'Door A/12 · Forsaken Cities' },
		{ id: 'hollowMenArrive', label: 'Pkg 2 · Hollow Men Arrive' },
		{ id: 'shanghaiMassacre', label: 'Shanghai · Shot Outside Utopia' },
		{ id: 'fadedTruth', label: 'Door 17 · We Are the Faded' },
		{ id: 'utopiaHell', label: 'Pkg 8 · Utopia Is Hell on Earth' },
		{ id: 'selfInfect', label: 'Door 22 · PEARL Self-Infect' },
		{ id: 'finalReckoning', label: 'Dec 12-05 · Final Reckoning' },
	];

	const SFX_BUTTONS: { label: string; run: () => void }[] = [
		{ label: 'Cube Pickup', run: () => sfxCubePickup(3) },
		{ label: 'Supply Cube Drop', run: () => sfxCubeDrop('supply', 1) },
		{ label: 'Plague Cube Drop', run: () => sfxCubeDrop('plague', 1) },
		{ label: 'Hollow Man Drop', run: () => sfxCubeDrop('hollow', 1) },
		{ label: 'Incident #2', run: () => sfxIncident(2) },
		{ label: 'Incident #7', run: () => sfxIncident(7) },
		{ label: 'Outbreak', run: () => sfxOutbreak() },
		{ label: 'Epidemic Draw', run: () => sfxEpidemic('draw') },
		{ label: 'Epidemic Increase', run: () => sfxEpidemic('increase') },
		{ label: 'Epidemic Infect', run: () => sfxEpidemic('infect') },
		{ label: 'Epidemic Intensify', run: () => sfxEpidemic('intensify') },
		{ label: 'Card Draw', run: () => sfxCardDraw() },
		{ label: 'Card Flip', run: () => sfxCardFlip() },
		{ label: 'Scratch Box', run: () => sfxScratchBox() },
		{ label: 'Dossier Door Tear', run: () => sfxDoorTear() },
		{ label: 'Package Crate Open', run: () => sfxCrateOpen() },
		{ label: 'Masking-Tape Slap', run: () => sfxTapeSlap(0) },
		{ label: 'Route Draw', run: () => sfxRouteDraw() },
		{ label: 'Build Center', run: () => sfxBuildStructure('center') },
		{ label: 'Build Tower', run: () => sfxBuildStructure('tower') },
		{ label: 'Exposure: Scar', run: () => sfxExposure('scar') },
		{ label: 'Exposure: Death', run: () => sfxExposure('death') },
		{ label: 'Radio Decode', run: () => sfxRadioTune(true) },
		{ label: 'Inoculation Safe', run: () => sfxInoculationMotif(false) },
		{ label: 'Inoculation Broken', run: () => sfxInoculationMotif(true) },
		{ label: 'Vial Clink', run: () => sfxVialClink(1) },
		{ label: 'City Destroyed', run: () => sfxCityDestroyed() },
		{ label: 'Utopia Corrupt', run: () => sfxUtopiaCorrupt() },
		{ label: 'Victory', run: () => sfxOutcome(true) },
		{ label: 'Defeat', run: () => sfxOutcome(false) },
	];
</script>

<svelte:head>
	<title>Story & Audio Theater · Pandemic Legacy S2</title>
</svelte:head>

<main class="theater" {@attach feedback('Story theater', () => ({ scenes: allScenes.length, voices: voiceCount }))}>
	<header class="top">
		<div>
			<span class="kicker">STORY & AUDIO WORKBENCH</span>
			<h1>Narrative Theater, Cast & Sound</h1>
			<p class="sub">
				{allScenes.length} campaign scenes · {CAST_LIST.length} cast voices · {voiceCount} synthesized ElevenLabs tracks
			</p>
		</div>
		<div class="top-right">
			<AudioMenu />
			<a href="/debug/story-mode">Interactive Story Mode →</a>
			<a href="/debug">All debug tools</a>
		</div>
	</header>

	<section class="section">
		<h2>Narrative Cast (Transparent Cutouts)</h2>
		<div class="cast-grid">
			{#each CAST_LIST as member (member.id)}
				<div class="cast-card" style:--accent={member.accent}>
					{#if member.image}
						<img src={member.image} alt={member.name} />
					{:else}
						<div class="chron-emblem">✦</div>
					{/if}
					<strong>{member.name}</strong>
					<span>{member.title}</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="section">
		<h2>Adaptive Escalating Ambient Music & SFX</h2>
		<div class="audio-grid">
			<div class="music-box">
				<div class="music-head">
					<strong>Ambient Score Engine</strong>
					<span class="meter">Tension {tensionPct}%</span>
					<button type="button" class="primary" onclick={() => (musicActive = !musicActive)} data-testid="toggle-music">
						{musicActive ? 'Stop Music' : 'Start Music'}
					</button>
					<button type="button" onclick={() => ambientMusic.triggerEpidemicShift()}>Epidemic Shift</button>
				</div>

				<div class="sliders">
					<label>Incidents ({incidents}/8) <input type="range" min="0" max="8" bind:value={incidents} /></label>
					<label>Epidemics ({epidemics}/6) <input type="range" min="0" max="6" bind:value={epidemics} /></label>
					<label>Month ({month}/12) <input type="range" min="0" max="12" bind:value={month} /></label>
				</div>
				<div class="checks">
					<label><input type="checkbox" bind:checked={hollowPresent} /> Hollow Men in play</label>
					<label><input type="checkbox" bind:checked={inoculationSafe} /> Package 6 safe hum</label>
					<label><input type="checkbox" bind:checked={wearingOff} /> Sep 09-03 wearing off</label>
				</div>
			</div>

			<div class="sfx-board">
				{#each SFX_BUTTONS as btn (btn.label)}
					<button type="button" onclick={btn.run}>{btn.label}</button>
				{/each}
			</div>
		</div>
	</section>

	<section class="section">
		<h2>High-Impact Set-Pieces</h2>
		<div class="piece-buttons">
			{#each SET_PIECES as sp (sp.id)}
				<button
					type="button"
					class:active={activePiece === sp.id}
					onclick={() => (activePiece = activePiece === sp.id ? null : sp.id)}
					data-testid="piece-{sp.id}"
				>
					{sp.label}
				</button>
			{/each}
		</div>
		{#if activePiece}
			<div class="piece-preview">
				<SetPieceLayer piece={activePiece} {delivered} />
			</div>
		{/if}
	</section>

	<section class="section">
		<h2>Full Campaign Story Scenes (Click to Play Live Stage)</h2>
		<div class="scene-grid">
			{#each allScenes as scene (scene.id)}
				<button
					type="button"
					class="scene-btn"
					onclick={() => (activeScene = scene)}
					data-testid="play-scene-{scene.id}"
				>
					<span class="act">{scene.act}</span>
					<strong>{scene.title}</strong>
					<span class="meta">{scene.id} · {scene.beats.length} beats{scene.setPiece ? ` · ${scene.setPiece}` : ''}</span
					>
				</button>
			{/each}
		</div>
	</section>
</main>

{#if activeScene}
	<StoryStage
		scene={activeScene}
		{delivered}
		ondone={() => (activeScene = null)}
		onclose={() => (activeScene = null)}
	/>
{/if}

<style>
	.theater {
		min-height: 100vh;
		padding: 1.8rem clamp(1rem, 4vw, 3.5rem) 4rem;
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--line);
	}

	.kicker {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #d6b66f;
	}

	h1 {
		margin: 0.15rem 0 0.25rem;
		font-family: var(--font-display);
		font-size: 2.3rem;
		font-weight: 400;
		color: var(--paper);
	}

	.sub {
		margin: 0;
		color: var(--muted);
		font-size: 0.88rem;
	}

	.top-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.top-right a {
		color: var(--paper);
		font-size: 0.85rem;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-weight: 400;
		color: var(--paper);
	}

	.cast-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.75rem;
	}

	.cast-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.6rem;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: radial-gradient(
			ellipse at 50% 35%,
			color-mix(in srgb, var(--accent) 16%, transparent),
			rgb(14 12 10 / 0.8)
		);
		text-align: center;
	}

	.cast-card img {
		height: 9.5rem;
		width: auto;
		object-fit: contain;
	}

	.chron-emblem {
		display: grid;
		place-items: center;
		height: 9.5rem;
		font-size: 3.5rem;
		color: var(--accent);
	}

	.cast-card strong {
		font-family: var(--font-display);
		font-size: 0.98rem;
		font-weight: 400;
		color: var(--accent);
	}

	.cast-card span {
		font-size: 0.7rem;
		color: var(--muted);
	}

	.audio-grid {
		display: grid;
		grid-template-columns: minmax(18rem, 1fr) minmax(20rem, 1.4fr);
		gap: 1rem;
	}

	@media (max-width: 900px) {
		.audio-grid {
			grid-template-columns: 1fr;
		}
	}

	.music-box {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: var(--wash);
	}

	.music-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
	}

	.meter {
		margin-right: auto;
		padding: 0.12rem 0.5rem;
		border-radius: 999px;
		background: rgb(224 124 64 / 0.22);
		color: #f6c88a;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.sliders {
		display: grid;
		gap: 0.45rem;
		font-size: 0.82rem;
	}

	.sliders label {
		display: grid;
		grid-template-columns: 8.5rem 1fr;
		align-items: center;
		gap: 0.5rem;
	}

	.checks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.sfx-board,
	.piece-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-content: flex-start;
	}

	button {
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	button:hover {
		border-color: var(--paper);
	}

	button.primary,
	button.active {
		border-color: var(--paper);
		background: var(--paper);
		color: var(--paper-ink);
		font-weight: 700;
	}

	.piece-preview {
		margin-top: 1rem;
		padding: 1.6rem 1rem;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: radial-gradient(ellipse at 50% 45%, rgb(26 20 14 / 0.9), rgb(10 9 8 / 0.96));
	}

	.scene-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15.5rem, 1fr));
		gap: 0.55rem;
	}

	.scene-btn {
		display: flex;
		flex-direction: column;
		gap: 0.16rem;
		padding: 0.65rem 0.8rem;
		text-align: left;
	}

	.scene-btn .act {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #d6b66f;
	}

	.scene-btn strong {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
		color: var(--paper);
	}

	.scene-btn .meta {
		font-size: 0.72rem;
		color: var(--muted);
	}
</style>
