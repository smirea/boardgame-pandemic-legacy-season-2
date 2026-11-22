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
	import { onMount, untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Spring, Tween } from 'svelte/motion';
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { inkOn } from '#lib/color.ts';
	import type { Part } from './hints';
	import { DISC_REACH, NAME_SIZE } from './labels';
	import type { Placement } from './labels';
	import { cubeGeometries, cubeMaterials, pieceMaterials, pieceModels, shelterGeometry } from './models.svelte';
	import Pop from './Pop.svelte';
	import { fonts, printDisc, printDiscGlow, printName, printSticker } from './print.svelte';
	import type { DiscTone, PrintedKind } from './print.svelte';
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
		/** Supply cubes still flying here, which stand in the block only once they land. */
		landing?: number;
		onselect: () => void;
		/** A pointer over one of the city's parts, or off it when `event` is null. */
		onhint: (part: Part, event: PointerEvent | null) => void;
	};

	let { city, at, state, placement, lit, landing = 0, onselect, onhint }: Props = $props();

	// Every piece has its own place around the disc, so a glance tells what stands where.
	const SPOT = {
		center: [2.9, -2.5],
		tower: [-2.9, -2.5],
		shelter: [-2.9, 2.7],
		lab: [3.1, 2.8],
		infested: [-3.4, -1.95],
	} as const;
	const DISC = CITY_TOP - LAND_HEIGHT;
	/**
	 * Half the side of a city's square on the board, over the disc and the pieces around it. The closest cities, Tokyo
	 * and Osaka, sit 5.34 apart on one axis, so two squares may share a strip between them but never reach the
	 * other city's disc, and a click on a disc always selects that city.
	 */
	const FOOTPRINT = 3.4;
	/** CSS pixels per board unit in an `HTML` with `transform` and the default distance factor of 10. */
	const HTML_PX = 40;

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

	// A print is a canvas and a texture. `state` is a new object whenever anything about the city changes, so each
	// print reads what it shows through a value of its own and is made again only when that value changes.
	const label = $derived(state.name);
	const onGrid = $derived(state.onGrid);
	const population = $derived(state.population);
	const inoculated = $derived(state.inoculated);
	const name = $derived(fonts.ready ? printName(label, city.port, NAME_SIZE, !onGrid, false) : null);
	// The lit name is printed the first time the pointer rests on the city and kept beside the plain one, so a
	// pointer crossing the map lights names without painting any of them again.
	let wasLit = false;
	const everLit = $derived.by(() => (wasLit ||= lit));
	const litName = $derived(fonts.ready && everLit ? printName(label, city.port, NAME_SIZE, !onGrid, true) : null);
	const glow = $derived(fonts.ready && inoculated ? printDiscGlow(population, 2.8) : null);
	// The board draws only while something changes, so the blue shimmer runs a few times when the city becomes fully
	// inoculated, and once more whenever the pointer comes onto it, then rests on the blue numeral.
	const shimmer = new Tween(0, { easing: cubicInOut });
	let pulsing = 0;
	async function pulse(times: number) {
		const run = ++pulsing;
		for (let index = 0; index < times && run === pulsing; index++) {
			await shimmer.set(1, { duration: 650 });
			if (run === pulsing) await shimmer.set(0.15, { duration: 900 });
		}
		if (run === pulsing) await shimmer.set(0, { duration: 600 });
	}
	$effect(() => {
		if (inoculated) void pulse(3);
		else {
			pulsing++;
			shimmer.set(0, { duration: 0 });
		}
	});
	$effect(() => {
		if (lit && untrack(() => inoculated)) void pulse(1);
	});
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
	const discTone = $derived<DiscTone>(
		state.forsaken ? 'forsaken' : inoculated ? 'inoculated' : state.infested ? 'infested' : 'plain',
	);
	const face = $derived(fonts.ready ? printDisc(population, 2.8, inkOn(color), discTone) : null);
	const printedKinds = $derived(
		[
			...state.structures.filter(structure => structure.permanent).map(structure => structure.kind),
			...(state.lab ? ['lab' as const] : []),
			...(state.infested ? ['infested' as const] : []),
		].join(),
	);
	const stickers = $derived(
		fonts.ready && printedKinds
			? (printedKinds.split(',') as PrintedKind[]).map(kind => ({
					kind,
					print: printSticker(kind, kind === 'infested' ? 2.0 : kind === 'lab' ? 2.1 : 2.35),
				}))
			: [],
	);
	const placedStructure = (kind: 'center' | 'tower' | 'shelter') =>
		state.structures.find(structure => structure.kind === kind && structure.placed) ?? null;
	const stickerPart = (kind: PrintedKind): Part =>
		kind === 'lab'
			? 'lab'
			: kind === 'infested'
				? 'city'
				: { structure: kind, permanent: true, placed: Boolean(placedStructure(kind)) };

	// Supply cubes stand in a block under the supply center's place, rising in layers as they pile up.
	const SUPPLY = { size: 0.7, slot: 0.86, columns: 2, rows: 3 };
	const supplies = $derived(
		Array.from({ length: Math.max(0, Math.min(state.supplies - landing, 18)) }, (_, index) => {
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
			x: (index - (state.hollow - 1) / 2) * 1.35,
			z: CITY_RADIUS + 1.35,
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
		<Printed
			print={name}
			position={[placement.x, INK, placement.z]}
			opacity={ink.current}
			order={4}
			visible={!lit || !litName}
		/>
		{#if litName}
			<Printed
				print={litName}
				position={[placement.x, INK, placement.z]}
				opacity={ink.current}
				order={4}
				visible={lit}
			/>
		{/if}
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
		{#if glow}
			<Printed
				print={glow}
				position={[0, DISC + 0.025, 0]}
				opacity={shimmer.current}
				order={5}
				visible={shimmer.current > 0}
			/>
		{/if}
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

	<!--
		An empty square lying on the board over the disc and the pieces around it, centred on the disc. Tools that drive
		the page find, read and click a city through it, and a feedback capture selects the city anywhere inside it.
	-->
	<HTML transform position.y={DISC} rotation.x={-Math.PI / 2} pointerEvents="none" zIndexRange={[1, 0]}>
		<span
			class="anchor"
			style:--size="{FOOTPRINT * 2 * HTML_PX}px"
			data-city={city.id}
			data-name={state.name}
			data-highlight={state.highlight}
			aria-hidden="true"
			{@attach feedback(state.name, () => ({ id: city.id, ...state }))}
		></span>
	</HTML>

	{#each supplies as cube, index (index)}
		<Pop position={[cube.x, cube.y, cube.z]} delay={Math.min(index, 8) * 35}>
			<T.Mesh
				geometry={cubeGeometries.supply}
				material={cubeMaterials.supply}
				castShadow
				receiveShadow
				dispose={false}
			/>
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
			<T.Mesh
				geometry={cubeGeometries.plague}
				material={cubeMaterials.plague}
				castShadow
				receiveShadow
				dispose={false}
			/>
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
		<Pop position={[figure.x, INK + 0.02, figure.z]}>
			{#if pieceModels.hollow}
				<T.Mesh
					geometry={pieceModels.hollow}
					material={pieceMaterials.hollow}
					scale={2.1}
					castShadow
					receiveShadow
					dispose={false}
				/>
			{/if}
		</Pop>
	{/each}
	{#if figures.length}
		<T.Mesh position={[0, 1.05, CITY_RADIUS + 1.35]} {...explain('hollow')}>
			<T.BoxGeometry args={[figures.length * 1.35 + 0.35, 2.2, 1.65]} />
			<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
		</T.Mesh>
	{/if}

	{#each stickers as sticker (sticker.kind)}
		{@const [x, z] = SPOT[sticker.kind]}
		<Printed print={sticker.print} position={[x, INK + 0.01, z]} order={5} />
		{#if sticker.kind === 'lab' || sticker.kind === 'infested' || !placedStructure(sticker.kind)}
			<T.Mesh position={[x, 0.15, z]} {...explain(stickerPart(sticker.kind))}>
				<T.CylinderGeometry args={[1.15, 1.15, 0.3, 16]} />
				<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
			</T.Mesh>
		{/if}
	{/each}

	{#if placedStructure('center')}
		{@const center = placedStructure('center')!}
		<Pop position={[SPOT.center[0], INK + 0.02, SPOT.center[1]]}>
			{#if pieceModels.station}
				<T.Mesh
					geometry={pieceModels.station}
					material={pieceMaterials.center}
					scale={1.55}
					rotation.y={0.42}
					castShadow
					receiveShadow
					dispose={false}
				/>
			{/if}
			<T.Mesh position.y={0.8} {...explain({ structure: 'center', permanent: center.permanent, placed: true })}>
				<T.CylinderGeometry args={[1.15, 1.15, 1.7, 12]} />
				<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
			</T.Mesh>
		</Pop>
	{/if}
	{#if placedStructure('tower')}
		{@const tower = placedStructure('tower')!}
		<Pop position={[SPOT.tower[0], INK + 0.02, SPOT.tower[1]]}>
			{#if pieceModels.tower}
				<T.Mesh
					geometry={pieceModels.tower}
					material={pieceMaterials.tower}
					scale={3.68}
					rotation.y={-0.35 - Math.PI / 4}
					castShadow
					receiveShadow
					dispose={false}
				/>
			{/if}
			<T.Mesh position.y={1.85} {...explain({ structure: 'tower', permanent: tower.permanent, placed: true })}>
				<T.CylinderGeometry args={[1.55, 1.55, 3.8, 12]} />
				<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
			</T.Mesh>
		</Pop>
	{/if}
	{#if placedStructure('shelter')}
		{@const shelter = placedStructure('shelter')!}
		<Pop position={[SPOT.shelter[0], INK + 0.02, SPOT.shelter[1]]}>
			<T.Mesh
				geometry={shelterGeometry}
				material={pieceMaterials.shelter}
				scale={1.25}
				rotation.y={0.28}
				castShadow
				receiveShadow
				dispose={false}
			/>
			<T.Mesh position.y={0.65} {...explain({ structure: 'shelter', permanent: shelter.permanent, placed: true })}>
				<T.CylinderGeometry args={[1.15, 1.15, 1.4, 12]} />
				<T.MeshBasicMaterial colorWrite={false} depthWrite={false} />
			</T.Mesh>
		</Pop>
	{/if}
</T.Group>

<style>
	.anchor {
		display: block;
		width: var(--size);
		height: var(--size);
		pointer-events: none;
	}
</style>
