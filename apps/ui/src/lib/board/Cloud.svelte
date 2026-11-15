<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import type { BoardPoint } from './projection';

	type Props = { at: BoardPoint; seed: number; hidden: boolean };

	let { at, seed, hidden }: Props = $props();

	// The cloud lifts and thins out when its region is revealed. Neighbouring clouds go one after another.
	const cover = new Tween(
		untrack(() => (hidden ? 1 : 0)),
		{ duration: 1100, easing: cubicInOut },
	);
	$effect(() => {
		void cover.set(hidden ? 1 : 0, { delay: hidden ? 0 : (seed % 9) * 90 });
	});

	let bob = $state(0);
	useTask(delta => {
		bob += delta;
	});
	const puffs = [
		{ x: 0, z: 0, r: 2.6 },
		{ x: 2.3, z: 0.8, r: 1.9 },
		{ x: -2.1, z: -0.7, r: 2.1 },
		{ x: 0.6, z: -1.9, r: 1.7 },
	];
</script>

{#if cover.current > 0.01}
	<T.Group
		position={[at.x, 2.4 + Math.sin(bob * 0.5 + seed) * 0.25 + (1 - cover.current) * 5, at.z]}
		rotation.y={seed * 1.7}
		scale={0.4 + cover.current * 0.6}
	>
		{#each puffs as puff, index (index)}
			<T.Mesh position={[puff.x, 0, puff.z]} scale={[1, 0.55, 1]}>
				<T.SphereGeometry args={[puff.r, 16, 12]} />
				<T.MeshStandardMaterial
					color="#aab4bd"
					roughness={1}
					transparent
					opacity={0.9 * cover.current}
					depthWrite={false}
				/>
			</T.Mesh>
		{/each}
	</T.Group>
{/if}
