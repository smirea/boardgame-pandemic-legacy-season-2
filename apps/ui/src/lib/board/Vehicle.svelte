<script lang="ts">
	import { T } from '@threlte/core';
	import type { Travel } from './types';

	// Small toy-like vehicles built from primitives, pointing along +x. The pawn morphs into one while it travels.
	let { kind, color }: { kind: Travel; color: string } = $props();
	const BONE = '#efe6d2';
	const DARK = '#2a2017';
</script>

{#if kind === 'land'}
	<T.Group position.y={0.32}>
		<T.Mesh castShadow>
			<T.BoxGeometry args={[1.5, 0.42, 0.78]} />
			<T.MeshStandardMaterial {color} roughness={0.6} />
		</T.Mesh>
		<T.Mesh position={[-0.12, 0.36, 0]} castShadow>
			<T.BoxGeometry args={[0.78, 0.34, 0.7]} />
			<T.MeshStandardMaterial color={BONE} roughness={0.5} />
		</T.Mesh>
		{#each [-0.48, 0.48] as x (x)}
			{#each [-0.4, 0.4] as z (z)}
				<T.Mesh position={[x, -0.2, z]} rotation.x={Math.PI / 2}>
					<T.CylinderGeometry args={[0.2, 0.2, 0.14, 14]} />
					<T.MeshStandardMaterial color={DARK} roughness={0.9} />
				</T.Mesh>
			{/each}
		{/each}
	</T.Group>
{:else if kind === 'sea'}
	<T.Group position.y={0.2}>
		<T.Mesh castShadow>
			<T.BoxGeometry args={[1.3, 0.36, 0.7]} />
			<T.MeshStandardMaterial {color} roughness={0.6} />
		</T.Mesh>
		<T.Mesh position={[0.85, 0, 0]} rotation.z={-Math.PI / 2} rotation.y={Math.PI / 4} castShadow>
			<T.ConeGeometry args={[0.5, 0.55, 4]} />
			<T.MeshStandardMaterial {color} roughness={0.6} />
		</T.Mesh>
		<T.Mesh position={[0, 0.75, 0]}>
			<T.CylinderGeometry args={[0.04, 0.05, 1.2, 6]} />
			<T.MeshStandardMaterial color={DARK} />
		</T.Mesh>
		<T.Mesh position={[0.18, 0.78, 0]} rotation.y={Math.PI / 2} castShadow>
			<T.ConeGeometry args={[0.42, 1, 3]} />
			<T.MeshStandardMaterial color={BONE} roughness={0.8} />
		</T.Mesh>
	</T.Group>
{:else}
	<T.Group>
		<T.Mesh rotation.z={-Math.PI / 2} castShadow>
			<T.CylinderGeometry args={[0.16, 0.22, 1.8, 12]} />
			<T.MeshStandardMaterial color={BONE} roughness={0.45} />
		</T.Mesh>
		<T.Mesh position={[1, 0, 0]} rotation.z={-Math.PI / 2}>
			<T.ConeGeometry args={[0.16, 0.3, 12]} />
			<T.MeshStandardMaterial {color} roughness={0.5} />
		</T.Mesh>
		<T.Mesh position={[0.05, 0, 0]} castShadow>
			<T.BoxGeometry args={[0.42, 0.05, 2.1]} />
			<T.MeshStandardMaterial {color} roughness={0.5} />
		</T.Mesh>
		<T.Mesh position={[-0.8, 0.02, 0]}>
			<T.BoxGeometry args={[0.25, 0.04, 0.8]} />
			<T.MeshStandardMaterial {color} roughness={0.5} />
		</T.Mesh>
		<T.Mesh position={[-0.82, 0.24, 0]}>
			<T.BoxGeometry args={[0.28, 0.42, 0.05]} />
			<T.MeshStandardMaterial {color} roughness={0.5} />
		</T.Mesh>
	</T.Group>
{/if}
