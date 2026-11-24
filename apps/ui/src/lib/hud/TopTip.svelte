<!--
	A counter in the top bar with the slip that explains it: the slip opens while the pointer or the keyboard's focus
	rests on the counter, and never takes the pointer itself. A counter with something to open is a button. Which of
	them is open is the screen's own state, kept for a studio scene under `name`.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { fade } from 'svelte/transition';
	import { keep } from './viewState.ts';

	type Props = HTMLAttributes<HTMLDivElement> & {
		name: string;
		/** What the counter says to a screen reader. */
		label: string;
		/** The counter's test id. The slip's is the same with `-tip`. */
		testid: string;
		open?: boolean;
		/** What a click on the counter opens. */
		onopen?: () => void;
		/** Where pieces fly to when they are put away here (`data-dest`). */
		dest?: string;
		title?: string;
		width?: string;
		/** A dark frame round a card, in place of the paper slip. */
		frame?: boolean;
		/** The counter itself, for whoever animates it. */
		element?: HTMLElement;
		counter: Snippet;
		children: Snippet;
	};

	let {
		name,
		label,
		testid,
		open = $bindable(false),
		onopen,
		dest,
		title,
		width = '19.5rem',
		frame = false,
		element = $bindable(),
		counter,
		children,
		...rest
	}: Props = $props();

	// A counter keeps the name it was made with.
	// svelte-ignore state_referenced_locally
	keep(
		name,
		() => open,
		(value: boolean) => (open = value),
	);

	const hover = {
		onpointerenter: () => (open = true),
		onpointerleave: () => (open = false),
		onfocus: () => (open = true),
		onblur: () => (open = false),
	};
</script>

<div class="wrap" {...rest}>
	{#if onopen}
		<button
			class="counter opens"
			bind:this={element}
			onclick={() => {
				open = false;
				onopen();
			}}
			data-testid={testid}
			data-dest={dest}
			aria-label={label}
			aria-expanded={open}
			{...hover}
		>
			{@render counter()}
		</button>
	{:else}
		<div
			class="counter"
			bind:this={element}
			role="button"
			tabindex="0"
			data-testid={testid}
			data-dest={dest}
			aria-label={label}
			aria-expanded={open}
			{...hover}
		>
			{@render counter()}
		</div>
	{/if}

	{#if open}
		<div
			class="tip"
			class:frame
			style:width={frame ? null : width}
			role="tooltip"
			data-testid={`${testid}-tip`}
			transition:fade={{ duration: 140 }}
		>
			{#if title}<strong class="title">{title}</strong>{/if}
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: none;
	}

	.counter {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.15rem 0.3rem;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--ink);
		font: inherit;
		cursor: default;
		outline: none;
	}

	.counter:focus-visible {
		outline: 1px solid var(--line-strong);
		outline-offset: 2px;
	}

	.opens {
		cursor: pointer;
	}

	.opens:hover {
		background: rgb(231 220 198 / 0.08);
	}

	.counter :global(strong) {
		font-size: 1.02rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.tip {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		z-index: 65;
		display: flex;
		flex-direction: column;
		gap: 0.38rem;
		max-height: 70vh;
		overflow: hidden;
		padding: 0.5rem 0.72rem 0.6rem;
		border-radius: 2px;
		background: var(--slip);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.78rem;
		line-height: 1.32;
		white-space: normal;
		pointer-events: none;
	}

	.tip.frame {
		align-items: center;
		gap: 0.45rem;
		max-height: none;
		overflow: visible;
		padding: 0.55rem 0.55rem 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		background: rgb(20 18 14 / 0.97);
		box-shadow: 0 1.2rem 3rem rgb(0 0 0 / 0.65);
		color: var(--ink);
		font-size: inherit;
		line-height: inherit;
	}

	.title {
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 400;
	}

	.tip :global(p) {
		margin: 0;
	}
</style>
