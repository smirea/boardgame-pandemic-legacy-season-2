<script lang="ts">
	import { T } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { cubeGeometries, cubeMaterials } from './models.svelte';

	/** Where supply cubes are struck off the board: splinters fly, two rings crack outward, and the loss is counted. */
	type Props = { at: { x: number; y: number; z: number }; count: number; delay: number; ondone: () => void };

	let { at, count, delay, ondone }: Props = $props();

	const SHARDS = 9;
	const shards = Array.from({ length: SHARDS }, (_, index) => {
		const turn = (index / SHARDS) * Math.PI * 2 + Math.random() * 0.5;
		const reach = 2.2 + Math.random() * 2.6;
		return {
			x: Math.cos(turn) * reach,
			z: Math.sin(turn) * reach,
			rise: 2 + Math.random() * 3,
			spin: Math.random() * 6,
		};
	});
	const progress = new Tween(0, { duration: 820, easing: cubicOut });
	// The count outlasts the splinters, so it can be read after the eye has found the city.
	const tally = new Tween(0, { duration: 1500 });
	let started = $state(false);
	let done = false;
	onMount(() => {
		const timer = setTimeout(() => {
			started = true;
			void progress.set(1);
			void tally.set(1).then(() => {
				done = true;
				ondone();
			});
		}, delay);
		return () => {
			clearTimeout(timer);
			if (!done) ondone();
		};
	});
	const k = $derived(progress.current);
	const c = $derived(tally.current);
</script>

{#if started && c < 1}
	<HTML position={[at.x, at.y + 2.2 + cubicOut(c) * 2.6, at.z]} center pointerEvents="none">
		<span class="lost" style:opacity={Math.min(1, (1 - c) * 3.4)} aria-hidden="true">−{count}</span>
	</HTML>
{/if}
{#if started && k < 1}
	{#each shards as shard, index (index)}
		<T.Mesh
			geometry={cubeGeometries.supply}
			material={cubeMaterials.supply}
			position={[at.x + shard.x * k, at.y + shard.rise * Math.sin(Math.PI * k) * (1 - k * 0.4), at.z + shard.z * k]}
			rotation={[shard.spin * k, shard.spin * k * 1.3, 0]}
			scale={0.55 * (1 - k * k)}
			dispose={false}
		/>
	{/each}
	{#each [0, 0.22] as lag (lag)}
		{@const ring = Math.max(0, (k - lag) / (1 - lag))}
		<T.Mesh position={[at.x, at.y + 0.2, at.z]} rotation.x={-Math.PI / 2} scale={0.3 + ring * 7}>
			<T.RingGeometry args={[0.86, 1, 40]} />
			<T.MeshBasicMaterial color="#c8361f" transparent opacity={(1 - ring) * 0.95} depthWrite={false} />
		</T.Mesh>
	{/each}
{/if}

<style>
	.lost {
		color: #d8331c;
		font-family: system-ui, sans-serif;
		font-size: 2.2rem;
		font-weight: 800;
		/* A paper edge all round, so it reads over land, sea and a city's disc alike. */
		text-shadow:
			0 0 3px #fff1dc,
			1px 1px 0 #fff1dc,
			-1px 1px 0 #fff1dc,
			1px -1px 0 #fff1dc,
			-1px -1px 0 #fff1dc,
			0 0.12em 0.3em rgb(0 0 0 / 0.5);
		white-space: nowrap;
	}
</style>
