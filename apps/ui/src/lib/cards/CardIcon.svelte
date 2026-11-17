<script lang="ts">
	let { path, size = '1rem' }: { path: string; size?: string } = $props();
</script>

<svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true"><path d={path} /></svg>

<style>
	svg {
		display: block;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
