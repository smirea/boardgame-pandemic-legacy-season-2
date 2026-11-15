<script lang="ts">
	import { edgeKey, pack } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { T, useThrelte } from '@threlte/core';
	import { interactivity, OrbitControls } from '@threlte/extras';
	import { untrack } from 'svelte';
	import { MOUSE } from 'three';
	import type { PerspectiveCamera } from 'three';
	import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
	import CityMarker from './CityMarker.svelte';
	import Cloud from './Cloud.svelte';
	import { fitBoard } from './fit';
	import { buildLandGeometry } from './land';
	import Pawn from './Pawn.svelte';
	import type { BoardBounds, BoardPoint } from './projection';
	import Pulse from './Pulse.svelte';
	import RemoteCursor from './RemoteCursor.svelte';
	import RouteTube from './RouteTube.svelte';
	import type { BoardView } from './types';

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		onpointer?: (point: BoardPoint | null) => void;
		/** Bump to return the camera to the whole-board view. */
		resetView?: number;
	};

	let { view, oncity, onpointer, resetView = 0 }: Props = $props();

	interactivity();

	const FOV = 30;
	const { size } = useThrelte();
	const layout = pack.positions;
	const landGeometry = buildLandGeometry();
	const bounds: BoardBounds = (() => {
		const land = landGeometry.boundingBox!;
		const points = Object.values(layout);
		const margin = 4;
		return {
			minX: Math.min(land.min.x, ...points.map(point => point.x)) - margin,
			maxX: Math.max(land.max.x, ...points.map(point => point.x)) + margin,
			minZ: Math.min(land.min.z, ...points.map(point => point.z)) - margin,
			maxZ: Math.max(land.max.z, ...points.map(point => point.z)) + margin,
		};
	})();
	const boardSize = { width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ };
	const boardCentre = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };

	let camera = $state<PerspectiveCamera>();
	let controls = $state<OrbitControlsImpl>();
	let userMoved = $state(false);
	let dragging = false;
	let lastReset = 0;
	const fit = $derived(fitBoard(bounds, size.current.width / Math.max(1, size.current.height), FOV));
	$effect(() => {
		if (resetView !== lastReset) {
			lastReset = resetView;
			userMoved = false;
		}
		if (!camera || !controls || userMoved) return;
		camera.position.copy(fit.position);
		controls.target.copy(fit.target);
		controls.update();
	});

	// Edges present at first render are part of the board. Anything that shows up later draws itself in.
	const routeKey = (route: { a: CityId; b: CityId; kind: string }) => `${route.kind}:${edgeKey(route.a, route.b)}`;
	const initialEdges = new Set(untrack(() => view.edges.map(routeKey)));

	const visibleCities = $derived(pack.cities.filter(city => view.cities[city.id]!.revealed));
	const cloudCities = pack.cities.filter(city => !city.lost);
	// A city whose closest neighbour sits just north of it hangs its label below, so the two labels part instead of stacking.
	const labelsBelow = $derived.by(() => {
		const below = new Set<CityId>();
		for (const city of visibleCities) {
			const at = layout[city.id]!;
			let nearest: { dz: number; distance: number } | null = null;
			for (const other of visibleCities) {
				if (other.id === city.id) continue;
				const point = layout[other.id]!;
				const distance = Math.hypot(point.x - at.x, point.z - at.z);
				if (distance < 13 && (!nearest || distance < nearest.distance)) nearest = { dz: point.z - at.z, distance };
			}
			if (nearest && nearest.dz < 0) below.add(city.id);
		}
		return below;
	});
	const pawnSlots = $derived.by(() => {
		const perCity = new Map<CityId, number>();
		return view.pawns.map(pawn => {
			const slot = perCity.get(pawn.city) ?? 0;
			perCity.set(pawn.city, slot + 1);
			return { pawn, slot, at: layout[pawn.city]! };
		});
	});
</script>

<T.PerspectiveCamera makeDefault fov={FOV} near={1} far={900} bind:ref={camera}>
	<OrbitControls
		bind:ref={controls}
		enableDamping
		dampingFactor={0.12}
		minDistance={25}
		maxDistance={fit.distance * 1.15}
		minPolarAngle={0.05}
		maxPolarAngle={1.2}
		screenSpacePanning={false}
		zoomToCursor
		mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
		onstart={() => (dragging = true)}
		onend={() => (dragging = false)}
		onchange={() => {
			// A plain click on a city also starts a controls gesture. Only a gesture that moves the camera counts.
			if (dragging) userMoved = true;
		}}
	/>
</T.PerspectiveCamera>

<T.HemisphereLight args={['#dfeaf5', '#1c2630', 1.1]} />
<T.DirectionalLight
	position={[-60, 120, 50]}
	intensity={2.2}
	castShadow
	shadow.mapSize={[4096, 4096]}
	shadow.camera.left={-120}
	shadow.camera.right={120}
	shadow.camera.top={80}
	shadow.camera.bottom={-80}
	shadow.camera.far={320}
	shadow.bias={-0.0004}
/>

<T.Mesh position={[boardCentre.x, -1.6, boardCentre.z]} receiveShadow>
	<T.BoxGeometry args={[boardSize.width + 3, 3, boardSize.depth + 3]} />
	<T.MeshStandardMaterial color="#141a20" roughness={0.9} />
</T.Mesh>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position={[boardCentre.x, 0, boardCentre.z]}
	receiveShadow
	onpointermove={event => onpointer?.({ x: event.point.x, z: event.point.z })}
>
	<T.PlaneGeometry args={[boardSize.width, boardSize.depth]} />
	<T.MeshStandardMaterial color="#143a52" roughness={0.35} metalness={0.15} />
</T.Mesh>

<T.Mesh geometry={landGeometry} receiveShadow castShadow>
	<T.MeshStandardMaterial color="#b3ab8c" roughness={0.95} flatShading />
</T.Mesh>

{#each view.ghostEdges as route (`ghost:${routeKey(route)}`)}
	<RouteTube {route} from={layout[route.a]!} to={layout[route.b]!} ghost />
{/each}

{#each view.edges as route (routeKey(route))}
	<RouteTube {route} from={layout[route.a]!} to={layout[route.b]!} animate={!initialEdges.has(routeKey(route))} />
{/each}

{#each visibleCities as city (city.id)}
	<CityMarker
		{city}
		at={layout[city.id]!}
		state={view.cities[city.id]!}
		labelBelow={labelsBelow.has(city.id)}
		onselect={() => oncity?.(city.id)}
	/>
{/each}

{#each cloudCities as city, index (city.id)}
	<Cloud at={layout[city.id]!} seed={index} hidden={!view.cities[city.id]!.revealed} />
{/each}

{#each pawnSlots as { pawn, slot, at } (pawn.id)}
	<Pawn {pawn} {slot} {at} />
{/each}

{#each view.cursors as cursor (cursor.id)}
	<RemoteCursor {cursor} />
{/each}

{#each view.fx as fx (fx.id)}
	<Pulse at={layout[fx.city]!} kind={fx.kind} delay={fx.delay} />
{/each}
