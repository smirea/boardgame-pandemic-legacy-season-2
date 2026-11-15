<script lang="ts">
	import { T } from '@threlte/core';
	import { HTML } from '@threlte/extras';
	import { untrack } from 'svelte';
	import { Spring } from 'svelte/motion';
	import type { CursorView } from './types';

	let { cursor }: { cursor: CursorView } = $props();

	// Presence arrives at ~30 Hz, so the spring fills the frames between samples.
	const position = new Spring(
		untrack(() => ({ x: cursor.x, z: cursor.z })),
		{ stiffness: 0.25, damping: 0.7 },
	);
	$effect(() => {
		position.target = { x: cursor.x, z: cursor.z };
	});
</script>

<T.Group position={[position.current.x, 0, position.current.z]}>
	<T.Mesh position.y={1.6} rotation.x={Math.PI}>
		<T.ConeGeometry args={[0.45, 1.5, 12]} />
		<T.MeshBasicMaterial color={cursor.color} />
	</T.Mesh>
	<HTML position.y={2.6} center pointerEvents="none" style="pointer-events: none" zIndexRange={[20, 11]}>
		<span class="tag" style:background={cursor.color}>{cursor.name}</span>
	</HTML>
</T.Group>

<style>
	.tag {
		padding: 0.05rem 0.4rem;
		border-radius: 0.25rem;
		color: #0b1015;
		font:
			700 0.65rem/1.5 system-ui,
			sans-serif;
		white-space: nowrap;
		transform: translateY(-0.9rem);
		display: block;
	}
</style>
