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
	import type { RouteDef } from '@repo/game';
	import { T } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { TubeGeometry } from 'three';
	import type { BoardPoint } from './projection';
	import { routeCurve } from './routes';

	type Props = { route: RouteDef; from: BoardPoint; to: BoardPoint; established: boolean };

	let { route, from, to, established }: Props = $props();

	const RADIAL = 6;
	const curve = $derived(routeCurve(route, from, to));
	const segments = $derived(Math.max(16, Math.round(curve.getLength() * 2)));
	const solid = $derived(new TubeGeometry(curve, segments, route.kind === 'sea' ? 0.13 : 0.19, RADIAL));
	const ghost = $derived(new TubeGeometry(curve, segments, 0.07, RADIAL));
	const dashes = $derived(dashTexture(Math.max(3, Math.round(curve.getLength() / 1.6))));

	const drawn = new Tween(
		untrack(() => (established ? 1 : 0)),
		{ duration: 1100, easing: cubicInOut },
	);
	$effect(() => {
		drawn.target = established ? 1 : 0;
	});
	$effect(() => {
		solid.setDrawRange(0, Math.round(drawn.current * segments) * RADIAL * 6);
	});
</script>

{#if drawn.current < 1}
	<T.Mesh geometry={ghost}>
		<T.MeshBasicMaterial color="#e8eef2" alphaMap={dashes} alphaTest={0.5} transparent opacity={0.45} />
	</T.Mesh>
{/if}
{#if drawn.current > 0}
	<T.Mesh geometry={solid} castShadow>
		{#if route.kind === 'sea'}
			<T.MeshStandardMaterial
				color="#9ad7f5"
				emissive="#2a7fa8"
				emissiveIntensity={0.6}
				alphaMap={dashes}
				alphaTest={0.5}
			/>
		{:else}
			<T.MeshStandardMaterial color="#f2c178" emissive="#8a5a1c" emissiveIntensity={0.35} roughness={0.5} />
		{/if}
	</T.Mesh>
{/if}
