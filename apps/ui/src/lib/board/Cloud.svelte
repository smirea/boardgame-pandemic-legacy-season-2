<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import type { BoardPoint } from './projection';

	type Props = { at: BoardPoint; seed: number };

	let { at, seed }: Props = $props();

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

<T.Group position={[at.x, 2.4 + Math.sin(bob * 0.5 + seed) * 0.25, at.z]} rotation.y={seed * 1.7}>
	{#each puffs as puff, index (index)}
		<T.Mesh position={[puff.x, 0, puff.z]} scale={[1, 0.55, 1]}>
			<T.SphereGeometry args={[puff.r, 16, 12]} />
			<T.MeshStandardMaterial color="#aab4bd" roughness={1} transparent opacity={0.9} />
		</T.Mesh>
	{/each}
</T.Group>
