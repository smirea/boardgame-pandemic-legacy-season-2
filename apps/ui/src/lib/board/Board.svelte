<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { cityDef } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { Canvas } from '@threlte/core';
	import { untrack } from 'svelte';
	import { NoToneMapping, WebGLRenderer } from 'three';
	import { inkOn } from '#lib/color.ts';
	import ActionIcon from '#lib/hud/ActionIcon.svelte';
	import type { Rich } from '#lib/hud/rich.ts';
	import RichText from '#lib/hud/RichText.svelte';
	import type { Action } from '@repo/game';
	import { CITY_COLOR } from './CityMarker.svelte';
	import Glyph from './Glyph.svelte';
	import { partHint, partKey, stockpileHint } from './hints';
	import type { Part } from './hints';
	import type { Placement } from './labels';
	import type { BoardPoint } from './projection';
	import Scene from './Scene.svelte';
	import type { BoardView, Covered, CursorTool } from './types';
	import type { CameraPose } from '#lib/studio/scene.ts';

	// The feedback editor and the studio's capture redraw the page, and a WebGL canvas reads blank once its frame is
	// presented. The board draws only when something changes, so keeping the buffer costs little.
	const createRenderer = (canvas: HTMLCanvasElement) =>
		new WebGLRenderer({
			canvas,
			powerPreference: 'high-performance',
			antialias: true,
			alpha: true,
			preserveDrawingBuffer: true,
		});

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		onrecon?: (route: string) => void;
		/** A right click on a city, which takes back what a click put there. */
		oncityback?: (city: CityId) => void;
		onpointer?: (point: BoardPoint | null) => void;
		tool?: CursorTool | null;
		ondrawstart?: (point: BoardPoint) => void;
		ondrawmove?: (point: BoardPoint) => void;
		ondrawend?: () => void;
		onerasestart?: (point: BoardPoint, radius: number) => void;
		onerasemove?: (point: BoardPoint, radius: number) => void;
		oneraseend?: () => void;
		resetView?: number;
		covered?: Covered[];
		focus?: { city: CityId; x: number; y: number; glide?: number; zoom?: number } | null;
		/** Actions offered round a city, each starting one kind of action. */
		ring?: { city: CityId; entries: { key: Action['a']; label: string; detail: Rich | string }[] } | null;
		onring?: (key: Action['a']) => void;
		/** A right click away from a city, which puts down whatever was half-chosen. True when something was. */
		oncancel?: () => boolean;
		/** A click on the board that landed on no city. */
		onmiss?: () => void;
		/** A click on a pawn that can be picked. */
		onpawn?: (id: string) => void;
	};

	let {
		view,
		oncity,
		onrecon,
		oncityback,
		onpointer,
		tool = null,
		ondrawstart,
		ondrawmove,
		ondrawend,
		onerasestart,
		onerasemove,
		oneraseend,
		resetView,
		covered,
		focus,
		ring,
		onring,
		oncancel,
		onmiss,
		onpawn,
	}: Props = $props();

	let element = $state<HTMLElement>();
	let scene = $state<Scene>();
	let lastClient: { x: number; y: number } | null = null;
	let toolDown = false;
	let eraserAt = $state.raw<{ x: number; z: number; radius: number } | null>(null);

	export const camera = () => scene?.pose() ?? null;
	export const cameraNow = () => scene?.where() ?? null;
	export const pointerBoardPoint = () => (lastClient ? (scene?.boardPoint(lastClient.x, lastClient.y) ?? null) : null);

	$effect(() => {
		const active = tool;
		untrack(() => {
			if (active !== null) hovered = null;
			if (active === 'eraser' && lastClient && scene) {
				const pt = scene.boardPoint(lastClient.x, lastClient.y);
				eraserAt = pt ? { ...pt, radius: scene.eraserRadius() } : null;
			} else {
				eraserAt = null;
			}
			if (active === null && toolDown) {
				toolDown = false;
				ondrawend?.();
				oneraseend?.();
			}
		});
	});

	function onToolDown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
		lastClient = { x: event.clientX, y: event.clientY };
		if (event.button !== 0 || !tool) return;
		event.preventDefault();
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		toolDown = true;
		const pt = scene?.boardPoint(event.clientX, event.clientY) ?? null;
		onpointer?.(pt);
		if (!pt) return;
		if (tool === 'pen') {
			ondrawstart?.(pt);
		} else {
			const radius = scene?.eraserRadius() ?? 2.4;
			eraserAt = { ...pt, radius };
			onerasestart?.(pt, radius);
		}
	}

	function onToolMove(event: PointerEvent) {
		lastClient = { x: event.clientX, y: event.clientY };
		const pt = scene?.boardPoint(event.clientX, event.clientY) ?? null;
		onpointer?.(pt);
		if (tool === 'eraser') {
			eraserAt = pt ? { ...pt, radius: scene?.eraserRadius() ?? 2.4 } : null;
		}
		if (!toolDown || !pt || !tool) return;
		if (tool === 'pen') {
			ondrawmove?.(pt);
		} else {
			onerasemove?.(pt, scene?.eraserRadius() ?? 2.4);
		}
	}

	function onToolUp() {
		if (!toolDown) return;
		toolDown = false;
		if (tool === 'pen') ondrawend?.();
		else if (tool === 'eraser') oneraseend?.();
	}
	// The scene mounts a moment after the board, so a pose set before then waits here.
	let wanted: { pose: CameraPose | null } | null = null;
	export function setCamera(pose: CameraPose | null) {
		if (scene) scene.setPose(pose);
		else wanted = { pose };
	}
	$effect(() => {
		if (scene && wanted) scene.setPose(wanted.pose);
		wanted = null;
	});
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
		const up = y > height - 200 ? true : y < 200 ? false : (name?.z ?? 0) > 0;
		// Over a city with its ring open, the slip keeps to the side the ring left free.
		if (ringAt && hovered?.city === ring?.city) return { left: !ringAt.left, up };
		const left = x > width - 260 ? true : x < 260 ? false : (name?.x ?? 0) > 1;
		return { left, up };
	});

	// The ring follows its city as the chart pans and zooms, read from the anchor each city keeps over its disc.
	// It opens on the side away from where the slip opened, so the city's details stay readable beside it.
	let ringAt = $state.raw<{ x: number; y: number; reach: number; left: boolean } | null>(null);
	$effect(() => {
		const city = ring?.city;
		if (!city || !element) return void (ringAt = null);
		const board = element;
		const left = untrack(() => {
			const width = board.clientWidth;
			const anchor = board.querySelector(`.anchor[data-city="${city}"]`)?.getBoundingClientRect();
			const x = anchor ? anchor.x + anchor.width / 2 - board.getBoundingClientRect().x : width / 2;
			if (x < 300) return false;
			if (x > width - 300) return true;
			return hovered?.city === city ? !side.left : x > width / 2;
		});
		let frame = 0;
		const follow = () => {
			const anchor = board.querySelector(`.anchor[data-city="${city}"]`)?.getBoundingClientRect();
			const box = board.getBoundingClientRect();
			if (anchor) {
				const next = {
					x: anchor.x + anchor.width / 2 - box.x,
					y: anchor.y + anchor.height / 2 - box.y,
					reach: Math.max(30, anchor.width * 0.36) + 14,
					left,
				};
				if (
					!ringAt ||
					Math.abs(ringAt.x - next.x) + Math.abs(ringAt.y - next.y) + Math.abs(ringAt.reach - next.reach) > 0.5
				)
					ringAt = next;
			}
			frame = requestAnimationFrame(follow);
		};
		follow();
		return () => cancelAnimationFrame(frame);
	});
	/** Each entry's place on an arc round the disc, the middle one furthest out. */
	const spots = $derived.by(() => {
		if (!ring || !ringAt) return [];
		const gap = 44;
		const count = ring.entries.length;
		const bend = Math.max(ringAt.reach, ((count - 1) / 2) * gap + 24);
		return ring.entries.map((entry, index) => {
			const dy = (index - (count - 1) / 2) * gap;
			const dx = Math.sqrt(Math.max(0, bend * bend - dy * dy)) - (bend - ringAt!.reach);
			return { entry, x: ringAt!.left ? -dx : dx, y: dy };
		});
	});
	let downAt = { x: 0, y: 0 };
	// Board pieces stop `pointerdown` natively, before the camera controls can capture the pointer (see AGENTS.md).
	const keepFromCamera = (node: HTMLElement) => {
		const stop = (event: PointerEvent) => event.stopPropagation();
		node.addEventListener('pointerdown', stop);
		return () => node.removeEventListener('pointerdown', stop);
	};
	const hint = $derived.by(() => {
		if (!hovered) return null;
		if (!hovered.city) return view.stockpile === null ? null : stockpileHint(view.stockpile, view.reserve);
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
	class:pen={tool === 'pen'}
	class:eraser={tool === 'eraser'}
	role="presentation"
	{@attach feedback(undefined, () => ({ hovered: hovered?.city ?? null }))}
	bind:this={element}
	oncontextmenu={event => {
		if (tool === 'pen') {
			event.preventDefault();
			return;
		}
		if (tool === 'eraser') {
			event.preventDefault();
			oncancel?.();
			return;
		}
		if (hovered?.city && oncityback) {
			event.preventDefault();
			oncityback(hovered.city);
		} else if (oncancel?.()) event.preventDefault();
	}}
	onpointerdown={event => (downAt = { x: event.clientX, y: event.clientY })}
	onpointermove={event => {
		lastClient = { x: event.clientX, y: event.clientY };
	}}
	onclick={event => {
		if (tool !== null) return;
		// A drag pans the chart, and a click on a city is the city's. Anything else on the board is a miss.
		const dragged = Math.abs(event.clientX - downAt.x) + Math.abs(event.clientY - downAt.y) > 6;
		if (!dragged && !hovered?.city && !(event.target as Element).closest('.ring')) onmiss?.();
	}}
	onpointerleave={() => {
		lastClient = null;
		eraserAt = null;
		onpointer?.(null);
		hovered = null;
	}}
>
	<Canvas toneMapping={NoToneMapping} {createRenderer}>
		<Scene
			bind:this={scene}
			{view}
			oncity={city => tool === null && oncity?.(city)}
			{onrecon}
			onpointer={point => tool === null && onpointer?.(point)}
			{tool}
			{eraserAt}
			{onhint}
			hoverCity={hovered?.city ?? null}
			{onstockpile}
			hoverStockpile={hovered !== null && hovered.city === null}
			{onpawn}
			{resetView}
			{covered}
			{focus}
		/>
	</Canvas>
	{#if tool !== null}
		<!-- Captures pen and eraser input above canvas, tall 3D pieces, and HTML board overlays. -->
		<div
			class="tool-capture"
			class:pen={tool === 'pen'}
			class:eraser={tool === 'eraser'}
			role="presentation"
			data-testid="board-tool-capture"
			data-tool={tool}
			onpointerdown={onToolDown}
			onpointermove={onToolMove}
			onpointerup={onToolUp}
			onpointercancel={onToolUp}
			onlostpointercapture={onToolUp}
		></div>
	{/if}
	{#if ring && ringAt}
		{#key ring.city}
			<div
				class="ring"
				class:left={ringAt.left}
				style:left={`${ringAt.x}px`}
				style:top={`${ringAt.y}px`}
				role="menu"
				aria-label="Actions here"
				data-testid="city-ring"
				data-city={ring.city}
				{@attach keepFromCamera}
				{@attach feedback('City actions', () => ({ city: ring?.city, entries: ring?.entries.map(entry => entry.key) }))}
			>
				{#each spots as spot, index (spot.entry.key)}
					<button
						role="menuitem"
						style:--x={`${spot.x}px`}
						style:--y={`${spot.y}px`}
						style:--i={index}
						data-action={spot.entry.key}
						onclick={() => onring?.(spot.entry.key)}
					>
						<ActionIcon action={spot.entry.key} size="2.1rem" />
						<span>
							<strong>{spot.entry.label}</strong>
							{#if spot.entry.detail.length}<small><RichText text={spot.entry.detail} /></small>{/if}
						</span>
					</button>
				{/each}
			</div>
		{/key}
	{/if}
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
						<dd class={row.tone ?? ''}><RichText text={row.value} /></dd>
					{/each}
				</dl>
			{/if}
			{#each hint.notes as note, index (index)}<p><RichText text={note} /></p>{/each}
		</div>
	{/if}
</div>

<style>
	.ring {
		position: absolute;
		z-index: 38;
		width: 0;
		height: 0;
	}

	.ring button {
		position: absolute;
		left: 0;
		top: 0;
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.18rem 0.65rem 0.18rem 0.18rem;
		border: 1px solid rgb(42 32 23 / 0.55);
		border-radius: 999px;
		background: rgb(240 231 210 / 0.97);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font: inherit;
		font-family: var(--font-ui);
		white-space: nowrap;
		cursor: pointer;
		translate: var(--x) calc(var(--y) - 50%);
		animation: open 260ms calc(var(--i) * 35ms) cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
		transition:
			background 140ms ease,
			scale 140ms ease;
	}

	.ring.left button {
		flex-direction: row-reverse;
		padding: 0.18rem 0.18rem 0.18rem 0.65rem;
		translate: calc(var(--x) - 100%) calc(var(--y) - 50%);
		text-align: right;
	}

	.ring button:hover {
		background: #fff8e6;
		scale: 1.05;
	}

	.ring button :global(.icon) {
		border-radius: 50%;
	}

	.ring span {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}

	.ring strong {
		font-size: 0.86rem;
		font-weight: 650;
	}

	.ring small {
		color: rgb(42 32 23 / 0.7);
		font-size: 0.7rem;
	}

	@keyframes open {
		from {
			opacity: 0;
			translate: 0 -50%;
			scale: 0.6;
		}
	}

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

	.tool-capture {
		position: absolute;
		inset: 0;
		z-index: 45;
		touch-action: none;
	}

	.board.pen,
	.board.pen :global(canvas),
	.tool-capture.pen {
		cursor:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23f5ecd8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath fill='%23221a12' d='M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'/%3E%3C/svg%3E")
				2 22,
			crosshair;
	}

	.board.eraser,
	.board.eraser :global(canvas),
	.tool-capture.eraser {
		cursor:
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23f5ecd8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='8' fill='%231a140e' fill-opacity='0.35'/%3E%3Cpath d='M9.5 14.5 14.5 9.5'/%3E%3C/svg%3E")
				12 12,
			cell;
	}

	/* A paper slip beside the pointer, tinted with the city's colour, its heading a band of that colour:
	   labels in one column, values in the next. */
	.hint {
		position: absolute;
		z-index: 52;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		width: max-content;
		max-width: 19.5rem;
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
