<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import type { World } from '@repo/game';
	import { fade, scale } from 'svelte/transition';
	import { legacyScans } from '#lib/scans.generated.ts';
	import { originals, scanUrl } from '#lib/scans.svelte.ts';
	import { cityName } from './labels.svelte.ts';
	import RichText from './RichText.svelte';

	type Props = {
		world: World;
		/** This browser's player is the one resolving the Epidemic. */
		canAct: boolean;
		/** Something may still be played before the last step, so it waits for the player in place of running on. */
		held: boolean;
		/** Whose turn it is, for everyone who is waiting on them. */
		who: string;
		/** Takes the last step now. */
		onadvance: () => void;
	};

	let { world, canAct, held, who, onadvance }: Props = $props();

	const game = $derived(world.game);
	const pending = $derived(game?.pending[0]?.t ?? null);
	// The card lies beside the deck until its player starts it. This opens once the first step has been taken.
	const stage = $derived(pending === 'epidemicInfect' || pending === 'intensify' ? pending : null);
	// It stands aside for the second step, so the city that is struck shows on the board.
	const docked = $derived(stage === 'intensify');
	// The first step is shown as just taken for a beat, and then the second as the one about to be.
	const INCREASE_MS = 1200;
	let increased = $state(false);
	$effect(() => {
		if (stage !== 'epidemicInfect') return void (increased = false);
		const timer = setTimeout(() => (increased = true), INCREASE_MS);
		return () => clearTimeout(timer);
	});

	const rates = pack.numbers.infectionRates;
	const currentRate = $derived(game ? (rates[game.rateIndex] ?? rates.at(-1)!) : rates[0]!);
	const earlierRate = $derived(game ? (rates[Math.max(game.rateIndex - 1, 0)] ?? currentRate) : rates[0]!);
	const fromStorage = $derived(
		world.campaign.rules.includes('epidemicFromStorage') && world.campaign.stored.infection.length > 0,
	);
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
		class="epidemic-layer"
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
								Step 2 of 3 · Infect
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
									{:else if earlierRate === currentRate}
										Rate stays {currentRate}
									{:else}
										Rate {earlierRate} → {currentRate}
									{/if}
								</span>
							</div>
							<p><RichText text="Move the infection rate marker forward 1 space." /></p>
						</div>
					</li>

					<li class="stage {infectState}" data-epidemic-step="infect" data-state={infectState}>
						<span class="num" aria-hidden="true">{infectState === 'done' ? '✓' : '2'}</span>
						<div class="body">
							<div class="row">
								<b>Infect</b>
								{#if infectState === 'done' && lastEpidemic?.city}
									<span class="pill struck">
										{cityName(lastEpidemic.city)}{lastEpidemic.removed > 0 ? ` −${lastEpidemic.removed}` : ''}
									</span>
								{:else if fromStorage}
									<span class="pill">From storage</span>
								{:else}
									<span class="pill">Bottom card</span>
								{/if}
							</div>
							<p>
								<RichText
									text={fromStorage
										? 'Pull a stored Infection card and remove all supply cubes from that city.'
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
							{#if intensifyState === 'active' && held}
								<!-- An Event or a Lockdown may come first, so this step waits for its player. -->
								<div class="hold">
									{#if canAct}
										<button class="go" onclick={onadvance} data-testid="epidemic-advance" title="Space"
											>Intensify</button
										>
										<span>An Event or a Lockdown may be played first.</span>
									{:else}
										<span>Waiting for {who}.</span>
									{/if}
								</div>
							{/if}
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

	.hold {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.45rem;
		font-size: 0.74rem;
		color: #f0d7b4;
	}

	.go {
		padding: 0.3rem 0.9rem;
		border: 0;
		border-radius: 3px;
		background: #e3b23c;
		color: #1c140a;
		font: inherit;
		font-size: 0.84rem;
		font-weight: 700;
		cursor: pointer;
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

	.epi-card.docked {
		left: 1.1rem;
		top: 46%;
		transform: translate(0, -50%) scale(0.88);
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
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		margin-bottom: 0.2rem;
	}

	.row b {
		font-size: 0.88rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #f7ead8;
	}

	.stage.done .row b {
		text-decoration: line-through;
		opacity: 0.8;
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

	.pill.struck {
		background: rgb(180 52 40 / 0.4);
		color: #ffd0c8;
	}

	.body p {
		margin: 0;
		font-size: 0.76rem;
		line-height: 1.35;
		color: #d9c8b4;
	}
</style>
