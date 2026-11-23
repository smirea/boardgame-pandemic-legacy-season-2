<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { breakthrough, pack } from '@repo/game';
	import type { World } from '@repo/game';
	import { untrack } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { sfxMoment } from '#lib/audio/sfx.ts';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { originals, scanUrl } from '#lib/scans.svelte.ts';
	import { cityName } from './labels.svelte.ts';
	import RichText from './RichText.svelte';

	type Props = {
		world: World;
		/** The beat in which the infection rate is shown moving on, before the bottom card may be drawn. */
		increasing: boolean;
		/** The side of the table it stands aside to, away from the turn desk where its steps are taken. */
		side: 'left' | 'right';
	};

	let { world, increasing, side }: Props = $props();

	const game = $derived(world.game);
	const pending = $derived(game?.pending[0]?.t ?? null);
	// The card lies beside the deck until its player starts it. This opens once the first step has been taken.
	const stage = $derived(pending === 'epidemicInfect' || pending === 'intensify' ? pending : null);
	// It holds the table for the first step, then stands aside: the next two are taken at the turn desk, and the
	// city that is struck shows on the board.
	const docked = $derived(!increasing);
	const increased = $derived(!increasing);

	const rates = pack.numbers.infectionRates;
	const currentAt = $derived(Math.min(game?.rateIndex ?? 0, rates.length - 1));
	// Where the marker stood before this Epidemic: one space back, or the same space when it was already on the last.
	// A browser that opens in the middle of one never saw that, so it takes the Epidemic count's word for it.
	let seen = untrack(() => ({ epidemics: game?.epidemics ?? 0, at: currentAt }));
	let earlierAt = $state(untrack(() => ((game?.epidemics ?? 0) > currentAt ? currentAt : Math.max(currentAt - 1, 0))));
	$effect.pre(() => {
		const now = { epidemics: game?.epidemics ?? 0, at: currentAt };
		untrack(() => {
			if (now.epidemics > seen.epidemics) earlierAt = Math.min(seen.at, now.at);
			seen = now;
		});
	});
	const currentRate = $derived(rates[currentAt]!);
	const earlierRate = $derived(rates[earlierAt]!);

	// The first step as it is shown: the track opens under it with the marker where it stood, the marker moves on a
	// space, and the track closes again before the card stands aside for the second step.
	let track = $state<'shut' | 'open' | 'moved' | 'closing'>('shut');
	const markerAt = $derived(track === 'open' ? earlierAt : currentAt);
	$effect(() => {
		if (!increasing) {
			track = 'shut';
			return;
		}
		// Only the step beginning starts the sequence: nothing else that changes while it plays may start it again.
		return untrack(() => {
			const rises = currentRate > earlierRate;
			track = 'open';
			sfxMoment('rateOpen');
			const timers = [
				setTimeout(() => {
					track = 'moved';
					sfxMoment('rateMove');
				}, 750),
				setTimeout(() => rises && sfxMoment('rateRise'), 1300),
				setTimeout(() => {
					track = 'closing';
					sfxMoment('rateShut');
				}, 2450),
			];
			return () => timers.forEach(clearTimeout);
		});
	});
	const wearingOff = $derived(world.campaign.rules.includes('epidemicFromStorage'));
	const fromStorage = $derived(wearingOff && world.campaign.stored.infection.length > 0);
	const jade = $derived(breakthrough(world.campaign, 'jade'));
	const lastEpidemic = $derived.by(() => {
		if (!game) return null;
		for (let i = game.log.length - 1; i >= 0; i--) {
			const entry = game.log[i]!;
			if (entry.t === 'epidemic') return entry;
		}
		return null;
	});

	const originalSrc = $derived(legacyScans['03-07']?.src ? scanUrl(legacyScans['03-07']!.src) : null);

	type StepState = 'pending' | 'active' | 'done';
	const increaseState = $derived<StepState>(stage === 'epidemicInfect' && !increased ? 'active' : 'done');
	const infectState = $derived<StepState>(stage === 'epidemicInfect' ? (increased ? 'active' : 'pending') : 'done');
	const intensifyState = $derived<StepState>(stage === 'intensify' ? 'active' : 'pending');
</script>

{#if stage && game}
	{#if !docked}
		<!-- The table steps back while the Epidemic is read out, and returns for the city it strikes. -->
		<div class="scrim" transition:fade={{ duration: 260 }}></div>
	{/if}
	<div
		class="epidemic-layer {side}"
		class:docked
		data-testid="epidemic-sequence"
		data-stage={stage}
		data-docked={docked}
		{@attach feedback('Epidemic card', () => ({ stage, docked, rate: currentRate }))}
	>
		<article
			class="epi-card"
			class:docked
			data-original-active={originals.held && Boolean(originalSrc)}
			in:scale={{ start: 0.72, duration: 360 }}
			out:scale={{ start: 0.85, duration: 240 }}
		>
			{#if originals.held && originalSrc}
				<img class="original-img" src={originalSrc} alt="Epidemic (printed original)" />
			{:else}
				<div class="hazard"></div>
				<header class="epi-head">
					<span class="bio" aria-hidden="true">☣</span>
					<div class="title-wrap">
						<strong>EPIDEMIC</strong>
						<span class="sub">
							{#if stage === 'epidemicInfect' && !increased}
								Step 1 of 3 · Increase
							{:else if stage === 'epidemicInfect'}
								{wearingOff ? "Step 2 of 3 · It's wearing off" : 'Step 2 of 3 · Infect'}
							{:else}
								Step 3 of 3 · Intensify
							{/if}
						</span>
					</div>
				</header>

				<ol class="stages">
					<li class="stage {increaseState}" data-epidemic-step="increase" data-state={increaseState}>
						<span class="num" aria-hidden="true">{increaseState === 'done' ? '✓' : '1'}</span>
						<div class="body">
							<div class="row">
								<b>Increase</b>
								<span class="pill">
									{#if increaseState === 'done'}
										Rate {currentRate}
									{:else if track === 'open'}
										Rate {earlierRate}
									{:else if earlierRate === currentRate}
										Rate stays {currentRate}
									{:else}
										Rate {earlierRate} → {currentRate}
									{/if}
								</span>
							</div>
							<p><RichText text="Move the infection rate marker forward 1 space." /></p>
							<div class="rate-run" class:open={track === 'open' || track === 'moved'}>
								<div
									class="rate-track"
									class:moved={track === 'moved'}
									role="img"
									aria-label={`Infection rate track: ${rates[markerAt]} cards a turn`}
									data-testid="epidemic-rate-track"
									data-at={markerAt}
									style:--at={markerAt}
									style:--spaces={rates.length}
								>
									{#each rates as rate, index (index)}
										<span class="space" class:passed={index < markerAt} class:now={index === markerAt}>{rate}</span>
									{/each}
									<span class="marker" aria-hidden="true">☣</span>
								</div>
							</div>
						</div>
					</li>

					<li
						class="stage {infectState}"
						class:wearing-off={wearingOff}
						data-epidemic-step="infect"
						data-state={infectState}
					>
						<span class="num" aria-hidden="true">{infectState === 'done' ? '✓' : '2'}</span>
						<div class="body">
							<div class="row">
								<b>{wearingOff ? "It's wearing off" : 'Infect'}</b>
								<span class="pills">
									{#if jade}
										<span class="pill jade">Jade Lab</span>
									{/if}
									{#if infectState === 'done' && lastEpidemic?.city}
										<span class="pill struck">
											{cityName(lastEpidemic.city)}{lastEpidemic.removed > 0 ? ` −${lastEpidemic.removed}` : ''}
										</span>
									{:else if fromStorage}
										<span class="pill tape">Package 6</span>
									{:else if wearingOff}
										<span class="pill tape">Package 6 empty · Bottom card</span>
									{:else}
										<span class="pill">Bottom card</span>
									{/if}
								</span>
							</div>
							<p>
								<RichText
									text={fromStorage
										? jade
											? 'Draw a random Infection card from Package 6 and remove 1 supply cube from that city (Jade Lab).'
											: 'Draw a random Infection card from Package 6. Remove all the Supply cubes (if any) in that city. Then, discard that card.'
										: jade
											? 'Draw the bottom Infection card and remove 1 supply cube from that city (Jade Lab).'
											: 'Draw the bottom Infection card and remove all supply cubes from that city.'}
								/>
							</p>
						</div>
					</li>

					<li class="stage {intensifyState}" data-epidemic-step="intensify" data-state={intensifyState}>
						<span class="num" aria-hidden="true">3</span>
						<div class="body">
							<div class="row">
								<b>Intensify</b>
								<span class="pill">{game.infectionDiscard.length} in discard</span>
							</div>
							<p>
								<RichText text="Shuffle the Infection discard pile and place it on top of the Infection deck." />
							</p>
						</div>
					</li>
				</ol>
				<div class="hazard bottom"></div>
			{/if}
		</article>
	</div>
{/if}

<style>
	.epidemic-layer {
		position: absolute;
		inset: 0;
		z-index: 44;
		pointer-events: none;
	}

	.scrim {
		position: absolute;
		inset: 0;
		z-index: 43;
		background: radial-gradient(ellipse at 50% 44%, rgb(40 8 6 / 0.55), rgb(10 4 3 / 0.82));
		pointer-events: none;
	}

	.epi-card {
		position: absolute;
		left: 50%;
		top: 52%;
		transform: translate(-50%, -50%) scale(1);
		width: 20.5rem;
		border-radius: 10px;
		border: 2px solid #b43428;
		background: linear-gradient(165deg, #281010 0%, #170909 55%, #120707 100%);
		color: #f3e6d6;
		box-shadow:
			0 1.4rem 3.4rem rgb(0 0 0 / 0.72),
			0 0 0 1px rgb(255 120 96 / 0.25) inset,
			0 0 2.4rem rgb(180 42 32 / 0.35);
		overflow: hidden;
		pointer-events: auto;
		transition:
			left 560ms cubic-bezier(0.2, 0.9, 0.25, 1),
			top 560ms cubic-bezier(0.2, 0.9, 0.25, 1),
			transform 560ms cubic-bezier(0.2, 0.9, 0.25, 1),
			box-shadow 420ms ease;
	}

	/* Small enough to stand between the seats of its side, clear of the piles under the top one. */
	.right .epi-card.docked {
		left: calc(100% - 1.1rem);
		transform: translate(-100%, -50%) scale(0.8);
		transform-origin: right center;
	}

	.epi-card.docked {
		left: 1.1rem;
		top: 52%;
		transform: translate(0, -50%) scale(0.8);
		transform-origin: left center;
		box-shadow:
			0 1rem 2.4rem rgb(0 0 0 / 0.65),
			0 0 0 1px rgb(255 120 96 / 0.22) inset;
	}

	.original-img {
		display: block;
		width: 100%;
		height: auto;
	}

	.hazard {
		height: 8px;
		background: repeating-linear-gradient(-45deg, #b43428 0 10px, #1c0b0a 10px 20px);
	}

	.hazard.bottom {
		height: 6px;
		opacity: 0.75;
	}

	.epi-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem 0.65rem;
		border-bottom: 1px solid rgb(243 230 214 / 0.14);
		background: radial-gradient(circle at 18% 50%, rgb(196 52 38 / 0.28), transparent 70%);
	}

	.bio {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: #a8261c;
		color: #f7e6b2;
		font-size: 1.55rem;
		line-height: 1;
		box-shadow: 0 0 0 2px rgb(247 230 178 / 0.4);
		flex: none;
	}

	.title-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.title-wrap strong {
		font-family: var(--font-display);
		font-size: 1.65rem;
		font-weight: 400;
		letter-spacing: 0.08em;
		line-height: 1;
		color: #f9d8c4;
	}

	.sub {
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #d6a496;
	}

	.stages {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		margin: 0;
		padding: 0.85rem 0.9rem 0.95rem;
		list-style: none;
	}

	.stage {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.55rem 0.65rem;
		border-radius: 6px;
		border: 1px solid rgb(243 230 214 / 0.1);
		background: rgb(255 255 255 / 0.03);
		transition:
			background 260ms ease,
			border-color 260ms ease,
			opacity 260ms ease;
	}

	.stage.pending {
		opacity: 0.5;
	}

	.stage.active {
		border-color: #e3b23c;
		background: linear-gradient(90deg, rgb(227 178 60 / 0.18), rgb(180 52 40 / 0.16));
		box-shadow: 0 0 0 1px rgb(227 178 60 / 0.35);
	}

	.stage.done {
		border-color: rgb(118 184 126 / 0.4);
		background: rgb(118 184 126 / 0.1);
		opacity: 0.82;
	}

	.num {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: rgb(243 230 214 / 0.14);
		color: #f3e6d6;
		font-size: 0.78rem;
		font-weight: 700;
		flex: none;
		margin-top: 0.05rem;
	}

	.stage.active .num {
		background: #e3b23c;
		color: #1c140a;
	}

	.stage.done .num {
		background: #76b87e;
		color: #0e1d11;
	}

	.body {
		flex: 1;
		min-width: 0;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.25rem 0.4rem;
		margin-bottom: 0.2rem;
	}

	.row b {
		white-space: nowrap;
		font-size: 0.88rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #f7ead8;
	}

	.stage.done .row b {
		text-decoration: line-through;
		opacity: 0.8;
	}

	.pills {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}

	.pill {
		padding: 0.08rem 0.42rem;
		border-radius: 999px;
		background: rgb(243 230 214 / 0.12);
		color: #f0d7b4;
		font-size: 0.68rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.stage.active .pill {
		background: rgb(227 178 60 / 0.25);
		color: #fce29a;
	}

	.pill.jade {
		background: rgb(72 168 124 / 0.28);
		color: #a7f3d0;
	}

	.pill.struck {
		background: rgb(180 52 40 / 0.4);
		color: #ffd0c8;
	}

	.pill.tape {
		background: linear-gradient(170deg, #ede1c0, #d8c69b);
		color: #7d1b14;
		border: 1px solid rgb(56 42 24 / 0.45);
	}

	.stage.wearing-off {
		border-color: rgb(216 198 155 / 0.55);
		background: linear-gradient(90deg, rgb(237 225 192 / 0.14), rgb(180 52 40 / 0.16));
		transform: rotate(-0.7deg);
	}

	/* The track folds open under the step and shut again: a row that grows from nothing. */
	.rate-run {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows 320ms cubic-bezier(0.2, 0.9, 0.25, 1),
			opacity 240ms ease;
	}

	.rate-run.open {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	.rate-track {
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--spaces), 1fr);
		gap: 2px;
		min-height: 0;
		overflow: hidden;
	}

	.rate-run.open .rate-track {
		margin-top: 0.5rem;
		padding: 1.15rem 0 0.1rem;
	}

	.space {
		display: grid;
		place-items: center;
		height: 1.35rem;
		border-radius: 3px;
		background: rgb(243 230 214 / 0.1);
		color: #d9c8b4;
		font-size: 0.72rem;
		font-weight: 700;
		transition:
			background 300ms ease 380ms,
			color 300ms ease 380ms;
	}

	.space.passed {
		opacity: 0.55;
	}

	.space.now {
		background: #b43428;
		color: #fff1e4;
	}

	.marker {
		position: absolute;
		top: 0;
		left: calc((var(--at) + 0.5) * 100% / var(--spaces));
		transform: translateX(-50%);
		color: #ffd166;
		font-size: 1rem;
		line-height: 1;
		text-shadow: 0 0 0.5em rgb(255 120 60 / 0.9);
		transition: left 460ms cubic-bezier(0.45, 0, 0.25, 1);
	}

	/* The marker is picked up, carried over and set down, once. */
	.rate-track.moved .marker {
		animation: marker-hop 460ms ease-out 1;
	}

	@keyframes marker-hop {
		0% {
			transform: translateX(-50%) translateY(0) scale(1);
		}
		45% {
			transform: translateX(-50%) translateY(-0.45rem) scale(1.35);
		}
		100% {
			transform: translateX(-50%) translateY(0) scale(1);
		}
	}

	.body p {
		margin: 0;
		font-size: 0.76rem;
		line-height: 1.35;
		color: #d9c8b4;
	}
</style>
