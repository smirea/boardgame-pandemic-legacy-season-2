<script lang="ts">
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import favicon from '#lib/assets/favicon.svg';
	import './layout.css';

	let { children } = $props();
	const browser = typeof window !== 'undefined';

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				enabled: browser,
			},
		},
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={favicon} />
</svelte:head>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>
