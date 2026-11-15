<script lang="ts">
	import type { CityId } from '@repo/game';
	import { Canvas } from '@threlte/core';
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
	<Canvas>
		<Scene {view} {oncity} {onpointer} {resetView} {covered} />
	</Canvas>
</div>

<style>
	.board {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: radial-gradient(ellipse at 50% 35%, #1b2733 0%, #0a0f14 75%);
	}
</style>
