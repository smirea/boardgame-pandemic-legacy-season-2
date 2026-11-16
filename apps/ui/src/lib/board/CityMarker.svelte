<script lang="ts" module>
	import type { Color } from '@repo/game';

	export const CITY_COLOR: Record<Color | 'haven', string> = {
		blue: '#3d618f',
		yellow: '#c4952c',
		black: '#3b3732',
		red: '#a9432d',
		haven: '#4b8a77',
	};
</script>

<script lang="ts">
	import type { CityDef } from '@repo/game';
	import { T } from '@threlte/core';
	import { HTML, useCursor } from '@threlte/extras';
	import { Spring } from 'svelte/motion';
	import { anchorOffset, labelWidth } from './labels';
	import type { Anchor } from './labels';
	import { LAND_HEIGHT } from './projection';
	import Pop from './Pop.svelte';
	import type { BoardPoint } from './projection';
	import { CITY_RADIUS, CITY_TOP } from './routes';
	import type { CityView } from './types';

	type Props = { city: CityDef; at: BoardPoint; state: CityView; anchor: Anchor; onselect: () => void };

	let { city, at, state, anchor, onselect }: Props = $props();

	const offset = $derived(anchorOffset(anchor, labelWidth(state.name)));

	const color = $derived(state.forsaken ? '#8d8476' : CITY_COLOR[city.color ?? 'haven']);
	const { hovering, onPointerEnter, onPointerLeave } = useCursor();
	// Starting small makes a city rise out of the board when its region is revealed.
	const scale = new Spring(0.05, { stiffness: 0.12, damping: 0.42 });
	$effect(() => {
		scale.target = $hovering ? 1.18 : state.highlight === 'target' ? 1.08 : 1;
	});

	const SLOT = 0.85;
	const cubes = $derived.by(() => {
		const kinds = [
			...Array<'supply'>(Math.min(state.supplies, 18)).fill('supply'),
			...Array<'plague'>(state.plague).fill('plague'),
		];
		return kinds.map((kind, index) => ({
			kind,
			x: CITY_RADIUS + 0.7 + (index % 3) * SLOT,
			y: 0.36 + Math.floor(index / 9) * 0.8,
			z: -SLOT + (Math.floor(index / 3) % 3) * SLOT,
		}));
	});
	const figures = $derived(
		Array.from({ length: state.hollow }, (_, index) => ({ x: -0.9 + index * 0.9, z: CITY_RADIUS + 0.8 })),
	);
</script>

<T.Group position={[at.x, LAND_HEIGHT, at.z]}>
	<T.Group scale={scale.current}>
		<T.Mesh
			position.y={(CITY_TOP - LAND_HEIGHT) / 2}
			castShadow
			receiveShadow
			onclick={event => {
				event.stopPropagation();
				onselect();
			}}
			onpointerenter={onPointerEnter}
			onpointerleave={onPointerLeave}
		>
			<T.CylinderGeometry
				args={[CITY_RADIUS, CITY_RADIUS * 1.08, CITY_TOP - LAND_HEIGHT, city.kind === 'haven' ? 6 : 32]}
			/>
			<T.MeshStandardMaterial
				{color}
				roughness={0.7}
				metalness={0}
				opacity={state.onGrid ? 1 : 0.5}
				transparent={!state.onGrid}
			/>
		</T.Mesh>
		<T.Mesh position.y={CITY_TOP - LAND_HEIGHT + 0.02} rotation.x={-Math.PI / 2}>
			<T.RingGeometry args={[CITY_RADIUS * 0.62, CITY_RADIUS * 0.8, city.kind === 'haven' ? 6 : 32]} />
			<T.MeshBasicMaterial
				color={state.infested ? '#b79ad6' : '#efe6d2'}
				transparent
				opacity={state.onGrid ? 0.95 : 0.45}
			/>
		</T.Mesh>
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

	{#each cubes as cube, index (`${cube.kind}${index}`)}
		<Pop position={[cube.x, cube.y, cube.z]} delay={Math.min(index, 8) * 35}>
			<T.Mesh castShadow>
				<T.BoxGeometry args={[0.7, 0.7, 0.7]} />
				<T.MeshStandardMaterial
					color={cube.kind === 'plague' ? '#93b236' : '#efe6d2'}
					emissive={cube.kind === 'plague' ? '#3b5210' : '#000000'}
					emissiveIntensity={cube.kind === 'plague' ? 0.6 : 0}
					roughness={0.65}
				/>
			</T.Mesh>
		</Pop>
	{/each}

	{#each figures as figure, index (index)}
		<Pop position={[figure.x, 0.6, figure.z]}>
			<T.Mesh castShadow>
				<T.ConeGeometry args={[0.36, 1.2, 5]} />
				<T.MeshStandardMaterial color="#4e3b63" emissive="#24143a" emissiveIntensity={0.5} roughness={0.7} />
			</T.Mesh>
		</Pop>
	{/each}

	{#if state.center}
		<Pop position={[-CITY_RADIUS - 0.9, 0, 0]}>
			<T.Mesh position.y={0.5} castShadow>
				<T.BoxGeometry args={[1.2, 1, 1.2]} />
				<T.MeshStandardMaterial color="#ebe2cc" roughness={0.8} />
			</T.Mesh>
			<T.Mesh position.y={1.3} rotation.y={Math.PI / 4} castShadow>
				<T.ConeGeometry args={[1.02, 0.65, 4]} />
				<T.MeshStandardMaterial color="#8f4129" roughness={0.8} />
			</T.Mesh>
		</Pop>
	{/if}
	{#if state.tower}
		<Pop position={[-CITY_RADIUS - 0.6, 0, -1.5]}>
			<T.Mesh position.y={1.3} castShadow>
				<T.CylinderGeometry args={[0.08, 0.2, 2.6, 8]} />
				<T.MeshStandardMaterial color="#5e5a53" metalness={0.4} roughness={0.55} />
			</T.Mesh>
			<T.Mesh position.y={2.7}>
				<T.SphereGeometry args={[0.24, 12, 10]} />
				<T.MeshStandardMaterial color="#ffd27a" emissive="#e09a2e" emissiveIntensity={1.1} />
			</T.Mesh>
		</Pop>
	{/if}
	{#if state.shelter}
		<Pop position={[-CITY_RADIUS - 0.6, 0, 1.5]}>
			<T.Mesh castShadow>
				<T.SphereGeometry args={[0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
				<T.MeshStandardMaterial color="#7a8556" roughness={0.85} />
			</T.Mesh>
		</Pop>
	{/if}

	<HTML
		position.y={CITY_TOP - LAND_HEIGHT + 0.2}
		center
		pointerEvents="none"
		style="pointer-events: none"
		zIndexRange={[10, 0]}
	>
		<div
			class="label"
			class:off-grid={!state.onGrid}
			class:forsaken={state.forsaken}
			style:--dx={`${offset.x}px`}
			style:--dy={`${offset.y}px`}
			style:--w={`${labelWidth(state.name)}px`}
			data-city={city.id}
		>
			<span class="name">{state.name}</span>
			<span class="population" title="Population">{state.population}</span>
			{#if state.supplies}<span class="supplies">{state.supplies}</span>{/if}
			{#if state.plague}<span class="plague">{state.plague}</span>{/if}
			{#if state.hollow}<span class="hollow">{state.hollow}</span>{/if}
			{#if state.lab}<span class="lab">LAB</span>{/if}
			{#if state.odds !== null}<span class="odds" class:hot={state.supplies === 0}>{Math.round(state.odds * 100)}%</span
				>{/if}
		</div>
	</HTML>
</T.Group>

<style>
	/* Names are printed on the chart: ink with a paper halo, the way an engraver kept them readable over coastlines. */
	.label {
		--halo: #e2d5b6;
		display: flex;
		gap: 0.22rem;
		align-items: baseline;
		justify-content: center;
		min-width: 0;
		max-width: var(--w);
		transform: translate(var(--dx), var(--dy));
		transition:
			transform 300ms ease,
			opacity 300ms ease;
		color: #2a2017;
		font-family: var(--font-ui);
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.2;
		white-space: nowrap;
		user-select: none;
		text-shadow:
			0 0 1px var(--halo),
			0 0 2px var(--halo),
			0 0 3px var(--halo),
			0 0 5px var(--halo),
			0 0 8px var(--halo);
	}

	.name {
		font-family: var(--font-display);
		font-size: 0.86rem;
		font-weight: 400;
		letter-spacing: 0.01em;
	}

	.label.off-grid {
		opacity: 0.55;
	}

	.label.forsaken .name {
		color: #6d5f4c;
		text-decoration: line-through;
		text-decoration-color: #a9432d;
		text-decoration-thickness: 1.5px;
	}

	.population {
		color: #6f604c;
		font-weight: 500;
	}

	.supplies,
	.plague,
	.hollow,
	.lab {
		align-self: center;
		min-width: 0.9rem;
		padding: 0 0.2rem;
		border-radius: 1px;
		text-align: center;
		text-shadow: none;
		line-height: 1.25;
	}

	.supplies {
		border: 1px solid #2a2017;
		background: #f1e9d6;
	}

	.plague {
		background: #6f8a22;
		color: #f3f0dc;
	}

	.hollow {
		background: #4e3b63;
		color: #efe6f7;
	}

	.lab {
		border: 1px solid #3d618f;
		color: #3d618f;
		background: #f1e9d6;
		font-size: 0.56rem;
	}

	.odds {
		color: #8b5a12;
		font-style: italic;
	}

	.odds.hot {
		color: #a3301c;
	}
</style>
