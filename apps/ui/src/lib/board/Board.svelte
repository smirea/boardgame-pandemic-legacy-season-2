<script lang="ts">
	import type { CityId } from '@repo/game';
	import { Canvas } from '@threlte/core';
	import { NoToneMapping } from 'three';
	import { partHint, partKey } from './hints';
	import type { Part } from './hints';
	import type { BoardPoint } from './projection';
	import Scene from './Scene.svelte';
	import type { BoardView } from './types';

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		onpointer?: (point: BoardPoint | null) => void;
		resetView?: number;
		covered?: { x: number; y: number; width: number; height: number }[];
	};

	let { view, oncity, onpointer, resetView, covered }: Props = $props();

	let element = $state<HTMLElement>();
	// Which part of which city the pointer rests on. The text is read from the view, so it follows the game live.
	let hovered = $state.raw<{ city: CityId; part: Part; x: number; y: number } | null>(null);
	const hint = $derived(
		hovered && view.cities[hovered.city] ? partHint(hovered.part, view.cities[hovered.city]!) : null,
	);

	function onhint(city: CityId, part: Part, event: PointerEvent | null) {
		if (!event) {
			if (hovered?.city === city && partKey(hovered.part) === partKey(part)) hovered = null;
			return;
		}
		const box = element!.getBoundingClientRect();
		hovered = { city, part, x: event.clientX - box.x, y: event.clientY - box.y };
	}
</script>

<div
	class="board"
	role="presentation"
	bind:this={element}
	onpointerleave={() => {
		onpointer?.(null);
		hovered = null;
	}}
>
	<Canvas toneMapping={NoToneMapping}>
		<Scene {view} {oncity} {onpointer} {onhint} hoverCity={hovered?.city ?? null} {resetView} {covered} />
	</Canvas>
	{#if hovered && hint}
		<div
			class="hint"
			class:left={hovered.x > (element?.clientWidth ?? 0) - 260}
			class:up={hovered.y > (element?.clientHeight ?? 0) - 200}
			style:left={`${hovered.x}px`}
			style:top={`${hovered.y}px`}
			role="tooltip"
			data-testid="board-hint"
		>
			<strong>{hint.title}</strong>
			<dl>
				{#each hint.rows as row (row.label)}
					<dt>{row.label}</dt>
					<dd class={row.tone ?? ''}>{row.value}</dd>
				{/each}
			</dl>
			{#each hint.notes as note, index (index)}<p>{note}</p>{/each}
		</div>
	{/if}
</div>

<style>
	.board {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		/* A lamp over the middle of the desk. The chart is the only lit thing on it. */
		background:
			radial-gradient(ellipse 70% 60% at 50% 46%, rgb(255 226 170 / 0.09), transparent 70%),
			radial-gradient(ellipse at 50% 50%, #221e18 0%, var(--table) 78%);
	}

	/* A paper slip beside the pointer, in the chart's own colours: labels in one column, values in the next. */
	.hint {
		position: absolute;
		z-index: 32;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		width: max-content;
		max-width: 17rem;
		padding: 0.45rem 0.65rem 0.5rem;
		border: 1px solid rgb(42 32 23 / 0.35);
		border-radius: 2px;
		background: rgb(240 231 210 / 0.97);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-family: var(--font-ui);
		font-size: 0.78rem;
		line-height: 1.35;
		translate: 1rem 1rem;
		pointer-events: none;
	}

	.hint.left {
		translate: calc(-100% - 1rem) 1rem;
	}

	.hint.up {
		translate: 1rem calc(-100% - 1rem);
	}

	.hint.left.up {
		translate: calc(-100% - 1rem) calc(-100% - 1rem);
	}

	.hint strong {
		padding-bottom: 0.15rem;
		border-bottom: 1px solid rgb(42 32 23 / 0.2);
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
	}

	.hint dl {
		display: grid;
		grid-template-columns: max-content auto;
		gap: 0.08rem 0.9rem;
		margin: 0;
	}

	.hint dt {
		color: rgb(42 32 23 / 0.62);
	}

	.hint dd {
		margin: 0;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.hint dd.bad {
		color: #a3301c;
	}

	.hint dd.good {
		color: #2f6e5c;
	}

	.hint p {
		max-width: 15rem;
		margin: 0;
		color: rgb(42 32 23 / 0.75);
		font-size: 0.74rem;
	}
</style>
