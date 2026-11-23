<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { onDestroy, onMount, setContext } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import AudioMenu from '#lib/audio/AudioMenu.svelte';
	import { bindAudioUnlock } from '#lib/audio/engine.ts';
	import { ambientMusic } from '#lib/audio/music.ts';
	import { tensionOf } from '#lib/audio/score.ts';
	import { sfxCardDraw, sfxCardFlip, sfxCrateOpen, sfxDoorTear } from '#lib/audio/sfx.ts';
	import { campaignTone } from '#lib/audio/tones.ts';
	import LegacyCard from '#lib/cards/LegacyCard.svelte';
	import Crate from '#lib/hud/Crate.svelte';
	import DossierDoor from '#lib/hud/DossierDoor.svelte';
	import { typing } from '#lib/keys.ts';
	import { CAST } from '#lib/story/cast.ts';
	import {
		buildChronicle,
		DARKEST_CHOICES,
		HEROIC_CHOICES,
		legacyCard,
		storySceneFor,
		worldSummary,
	} from '#lib/story/chronicle.ts';
	import type { ChronicleChoices } from '#lib/story/chronicle.ts';
	import StoryStage from '#lib/story/StoryStage.svelte';
	import { voiceManifest } from '#lib/story/voices.generated.ts';

	let choices = $state<ChronicleChoices>({ ...HEROIC_CHOICES });
	let stepId = $state('prelude');
	let fallbackIndex = $state(0);
	let cardSide = $state<'a' | 'b'>('b');
	let activeCardIndex = $state(0);
	let theaterOpen = $state(false);
	let autoTheater = $state(false);
	let musicOn = $state(false);
	let flashNote = $state<string | null>(null);
	let flashTimer: ReturnType<typeof setTimeout> | null = null;

	const timeline = $derived(buildChronicle(choices));
	const stepIndex = $derived.by(() => {
		const idx = timeline.findIndex(s => s.id === stepId);
		return idx >= 0 ? idx : Math.max(0, Math.min(timeline.length - 1, fallbackIndex));
	});
	const step = $derived(timeline[stepIndex] ?? timeline[0]!);
	const scene = $derived(storySceneFor(step));
	const summaryChips = $derived(worldSummary(choices));

	const stepCards = $derived(
		(step.cardIds ?? []).map(id => legacyCard(id)).filter((c): c is NonNullable<typeof c> => c !== null),
	);
	const focusedCard = $derived(stepCards[activeCardIndex] ?? stepCards[0] ?? null);

	// Propagate live wearing-off context to Epidemic cards shown inside Story Mode.
	setContext('epidemic-wearing-off', () => step.audio.wearingOff);

	function notify(msg: string) {
		flashNote = msg;
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => (flashNote = null), 2400);
	}

	function goToIndex(nextIdx: number, playAudio = true) {
		const clamped = Math.max(0, Math.min(timeline.length - 1, nextIdx));
		const target = timeline[clamped];
		if (!target) return;
		const forward = clamped > stepIndex;
		fallbackIndex = clamped;
		stepId = target.id;
		activeCardIndex = 0;
		cardSide = 'b';
		theaterOpen = false;
		if (playAudio) {
			if (target.kind === 'seal') {
				if (target.seals?.some(s => s.t === 'package')) sfxCrateOpen();
				else sfxDoorTear();
			} else if (target.cardIds?.length) {
				if (forward) sfxCardDraw();
				else sfxCardFlip();
			}
		}
		if (autoTheater && storySceneFor(target)) {
			theaterOpen = true;
		}
	}

	function jumpTo(id: string) {
		const idx = timeline.findIndex(s => s.id === id);
		if (idx >= 0) goToIndex(idx, true);
	}

	function stepForward() {
		if (stepIndex < timeline.length - 1) goToIndex(stepIndex + 1, true);
	}

	function stepReverse() {
		if (stepIndex > 0) goToIndex(stepIndex - 1, true);
	}

	function pickChoice(patch: Partial<ChronicleChoices>, label: string) {
		choices = { ...choices, ...patch };
		sfxCardFlip();
		notify(`Branch updated: ${label}`);
	}

	function applyPreset(preset: ChronicleChoices, label: string) {
		choices = { ...preset };
		sfxCardDraw();
		notify(`Timeline preset loaded: ${label}`);
	}

	onMount(() => bindAudioUnlock());

	$effect(() => {
		if (!musicOn) {
			ambientMusic.stop();
			return;
		}
		ambientMusic.update({
			tone: campaignTone(step.campaign),
			tension: tensionOf(step.audio.incidents, step.audio.epidemics),
			occupation: null,
			sea: 0.85,
			alarm: false,
			infecting: false,
			hollow: step.audio.hollowPresent,
			safe: step.audio.inoculationSafe && !step.audio.wearingOff,
			hush: theaterOpen,
		});
	});

	onDestroy(() => {
		if (flashTimer) clearTimeout(flashTimer);
		ambientMusic.stop();
	});

	function onKeydown(event: KeyboardEvent) {
		if (typing(event)) return;
		if (theaterOpen) {
			if (event.key === 'Escape') theaterOpen = false;
			return;
		}
		if (event.key === 'ArrowRight' || event.key === ' ') {
			event.preventDefault();
			stepForward();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			stepReverse();
		} else if (event.key === 'f' || event.key === 'F') {
			if (focusedCard) {
				cardSide = cardSide === 'a' ? 'b' : 'a';
				sfxCardFlip();
			}
		} else if (event.key === 'Enter' && scene) {
			theaterOpen = true;
		}
	}

	const voicedBeatsInScene = $derived(scene ? scene.beats.filter(b => b.id in voiceManifest).length : 0);
</script>

<svelte:head>
	<title>Story Mode · Legacy Deck Chronicle</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<main
	class="story-mode"
	data-testid="story-mode"
	data-step={step.id}
	{@attach feedback('Story mode', () => ({ step: step.id, index: stepIndex, total: timeline.length, choices }))}
>
	<!-- Top Navigation & Timeline Controls -->
	<header class="topbar">
		<div class="brand">
			<span class="kicker">INTERACTIVE STORY MODE</span>
			<h1>Legacy Deck Chronicle</h1>
		</div>

		<div class="top-actions">
			<button
				type="button"
				class="pill"
				class:on={musicOn}
				onclick={() => (musicOn = !musicOn)}
				data-testid="story-mode-music"
			>
				{musicOn ? 'Score: On' : 'Score: Off'}
			</button>
			<button
				type="button"
				class="pill"
				class:on={autoTheater}
				onclick={() => (autoTheater = !autoTheater)}
				data-testid="story-mode-auto-theater"
			>
				{autoTheater ? 'Auto-Theater: On' : 'Auto-Theater: Off'}
			</button>
			<button
				type="button"
				class="pill"
				onclick={() => applyPreset(HEROIC_CHOICES, 'Heroic Recon')}
				data-testid="preset-heroic"
			>
				Heroic Path
			</button>
			<button
				type="button"
				class="pill danger"
				onclick={() => applyPreset(DARKEST_CHOICES, 'Darkest Timeline')}
				data-testid="preset-darkest"
			>
				Darkest Timeline
			</button>
			<AudioMenu />
			<a class="nav-link" href="/debug/story">Soundboard</a>
			<a class="nav-link" href="/debug">Debug</a>
		</div>
	</header>

	<!-- Time-Travel Timeline Scrubber -->
	<nav class="timeline-bar" aria-label="Campaign timeline" data-testid="timeline-bar">
		<button type="button" class="step-btn" onclick={stepReverse} disabled={stepIndex <= 0} data-testid="btn-reverse">
			← Reverse
		</button>

		<div class="rail" role="list">
			{#each timeline as node, idx (node.id)}
				{@const prevMonth = idx > 0 ? timeline[idx - 1]!.monthLabel : null}
				{#if node.monthLabel !== prevMonth}
					<span class="month-sep">{node.monthLabel}</span>
				{/if}
				<button
					type="button"
					class="node kind-{node.kind}"
					class:active={idx === stepIndex}
					class:past={idx < stepIndex}
					class:has-setpiece={Boolean(node.setPiece)}
					onclick={() => goToIndex(idx, true)}
					aria-label={`${node.monthLabel}: ${node.title}`}
					aria-current={idx === stepIndex ? 'step' : undefined}
					data-node-id={node.id}
				>
					<span class="dot"></span>
				</button>
			{/each}
		</div>

		<span class="counter" data-testid="step-counter">{stepIndex + 1} / {timeline.length}</span>

		<button
			type="button"
			class="step-btn primary"
			onclick={stepForward}
			disabled={stepIndex >= timeline.length - 1}
			data-testid="btn-forward"
		>
			Forward →
		</button>
	</nav>

	{#if flashNote}
		<div class="toast" transition:fade={{ duration: 180 }} role="status">{flashNote}</div>
	{/if}

	<!-- Main Stage -->
	<section class="stage-grid">
		{#key step.id}
			<div class="main-column" in:fly={{ y: 12, duration: 220, easing: cubicOut }}>
				<div class="step-head">
					<div class="step-badges">
						<span class="act-badge">{step.act}</span>
						<span class="kind-badge kind-{step.kind}">
							{step.kind === 'decision'
								? 'Inflection Point'
								: step.kind === 'ending'
									? 'Final Reckoning'
									: step.kind === 'seal'
										? 'Package / Door'
										: step.kind === 'card'
											? 'Legacy Deck'
											: 'Story Beat'}
						</span>
						{#if step.setPiece}
							<span class="setpiece-badge">★ Set-Piece</span>
						{/if}
					</div>
					<h2 data-testid="step-title">{step.title}</h2>
					{#if step.subtitle}<p class="subtitle">{step.subtitle}</p>{/if}
					<p class="summary">{step.summary}</p>
					{#if step.consequences?.length}
						<div class="consequences">
							{#each step.consequences as badge (badge.label)}
								<span class="conseq tone-{badge.tone}">{badge.label}</span>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Branching Decision Picker -->
				{#if step.decisions?.length}
					<div class="decisions" data-testid="decision-panel">
						{#each step.decisions as group (group.id)}
							<fieldset class="decision-group" data-decision-id={group.id}>
								<legend>{group.prompt}</legend>
								<p class="decision-ctx">{group.context}</p>
								<div class="options">
									{#each group.options as opt (opt.label)}
										{@const selected = opt.active(choices)}
										<button
											type="button"
											class="opt tone-{opt.tone}"
											class:selected
											aria-pressed={selected}
											onclick={() => pickChoice(opt.apply, opt.label)}
											data-option={opt.label}
										>
											<span class="opt-top">
												<span class="radio-mark" aria-hidden="true">{selected ? '◆' : '◇'}</span>
												<strong>{opt.label}</strong>
											</span>
											<span class="opt-detail">{opt.detail}</span>
										</button>
									{/each}
								</div>
							</fieldset>
						{/each}
					</div>
				{/if}

				<!-- Final Reckoning Verbatim Ending Box -->
				{#if step.endingText}
					<div class="ending-box" class:delivered={step.endingText.delivered} data-testid="ending-box">
						<div class="ending-meta">
							<span>{step.endingText.delivered ? 'Sample Delivered' : 'Sample Not Delivered'}</span>
							<strong>Score Bracket: {step.endingText.bracket}</strong>
						</div>
						<blockquote>“{step.endingText.text}”</blockquote>
						<button type="button" class="pill" onclick={() => jumpTo('decision-finale')}>
							Change delivery outcome or score bracket →
						</button>
					</div>
				{/if}

				<!-- Voiced Scene Preview & Launch Card -->
				{#if scene}
					<div class="scene-card" data-testid="scene-preview">
						<div class="scene-card-head">
							<div>
								<span class="scene-kicker">NARRATIVE THEATER SCENE</span>
								<h3>{scene.title}</h3>
								<span class="scene-meta">
									{scene.beats.length}
									{scene.beats.length === 1 ? 'beat' : 'beats'}
									{#if voicedBeatsInScene > 0}
										· {voicedBeatsInScene}/{scene.beats.length} studio voiced
									{/if}
									{#if scene.setPiece}
										· Includes animated set-piece
									{/if}
								</span>
							</div>
							<button
								type="button"
								class="launch-btn"
								onclick={() => (theaterOpen = true)}
								data-testid="launch-theater"
							>
								▶ Play Scene{scene.setPiece ? ' & Set-Piece' : ''}
							</button>
						</div>

						<div class="script-beats">
							{#each scene.beats as entry (entry.id)}
								{@const sp = CAST[entry.speaker]}
								<div class="beat-row" style:--accent={sp.accent}>
									{#if sp.image}
										<img class="beat-thumb" src={sp.image} alt="" />
									{:else}
										<span class="beat-thumb chron" aria-hidden="true">✦</span>
									{/if}
									<div class="beat-body">
										<span class="beat-speaker" style:color={sp.accent}>
											{sp.name}
											{#if entry.id in voiceManifest}
												<em class="voiced-pill">VOICED</em>
											{/if}
										</span>
										<p>{entry.text}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Right Column: Physical Legacy Cards & Opened Crates/Doors -->
			<aside class="card-column" aria-label="Physical components for this step">
				{#if step.seals?.length}
					<div class="seals-strip">
						{#each step.seals as seal (`${seal.t}:${seal.id}`)}
							<div class="seal-item">
								<span class="seal-art">
									{#if seal.t === 'package'}
										<Crate id={seal.id} open={true} />
									{:else}
										<DossierDoor id={seal.id} open={true} />
									{/if}
								</span>
								<span class="seal-label">{seal.t === 'package' ? `Package ${seal.id}` : `Door ${seal.id}`}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if focusedCard}
					<div class="card-viewer" data-testid="legacy-card-viewer">
						<div class="viewer-controls">
							<span class="card-code-tag">{focusedCard.id}{cardSide} · {focusedCard.title}</span>
							<button
								type="button"
								class="flip-btn"
								onclick={() => {
									cardSide = cardSide === 'a' ? 'b' : 'a';
									sfxCardFlip();
								}}
								data-testid="flip-card-btn"
							>
								Flip to Side {cardSide === 'a' ? 'B' : 'A'} (F)
							</button>
						</div>

						<div class="card-frame">
							<LegacyCard card={focusedCard} side={cardSide} size="full" campaign={step.campaign} />
						</div>

						{#if stepCards.length > 1}
							<div class="card-tabs" role="tablist" aria-label="Cards in this step">
								{#each stepCards as item, idx (item.id)}
									<button
										type="button"
										role="tab"
										class="card-tab"
										class:active={idx === activeCardIndex}
										aria-selected={idx === activeCardIndex}
										onclick={() => {
											activeCardIndex = idx;
											cardSide = 'b';
											sfxCardFlip();
										}}
									>
										{item.id}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{:else if !step.seals?.length}
					<div class="empty-card-box">
						{#if step.kind === 'decision'}
							<span class="diamond-icon" aria-hidden="true">◆</span>
							<p>Pick any branch on the left. Downstream Legacy cards and perimeter reports update immediately.</p>
							<p class="hint">Use ← Reverse anytime to revisit past choices and explore alternate branches.</p>
						{:else}
							<span class="diamond-icon" aria-hidden="true">✦</span>
							<p>
								Field &amp; chronicle narrative moment — launch the full voiced stage to watch with character cutouts.
							</p>
						{/if}
					</div>
				{/if}
			</aside>
		{/key}
	</section>

	<!-- Live World-State Ledger (Click Any Chip to Jump Back & Rewrite That Decision!) -->
	<footer class="ledger" aria-label="Current timeline decisions" data-testid="world-ledger">
		<span class="ledger-label">Timeline State (click to jump &amp; edit):</span>
		<div class="chips">
			{#each summaryChips as chip (chip.label)}
				<button
					type="button"
					class="chip tone-{chip.tone}"
					onclick={() => jumpTo(chip.jumpToStepId)}
					data-chip={chip.label}
				>
					<span class="chip-k">{chip.label}:</span>
					<b>{chip.value}</b>
				</button>
			{/each}
		</div>
	</footer>
</main>

{#if theaterOpen && scene}
	<StoryStage
		{scene}
		delivered={choices.sampleDelivered}
		ondone={() => {
			theaterOpen = false;
			if (autoTheater && stepIndex < timeline.length - 1) stepForward();
		}}
		onclose={() => (theaterOpen = false)}
	/>
{/if}

<style>
	.story-mode {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		padding: 1.15rem clamp(1rem, 3vw, 2.5rem) 1.5rem;
		gap: 0.9rem;
		background: radial-gradient(ellipse 70% 45% at 50% 0%, rgb(186 142 66 / 0.08), transparent 65%), var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
		box-sizing: border-box;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem 1.2rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--line);
	}

	.kicker {
		display: block;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		color: #d6b66f;
	}

	h1 {
		margin: 0.1rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 2.5vw, 2.15rem);
		font-weight: 400;
		color: var(--paper);
		line-height: 1.05;
	}

	.top-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.pill {
		padding: 0.34rem 0.72rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.pill:hover {
		border-color: var(--paper);
	}

	.pill.on {
		border-color: #d6b66f;
		background: rgb(214 182 111 / 0.16);
		color: #f6e7c4;
	}

	.pill.danger:hover {
		border-color: #c84434;
		color: #f4c2ba;
	}

	.nav-link {
		padding: 0.34rem 0.65rem;
		color: var(--muted);
		font-size: 0.8rem;
		text-decoration: none;
		border-bottom: 1px solid transparent;
	}

	.nav-link:hover {
		color: var(--paper);
		border-bottom-color: var(--paper);
	}

	/* === Time-Travel Scrubber === */
	.timeline-bar {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: rgb(14 11 9 / 0.72);
	}

	.step-btn {
		flex: none;
		padding: 0.44rem 0.9rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
	}

	.step-btn:hover:not(:disabled) {
		border-color: var(--paper);
	}

	.step-btn.primary {
		border-color: #d6b66f;
		background: #d6b66f;
		color: #16110a;
	}

	.step-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.rail {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		flex: 1 1 auto;
		min-width: 0;
		overflow-x: auto;
		padding: 0.25rem 0.2rem;
		scrollbar-width: thin;
	}

	.month-sep {
		flex: none;
		margin: 0 0.18rem 0 0.42rem;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.month-sep:first-child {
		margin-left: 0;
	}

	.node {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.15rem;
		height: 1.4rem;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
	}

	.node .dot {
		width: 0.52rem;
		height: 0.52rem;
		border-radius: 50%;
		background: rgb(231 220 198 / 0.26);
		transition:
			transform 140ms ease,
			background 140ms ease;
	}

	.node.past .dot {
		background: rgb(231 220 198 / 0.56);
	}

	.node.kind-decision .dot {
		width: 0.58rem;
		height: 0.58rem;
		border-radius: 2px;
		transform: rotate(45deg);
		background: #d6b66f;
	}

	.node.has-setpiece .dot {
		background: #d95645;
	}

	.node.kind-ending .dot {
		width: 0.66rem;
		height: 0.66rem;
		background: #7ec9c2;
	}

	.node.active .dot {
		transform: scale(1.45);
		background: #fff3d6;
		box-shadow: 0 0 0 2px rgb(214 182 111 / 0.6);
	}

	.node.kind-decision.active .dot {
		transform: rotate(45deg) scale(1.4);
	}

	.node:hover .dot {
		transform: scale(1.3);
	}

	.counter {
		flex: none;
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	.toast {
		align-self: center;
		padding: 0.28rem 0.85rem;
		border: 1px solid rgb(214 182 111 / 0.55);
		border-radius: 999px;
		background: rgb(32 24 14 / 0.92);
		color: #f6e7c4;
		font-size: 0.78rem;
		font-weight: 700;
	}

	/* === Stage Layout === */
	.stage-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(19rem, 0.95fr);
		gap: 1.4rem;
		flex: 1 1 auto;
		align-items: start;
	}

	.main-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.step-head {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 1rem 1.15rem;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: rgb(18 14 11 / 0.72);
	}

	.step-badges {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.act-badge {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #d6b66f;
	}

	.kind-badge,
	.setpiece-badge {
		padding: 0.08rem 0.45rem;
		border-radius: 999px;
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.kind-badge {
		border: 1px solid var(--line-strong);
		color: var(--muted);
	}

	.kind-badge.kind-decision {
		border-color: rgb(214 182 111 / 0.65);
		background: rgb(214 182 111 / 0.16);
		color: #f6e7c4;
	}

	.setpiece-badge {
		border: 1px solid rgb(217 86 69 / 0.65);
		background: rgb(217 86 69 / 0.18);
		color: #ffb8ae;
	}

	h2 {
		margin: 0.1rem 0 0;
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 2.4vw, 2rem);
		font-weight: 400;
		color: var(--paper);
		line-height: 1.12;
	}

	.subtitle {
		margin: 0;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.summary {
		margin: 0.25rem 0 0;
		font-size: 0.96rem;
		line-height: 1.52;
		color: #ede1ca;
	}

	.consequences {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.35rem;
	}

	.conseq {
		padding: 0.16rem 0.55rem;
		border-radius: 3px;
		font-size: 0.74rem;
		font-weight: 700;
		border: 1px solid var(--line);
	}

	.conseq.tone-good {
		border-color: rgb(118 184 128 / 0.55);
		background: rgb(118 184 128 / 0.14);
		color: #b7ebc0;
	}

	.conseq.tone-warn {
		border-color: rgb(224 169 67 / 0.55);
		background: rgb(224 169 67 / 0.14);
		color: #f6d591;
	}

	.conseq.tone-danger {
		border-color: rgb(212 82 67 / 0.6);
		background: rgb(212 82 67 / 0.16);
		color: #ffb9af;
	}

	/* === Decisions === */
	.decisions {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.decision-group {
		margin: 0;
		padding: 0.9rem 1.05rem 1rem;
		border: 1px solid rgb(214 182 111 / 0.4);
		border-radius: 5px;
		background: rgb(24 19 14 / 0.82);
	}

	.decision-group legend {
		padding: 0 0.45rem;
		font-family: var(--font-display);
		font-size: 1.18rem;
		color: #f6e7c4;
	}

	.decision-ctx {
		margin: 0 0 0.65rem;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.55rem;
	}

	.opt {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.68rem 0.8rem;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background: rgb(15 12 10 / 0.72);
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 140ms ease,
			background 140ms ease;
	}

	.opt:hover {
		border-color: var(--paper);
	}

	.opt.selected {
		border-color: #d6b66f;
		background: rgb(214 182 111 / 0.15);
		box-shadow: inset 3px 0 0 #d6b66f;
	}

	.opt.selected.tone-good {
		border-color: #7cc488;
		background: rgb(124 196 136 / 0.14);
		box-shadow: inset 3px 0 0 #7cc488;
	}

	.opt.selected.tone-danger {
		border-color: #d85a4a;
		background: rgb(216 90 74 / 0.16);
		box-shadow: inset 3px 0 0 #d85a4a;
	}

	.opt-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.88rem;
	}

	.radio-mark {
		color: #d6b66f;
		font-size: 0.8rem;
	}

	.opt-detail {
		font-size: 0.77rem;
		line-height: 1.38;
		color: var(--muted);
	}

	/* === Ending Box === */
	.ending-box {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 1rem 1.15rem;
		border: 1px solid rgb(212 82 67 / 0.55);
		border-radius: 5px;
		background: rgb(28 16 14 / 0.85);
	}

	.ending-box.delivered {
		border-color: rgb(124 196 136 / 0.55);
		background: rgb(16 26 20 / 0.85);
	}

	.ending-meta {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #d6b66f;
	}

	.ending-box blockquote {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.12rem;
		line-height: 1.5;
		color: #f7ecd5;
	}

	/* === Voiced Scene Card === */
	.scene-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.95rem 1.1rem;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: rgb(16 13 11 / 0.78);
	}

	.scene-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.6rem;
		padding-bottom: 0.6rem;
		border-bottom: 1px solid var(--line);
	}

	.scene-kicker {
		display: block;
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #d6b66f;
	}

	.scene-card h3 {
		margin: 0.1rem 0 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 400;
		color: var(--paper);
	}

	.scene-meta {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.launch-btn {
		padding: 0.5rem 1.05rem;
		border: 1px solid #d6b66f;
		border-radius: 4px;
		background: linear-gradient(180deg, #e2c36a, #c79f45);
		color: #16110a;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 800;
		cursor: pointer;
	}

	.launch-btn:hover {
		filter: brightness(1.08);
	}

	.script-beats {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.beat-row {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
		padding: 0.5rem 0.65rem;
		border-left: 2px solid var(--accent);
		background: rgb(255 248 232 / 0.03);
		border-radius: 0 4px 4px 0;
	}

	.beat-thumb {
		flex: none;
		width: 2.6rem;
		height: 2.6rem;
		object-fit: cover;
		object-position: top center;
		border-radius: 50%;
		border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
		background: rgb(10 9 8 / 0.8);
	}

	.beat-thumb.chron {
		display: grid;
		place-items: center;
		color: var(--accent);
		font-size: 1.15rem;
	}

	.beat-body {
		min-width: 0;
	}

	.beat-speaker {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.voiced-pill {
		padding: 0.04rem 0.36rem;
		border-radius: 999px;
		border: 1px solid rgb(126 201 194 / 0.5);
		background: rgb(126 201 194 / 0.14);
		color: #9de5dd;
		font-style: normal;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	.beat-body p {
		margin: 0.16rem 0 0;
		font-size: 0.86rem;
		line-height: 1.46;
		color: #e9dec7;
	}

	/* === Right Column: Legacy Card & Seals === */
	.card-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
	}

	.seals-strip {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.85rem;
		padding: 0.7rem 1rem;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: rgb(18 14 11 / 0.7);
		width: 100%;
		box-sizing: border-box;
	}

	.seal-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.seal-art {
		width: 4.4rem;
		font-size: 0.78rem;
	}

	.seal-label {
		font-size: 0.72rem;
		font-weight: 700;
		color: #e4d4b4;
	}

	.card-viewer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		padding: 0.9rem;
		border: 1px solid var(--line);
		border-radius: 5px;
		background: rgb(16 13 10 / 0.75);
		box-sizing: border-box;
	}

	.viewer-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		width: 100%;
	}

	.card-code-tag {
		font-size: 0.78rem;
		font-weight: 700;
		color: #d6b66f;
	}

	.flip-btn {
		padding: 0.26rem 0.62rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.74rem;
		cursor: pointer;
	}

	.flip-btn:hover {
		border-color: var(--paper);
	}

	.card-frame {
		display: flex;
		justify-content: center;
		max-width: 100%;
		overflow-x: auto;
		padding: 0.25rem 0;
	}

	.card-tabs {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.3rem;
	}

	.card-tab {
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.74rem;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	.card-tab.active {
		border-color: #d6b66f;
		background: rgb(214 182 111 / 0.18);
		color: #f6e7c4;
		font-weight: 700;
	}

	.empty-card-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.55rem;
		width: 100%;
		padding: 2.2rem 1.4rem;
		border: 1px dashed var(--line-strong);
		border-radius: 5px;
		background: rgb(16 13 10 / 0.5);
		box-sizing: border-box;
	}

	.diamond-icon {
		font-size: 2.2rem;
		color: #d6b66f;
		line-height: 1;
	}

	.empty-card-box p {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.48;
		color: #e4d6bb;
		max-width: 20rem;
	}

	.empty-card-box .hint {
		font-size: 0.78rem;
		color: var(--muted);
	}

	/* === World-State Ledger Footer === */
	.ledger {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem 0.65rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--line);
	}

	.ledger-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		padding: 0.2rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(18 14 11 / 0.75);
		color: var(--ink);
		font: inherit;
		font-size: 0.73rem;
		cursor: pointer;
	}

	.chip:hover {
		border-color: var(--paper);
	}

	.chip-k {
		color: var(--muted);
	}

	.chip.tone-good b {
		color: #9be2a6;
	}

	.chip.tone-warn b {
		color: #f3ce7e;
	}

	.chip.tone-danger b {
		color: #ff9c8f;
	}

	@media (max-width: 960px) {
		.stage-grid {
			grid-template-columns: 1fr;
		}

		.timeline-bar {
			flex-wrap: wrap;
		}

		.rail {
			order: 3;
			flex-basis: 100%;
		}
	}
</style>
