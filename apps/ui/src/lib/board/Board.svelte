<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { cityDef } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { Canvas } from '@threlte/core';
	import { NoToneMapping, WebGLRenderer } from 'three';
	import { inkOn } from '#lib/color.ts';
	import { CITY_COLOR } from './CityMarker.svelte';
	import Glyph from './Glyph.svelte';
	import { partHint, partKey, stockpileHint } from './hints';
	import type { Part } from './hints';
	import type { Placement } from './labels';
	import type { BoardPoint } from './projection';
	import Scene from './Scene.svelte';
	import type { BoardView } from './types';

	// The feedback editor (development only) redraws the page, and a WebGL canvas reads blank once its frame is presented.
	const createRenderer = (canvas: HTMLCanvasElement) =>
		new WebGLRenderer({
			canvas,
			powerPreference: 'high-performance',
			antialias: true,
			alpha: true,
			preserveDrawingBuffer: import.meta.env.DEV,
		});

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		onrecon?: (route: string) => void;
		/** A right click on a city, which takes back what a click put there. */
		oncityback?: (city: CityId) => void;
		onpointer?: (point: BoardPoint | null) => void;
		resetView?: number;
		covered?: { x: number; y: number; width: number; height: number }[];
	};

	let { view, oncity, onrecon, oncityback, onpointer, resetView, covered }: Props = $props();

	let element = $state<HTMLElement>();
	// Which part of which city the pointer rests on. The text is read from the view, so it follows the game live.
	// The stockpile is the one piece on the board that belongs to no city.
	let hovered = $state.raw<{ city: CityId | null; part: Part; x: number; y: number; name?: Placement } | null>(null);
	// The slip opens away from the city's printed name, so the name it lights up stays in view, unless the
	// screen's edge leaves no room on that side.
	const side = $derived.by(() => {
		const name = hovered?.name;
		const width = element?.clientWidth ?? 0;
		const height = element?.clientHeight ?? 0;
		const x = hovered?.x ?? 0;
		const y = hovered?.y ?? 0;
		const left = x > width - 260 ? true : x < 260 ? false : (name?.x ?? 0) > 1;
		const up = y > height - 200 ? true : y < 200 ? false : (name?.z ?? 0) > 0;
		return { left, up };
	});
	const hint = $derived.by(() => {
		if (!hovered) return null;
		if (!hovered.city) return view.stockpile === null ? null : stockpileHint(view.stockpile);
		return view.cities[hovered.city] ? partHint(hovered.part, view.cities[hovered.city]!) : null;
	});
	// The slip takes the colour of the city it describes, as the city's player card does, and the stockpile's is
	// plain paper and ink.
	const tint = $derived(
		hovered ? (hovered.city ? CITY_COLOR[cityDef(hovered.city).color ?? 'haven'] : '#5a4a36') : null,
	);

	function onhint(city: CityId, part: Part, event: PointerEvent | null, name?: Placement) {
		if (!event) {
			if (hovered?.city === city && partKey(hovered.part) === partKey(part)) hovered = null;
			return;
		}
		const box = element!.getBoundingClientRect();
		hovered = { city, part, x: event.clientX - box.x, y: event.clientY - box.y, name };
	}

	function onstockpile(event: PointerEvent | null) {
		if (!event) {
			if (hovered && !hovered.city) hovered = null;
			return;
		}
		const box = element!.getBoundingClientRect();
		hovered = { city: null, part: 'supplies', x: event.clientX - box.x, y: event.clientY - box.y };
	}
</script>

<div
	class="board"
	role="presentation"
	{@attach feedback(undefined, () => ({ hovered: hovered?.city ?? null }))}
	bind:this={element}
	oncontextmenu={event => {
		if (!hovered?.city || !oncityback) return;
		event.preventDefault();
		oncityback(hovered.city);
	}}
	onpointerleave={() => {
		onpointer?.(null);
		hovered = null;
	}}
>
	<Canvas toneMapping={NoToneMapping} {createRenderer}>
		<Scene
			{view}
			{oncity}
			{onrecon}
			{onpointer}
			{onhint}
			hoverCity={hovered?.city ?? null}
			{onstockpile}
			hoverStockpile={hovered !== null && hovered.city === null}
			{resetView}
			{covered}
		/>
	</Canvas>
	{#if hovered && hint}
		<div
			class="hint"
			class:left={side.left}
			class:up={side.up}
			style:left={`${hovered.x}px`}
			style:top={`${hovered.y}px`}
			style:--tint={tint}
			style:--tint-ink={tint ? inkOn(tint) : null}
			role="tooltip"
			data-testid="board-hint"
		>
			<div class="head">
				{#each hint.marks ?? [] as mark (mark)}<Glyph glyph={mark} />{/each}
				<strong>{hint.title}</strong>
				{#if hint.counts?.length}
					<span class="counts" data-testid="board-hint-counts">
						{#each hint.counts as entry (entry.glyph)}
							<span class={entry.tone ?? ''} data-glyph={entry.glyph}><Glyph glyph={entry.glyph} />{entry.count}</span>
						{/each}
					</span>
				{/if}
			</div>
			{#if hint.rows.length}
				<dl>
					{#each hint.rows as row (row.label)}
						<dt>{row.label}</dt>
						<dd class={row.tone ?? ''}>{row.value}</dd>
					{/each}
				</dl>
			{/if}
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

	/* A paper slip beside the pointer, tinted with the city's colour, its heading a band of that colour:
	   labels in one column, values in the next. */
	.hint {
		position: absolute;
		z-index: 32;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		width: max-content;
		max-width: 17rem;
		padding: 0.45rem 0.65rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--tint) 70%, #2a2017);
		border-radius: 2px;
		background: color-mix(in srgb, var(--tint) 16%, rgb(240 231 210 / 0.97));
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

	.head {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin: -0.45rem -0.65rem 0.05rem;
		padding: 0.25rem 0.4rem 0.25rem 0.65rem;
		background: var(--tint);
		color: var(--tint-ink);
	}

	.head strong {
		margin-right: auto;
		padding-right: 0.6rem;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 400;
	}

	/* Cubes keep their piece colours, so they sit on a scrap of paper whatever the band's colour. */
	.counts {
		display: flex;
		gap: 0.45rem;
		padding: 0.1rem 0.35rem;
		border-radius: 2px;
		background: rgb(240 231 210 / 0.95);
		color: var(--slip-ink);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.counts > span {
		display: flex;
		align-items: center;
		gap: 0.18rem;
	}

	.counts > .bad {
		color: #a3301c;
	}

	.hint dl {
		display: grid;
		grid-template-columns: max-content auto;
		gap: 0.08rem 0.9rem;
		margin: 0;
	}

	.hint dt {
		color: rgb(42 32 23 / 0.75);
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
