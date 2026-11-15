<script lang="ts">
	import { T } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import type { BoardPoint } from './projection';
	import { CITY_TOP } from './routes';
	import type { PawnView } from './types';

	type Props = { pawn: PawnView; slot: number; at: BoardPoint };

	let { pawn, slot, at }: Props = $props();

	const target = $derived.by(() => {
		const angle = -Math.PI / 2 + slot * (Math.PI / 2);
		return { x: at.x + Math.cos(angle) * 0.85, z: at.z + Math.sin(angle) * 0.85 };
	});

	// A move is one hop from where the pawn stands to where it is going, higher for longer trips.
	let from = untrack(() => ({ ...target }));
	let to = untrack(() => ({ ...target }));
	const travel = new Tween(1, { easing: cubicInOut });
	$effect(() => {
		const next = target;
		untrack(() => {
			if (next.x === to.x && next.z === to.z) return;
			const t = travel.current;
			from = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
			to = { ...next };
			const distance = Math.hypot(to.x - from.x, to.z - from.z);
			void travel.set(0, { duration: 0 });
			void travel.set(1, { duration: Math.min(1400, 380 + distance * 14) });
		});
	});
	const position = $derived.by(() => {
		const t = travel.current;
		const distance = Math.hypot(to.x - from.x, to.z - from.z);
		const arc = Math.sin(Math.PI * t) * Math.min(9, 0.6 + distance * 0.16);
		return [from.x + (to.x - from.x) * t, CITY_TOP + arc, from.z + (to.z - from.z) * t] as [number, number, number];
	});
</script>

<T.Group {position}>
	<T.Mesh position.y={0.6} castShadow>
		<T.ConeGeometry args={[0.46, 1.2, 20]} />
		<T.MeshStandardMaterial
			color={pawn.color}
			roughness={0.35}
			emissive={pawn.color}
			emissiveIntensity={pawn.active ? 0.55 : 0.05}
		/>
	</T.Mesh>
	<T.Mesh position.y={1.36} castShadow>
		<T.SphereGeometry args={[0.33, 20, 16]} />
		<T.MeshStandardMaterial
			color={pawn.color}
			roughness={0.35}
			emissive={pawn.color}
			emissiveIntensity={pawn.active ? 0.55 : 0.05}
		/>
	</T.Mesh>
	{#if pawn.active}
		<T.Mesh position.y={0.04} rotation.x={-Math.PI / 2}>
			<T.RingGeometry args={[0.62, 0.78, 32]} />
			<T.MeshBasicMaterial color={pawn.color} transparent opacity={0.85} />
		</T.Mesh>
	{/if}
</T.Group>
