<script module lang="ts">
	import { pack } from '@repo/game';
	import type { JobId } from '@repo/game';

	const files = import.meta.glob<string>('./icons/*.svg', { query: '?raw', import: 'default', eager: true });
	const ICONS: Record<string, string> = Object.fromEntries(
		Object.entries(files).map(([path, svg]) => [path.slice('./icons/'.length, -'.svg'.length), svg]),
	);
	const missing = pack.jobs.filter(job => !ICONS[job.id]).map(job => job.id);
	if (missing.length) throw new Error(`No occupation icon in occupations/icons for: ${missing.join(', ')}`);
</script>

<script lang="ts">
	/** An occupation's mark, drawn in the surrounding text colour. */
	let { job }: { job: JobId } = $props();
</script>

<span class="icon" aria-hidden="true">{@html ICONS[job]}</span>

<style>
	.icon {
		display: block;
		width: 100%;
		height: 100%;
	}

	.icon :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
