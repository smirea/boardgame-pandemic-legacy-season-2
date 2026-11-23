<script lang="ts">
	import { T } from '@threlte/core';
	import { onMount } from 'svelte';
	import { backOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import type { BoardPoint } from './projection';
	import { LAND_HEIGHT } from './projection';
	import { CITY_RADIUS } from './routes';

	type Props = { at: BoardPoint; color: string; faint?: boolean };

	let { at, color, faint = false }: Props = $props();

	// The ring closes in on its city from wide, so the eye is pulled to where the step happened.
	const close = new Tween(0, { duration: 650, easing: backOut });
	onMount(() => void close.set(1));
	const scale = $derived(3.2 - close.current * 2.2);
</script>

<T.Group position={[at.x, LAND_HEIGHT + 0.08, at.z]} rotation.x={-Math.PI / 2} {scale}>
	{#if !faint}
		<T.Mesh>
			<T.CircleGeometry args={[CITY_RADIUS * 2.4, 48]} />
			<T.MeshBasicMaterial {color} transparent opacity={Math.min(1, close.current) * 0.22} depthWrite={false} />
		</T.Mesh>
	{/if}
	<T.Mesh position.z={0.01}>
		<T.RingGeometry args={[CITY_RADIUS * (faint ? 2.1 : 1.9), CITY_RADIUS * 2.4, 48]} />
		<T.MeshBasicMaterial
			{color}
			transparent
			opacity={Math.min(1, close.current) * (faint ? 0.6 : 1)}
			depthWrite={false}
		/>
	</T.Mesh>
</T.Group>
