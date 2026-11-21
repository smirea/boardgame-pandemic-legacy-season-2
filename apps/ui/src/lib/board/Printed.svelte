<script lang="ts">
	import { T } from '@threlte/core';
	import type { Print } from './print.svelte';

	type Props = {
		print: Print;
		position: [number, number, number];
		opacity?: number;
		/** Prints draw after the fog's sheets (orders 1 and 2), and higher orders lie over lower ones where they cross. */
		order?: number;
		visible?: boolean;
	};

	let { print, position, opacity = 1, order = 4, visible = true }: Props = $props();

	$effect(() => {
		const texture = print.texture;
		return () => texture.dispose();
	});
</script>

<!-- Ink lies flat on the chart and writes no depth, so any piece or line standing on it covers it. -->
<T.Mesh {position} rotation.x={-Math.PI / 2} receiveShadow renderOrder={order} {visible}>
	<T.PlaneGeometry args={[print.width, print.height]} />
	<T.MeshStandardMaterial map={print.texture} transparent depthWrite={false} roughness={0.92} metalness={0} {opacity} />
</T.Mesh>
