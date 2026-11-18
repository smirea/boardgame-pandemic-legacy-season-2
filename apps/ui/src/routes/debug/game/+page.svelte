<script lang="ts">
	import Crash from '#lib/hud/Crash.svelte';
	import Game from '#lib/hud/Game.svelte';
	import { GameSession } from '#lib/session/session.svelte.ts';
	import { onDestroy } from 'svelte';

	// The real machine and the real game screen with every seat on this client and no networking.
	const session = new GameSession({ mode: 'solo', secret: '' });
	window.DEBUG = session.debugApi();
	onDestroy(() => {
		session.close();
		delete window.DEBUG;
	});
</script>

<svelte:head>
	<title>Legacy: debug game</title>
</svelte:head>

{#if session.state}
	<svelte:boundary>
		<Game {session} />
		{#snippet failed(error)}
			<Crash {error} {session} />
		{/snippet}
	</svelte:boundary>
{/if}
