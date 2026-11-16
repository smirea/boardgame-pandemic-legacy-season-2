<script lang="ts">
	import { T } from '@threlte/core';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import type { BoardPoint } from './projection';
	import { CITY_TOP } from './routes';
	import type { PawnView, Travel } from './types';
	import Vehicle from './Vehicle.svelte';

	type Props = { pawn: PawnView; slot: number; at: BoardPoint };

	let { pawn, slot, at }: Props = $props();

	// Pieces are drawn larger than life so a move reads at the whole-map view.
	const PAWN_SCALE = 2.2;
	const VEHICLE_SCALE = 3.2;

	const target = $derived.by(() => {
		const angle = -Math.PI / 2 + slot * (Math.PI / 2);
		return { x: at.x + Math.cos(angle) * 1.1, z: at.z + Math.sin(angle) * 1.1 };
	});

	// Each mode has its own way of crossing the board: a car keeps to the ground, a boat rides the water
	// and rocks, a plane climbs and banks. Long trips take longer, up to a cap so a turn never drags.
	const STYLE: Record<Travel, { lift: (distance: number) => number; duration: (distance: number) => number }> = {
		land: { lift: () => 0.25, duration: distance => Math.min(1500, 520 + distance * 22) },
		sea: { lift: () => 0, duration: distance => Math.min(1900, 700 + distance * 20) },
		air: {
			lift: distance => Math.min(10, 2.5 + distance * 0.16),
			duration: distance => Math.min(1800, 800 + distance * 11),
		},
	};

	let from = untrack(() => ({ ...target }));
	let to = untrack(() => ({ ...target }));
	let mode = $state<Travel>(untrack(() => pawn.travel));
	// A shuffle between slots in the same city is a step, not a trip, so it gets no vehicle.
	let trip = $state(false);
	const travel = new Tween(1, { easing: cubicInOut });
	$effect(() => {
		const next = target;
		const kind = pawn.travel;
		untrack(() => {
			if (next.x === to.x && next.z === to.z) return;
			const t = travel.current;
			from = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
			to = { ...next };
			const distance = Math.hypot(to.x - from.x, to.z - from.z);
			trip = distance > 3;
			mode = kind;
			void travel.set(0, { duration: 0 });
			void travel.set(1, { duration: trip ? STYLE[kind].duration(distance) : 300 });
		});
	});

	const distance = $derived(Math.hypot(to.x - from.x, to.z - from.z));
	const heading = $derived(Math.atan2(-(to.z - from.z), to.x - from.x));
	// 0 at either end of the trip and 1 for most of it: how far the pawn has turned into its vehicle.
	const morph = $derived(trip ? Math.min(1, Math.min(travel.current, 1 - travel.current) / 0.14) : 0);
	const position = $derived.by(() => {
		const t = travel.current;
		const lift = trip ? STYLE[mode].lift(distance) : 0.4;
		const bob = trip && mode === 'sea' ? Math.sin(t * Math.PI * 10) * 0.12 : 0;
		const base = trip && mode === 'sea' ? CITY_TOP - 0.45 : CITY_TOP;
		return [from.x + (to.x - from.x) * t, base + Math.sin(Math.PI * t) * lift + bob, from.z + (to.z - from.z) * t] as [
			number,
			number,
			number,
		];
	});
	// A plane noses up as it climbs and down as it lands; a boat rolls with the swell.
	const pitch = $derived(trip && mode === 'air' ? Math.cos(Math.PI * travel.current) * 0.35 : 0);
	const roll = $derived(trip && mode === 'sea' ? Math.sin(travel.current * Math.PI * 7) * 0.12 : 0);
</script>

<T.Group {position}>
	{#if morph < 1}
		<T.Group scale={Math.max(0.001, 1 - morph) * PAWN_SCALE}>
			<T.Mesh position.y={0.6} castShadow>
				<T.ConeGeometry args={[0.46, 1.2, 20]} />
				<T.MeshStandardMaterial
					color={pawn.color}
					roughness={0.55}
					emissive={pawn.color}
					emissiveIntensity={pawn.active ? 0.35 : 0}
				/>
			</T.Mesh>
			<T.Mesh position.y={1.36} castShadow>
				<T.SphereGeometry args={[0.33, 20, 16]} />
				<T.MeshStandardMaterial
					color={pawn.color}
					roughness={0.55}
					emissive={pawn.color}
					emissiveIntensity={pawn.active ? 0.35 : 0}
				/>
			</T.Mesh>
			{#if pawn.active}
				<T.Mesh position.y={0.04} rotation.x={-Math.PI / 2}>
					<T.RingGeometry args={[0.62, 0.78, 32]} />
					<T.MeshBasicMaterial color="#2a2017" transparent opacity={0.8} />
				</T.Mesh>
			{/if}
		</T.Group>
	{/if}
	{#if morph > 0}
		<T.Group rotation.y={heading} scale={Math.max(0.001, morph) * VEHICLE_SCALE}>
			<T.Group rotation.z={pitch} rotation.x={roll}>
				<Vehicle kind={mode} color={pawn.color} />
			</T.Group>
		</T.Group>
	{/if}
</T.Group>
