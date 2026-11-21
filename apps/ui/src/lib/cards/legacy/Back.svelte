<script lang="ts">
	import type { Campaign, LegacyCardDef } from '@repo/game';
	import type { LegacyPrint } from '#lib/cards/print.generated.ts';

	type Props = { card: LegacyCardDef; print: LegacyPrint; code: string; monthLabel: string; campaign?: Campaign };

	let { card, print, code, monthLabel }: Props = $props();

	const triggerHint = $derived.by(() => {
		if (card.id === '12-05') return 'Draw at the end of December';
		if (card.kind === 'stop') return `Draw at setup of ${monthLabel}`;
		if (card.kind === 'pause') return `Draw after the first game of ${monthLabel}`;
		if (card.kind === 'priorities') return 'Keep drawing';
		if (card.kind === 'objective') return 'Objective';
		if (card.kind === 'event') return 'Rationed Event';
		if (card.kind === 'epidemic') return 'Epidemic';
		return monthLabel;
	});

	const KIND_LABEL: Record<LegacyCardDef['kind'], string> = {
		prologue: 'Prologue',
		stop: 'Stop',
		pause: 'Pause',
		archive: 'Journal',
		priorities: 'New Priorities',
		objective: 'Objective',
		turningPoint: 'Turning Point',
		event: 'Rationed Event',
		epidemic: 'Epidemic',
		scanner: 'Frequency Scanner',
		plan: 'The Plan',
		ending: 'Ending',
		reckoning: 'Final Reckoning',
		end: 'Campaign End',
	};
</script>

<div class="inner back">
	<div class="frame-line"></div>
	{#if card.kind === 'stop'}
		<div class="hazard"></div>
		<div class="stop-emblem" aria-hidden="true">
			<svg viewBox="0 0 64 64"><polygon points="19,4 45,4 60,19 60,45 45,60 19,60 4,45 4,19" /></svg>
			<span>STOP</span>
		</div>
		<strong class="back-title">{monthLabel}</strong>
		<p class="back-sub">{triggerHint}</p>
	{:else if card.kind === 'pause'}
		<div class="hazard amber"></div>
		<div class="pause-emblem" aria-hidden="true">
			<i></i><i></i>
		</div>
		<strong class="back-title">PAUSE</strong>
		<p class="back-sub">{triggerHint}</p>
	{:else if card.kind === 'objective'}
		<div class="star-crest" aria-hidden="true">★</div>
		<strong class="back-title">OBJECTIVE</strong>
		<p class="back-sub">Legacy Deck</p>
	{:else if card.kind === 'epidemic'}
		<div class="bio-crest" aria-hidden="true">☣</div>
		<strong class="back-title">LEGACY</strong>
		<p class="back-sub">{monthLabel}</p>
	{:else}
		<div class="compass-crest" aria-hidden="true">
			<svg viewBox="0 0 48 48">
				<circle cx="24" cy="24" r="19" />
				<polygon points="24,6 28,20 42,24 28,28 24,42 20,28 6,24 20,20" />
			</svg>
		</div>
		<span class="back-kicker">LEGACY DECK</span>
		<strong class="back-title">{monthLabel}</strong>
		<p class="back-sub">{KIND_LABEL[card.kind]}</p>
	{/if}
	<span class="code">{code}</span>
</div>

<style>
	/* === Side A (Card Backs) === */
	.back {
		align-items: center;
		justify-content: center;
		gap: 0.55em;
		background:
			radial-gradient(ellipse at 50% 35%, rgb(255 240 200 / 0.09), transparent 65%),
			linear-gradient(165deg, #2b2520, #161310);
		color: #efe6d2;
		text-align: center;
	}

	.frame-line {
		position: absolute;
		inset: 0.45em;
		border: 1.5px solid rgb(231 220 198 / 0.25);
		border-radius: 4px;
		pointer-events: none;
	}

	.hazard {
		position: absolute;
		inset: 0 0 auto 0;
		height: 0.9em;
		background: repeating-linear-gradient(-45deg, #a8261c 0 0.55em, #1a1612 0.55em 1.1em);
	}

	.hazard.amber {
		background: repeating-linear-gradient(-45deg, #d99b26 0 0.55em, #1a1612 0.55em 1.1em);
	}

	.stop-emblem {
		position: relative;
		display: grid;
		place-items: center;
		width: 5.4em;
		height: 5.4em;
	}

	.stop-emblem svg {
		width: 100%;
		height: 100%;
		fill: #a8261c;
		stroke: #f4ebd8;
		stroke-width: 2.5;
	}

	.stop-emblem span {
		position: absolute;
		font-family: var(--font-display);
		font-size: 1.55em;
		letter-spacing: 0.06em;
		color: #fff8eb;
	}

	.pause-emblem {
		display: flex;
		gap: 0.7em;
		padding: 0.8em 1.1em;
		border: 2px solid #e3b23c;
		border-radius: 50%;
	}

	.pause-emblem i {
		display: block;
		width: 0.65em;
		height: 2.1em;
		border-radius: 2px;
		background: #e3b23c;
	}

	.star-crest {
		display: grid;
		place-items: center;
		width: 3.4em;
		height: 3.4em;
		border: 2px solid #5985b8;
		border-radius: 50%;
		color: #7eb0e8;
		font-size: 1.6em;
	}

	.bio-crest {
		color: #c84232;
		font-size: 3.6em;
		line-height: 1;
	}

	.compass-crest svg {
		width: 3.8em;
		height: 3.8em;
		fill: rgb(227 178 60 / 0.25);
		stroke: #d4b886;
		stroke-width: 1.5;
	}

	.back-kicker {
		font-size: 0.78em;
		letter-spacing: 0.14em;
		color: rgb(231 220 198 / 0.72);
	}

	.back-title {
		font-family: var(--font-display);
		font-size: 1.9em;
		font-weight: 400;
		line-height: 1.05;
		color: #f4ebd8;
	}

	.back-sub {
		margin: 0;
		max-width: 92%;
		font-size: 0.96em;
		color: rgb(231 220 198 / 0.85);
		line-height: 1.3;
	}

	:global(.legacy-card.size-mini) .back-sub,
	:global(.legacy-card.size-mini) .back-kicker {
		display: none;
	}
</style>
