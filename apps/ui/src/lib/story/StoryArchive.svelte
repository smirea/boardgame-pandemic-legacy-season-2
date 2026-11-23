<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import type { Campaign } from '@repo/game';
	import { typing } from '#lib/keys.ts';
	import { CAST } from './cast.ts';
	import { unlockedStoryScenes } from './script.ts';
	import type { StoryScene } from './script.ts';
	import StoryStage from './StoryStage.svelte';

	type Props = {
		campaign: Campaign;
		initialScene?: StoryScene | null;
		onclose: () => void;
	};

	let { campaign, initialScene = null, onclose }: Props = $props();

	const scenes = $derived(unlockedStoryScenes(campaign));
	let picked = $state<StoryScene | null>(null);
	const active = $derived(picked ?? initialScene);
</script>

<svelte:window
	onkeydown={event => {
		if (typing(event)) return;
		if (event.key === 'Escape') {
			if (picked) picked = null;
			else onclose();
		}
	}}
/>

{#if active}
	<StoryStage
		scene={active}
		delivered={campaign.sampleDelivered}
		ondone={() => {
			if (picked) picked = null;
			else onclose();
		}}
		onclose={() => {
			if (picked) picked = null;
			else onclose();
		}}
	/>
{:else}
	<section
		class="archive-panel"
		aria-label="Campaign story log"
		data-testid="story-archive"
		{@attach feedback('Story log', () => ({ count: scenes.length }))}
	>
		<header>
			<div>
				<span class="kicker">HAVEN CHRONICLE</span>
				<h2>Story Log</h2>
			</div>
			<p class="count">{scenes.length} narrative scenes unlocked</p>
			<button type="button" class="close" onclick={onclose} aria-label="Close story log">×</button>
		</header>

		<div class="list">
			{#each scenes as scene (scene.id)}
				{@const lead = CAST[scene.beats[0]!.speaker]}
				<button type="button" class="scene-card" onclick={() => (picked = scene)} data-scene-id={scene.id}>
					<span class="act">{scene.act}</span>
					<strong>{scene.title}</strong>
					{#if scene.subtitle}<span class="sub">{scene.subtitle}</span>{/if}
					<p class="preview">“{scene.beats[0]!.text}”</p>
					<footer>
						<span class="speaker" style:color={lead.accent}>{lead.name}</span>
						<span class="lines">{scene.beats.length} {scene.beats.length === 1 ? 'line' : 'lines'}</span>
						{#if scene.setPiece}<span class="tag">Set-piece</span>{/if}
					</footer>
				</button>
			{/each}
		</div>
	</section>
{/if}

<style>
	.archive-panel {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: min(64rem, 94vw);
		max-height: 86vh;
		padding: 1.25rem 1.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background: var(--panel-solid);
		box-shadow: 0 1.4rem 3.5rem rgb(0 0 0 / 0.65);
		color: var(--ink);
		overflow: hidden;
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		padding-bottom: 0.7rem;
		border-bottom: 1px solid var(--line);
	}

	.kicker {
		display: block;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: #d6b66f;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.9rem;
		font-weight: 400;
		color: var(--paper);
	}

	.count {
		margin: 0;
		color: var(--muted);
		font-size: 0.84rem;
	}

	.close {
		margin-left: auto;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--line-strong);
		border-radius: 50%;
		background: none;
		color: var(--ink);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
	}

	.list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17.5rem, 1fr));
		gap: 0.7rem;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.scene-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: rgb(255 250 238 / 0.04);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease;
	}

	.scene-card:hover {
		border-color: var(--paper);
		background: rgb(231 220 198 / 0.09);
	}

	.act {
		font-size: 0.66rem;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #d6b66f;
	}

	strong {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 400;
		color: var(--paper);
	}

	.sub {
		font-size: 0.74rem;
		color: var(--muted);
	}

	.preview {
		margin: 0.2rem 0 0.35rem;
		font-size: 0.78rem;
		line-height: 1.38;
		color: #cfc4b0;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 0.3rem;
		border-top: 1px solid rgb(231 220 198 / 0.1);
		font-size: 0.72rem;
	}

	.speaker {
		font-weight: 700;
	}

	.lines {
		color: var(--muted);
	}

	.tag {
		margin-left: auto;
		padding: 0.05rem 0.42rem;
		border-radius: 999px;
		background: rgb(224 108 72 / 0.24);
		color: #ffb29e;
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
	}
</style>
