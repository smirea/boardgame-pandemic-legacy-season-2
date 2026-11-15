<script lang="ts" module>
	import type { Affiliation } from '@repo/game';

	export const AFFILIATION_COLOR: Record<Affiliation | 'haven', string> = {
		blue: '#3d8bf2',
		yellow: '#e9b21c',
		black: '#3a4250',
		haven: '#19b9a5',
	};
</script>

<script lang="ts">
	import type { CityDef } from '@repo/game';
	import { T } from '@threlte/core';
	import { HTML, useCursor } from '@threlte/extras';
	import { Spring } from 'svelte/motion';
	import { LAND_HEIGHT } from './projection';
	import type { BoardPoint } from './projection';
	import { CITY_RADIUS, CITY_TOP } from './routes';
	import type { CityView } from './types';

	type Props = { city: CityDef; at: BoardPoint; state: CityView; onselect: () => void };

	let { city, at, state, onselect }: Props = $props();

	const color = $derived(AFFILIATION_COLOR[city.affiliation ?? 'haven']);
	const { hovering, onPointerEnter, onPointerLeave } = useCursor();
	const scale = new Spring(1, { stiffness: 0.2, damping: 0.5 });
	$effect(() => {
		scale.target = $hovering ? 1.18 : 1;
	});

	const cubeSlots = $derived.by(() => {
		const slots: { x: number; y: number; z: number; plague: boolean }[] = [];
		const total = state.supplies + state.plague;
		for (let i = 0; i < total; i++) {
			const column = i % 3;
			const layer = Math.floor(i / 9);
			const row = Math.floor(i / 3) % 3;
			slots.push({
				x: CITY_RADIUS + 0.55 + column * 0.62,
				y: 0.28 + layer * 0.58,
				z: -0.62 + row * 0.62,
				plague: i >= state.supplies,
			});
		}
		return slots;
	});
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
				opacity={state.onGrid ? 1 : 0.45}
				transparent={!state.onGrid}
			/>
		</T.Mesh>
		<T.Mesh position.y={CITY_TOP - LAND_HEIGHT + 0.02} rotation.x={-Math.PI / 2}>
			<T.RingGeometry args={[CITY_RADIUS * 0.62, CITY_RADIUS * 0.8, city.kind === 'haven' ? 6 : 32]} />
			<T.MeshBasicMaterial color="#f4f1e8" transparent opacity={state.onGrid ? 0.95 : 0.4} />
		</T.Mesh>
		{#if state.highlight}
			<T.Mesh position.y={0.06} rotation.x={-Math.PI / 2}>
				<T.RingGeometry args={[CITY_RADIUS * 1.25, CITY_RADIUS * 1.55, 48]} />
				<T.MeshBasicMaterial color={state.highlight === 'selected' ? '#ffffff' : '#7dfcc0'} transparent opacity={0.9} />
			</T.Mesh>
		{/if}
	</T.Group>

	{#each cubeSlots as slot, index (index)}
		<T.Mesh position={[slot.x, slot.y, slot.z]} castShadow>
			<T.BoxGeometry args={[0.5, 0.5, 0.5]} />
			<T.MeshStandardMaterial
				color={slot.plague ? '#63d417' : '#f2ecd8'}
				emissive={slot.plague ? '#2f7a00' : '#000000'}
				emissiveIntensity={slot.plague ? 0.8 : 0}
				roughness={0.4}
			/>
		</T.Mesh>
	{/each}

	{#if state.supplyCenter}
		<T.Group position={[-CITY_RADIUS - 0.9, 0, 0]}>
			<T.Mesh position.y={0.5} castShadow>
				<T.BoxGeometry args={[1.1, 1, 1.1]} />
				<T.MeshStandardMaterial color="#e8e2d0" roughness={0.6} />
			</T.Mesh>
			<T.Mesh position.y={1.3} rotation.y={Math.PI / 4} castShadow>
				<T.ConeGeometry args={[0.95, 0.65, 4]} />
				<T.MeshStandardMaterial color="#c2552d" roughness={0.6} />
			</T.Mesh>
		</T.Group>
	{/if}

	<HTML position.y={CITY_TOP - LAND_HEIGHT + 0.2} center pointerEvents="none" zIndexRange={[10, 0]}>
		<div class="label" class:off-grid={!state.onGrid}>
			<span class="name">{city.name}</span>
			{#if state.supplies || state.plague}
				<span class="counts">
					{#if state.supplies}<span class="supplies">{state.supplies}</span>{/if}
					{#if state.plague}<span class="plague">{state.plague}</span>{/if}
				</span>
			{/if}
		</div>
	</HTML>
</T.Group>

<style>
	.label {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		transform: translateY(-1.7rem);
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: rgb(10 15 20 / 0.78);
		color: #f1ede2;
		font:
			600 0.7rem/1.4 system-ui,
			sans-serif;
		letter-spacing: 0.02em;
		white-space: nowrap;
		user-select: none;
	}

	.label.off-grid {
		opacity: 0.6;
	}

	.counts {
		display: flex;
		gap: 0.2rem;
	}

	.supplies,
	.plague {
		min-width: 1rem;
		padding: 0 0.25rem;
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
</style>
