<script lang="ts" module>
	import type { Color } from '@repo/game';

	export const CITY_COLOR: Record<Color | 'haven', string> = {
		blue: '#2f64a3',
		yellow: '#d9a128',
		black: '#3a3632',
		red: '#bc3f27',
		haven: '#2f8f74',
	};
</script>

<script lang="ts">
	import type { CityDef } from '@repo/game';
	import { T } from '@threlte/core';
	import type { IntersectionEvent } from '@threlte/extras';
	import { HTML, useCursor } from '@threlte/extras';
	import { onMount } from 'svelte';
	import { Spring, Tween } from 'svelte/motion';
	import { inkOn } from '#lib/color.ts';
	import type { Part } from './hints';
	import { DISC_REACH, NAME_SIZE } from './labels';
	import type { Placement } from './labels';
	import Pop from './Pop.svelte';
	import { fonts, printDisc, printName, printSticker } from './print.svelte';
	import Printed from './Printed.svelte';
	import type { BoardPoint } from './projection';
	import { LAND_HEIGHT } from './projection';
	import { CITY_RADIUS, CITY_TOP } from './routes';
	import type { CityView } from './types';

	type Props = {
		city: CityDef;
		at: BoardPoint;
		state: CityView;
		placement: Placement;
		/** Under the pointer, so its printed name lights up. */
		lit: boolean;
		onselect: () => void;
		/** A pointer over one of the city's parts, or off it when `event` is null. */
		onhint: (part: Part, event: PointerEvent | null) => void;
	};

	let { city, at, state, placement, lit, onselect, onhint }: Props = $props();

	// Every piece has its own place around the disc, so a glance tells what stands where.
	const SPOT = {
		center: [2.9, -2.5],
		tower: [-2.9, -2.5],
		shelter: [-2.9, 2.7],
		lab: [3.1, 2.8],
	} as const;
	const DISC = CITY_TOP - LAND_HEIGHT;

	const color = $derived(state.forsaken ? '#8d8476' : CITY_COLOR[city.color ?? 'haven']);
	const { hovering, onPointerEnter, onPointerLeave } = useCursor();
	// Starting small makes a city rise out of the board when its region is revealed.
	const scale = new Spring(0.05, { stiffness: 0.12, damping: 0.42 });
	$effect(() => {
		scale.target = $hovering ? 1.12 : state.highlight === 'target' ? 1.08 : 1;
	});
	// A name is inked in after its city appears.
	const ink = new Tween(0, { duration: 700 });
	onMount(() => {
		const timer = setTimeout(() => (ink.target = 1), 250);
		return () => clearTimeout(timer);
	});
	// Prints lie just above the fog's lowest sheet, so a name running out over unexplored sea stays legible.
	const INK = 0.2;

	const name = $derived(fonts.ready ? printName(state.name, city.port, NAME_SIZE, !state.onGrid, lit) : null);
	// A name that stands off from its city is tied back to the disc by a fine ruled line.
	const leader = $derived.by(() => {
		if (!placement.leader || !name) return null;
		const halfWidth = name.width / 2 - NAME_SIZE * 0.3;
		const halfHeight = NAME_SIZE * 0.45;
		const toX = Math.max(placement.x - halfWidth, Math.min(0, placement.x + halfWidth));
		const toZ = Math.max(placement.z - halfHeight, Math.min(0, placement.z + halfHeight));
		const distance = Math.hypot(toX, toZ);
		const length = distance - DISC_REACH - 0.2;
		if (length <= 0.4) return null;
		const ux = toX / distance;
		const uz = toZ / distance;
		const mid = DISC_REACH + length / 2;
		return { x: ux * mid, z: uz * mid, length, angle: Math.atan2(-uz, ux) };
	});
	const face = $derived(fonts.ready ? printDisc(state.population, 2.8, inkOn(color)) : null);
	const permanent = $derived(state.structures.filter(structure => structure.permanent));
	const stickers = $derived(
		fonts.ready
			? [
					...permanent.map(structure => ({
						part: { structure: structure.kind, permanent: true },
						kind: structure.kind,
					})),
					...(state.lab ? [{ part: 'lab' as const, kind: 'lab' as const }] : []),
				].map(entry => ({ ...entry, print: printSticker(entry.kind, 2.1) }))
			: [],
	);
	const built = (kind: 'center' | 'tower' | 'shelter') =>
		state.structures.some(structure => structure.kind === kind && !structure.permanent);

	// Supply cubes stand in a block under the supply center's place, rising in layers as they pile up.
	const SUPPLY = { size: 0.7, slot: 0.86, columns: 2, rows: 3 };
	const supplies = $derived(
		Array.from({ length: Math.min(state.supplies, 18) }, (_, index) => {
			const perLayer = SUPPLY.columns * SUPPLY.rows;
			const layer = Math.floor(index / perLayer);
			const inLayer = index % perLayer;
			return {
				x: CITY_RADIUS + 0.75 + (inLayer % SUPPLY.columns) * SUPPLY.slot,
				y: SUPPLY.size / 2 + layer * SUPPLY.slot,
				z: -0.85 + Math.floor(inLayer / SUPPLY.columns) * SUPPLY.slot,
			};
		}),
	);
	const PLAGUE = { size: 1, slot: 1.12 };
	const plague = $derived(
		Array.from({ length: state.plague }, (_, index) => ({
			x: -CITY_RADIUS - 0.85 - (index % 2) * PLAGUE.slot,
			y: PLAGUE.size / 2 + Math.floor(index / 4) * PLAGUE.slot,
			z: -0.5 + (Math.floor(index / 2) % 2) * PLAGUE.slot,
		})),
	);
	const figures = $derived(
		Array.from({ length: state.hollow }, (_, index) => ({
			x: (index - (state.hollow - 1) / 2) * 1.2,
			z: CITY_RADIUS + 1.2,
		})),
	);

	/**
	 * Pointer handlers that explain one part of the city while the pointer is over it. A part made of many
	 * pieces gets one box around them that draws nothing, so moving between its pieces never drops the hint.
	 */
	const explain = (part: Part) => ({
		onpointerenter: (event: IntersectionEvent<PointerEvent>) => {
			event.stopPropagation();
			onhint(part, event.nativeEvent);
		},
		onpointermove: (event: IntersectionEvent<PointerEvent>) => {
			event.stopPropagation();
			onhint(part, event.nativeEvent);
		},
		onpointerleave: () => onhint(part, null),
	});
</script>

<T.Group position={[at.x, LAND_HEIGHT, at.z]}>
	{#if name}
		<Printed print={name} position={[placement.x, INK, placement.z]} opacity={ink.current} order={4} />
		{#if leader}
			<T.Mesh position={[leader.x, INK, leader.z]} rotation={[-Math.PI / 2, 0, leader.angle]} renderOrder={4}>
				<T.PlaneGeometry args={[leader.length, 0.13]} />
				<T.MeshBasicMaterial
					color={lit ? '#8e2a12' : '#2a2017'}
					transparent
					opacity={ink.current * (lit ? 0.95 : 0.7)}
					depthWrite={false}
				/>
			</T.Mesh>
		{/if}
	{/if}

	<T.Group scale={scale.current}>
		<T.Mesh
			position.y={DISC / 2}
			castShadow
			receiveShadow
			onclick={event => {
				event.stopPropagation();
				onselect();
			}}
			onpointerenter={event => {
				onPointerEnter();
				explain('city').onpointerenter(event);
			}}
			onpointermove={explain('city').onpointermove}
			onpointerleave={() => {
				onPointerLeave();
				onhint('city', null);
			}}
		>
			<T.CylinderGeometry args={[CITY_RADIUS, CITY_RADIUS * 1.08, DISC, city.kind === 'haven' ? 6 : 32]} />
			<T.MeshStandardMaterial
				{color}
				roughness={0.7}
				metalness={0}
				opacity={state.onGrid ? 1 : 0.5}
				transparent={!state.onGrid}
			/>
		</T.Mesh>
		<T.Mesh position.y={DISC + 0.02} rotation.x={-Math.PI / 2}>
			<!-- A ring's corners start on its x axis and a cylinder's on its z axis, so a haven's ring turns a quarter to match its hex. -->
			<T.RingGeometry args={[CITY_RADIUS * 0.8, CITY_RADIUS * 0.88, city.kind === 'haven' ? 6 : 32, 1, Math.PI / 2]} />
			<T.MeshBasicMaterial
				color={state.infested ? '#b79ad6' : '#efe6d2'}
				transparent
				opacity={state.onGrid ? 0.9 : 0.45}
			/>
		</T.Mesh>
		{#if face}
			<Printed print={face} position={[0, DISC + 0.03, 0]} opacity={state.onGrid ? 1 : 0.6} order={6} />
		{/if}
		{#if state.highlight}
			<T.Mesh position.y={0.06} rotation.x={-Math.PI / 2}>
				<T.RingGeometry args={[CITY_RADIUS * 1.25, CITY_RADIUS * 1.55, 48]} />
				<T.MeshBasicMaterial
					color={state.highlight === 'selected' ? '#2a2017' : '#b5521f'}
					transparent
					opacity={0.85}
				/>
			</T.Mesh>
		{/if}
	</T.Group>

	<!-- An empty point at the disc's centre, so tools that drive the page can find a city, read its name and click it. -->
	<HTML position.y={DISC} center pointerEvents="none" style="pointer-events: none" zIndexRange={[1, 0]}>
		<span class="anchor" data-city={city.id} data-name={state.name} aria-hidden="true"></span>
	</HTML>

	{#each supplies as cube, index (index)}
		<Pop position={[cube.x, cube.y, cube.z]} delay={Math.min(index, 8) * 35}>
			<T.Mesh castShadow>
				<T.BoxGeometry args={[SUPPLY.size, SUPPLY.size, SUPPLY.size]} />
				<T.MeshStandardMaterial color="#efe6d2" roughness={0.65} />
			</T.Mesh>
		</Pop>
	{/each}
	{#if supplies.length}
		{@const layers = Math.ceil(supplies.length / (SUPPLY.columns * SUPPLY.rows))}
		<T.Mesh
			position={[CITY_RADIUS + 0.75 + SUPPLY.slot / 2, (layers * SUPPLY.slot) / 2, -0.85 + SUPPLY.slot]}
			{...explain('supplies')}
		>
			<T.BoxGeometry args={[SUPPLY.slot * 2 + 0.3, layers * SUPPLY.slot + 0.2, SUPPLY.slot * 3 + 0.3]} />
			<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
		</T.Mesh>
	{/if}

	{#each plague as cube, index (index)}
		<Pop position={[cube.x, cube.y, cube.z]} delay={index * 60}>
			<T.Mesh castShadow>
				<T.BoxGeometry args={[PLAGUE.size, PLAGUE.size, PLAGUE.size]} />
				<T.MeshStandardMaterial color="#93b236" emissive="#3b5210" emissiveIntensity={0.6} roughness={0.65} />
			</T.Mesh>
		</Pop>
	{/each}
	{#if plague.length}
		{@const layers = Math.ceil(plague.length / 4)}
		<T.Mesh
			position={[-CITY_RADIUS - 0.85 - PLAGUE.slot / 2, (layers * PLAGUE.slot) / 2, -0.5 + PLAGUE.slot / 2]}
			{...explain('plague')}
		>
			<T.BoxGeometry args={[PLAGUE.slot * 2 + 0.2, layers * PLAGUE.slot + 0.2, PLAGUE.slot * 2 + 0.2]} />
			<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
		</T.Mesh>
	{/if}

	{#each figures as figure, index (index)}
		<Pop position={[figure.x, 0.85, figure.z]}>
			<T.Mesh castShadow>
				<T.ConeGeometry args={[0.52, 1.7, 5]} />
				<T.MeshStandardMaterial color="#4e3b63" emissive="#24143a" emissiveIntensity={0.5} roughness={0.7} />
			</T.Mesh>
		</Pop>
	{/each}
	{#if figures.length}
		<T.Mesh position={[0, 0.9, CITY_RADIUS + 1.2]} {...explain('hollow')}>
			<T.BoxGeometry args={[figures.length * 1.2 + 0.3, 1.9, 1.3]} />
			<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
		</T.Mesh>
	{/if}

	{#each stickers as sticker (sticker.kind)}
		{@const [x, z] = SPOT[sticker.kind]}
		<Printed print={sticker.print} position={[x, INK + 0.01, z]} order={5} />
		<T.Mesh position={[x, 0.15, z]} {...explain(sticker.part)}>
			<T.CylinderGeometry args={[1.05, 1.05, 0.3, 16]} />
			<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
		</T.Mesh>
	{/each}

	{#if built('center')}
		<Pop position={[SPOT.center[0], 0, SPOT.center[1]]}>
			<T.Mesh position.y={0.5} castShadow {...explain({ structure: 'center', permanent: false })}>
				<T.BoxGeometry args={[1.2, 1, 1.2]} />
				<T.MeshStandardMaterial color="#ebe2cc" roughness={0.8} />
			</T.Mesh>
			<T.Mesh
				position.y={1.3}
				rotation.y={Math.PI / 4}
				castShadow
				{...explain({ structure: 'center', permanent: false })}
			>
				<T.ConeGeometry args={[1.02, 0.65, 4]} />
				<T.MeshStandardMaterial color="#8f4129" roughness={0.8} />
			</T.Mesh>
		</Pop>
	{/if}
	{#if built('tower')}
		<Pop position={[SPOT.tower[0], 0, SPOT.tower[1]]}>
			<T.Mesh position.y={1.3} castShadow>
				<T.CylinderGeometry args={[0.08, 0.2, 2.6, 8]} />
				<T.MeshStandardMaterial color="#5e5a53" metalness={0.4} roughness={0.55} />
			</T.Mesh>
			<T.Mesh position.y={2.7}>
				<T.SphereGeometry args={[0.24, 12, 10]} />
				<T.MeshStandardMaterial color="#ffd27a" emissive="#e09a2e" emissiveIntensity={1.1} />
			</T.Mesh>
			<T.Mesh position.y={1.4} {...explain({ structure: 'tower', permanent: false })}>
				<T.CylinderGeometry args={[0.6, 0.6, 3, 8]} />
				<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
			</T.Mesh>
		</Pop>
	{/if}
	{#if built('shelter')}
		<Pop position={[SPOT.shelter[0], 0, SPOT.shelter[1]]}>
			<T.Mesh castShadow {...explain({ structure: 'shelter', permanent: false })}>
				<T.SphereGeometry args={[0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
				<T.MeshStandardMaterial color="#7a8556" roughness={0.85} />
			</T.Mesh>
		</Pop>
	{/if}
</T.Group>

<style>
	.anchor {
		display: block;
		width: 1px;
		height: 1px;
		pointer-events: none;
	}
</style>
