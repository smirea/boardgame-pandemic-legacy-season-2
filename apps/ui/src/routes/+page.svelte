<script lang="ts">
	import Game from '#lib/hud/Game.svelte';
	import { GameSession } from '#lib/session/session.svelte.ts';
	import type { Mode } from '#lib/session/session.svelte.ts';
	import { LS } from '#lib/storage.ts';
	import { onDestroy } from 'svelte';

	const browser = typeof window !== 'undefined';

	let name = $state(LS.get('name', ''));
	let secret = $state(LS.get('passphrase', ''));
	let session = $state<GameSession | null>(null);
	let error = $state<string | null>(null);

	function start(mode: Mode) {
		error = null;
		LS.set({ name, passphrase: secret, mode });
		try {
			session = new GameSession({ mode, name: name.trim() || 'Player', secret });
			window.DEBUG = session.debugApi();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
			LS.set({ mode: null });
		}
	}

	// A reload keeps the player in the game they were in.
	const resume = browser ? LS.get('mode') : null;
	if (resume) start(resume);
	onDestroy(() => {
		session?.close();
		if (browser) delete window.DEBUG;
	});

	function leave() {
		session?.close();
		session = null;
		LS.set({ mode: null });
		delete window.DEBUG;
	}
</script>

<svelte:head>
	<title>Legacy</title>
</svelte:head>

{#if session?.fatal}
	<main class="landing">
		<section>
			<h1>Disconnected</h1>
			<p>{session.fatal}</p>
			<button class="primary" onclick={leave}>Back</button>
		</section>
	</main>
{:else if session?.state}
	<Game {session} />
{:else if session}
	<main class="landing">
		<section>
			<h1>Looking for the host</h1>
			<p>Status: {session.status}. The game appears as soon as the host is online.</p>
			<button onclick={leave}>Cancel</button>
		</section>
	</main>
{:else}
	<main class="landing">
		<section>
			<h1>Legacy</h1>
			<p>
				A co-op campaign for two to four players. One player hosts and keeps the save. Everyone else joins them
				directly.
			</p>
			<label>Your name <input bind:value={name} maxlength="24" placeholder="Name" data-testid="name" /></label>
			<label
				>Passphrase <input
					bind:value={secret}
					type="password"
					placeholder="Shared with your group"
					data-testid="passphrase"
				/></label
			>
			<div class="buttons">
				<button class="primary" disabled={!secret} onclick={() => start('host')} data-testid="host">Host</button>
				<button disabled={!secret} onclick={() => start('join')} data-testid="join">Join</button>
				<button onclick={() => start('solo')} data-testid="solo">Play on this screen</button>
			</div>
			{#if error}<p class="error">{error}</p>{/if}
		</section>
	</main>
{/if}

<style>
	.landing {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: radial-gradient(ellipse at 50% 30%, #16222e 0%, #070b0f 70%);
		color: #e9e6dc;
		font-family: 'Avenir Next', 'Segoe UI', system-ui, sans-serif;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		width: min(26rem, 90vw);
	}

	h1 {
		margin: 0;
		font-size: 3rem;
		font-weight: 650;
		letter-spacing: -0.02em;
	}

	p {
		margin: 0;
		color: #8a9aa8;
		line-height: 1.5;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		color: #8a9aa8;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	input,
	button {
		padding: 0.6rem 0.8rem;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 0.5rem;
		background: rgb(255 255 255 / 0.05);
		color: inherit;
		font: inherit;
		font-size: 0.95rem;
		letter-spacing: normal;
		text-transform: none;
	}

	.buttons {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.4rem;
	}

	button {
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.primary {
		border-color: #7dfcc0;
		background: #7dfcc0;
		color: #06120c;
		font-weight: 700;
	}

	.error {
		color: #ff6b6b;
	}
</style>
