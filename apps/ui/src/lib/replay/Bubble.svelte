<script lang="ts">
	import { fly } from 'svelte/transition';
	import type { SaidNote } from './replay.svelte.ts';

	type Props = { note: SaidNote; folded: boolean; above: boolean; right: boolean; color: string; onopen: () => void };

	let { note, folded, above, right, color, onopen }: Props = $props();
</script>

<button
	class="bubble {note.kind}"
	class:folded
	class:above
	class:right
	style:--who={color}
	in:fly={{ y: above ? 10 : -10, duration: 260 }}
	onclick={onopen}
	data-testid="bubble"
	data-kind={note.kind}
>
	{#if note.kind === 'issue'}<span class="head">{note.by} reports a problem</span>{/if}
	<span class="text">{note.text}</span>
	{#if !folded}
		{#if note.kind === 'why'}
			<i class="puff one"></i><i class="puff two"></i>
		{:else}
			<i class="tail"></i>
		{/if}
	{/if}
</button>

<style>
	.bubble {
		position: relative;
		display: block;
		max-width: 100%;
		padding: 0.45rem 0.7rem 0.5rem;
		border: 0;
		border-radius: 3px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-family: var(--font-ui);
		font-size: 0.86rem;
		line-height: 1.32;
		text-align: left;
		cursor: pointer;
	}

	.text {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 5;
		line-clamp: 5;
	}

	.bubble:not(.folded):hover .text {
		display: block;
		max-height: 40vh;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.why {
		border-radius: 1.1rem;
		background: #f3ead6;
		font-family: var(--font-display);
		font-size: 0.92rem;
		font-style: italic;
		line-height: 1.3;
	}

	.chat {
		border-left: 3px solid var(--who);
	}

	.issue {
		border-left: 0.45rem solid transparent;
		border-image: repeating-linear-gradient(-45deg, #8b5a12 0 4px, #e1b863 4px 8px) 0 0 0 1;
	}

	.head {
		display: block;
		margin-bottom: 0.1rem;
		color: var(--ink-warn);
		font-size: 0.74rem;
		font-weight: 700;
	}

	.folded {
		padding: 0.25rem 0.6rem;
		opacity: 0.72;
		font-size: 0.78rem;
	}

	.folded .text {
		-webkit-line-clamp: 1;
		line-clamp: 1;
	}

	.folded:hover {
		opacity: 1;
	}

	.puff {
		position: absolute;
		border-radius: 50%;
		background: #f3ead6;
		box-shadow: var(--slip-shadow);
	}

	.puff.one {
		top: -0.65rem;
		left: 1.3rem;
		width: 0.55rem;
		height: 0.55rem;
	}

	.puff.two {
		top: -1.1rem;
		left: 0.9rem;
		width: 0.32rem;
		height: 0.32rem;
	}

	.above .puff.one {
		top: auto;
		bottom: -0.65rem;
	}

	.above .puff.two {
		top: auto;
		bottom: -1.1rem;
	}

	.tail {
		position: absolute;
		top: -0.45rem;
		left: 1.2rem;
		width: 0.9rem;
		height: 0.5rem;
		background: inherit;
		clip-path: polygon(0 100%, 30% 0, 100% 100%);
	}

	.right .puff.one {
		left: auto;
		right: 1.3rem;
	}

	.right .puff.two {
		left: auto;
		right: 0.9rem;
	}

	.right .tail {
		left: auto;
		right: 1.2rem;
	}

	.above .tail {
		top: auto;
		bottom: -0.45rem;
		clip-path: polygon(0 0, 30% 100%, 100% 0);
	}
</style>
