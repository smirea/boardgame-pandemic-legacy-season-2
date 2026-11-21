<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { untrack } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { inkOn } from '#lib/color.ts';
	import { CITY_TOP } from './routes';
	import type { CursorView } from './types';

	let { cursor }: { cursor: CursorView } = $props();

	const { invalidate } = useThrelte();

	// Presence arrives at ~30 Hz, so the spring fills the frames between samples.
	const position = new Spring(
		untrack(() => ({ x: cursor.x, z: cursor.z })),
		{ stiffness: 0.35, damping: 0.78 },
	);
	$effect(() => {
		position.target = { x: cursor.x, z: cursor.z };
	});
	// Wake the resting board loop whenever the remote cursor moves or switches tool.
	$effect(() => {
		void position.current.x;
		void position.current.z;
		void cursor.tool;
		invalidate();
	});

	const tipY = CITY_TOP + 0.45;
	const labelInk = $derived(inkOn(cursor.color));
</script>

<T.Group position={[position.current.x, 0, position.current.z]}>
	{#if cursor.tool === 'pen'}
		<!-- Tilted pencil whose tip rests directly on the drawing plane so everyone sees where strokes land. -->
		<T.Group position.y={tipY} rotation={[-0.38, 0.35, -0.42]}>
			<T.Mesh position.y={0.45} rotation.x={Math.PI} renderOrder={14}>
				<T.ConeGeometry args={[0.32, 0.9, 8]} />
				<T.MeshStandardMaterial color="#e7d6b4" roughness={0.7} />
			</T.Mesh>
			<T.Mesh position.y={0.14} rotation.x={Math.PI} renderOrder={15}>
				<T.ConeGeometry args={[0.13, 0.28, 8]} />
				<T.MeshBasicMaterial color={cursor.color} />
			</T.Mesh>
			<T.Mesh position.y={2.05} renderOrder={14}>
				<T.CylinderGeometry args={[0.32, 0.32, 2.3, 6]} />
				<T.MeshStandardMaterial color={cursor.color} roughness={0.5} />
			</T.Mesh>
			<T.Mesh position.y={3.35} renderOrder={14}>
				<T.CylinderGeometry args={[0.33, 0.33, 0.32, 8]} />
				<T.MeshStandardMaterial color="#d8a8a0" roughness={0.6} />
			</T.Mesh>
		</T.Group>
		<T.Mesh position.y={tipY + 0.03} rotation.x={-Math.PI / 2} renderOrder={12}>
			<T.RingGeometry args={[0.42, 0.68, 24]} />
			<T.MeshBasicMaterial color={cursor.color} transparent opacity={0.9} depthWrite={false} />
		</T.Mesh>
	{:else if cursor.tool === 'eraser'}
		<T.Mesh position.y={tipY + 0.04} rotation.x={-Math.PI / 2} renderOrder={12}>
			<T.RingGeometry args={[1.9, 2.25, 32]} />
			<T.MeshBasicMaterial color="#f5ecd8" transparent opacity={0.85} depthWrite={false} />
		</T.Mesh>
		<T.Mesh position.y={tipY + 0.03} rotation.x={-Math.PI / 2} renderOrder={11}>
			<T.CircleGeometry args={[1.9, 32]} />
			<T.MeshBasicMaterial color="#1a140e" transparent opacity={0.22} depthWrite={false} />
		</T.Mesh>
	{:else}
		<T.Mesh position.y={1.6} rotation.x={Math.PI}>
			<T.ConeGeometry args={[0.45, 1.5, 12]} />
			<T.MeshBasicMaterial color={cursor.color} />
		</T.Mesh>
	{/if}
	<HTML
		position.y={cursor.tool === 'pen' ? tipY + 3.8 : 2.6}
		center
		pointerEvents="none"
		style="pointer-events: none"
		zIndexRange={[20, 11]}
	>
		<span class="tag" style:background={cursor.color} style:color={labelInk}>
			{#if cursor.tool === 'pen'}
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path d="M11.8 1.8a1.9 1.9 0 0 1 2.7 2.7L5.4 13.6 1.5 14.5l.9-3.9Z" />
				</svg>
			{:else if cursor.tool === 'eraser'}
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path d="M9.6 2.4 14 6.8l-6.2 6.2H3.6L1.8 11.2a1.4 1.4 0 0 1 0-2Z" />
				</svg>
			{/if}
			{cursor.name}
		</span>
	</HTML>
</T.Group>

<style>
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.08rem 0.42rem;
		border-radius: 2px;
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.45);
		font: 600 0.68rem/1.45 var(--font-ui);
		white-space: nowrap;
		transform: translateY(-0.7rem);
	}

	.tag svg {
		width: 0.72rem;
		height: 0.72rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
