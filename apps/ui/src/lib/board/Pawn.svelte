<script lang="ts">
	import { T } from '@threlte/core';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { HTML } from '@threlte/extras';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Spring, Tween } from 'svelte/motion';
	import type { BoardPoint } from './projection';
	import { CITY_TOP } from './routes';
	import { along, follows } from './travel';
	import type { PawnView, Travel } from './types';
	import Vehicle from './Vehicle.svelte';

	/** `slot` is this pawn's place among the `of` pawns in its city. */
	type Props = { pawn: PawnView; slot: number; of: number; at: BoardPoint; onpick: () => void };

	let { pawn, slot, of, at, onpick }: Props = $props();

	// The city's hover boxes stand in front of a pawn and take the pointer first, so a pawn that can be picked is
	// clicked through a button over it. It stops `pointerdown` natively, before the camera controls capture the pointer.
	const keepFromCamera = (node: HTMLElement) => {
		const stop = (event: PointerEvent) => event.stopPropagation();
		node.addEventListener('pointerdown', stop);
		return () => node.removeEventListener('pointerdown', stop);
	};

	// Pieces are drawn larger than life so a move reads at the whole-map view. A crowd of three or more stands
	// a little smaller, so every head stays clear of its neighbours'.
	const VEHICLE_SCALE = 3.2;
	const PAWN_SCALE = $derived(of >= 3 ? 1.85 : 2.2);
	// A little wider than a pawn's base, so no two overlap.
	const SPACING = $derived(PAWN_SCALE * 0.46 * 2 + 0.15);

	const target = $derived.by(() => {
		// Pawns stand in a row along the back of the disc, so the population printed on its face stays in view.
		// The row bows backwards at its ends, so the camera, looking north, sees each pawn beside the next.
		const offset = slot - (of - 1) / 2;
		return { x: at.x + offset * SPACING, z: at.z - 1.25 - 0.22 * offset * offset };
	});

	// A lit pawn rises and swells, with a halo at its feet, so the eye finds it from the seat card.
	const glow = new Spring(0, { stiffness: 0.18, damping: 0.5 });
	$effect(() => {
		glow.target = pawn.lit ? 1 : 0;
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
	// The city the pawn stood in, where a course it follows must start.
	let home = untrack(() => ({ ...at }));
	let mode = $state<Travel>(untrack(() => pawn.travel));
	// A shuffle between slots in the same city is a step, not a trip, so it gets no vehicle.
	let trip = $state(false);
	// A drive or a sailing keeps to the route it used; the pawn's slot offset fades from one end to the other.
	let route = $state.raw<{ path: ReturnType<typeof along>; start: BoardPoint; end: BoardPoint } | null>(null);
	const travel = new Tween(1, { easing: cubicInOut });
	$effect(() => {
		const next = target;
		const kind = pawn.travel;
		const course = pawn.course;
		untrack(() => {
			if (next.x === to.x && next.z === to.z) return;
			const t = travel.current;
			from = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
			to = { ...next };
			const followed = follows(course, home, at);
			home = { ...at };
			route = followed
				? {
						path: along(course),
						start: { x: from.x - course[0]!.x, z: from.z - course[0]!.z },
						end: { x: to.x - course.at(-1)!.x, z: to.z - course.at(-1)!.z },
					}
				: null;
			const distance = route ? route.path.total : Math.hypot(to.x - from.x, to.z - from.z);
			trip = distance > 3;
			mode = kind;
			void travel.set(0, { duration: 0 });
			void travel.set(1, { duration: trip ? STYLE[kind].duration(distance) : 300 });
		});
	});

	const distance = $derived(route ? route.path.total : Math.hypot(to.x - from.x, to.z - from.z));
	const ground = $derived.by(() => {
		const t = travel.current;
		if (!route)
			return {
				x: from.x + (to.x - from.x) * t,
				z: from.z + (to.z - from.z) * t,
				heading: Math.atan2(-(to.z - from.z), to.x - from.x),
			};
		const point = route.path.at(t);
		return {
			x: point.x + route.start.x + (route.end.x - route.start.x) * t,
			z: point.z + route.start.z + (route.end.z - route.start.z) * t,
			heading: point.heading,
		};
	});
	// 0 at either end of the trip and 1 for most of it: how far the pawn has turned into its vehicle.
	const morph = $derived(trip ? Math.min(1, Math.min(travel.current, 1 - travel.current) / 0.14) : 0);
	const position = $derived.by(() => {
		const t = travel.current;
		const lift = trip ? STYLE[mode].lift(distance) : 0.4;
		const raised = glow.current * 0.9;
		const bob = trip && mode === 'sea' ? Math.sin(t * Math.PI * 10) * 0.12 : 0;
		const base = trip && mode === 'sea' ? CITY_TOP - 0.45 : CITY_TOP;
		return [ground.x, base + raised + Math.sin(Math.PI * t) * lift + bob, ground.z] as [number, number, number];
	});
	// A plane noses up as it climbs and down as it lands; a boat rolls with the swell.
	const pitch = $derived(trip && mode === 'air' ? Math.cos(Math.PI * travel.current) * 0.35 : 0);
	const roll = $derived(trip && mode === 'sea' ? Math.sin(travel.current * Math.PI * 7) * 0.12 : 0);
</script>

<T.Group {position}>
	{#if morph < 1}
		<T.Group scale={Math.max(0.001, 1 - morph) * PAWN_SCALE * (1 + glow.current * 0.25)}>
			<T.Mesh position.y={0.6} castShadow>
				<T.ConeGeometry args={[0.46, 1.2, 20]} />
				<T.MeshStandardMaterial
					color={pawn.color}
					roughness={0.55}
					emissive={pawn.color}
					emissiveIntensity={Math.max(pawn.active ? 0.35 : 0, glow.current * 0.7)}
				/>
			</T.Mesh>
			<!-- A mark over the pawn's body, as each city keeps one over its disc, so a script can find it. -->
			<HTML center position.y={0.75} pointerEvents={pawn.pickable ? 'auto' : 'none'} zIndexRange={[2, 1]}>
				{#if pawn.pickable}
					<button
						class="anchor pick"
						data-pawn={pawn.id}
						data-carrier={pawn.carrier ? 'true' : undefined}
						aria-label={`Pick ${pawn.name}`}
						title={pawn.name}
						onclick={onpick}
						{@attach keepFromCamera}
						{@attach feedback(pawn.name, () => ({
							id: pawn.id,
							city: pawn.city,
							pickable: true,
							carrier: pawn.carrier,
						}))}
					></button>
				{:else}
					<span
						class="anchor"
						data-pawn={pawn.id}
						data-carrier={pawn.carrier ? 'true' : undefined}
						aria-hidden="true"
						{@attach feedback(pawn.name, () => ({
							id: pawn.id,
							city: pawn.city,
							lit: pawn.lit,
							carrier: pawn.carrier,
						}))}
					></span>
				{/if}
			</HTML>
			<T.Mesh position.y={1.36} castShadow>
				<T.SphereGeometry args={[0.33, 20, 16]} />
				<T.MeshStandardMaterial
					color={pawn.color}
					roughness={0.55}
					emissive={pawn.color}
					emissiveIntensity={Math.max(pawn.active ? 0.35 : 0, glow.current * 0.7)}
				/>
			</T.Mesh>
			{#if pawn.carrier}
				<T.Mesh position.y={0.95} rotation.x={Math.PI / 2}>
					<T.TorusGeometry args={[0.33, 0.065, 12, 28]} />
					<T.MeshStandardMaterial color="#4be3b5" emissive="#2fd9a4" emissiveIntensity={0.85} roughness={0.3} />
				</T.Mesh>
				<T.Mesh position.y={0.05} rotation.x={-Math.PI / 2}>
					<T.RingGeometry args={[0.8, 0.96, 36]} />
					<T.MeshBasicMaterial color="#4be3b5" transparent opacity={0.88} depthWrite={false} />
				</T.Mesh>
			{/if}
			{#if glow.current > 0.01}
				<T.Mesh
					position.y={0.04 - (glow.current * 0.9) / (PAWN_SCALE * (1 + glow.current * 0.25))}
					rotation.x={-Math.PI / 2}
				>
					<T.RingGeometry args={[0.7, 1.15, 40]} />
					<T.MeshBasicMaterial color={pawn.color} transparent opacity={glow.current * 0.85} depthWrite={false} />
				</T.Mesh>
			{/if}
			{#if pawn.active}
				<T.Mesh position.y={0.04} rotation.x={-Math.PI / 2}>
					<T.RingGeometry args={[0.62, 0.78, 32]} />
					<T.MeshBasicMaterial color="#2a2017" transparent opacity={0.8} />
				</T.Mesh>
			{/if}
		</T.Group>
	{/if}
	{#if morph > 0}
		<T.Group rotation.y={ground.heading} scale={Math.max(0.001, morph) * VEHICLE_SCALE}>
			<T.Group rotation.z={pitch} rotation.x={roll}>
				<Vehicle kind={mode} color={pawn.color} />
			</T.Group>
		</T.Group>
	{/if}
</T.Group>

<style>
	.anchor {
		display: block;
		width: 2px;
		height: 2px;
		pointer-events: none;
	}

	.pick {
		width: 1.6rem;
		height: 2.2rem;
		padding: 0;
		border: 0;
		border-radius: 0.8rem;
		background: none;
		cursor: pointer;
		pointer-events: auto;
	}
</style>
