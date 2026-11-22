<script module lang="ts">
	/** The note's lettering and the widest a line may run, in board units, which `Scene` places it by. */
	export const NOTE = { size: 1.7, width: 13 };
</script>

<script lang="ts">
	import { LAND_HEIGHT } from './projection';
	import type { BoardPoint } from './projection';
	import { printNote } from './print.svelte';
	import Printed from './Printed.svelte';

	type Props = { text: string; at: BoardPoint };

	let { text, at }: Props = $props();

	const print = $derived(printNote(text, NOTE.size, NOTE.width));
</script>

<Printed {print} position={[at.x, LAND_HEIGHT + 0.2, at.z]} order={4} />
