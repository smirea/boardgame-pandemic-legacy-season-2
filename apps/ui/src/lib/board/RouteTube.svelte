<script lang="ts" module>
	import { BackSide, DataTexture, NearestFilter, RepeatWrapping, RGBAFormat } from 'three';

	function dashTexture(dashes: number, total: number, start: number, end: number) {
		const data = new Uint8Array(total * 4);
		for (let i = 0; i < total; i++) {
			const v = i >= start && i < end ? 255 : 0;
			data[i * 4] = v;
			data[i * 4 + 1] = v;
			data[i * 4 + 2] = v;
			data[i * 4 + 3] = 255;
		}
		const texture = new DataTexture(data, total, 1, RGBAFormat);
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
	import { routeCurve } from './routes';

	type Props = { route: EdgeDef; ghost?: boolean; animate?: boolean };

	let { route, ghost = false, animate = false }: Props = $props();

	const RADIAL = 8;
	const curve = $derived(routeCurve(route));
	const segments = $derived(Math.max(16, Math.round(curve.getLength() * 2)));
	const dashCount = $derived(Math.max(3, Math.round(curve.getLength() / 1.6)));
	const tube = $derived(new TubeGeometry(curve, segments, ghost ? 0.09 : route.kind === 'sea' ? 0.16 : 0.2, RADIAL));
	const halo = $derived(!ghost && route.kind === 'sea' ? new TubeGeometry(curve, segments, 0.28, RADIAL) : null);
	const dashes = $derived(dashTexture(dashCount, 16, 1, 9));
	const haloDashes = $derived(halo ? dashTexture(dashCount, 16, 0, 10) : null);

	// A route that appears mid-game draws itself from its first city to its second.
	const drawn = new Tween(
		untrack(() => (animate ? 0 : 1)),
		{ duration: 1400, easing: cubicInOut },
	);
	$effect(() => {
		drawn.target = 1;
	});
	$effect(() => {
		const count = Math.round(drawn.current * segments) * RADIAL * 6;
		tube.setDrawRange(0, count);
		halo?.setDrawRange(0, count);
	});
</script>

{#if halo && haloDashes}
	<T.Mesh geometry={halo} renderOrder={1}>
		<T.MeshBasicMaterial
			color="#ffffff"
			side={BackSide}
			alphaMap={haloDashes}
			alphaTest={0.5}
			transparent
			opacity={0.62}
			depthWrite={false}
		/>
	</T.Mesh>
{/if}

<T.Mesh geometry={tube} renderOrder={2}>
	{#if ghost}
		<T.MeshBasicMaterial color="#3a2e22" alphaMap={dashes} alphaTest={0.5} transparent opacity={0.5} />
	{:else if route.kind === 'sea'}
		<T.MeshStandardMaterial color="#2d5873" roughness={0.8} alphaMap={dashes} alphaTest={0.5} />
	{:else}
		<T.MeshStandardMaterial color="#8e3a24" roughness={0.75} />
	{/if}
</T.Mesh>
