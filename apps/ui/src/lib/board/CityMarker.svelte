<script lang="ts" module>
	import type { Color } from '@repo/game';

	export const CITY_COLOR: Record<Color | 'haven', string> = {
		blue: '#3d8bf2',
		yellow: '#e9b21c',
		black: '#4a5362',
		red: '#e0483e',
		haven: '#19b9a5',
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

	const color = $derived(state.forsaken ? '#6b6f76' : CITY_COLOR[city.color ?? 'haven']);
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
				roughness={0.45}
				metalness={0.2}
				opacity={state.onGrid ? 1 : 0.5}
				transparent={!state.onGrid}
			/>
		</T.Mesh>
		<T.Mesh position.y={CITY_TOP - LAND_HEIGHT + 0.02} rotation.x={-Math.PI / 2}>
			<T.RingGeometry args={[CITY_RADIUS * 0.62, CITY_RADIUS * 0.8, city.kind === 'haven' ? 6 : 32]} />
			<T.MeshBasicMaterial
				color={state.infested ? '#c79bff' : '#f4f1e8'}
				transparent
				opacity={state.onGrid ? 0.95 : 0.45}
			/>
		</T.Mesh>
		{#if state.highlight}
			<T.Mesh position.y={0.06} rotation.x={-Math.PI / 2}>
				<T.RingGeometry args={[CITY_RADIUS * 1.25, CITY_RADIUS * 1.55, 48]} />
				<T.MeshBasicMaterial color={state.highlight === 'selected' ? '#ffffff' : '#7dfcc0'} transparent opacity={0.9} />
			</T.Mesh>
		{/if}
	</T.Group>

	{#each cubes as cube, index (`${cube.kind}${index}`)}
		<Pop position={[cube.x, cube.y, cube.z]} delay={Math.min(index, 8) * 35}>
			<T.Mesh castShadow>
				<T.BoxGeometry args={[0.7, 0.7, 0.7]} />
				<T.MeshStandardMaterial
					color={cube.kind === 'plague' ? '#63d417' : '#f2ecd8'}
					emissive={cube.kind === 'plague' ? '#2f7a00' : '#000000'}
					emissiveIntensity={cube.kind === 'plague' ? 0.8 : 0}
					roughness={0.4}
				/>
			</T.Mesh>
		</Pop>
	{/each}

	{#each figures as figure, index (index)}
		<Pop position={[figure.x, 0.6, figure.z]}>
			<T.Mesh castShadow>
				<T.ConeGeometry args={[0.36, 1.2, 5]} />
				<T.MeshStandardMaterial color="#5b3f8f" emissive="#3b1d6e" emissiveIntensity={0.6} roughness={0.5} />
			</T.Mesh>
		</Pop>
	{/each}

	{#if state.center}
		<Pop position={[-CITY_RADIUS - 0.9, 0, 0]}>
			<T.Mesh position.y={0.5} castShadow>
				<T.BoxGeometry args={[1.2, 1, 1.2]} />
				<T.MeshStandardMaterial color="#e8e2d0" roughness={0.6} />
			</T.Mesh>
			<T.Mesh position.y={1.3} rotation.y={Math.PI / 4} castShadow>
				<T.ConeGeometry args={[1.02, 0.65, 4]} />
				<T.MeshStandardMaterial color="#c2552d" roughness={0.6} />
			</T.Mesh>
		</Pop>
	{/if}
	{#if state.tower}
		<Pop position={[-CITY_RADIUS - 0.6, 0, -1.5]}>
			<T.Mesh position.y={1.3} castShadow>
				<T.CylinderGeometry args={[0.08, 0.2, 2.6, 8]} />
				<T.MeshStandardMaterial color="#cfd6dd" metalness={0.6} roughness={0.3} />
			</T.Mesh>
			<T.Mesh position.y={2.7}>
				<T.SphereGeometry args={[0.24, 12, 10]} />
				<T.MeshStandardMaterial color="#6fd3ff" emissive="#2aa8e6" emissiveIntensity={1.2} />
			</T.Mesh>
		</Pop>
	{/if}
	{#if state.shelter}
		<Pop position={[-CITY_RADIUS - 0.6, 0, 1.5]}>
			<T.Mesh castShadow>
				<T.SphereGeometry args={[0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
				<T.MeshStandardMaterial color="#7fb38a" roughness={0.7} />
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
	.label {
		display: flex;
		gap: 0.25rem;
		align-items: center;
		justify-content: center;
		min-width: 0;
		max-width: var(--w);
		transform: translate(var(--dx), var(--dy));
		transition: transform 300ms ease;
		padding: 0.05rem 0.4rem;
		border-radius: 999px;
		background: rgb(10 15 20 / 0.8);
		color: #f1ede2;
		font:
			600 0.66rem/1.45 system-ui,
			sans-serif;
		letter-spacing: 0.02em;
		white-space: nowrap;
		user-select: none;
	}

	.label.off-grid {
		opacity: 0.6;
	}

	.label.forsaken .name {
		text-decoration: line-through;
		color: #9aa0a8;
	}

	.population {
		color: #9fb0bf;
		font-weight: 500;
	}

	.supplies,
	.plague,
	.hollow,
	.lab,
	.odds {
		min-width: 0.95rem;
		padding: 0 0.22rem;
		border-radius: 0.2rem;
		text-align: center;
		color: #10161c;
	}

	.supplies {
		background: #f2ecd8;
	}

	.plague {
		background: #7be02a;
	}

	.hollow {
		background: #b48cff;
	}

	.lab {
		background: #6fd3ff;
		font-size: 0.55rem;
	}

	.odds {
		background: transparent;
		color: #ffd166;
		padding: 0;
	}

	.odds.hot {
		color: #ff7a7a;
	}
</style>
