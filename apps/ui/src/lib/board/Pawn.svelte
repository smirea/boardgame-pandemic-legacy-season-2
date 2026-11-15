<script lang="ts">
	import { T } from '@threlte/core';
	import { untrack } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { CITY_TOP } from './routes';
	import type { BoardPoint } from './projection';
	import type { PawnView } from './types';

	type Props = { pawn: PawnView; slot: number; at: BoardPoint };

	let { pawn, slot, at }: Props = $props();

	const target = $derived.by(() => {
		const angle = -Math.PI / 2 + slot * (Math.PI / 2);
		return { x: at.x + Math.cos(angle) * 0.75, z: at.z + Math.sin(angle) * 0.75 };
	});
	const position = new Spring(
		untrack(() => ({ x: at.x, z: at.z })),
		{ stiffness: 0.07, damping: 0.45 },
	);
	$effect(() => {
		position.target = target;
	});
</script>

<T.Group position={[position.current.x, CITY_TOP, position.current.z]}>
	<T.Mesh position.y={0.55} castShadow>
		<T.ConeGeometry args={[0.42, 1.1, 20]} />
		<T.MeshStandardMaterial
			color={pawn.color}
			roughness={0.35}
			emissive={pawn.color}
			emissiveIntensity={pawn.active ? 0.5 : 0}
		/>
	</T.Mesh>
	<T.Mesh position.y={1.25} castShadow>
		<T.SphereGeometry args={[0.3, 20, 16]} />
		<T.MeshStandardMaterial
			color={pawn.color}
			roughness={0.35}
			emissive={pawn.color}
			emissiveIntensity={pawn.active ? 0.5 : 0}
		/>
	</T.Mesh>
</T.Group>
