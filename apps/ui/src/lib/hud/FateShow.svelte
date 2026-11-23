<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { pack } from '@repo/game';
	import { backOut } from 'svelte/easing';
	import { fade, scale } from 'svelte/transition';
	import CardIcon from '#lib/cards/CardIcon.svelte';
	import { SCAR_ICON } from '#lib/cards/icons.ts';
	import type { FateScene } from './fateShow.svelte.ts';
	import Portrait from './Portrait.svelte';
	import { placed } from './traits.ts';

	type Props = {
		scene: FateScene;
		color: string;
		/** What the Chronicler says over a death. */
		epitaph: string;
	};

	let { scene, color, epitaph }: Props = $props();

	const occupation = $derived(
		scene.who.worker
			? 'Haven worker'
			: scene.who.job
				? pack.jobs.find(candidate => candidate.id === scene.who.job)!.name
				: null,
	);
	const VERDICT = {
		empty: { title: 'Nothing', text: 'The box is empty.' },
		scar: { title: 'A scar', text: 'They carry this one for good.' },
		skull: { title: 'Dead', text: 'The plague takes them.' },
	} as const;
</script>

<!--
	The table stops to watch what happens to one of its own. It takes no clicks: the scar is chosen and the seat
	refilled on the screens that follow.
-->
<div
	class="fate {scene.t}"
	class:bad={scene.t === 'scratch' && scene.stage === 'open' && scene.result !== 'empty'}
	style:--seat={color}
	role="status"
	data-testid="fate-show"
	data-scene={scene.t}
	data-stage={scene.t === 'scratch' ? scene.stage : undefined}
	transition:fade={{ duration: 260 }}
	{@attach feedback('Fate', () => scene)}
>
	{#if scene.t === 'scratch'}
		<article class="card" in:scale={{ start: 0.8, duration: 380, easing: backOut }}>
			<span class="kicker">Exposed</span>
			<div class="who">
				<span class="face"
					><Portrait portrait={scene.who.portrait} {color} job={scene.who.job} hooded={scene.who.worker} /></span
				>
				<div class="words">
					<strong>{scene.who.name}</strong>
					{#if occupation}
						<span class="job">
							{occupation}
						</span>
					{/if}
				</div>
			</div>
			<div class="track" role="img" aria-label={`Exposure box ${scene.box + 1} of ${scene.track.length}`}>
				{#each scene.track as box, index (index)}
					<i
						class={box}
						class:now={index === scene.box}
						class:scratching={index === scene.box && scene.stage === 'scratching'}
						class:opened={index === scene.box && scene.stage === 'open'}
					>
						{#if box === 'scar'}<CardIcon path={SCAR_ICON} size="1.5rem" />{:else if box === 'skull'}☠{/if}
					</i>
				{/each}
			</div>
			<p class="verdict" class:shown={scene.stage === 'open'} data-testid="fate-verdict">
				<b>{VERDICT[scene.result].title}</b>
				<span>{VERDICT[scene.result].text}</span>
			</p>
		</article>
	{:else}
		<article class="card obituary" in:scale={{ start: 0.86, duration: 700 }}>
			<span class="kicker">In memory</span>
			<span class="face large"
				><Portrait portrait={scene.who.portrait} {color} job={scene.who.job} hooded={scene.who.worker} dead /></span
			>
			<strong>{scene.who.name}</strong>
			{#if occupation}
				<span class="job">
					{occupation}
				</span>
			{/if}
			<span class="where">Died in {placed(scene.at, scene.month)}</span>
			<ul class="life">
				<li><b>{scene.games}</b> {scene.games === 1 ? 'game' : 'games'} played</li>
				{#if scene.abilities.length}<li>{scene.abilities.join(' · ')}</li>{/if}
				{#if scene.scars.length}
					<li class="scars"><CardIcon path={SCAR_ICON} size="0.95rem" />{scene.scars.join(' · ')}</li>
				{/if}
			</ul>
			<p class="epitaph">{epitaph}</p>
		</article>
	{/if}
</div>

<style>
	.fate {
		position: absolute;
		inset: 0;
		z-index: 47;
		display: grid;
		place-items: center;
		background: radial-gradient(ellipse at 50% 46%, rgb(18 13 9 / 0.78), rgb(8 6 4 / 0.9));
		pointer-events: none;
		transition: background 500ms ease;
	}

	.fate.bad,
	.fate.memorial {
		background: radial-gradient(ellipse at 50% 46%, rgb(58 12 8 / 0.82), rgb(8 4 3 / 0.94));
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
		min-width: 26rem;
		padding: 1.3rem 2.4rem 1.5rem;
		border: 3px double color-mix(in srgb, var(--seat) 80%, white);
		border-radius: 6px;
		background: rgb(22 17 12 / 0.94);
		color: var(--paper);
		box-shadow: 0 1.6rem 4rem rgb(0 0 0 / 0.7);
	}

	.kicker {
		padding: 0.12rem 0.8rem;
		border-radius: 2px;
		background: var(--danger);
		color: #fff4ea;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 1.1rem;
	}

	.face {
		position: relative;
		display: block;
		flex: none;
		width: 6rem;
		height: 6rem;
		border: 3px solid var(--seat);
		border-radius: 6px;
		overflow: hidden;
	}

	.face.large {
		width: 9rem;
		height: 9rem;
		border-color: rgb(243 230 214 / 0.35);
	}

	.words {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	strong {
		font-family: var(--font-display);
		font-size: 2.8rem;
		font-weight: 400;
		line-height: 1;
	}

	.job {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 1.1rem;
		color: color-mix(in srgb, var(--seat) 45%, var(--paper));
	}

	.track {
		display: flex;
		gap: 0.5rem;
	}

	.track i {
		position: relative;
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		border: 2px solid rgb(243 230 214 / 0.35);
		border-radius: 4px;
		background: rgb(243 230 214 / 0.08);
		font-size: 1.6rem;
		font-style: normal;
		line-height: 1;
		overflow: hidden;
	}

	/* The foil still on a box nobody has scratched. */
	.track i.hidden {
		background: repeating-linear-gradient(45deg, #8d8674 0 4px, #a59d88 4px 8px);
	}

	.track i.scar {
		background: var(--danger);
		color: #fff4ea;
	}

	.track i.skull {
		background: #0c0907;
		color: #f3e6d6;
	}

	.track i.now {
		border-color: #ffd166;
		box-shadow: 0 0 0 3px rgb(255 209 102 / 0.3);
		scale: 1.25;
		transition: scale 300ms cubic-bezier(0.3, 1.4, 0.5, 1);
	}

	/* A coin worked across the foil: the box shakes and the foil thins from one corner to the other. */
	.track i.scratching {
		animation: scratch-shake 950ms linear 1;
	}

	.track i.scratching::after {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(-45deg, rgb(22 17 12 / 0.9) 0 3px, transparent 3px 7px);
		animation: scratch-wipe 950ms ease-in 1 both;
	}

	.track i.opened {
		animation: box-open 420ms cubic-bezier(0.3, 1.5, 0.5, 1) 1;
	}

	@keyframes scratch-shake {
		0%,
		100% {
			translate: 0 0;
			rotate: 0deg;
		}
		12%,
		37%,
		62%,
		87% {
			translate: -2px 1px;
			rotate: -3deg;
		}
		25%,
		50%,
		75% {
			translate: 2px -1px;
			rotate: 3deg;
		}
	}

	@keyframes scratch-wipe {
		from {
			clip-path: inset(0 100% 0 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}

	@keyframes box-open {
		from {
			scale: 1.9;
		}
		to {
			scale: 1.25;
		}
	}

	.verdict {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		margin: 0;
		opacity: 0;
		translate: 0 0.4rem;
		transition:
			opacity 240ms ease,
			translate 240ms ease;
	}

	.verdict.shown {
		opacity: 1;
		translate: 0 0;
	}

	.verdict b {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 400;
		line-height: 1.1;
	}

	.bad .verdict b {
		color: #ff7a5c;
	}

	.verdict span {
		font-size: 0.95rem;
		opacity: 0.8;
	}

	.obituary {
		gap: 0.55rem;
		max-width: 34rem;
		border-color: rgb(243 230 214 / 0.4);
		text-align: center;
	}

	.obituary .kicker {
		background: rgb(243 230 214 / 0.16);
		color: var(--paper);
	}

	.where {
		font-size: 1.1rem;
		color: #ff9a80;
	}

	.life {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0.2rem 0 0;
		padding: 0;
		list-style: none;
		font-size: 0.92rem;
		opacity: 0.85;
	}

	.life .scars {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		color: #ff9a80;
	}

	.epitaph {
		margin: 0.5rem 0 0;
		padding-top: 0.7rem;
		border-top: 1px solid rgb(243 230 214 / 0.2);
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-style: italic;
		line-height: 1.35;
	}
</style>
