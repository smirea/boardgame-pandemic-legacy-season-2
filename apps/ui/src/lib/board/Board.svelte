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
	};

	let { view, oncity, onpointer }: Props = $props();
</script>

<div class="board" role="presentation" onpointerleave={() => onpointer?.(null)}>
	<Canvas>
		<Scene {view} {oncity} {onpointer} />
	</Canvas>
</div>

<style>
	.board {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at 50% 35%, #1b2733 0%, #0a0f14 75%);
	}
</style>
