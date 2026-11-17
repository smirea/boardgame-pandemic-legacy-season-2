<script lang="ts">
	import type { Action } from '@repo/game';
	import { ACTION_ICON } from './labels.svelte.ts';

	let { action, size = '2rem' }: { action: Action['a']; size?: string } = $props();
</script>

<i class="icon" style:--size={size} style:--x={`${(ACTION_ICON[action] * 100) / 15}%`} aria-hidden="true"></i>

<style>
	.icon {
		display: block;
		flex: none;
		width: var(--size);
		height: var(--size);
		border-radius: 0.3rem;
		background: url('/actions/icons.webp') var(--x) 0 / 1600% 100% no-repeat;
		box-shadow:
			inset 0 0 0 1px rgb(42 32 23 / 0.35),
			0 1px 2px rgb(0 0 0 / 0.35);
	}
</style>
