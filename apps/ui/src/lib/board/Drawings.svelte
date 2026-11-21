<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
	import { CITY_TOP } from './routes';
	import type { DrawingView } from './types';

	let { drawings }: { drawings: DrawingView[] } = $props();

	const { invalidate } = useThrelte();
	const Y = CITY_TOP + 0.45;
	const RADIAL = 6;

	const rendered = $derived.by(() =>
		drawings.flatMap(entry =>
			entry.strokes.map(stroke => {
				if (stroke.points.length < 2) {
					const only = stroke.points[0];
					return { key: `${entry.id}:${stroke.id}`, color: entry.color, dot: only ?? null, tube: null, outline: null };
				}
				const curve = new CatmullRomCurve3(
					stroke.points.map(point => new Vector3(point.x, Y, point.z)),
					false,
					'centripetal',
				);
				const segments = Math.max(8, Math.min(240, Math.round(curve.getLength() * 2.5)));
				return {
					key: `${entry.id}:${stroke.id}`,
					color: entry.color,
					dot: null,
					tube: new TubeGeometry(curve, segments, 0.24, RADIAL),
					outline: new TubeGeometry(curve, segments, 0.34, RADIAL),
				};
			}),
		),
	);

	$effect(() => {
		void rendered;
		invalidate();
		return () => {
			for (const item of rendered) {
				item.tube?.dispose();
				item.outline?.dispose();
			}
		};
	});
</script>

{#each rendered as item (item.key)}
	{#if item.tube && item.outline}
		<T.Mesh geometry={item.outline} renderOrder={8}>
			<T.MeshBasicMaterial color="#1a140e" transparent opacity={0.45} depthWrite={false} />
		</T.Mesh>
		<T.Mesh geometry={item.tube} renderOrder={9}>
			<T.MeshBasicMaterial color={item.color} />
		</T.Mesh>
	{:else if item.dot}
		<T.Mesh position={[item.dot.x, Y, item.dot.z]} renderOrder={9}>
			<T.SphereGeometry args={[0.28, 10, 10]} />
			<T.MeshBasicMaterial color={item.color} />
		</T.Mesh>
	{/if}
{/each}
