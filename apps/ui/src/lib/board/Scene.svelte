<script lang="ts">
	import { edgeKey, pack } from '@repo/game';
	import type { CityId } from '@repo/game';
	import { T, useThrelte } from '@threlte/core';
	import { interactivity, OrbitControls } from '@threlte/extras';
	import { untrack } from 'svelte';
	import { CanvasTexture, MOUSE, SRGBColorSpace } from 'three';
	import type { PerspectiveCamera } from 'three';
	import type { OrbitControls as OrbitControlsImpl } from 'three/examples/jsm/controls/OrbitControls.js';
	import CityMarker from './CityMarker.svelte';
	import { drawChart } from './chart';
	import { DEFAULT_TILT, fitBoard } from './fit';
	import Fog from './Fog.svelte';
	import { layoutLabels } from './labels';
	import { buildLandGeometry, mapToSheet } from './land';
	import Pawn from './Pawn.svelte';
	import type { BoardBounds, BoardPoint } from './projection';
	import Pulse from './Pulse.svelte';
	import RemoteCursor from './RemoteCursor.svelte';
	import { routeBow } from './routes';
	import RouteTube from './RouteTube.svelte';
	import type { BoardView } from './types';

	type Props = {
		view: BoardView;
		oncity?: (city: CityId) => void;
		onpointer?: (point: BoardPoint | null) => void;
		/** Bump to return the camera to the whole-board view. */
		resetView?: number;
		/** Screen rectangles, in pixels from the canvas corner, that HUD panels cover. Labels keep out of them. */
		covered?: { x: number; y: number; width: number; height: number }[];
	};

	let { view, oncity, onpointer, resetView = 0, covered = [] }: Props = $props();

	interactivity();

	const FOV = 30;
	const { size, renderer } = useThrelte();
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
	mapToSheet(landGeometry, bounds);
	const chart = drawChart(bounds);
	const texture = (canvas: HTMLCanvasElement) => {
		const map = new CanvasTexture(canvas);
		map.colorSpace = SRGBColorSpace;
		map.anisotropy = renderer.capabilities.getMaxAnisotropy();
		return map;
	};
	const knownSheet = texture(chart.known);
	const unknownSheet = texture(chart.unknown);

	let camera = $state<PerspectiveCamera>();
	let controls = $state<OrbitControlsImpl>();
	let userMoved = $state(false);
	let dragging = false;
	let lastReset = 0;
	// `$size` subscribes to the store. Reading `size.current` would not rerun when the canvas is resized.
	const MARKER_REACH = 2.6;
	const cityBounds: BoardBounds = (() => {
		const points = Object.values(layout);
		return {
			minX: Math.min(...points.map(point => point.x)) - MARKER_REACH,
			maxX: Math.max(...points.map(point => point.x)) + MARKER_REACH,
			minZ: Math.min(...points.map(point => point.z)) - MARKER_REACH,
			maxZ: Math.max(...points.map(point => point.z)) + MARKER_REACH,
		};
	})();
	const sides = $derived.by(() => {
		const width = Math.max(1, $size.width);
		let left = 0;
		let right = 0;
		for (const rect of covered) {
			if (rect.x + rect.width / 2 < width / 2) left = Math.max(left, rect.x + rect.width);
			else right = Math.max(right, width - rect.x);
		}
		return { left: left / width, right: right / width };
	});
	const fit = $derived(
		fitBoard(bounds, $size.width / Math.max(1, $size.height), FOV, DEFAULT_TILT, { bounds: cityBounds, ...sides }),
	);
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

	const bows = $derived.by(() => {
		const lanes = view.edges.filter(edge => edge.kind === 'sea');
		return new Map([...view.edges, ...view.ghostEdges].map(route => [routeKey(route), routeBow(route, lanes)]));
	});
	const visibleCities = $derived(pack.cities.filter(city => view.cities[city.id]!.revealed));
	// Board units covered by one screen pixel at the whole-board view, the zoom at which labels are most crowded.
	const unitsPerPixel = $derived((2 * fit.distance * Math.tan((FOV * Math.PI) / 360)) / Math.max(1, $size.height));
	const anchors = $derived(
		layoutLabels(
			visibleCities.map(city => ({ id: city.id, name: view.cities[city.id]!.name, at: layout[city.id]! })),
			unitsPerPixel,
			// Screen to board is close to a plain scale at the whole-board view, which is all the label layout needs.
			covered.map(rect => ({
				x: fit.target.x + (rect.x + rect.width / 2 - $size.width / 2) * unitsPerPixel,
				z: fit.target.z + (rect.y + rect.height / 2 - $size.height / 2) * unitsPerPixel,
				halfWidth: (rect.width / 2) * unitsPerPixel,
				halfHeight: (rect.height / 2) * unitsPerPixel,
			})),
		),
	);
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

<T.HemisphereLight args={['#fff4dc', '#3a2e20', 2.6]} />
<T.DirectionalLight
	position={[-60, 120, 50]}
	color="#fff1d6"
	intensity={2.9}
	castShadow
	shadow.mapSize={[4096, 4096]}
	shadow.camera.left={-120}
	shadow.camera.right={120}
	shadow.camera.top={80}
	shadow.camera.bottom={-80}
	shadow.camera.far={320}
	shadow.bias={-0.0004}
/>

<T.Mesh
	rotation.x={-Math.PI / 2}
	position={[boardCentre.x, 0, boardCentre.z]}
	receiveShadow
	onpointermove={event => onpointer?.({ x: event.point.x, z: event.point.z })}
>
	<T.PlaneGeometry args={[boardSize.width, boardSize.depth]} />
	<T.MeshStandardMaterial map={knownSheet} alphaTest={0.5} roughness={0.92} />
</T.Mesh>

<T.Mesh geometry={landGeometry} receiveShadow castShadow>
	<T.MeshStandardMaterial map={knownSheet} roughness={0.92} />
</T.Mesh>

<Fog {bounds} sheet={unknownSheet} hidden={city => !view.cities[city]!.revealed} />

{#each view.ghostEdges as route (`ghost:${routeKey(route)}`)}
	<RouteTube {route} from={layout[route.a]!} to={layout[route.b]!} bow={bows.get(routeKey(route)) ?? 0} ghost />
{/each}

{#each view.edges as route (routeKey(route))}
	<RouteTube
		{route}
		from={layout[route.a]!}
		to={layout[route.b]!}
		bow={bows.get(routeKey(route)) ?? 0}
		animate={!initialEdges.has(routeKey(route))}
	/>
{/each}

{#each visibleCities as city (city.id)}
	<CityMarker
		{city}
		at={layout[city.id]!}
		state={view.cities[city.id]!}
		anchor={anchors.get(city.id) ?? 'n'}
		onselect={() => oncity?.(city.id)}
	/>
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
