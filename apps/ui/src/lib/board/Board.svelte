<script lang="ts">
	import type { CityId } from '@repo/game';
	import { Canvas } from '@threlte/core';
	import { NoToneMapping } from 'three';
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
</script>

<div class="board" role="presentation" onpointerleave={() => onpointer?.(null)}>
	<Canvas toneMapping={NoToneMapping}>
		<Scene {view} {oncity} {onpointer} {resetView} {covered} />
	</Canvas>
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
</style>
