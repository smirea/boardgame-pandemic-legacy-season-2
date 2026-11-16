<script lang="ts" module>
	import { DataTexture, NearestFilter, RepeatWrapping, RGBAFormat } from 'three';

	function dashTexture(dashes: number) {
		const texture = new DataTexture(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1, RGBAFormat);
		texture.wrapS = RepeatWrapping;
		texture.magFilter = NearestFilter;
		texture.repeat.set(dashes, 1);
		texture.needsUpdate = true;
		return texture;
	}
</script>

<script lang="ts">
	import type { EdgeDef } from '@repo/game';
	import { T } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { TubeGeometry } from 'three';
	import type { BoardPoint } from './projection';
	import { routeCurve } from './routes';

	type Props = { route: EdgeDef; from: BoardPoint; to: BoardPoint; ghost?: boolean; animate?: boolean };

	let { route, from, to, ghost = false, animate = false }: Props = $props();

	const RADIAL = 6;
	const curve = $derived(routeCurve(route, from, to));
	const segments = $derived(Math.max(16, Math.round(curve.getLength() * 2)));
	const tube = $derived(new TubeGeometry(curve, segments, ghost ? 0.09 : route.kind === 'sea' ? 0.16 : 0.2, RADIAL));
	const dashes = $derived(dashTexture(Math.max(3, Math.round(curve.getLength() / 1.6))));

	// A route that appears mid-game draws itself from its first city to its second.
	const drawn = new Tween(
		untrack(() => (animate ? 0 : 1)),
		{ duration: 1400, easing: cubicInOut },
	);
	$effect(() => {
		drawn.target = 1;
	});
	$effect(() => {
		tube.setDrawRange(0, Math.round(drawn.current * segments) * RADIAL * 6);
	});
</script>

<T.Mesh geometry={tube} castShadow={!ghost}>
	{#if ghost}
		<T.MeshBasicMaterial color="#3a2e22" alphaMap={dashes} alphaTest={0.5} transparent opacity={0.5} />
	{:else if route.kind === 'sea'}
		<T.MeshStandardMaterial color="#2d5873" roughness={0.8} alphaMap={dashes} alphaTest={0.5} />
	{:else}
		<T.MeshStandardMaterial color="#8e3a24" roughness={0.75} />
	{/if}
</T.Mesh>
