<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { tick } from 'svelte';
	import { LIBRARY_RUN } from './library.ts';
	import { gameTitle } from './replay.svelte.ts';
	import type { IndexGame, Loaded, PanelTab, ReplayIndex, SaidNote } from './replay.svelte.ts';

	type Props = {
		loaded: Loaded | null;
		index: ReplayIndex | null;
		current: string | null;
		frame: number;
		tab: PanelTab;
		focus: number | null;
		follow: string | null;
		busy: boolean;
		error: string | null;
		colorOf: (name: string | null) => string;
		go: (frame: number) => void;
		open: (game: IndexGame) => void;
		pick: (file: File) => void;
	};

	let {
		loaded,
		index,
		current,
		frame,
		tab = $bindable(),
		focus,
		follow,
		busy,
		error,
		colorOf,
		go,
		open,
		pick,
	}: Props = $props();

	let list = $state<HTMLElement>();
	const game = $derived(index?.games.find(entry => entry.id === current) ?? null);
	const notes = $derived(game?.notes ?? null);
	const clock = (at: number) =>
		new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	const VERB = { why: ' thinks', issue: ' reports', chat: '', note: '' } as const;

	$effect(() => {
		const wanted = focus;
		void frame;
		if (tab !== 'timeline') return;
		void tick().then(() => {
			const target = wanted !== null ? list?.querySelector(`[data-note="${wanted}"]`) : list?.querySelector('.now');
			target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		});
	});

	$effect(() => {
		// Notes and the games list start at their top, wherever the timeline had scrolled to.
		if (tab !== 'timeline' && list) list.scrollTop = 0;
	});
</script>

{#snippet said(note: SaidNote)}
	<li
		class="note {note.kind}"
		class:live={note.frame === frame}
		class:focused={note.key === focus}
		class:muted={follow !== null && note.by !== follow}
		style:--who={colorOf(note.by)}
		data-note={note.key}
	>
		<span class="by">{note.by}{VERB[note.kind]}</span>
		<span class="time">{clock(note.at)}</span>
		<p>{note.text}</p>
	</li>
{/snippet}

<aside class="side" data-testid="panel" {@attach feedback(undefined, () => ({ tab }))}>
	<header>
		<p class="crumb">
			{#if index?.run === LIBRARY_RUN}{index.title}{:else if index}<a href="/debug/runs">Runs</a> /
				{index.title}{:else}Replay{/if}
		</p>
		{#if loaded}
			<h1>{gameTitle(loaded.record)}</h1>
			{#if game?.outcome}
				<p class="result" class:won={game.outcome.won}>
					{game.outcome.won ? 'Won' : 'Lost'} in {game.turns} turns. {game.outcome.reason}
				</p>
			{/if}
		{:else}
			<h1>Open a recording</h1>
		{/if}
	</header>

	{#if error}<p class="error">{error}</p>{/if}

	{#if loaded}
		<nav>
			<button class:on={tab === 'timeline'} onclick={() => (tab = 'timeline')}>Timeline</button>
			{#if notes}<button class:on={tab === 'notes'} onclick={() => (tab = 'notes')}>Notes</button>{/if}
			{#if index}<button class:on={tab === 'games'} onclick={() => (tab = 'games')} data-testid="tab-games"
					>Games</button
				>{/if}
		</nav>
	{/if}

	<div class="body" bind:this={list}>
		{#if !loaded && !index}
			<p class="hint">A recording is the file the game's menu saves with “Save this game's recording”.</p>
			<label class="file"
				>Choose a recording <input
					type="file"
					accept="application/json"
					onchange={event => {
						const file = event.currentTarget.files?.[0];
						if (file) pick(file);
					}}
				/></label
			>
			<a class="file" href="?src=library">Games played in this browser</a>
		{:else if loaded && tab === 'timeline'}
			<ol class="timeline">
				{#each loaded.timeline as entry, at (entry.frame)}
					{#if at === 0 || loaded.timeline[at - 1]!.turn !== entry.turn}
						<li class="turn">{entry.turn > 0 ? `Turn ${entry.turn}` : at === 0 ? 'Setup' : 'After the game'}</li>
					{/if}
					{#each entry.notes as note (note.key)}{@render said(note)}{/each}
					<li
						class="step"
						class:now={entry.frame === frame}
						class:past={entry.frame < frame}
						class:muted={follow !== null && entry.by !== follow}
					>
						<button onclick={() => go(entry.frame)} style:--who={colorOf(entry.by)}>
							<span class="n">{entry.frame}</span>
							<span class="what">
								{#if entry.who}<b>{entry.who}</b>{/if}
								{entry.text}
								{#if entry.by}<i>{entry.by}</i>{/if}
							</span>
							{#each entry.results as line (line)}<span class="out {line.tone}">{line.text}</span>{/each}
						</button>
					</li>
				{/each}
				{#each loaded.trailing as note (note.key)}{@render said(note)}{/each}
			</ol>
		{:else if loaded && tab === 'notes' && notes}
			<section class="notes" data-testid="notes">
				<p class="lead">{notes.summary}</p>
				<h2>What happened</h2>
				<p>{notes.story}</p>
				{#if notes.highlights.length}
					<h2>Highlights</h2>
					<ul>
						{#each notes.highlights as line (line)}<li>{line}</li>{/each}
					</ul>
				{/if}
				<h2>Rules check</h2>
				<p>{notes.parity}</p>
				{#if notes.findings.length}
					<h2>Findings and fixes</h2>
					{#each notes.findings as row (row.finding)}
						<article class="finding">
							<span class="kind">{row.kind}</span>
							<p class="what">{row.finding}</p>
							<p class="fix">{row.fix}</p>
						</article>
					{/each}
				{/if}
			</section>
		{:else if index}
			<ol class="games" data-testid="games">
				{#each index.games as entry (entry.id)}
					<li>
						<button class:on={entry.id === current} disabled={busy} onclick={() => open(entry)}>
							<span class="title">{gameTitle(entry)}</span>
							<span class="tag" class:won={entry.outcome?.won} class:live={!entry.outcome}
								>{entry.outcome ? (entry.outcome.won ? 'Won' : 'Lost') : 'In play'}</span
							>
							<span class="meta"
								>{entry.outcome ? `${entry.turns} turns, ` : ''}{entry.steps} steps. {entry.players
									.map(player => `${player.name} as ${player.character}`)
									.join(', ')}</span
							>
							{#if entry.notes}<span class="sum">{entry.notes.summary}</span>{/if}
						</button>
					</li>
				{/each}
			</ol>
			{#if !index.games.length}<p class="hint">
					{index.run === LIBRARY_RUN
						? 'This browser has not hosted a game yet.'
						: 'No game of this run has been recorded yet.'}
				</p>{/if}
		{/if}
	</div>
</aside>

<style>
	.side {
		display: flex;
		flex-direction: column;
		height: 100%;
		border-left: 1px solid var(--line);
		background: var(--chrome);
	}

	header {
		padding: 0.9rem 1rem 0.5rem;
	}

	.crumb {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.crumb a {
		color: inherit;
		text-decoration: none;
	}

	.crumb a:hover {
		color: var(--paper);
	}

	h1 {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 400;
		line-height: 1.1;
	}

	.result {
		margin: 0.2rem 0 0;
		color: var(--danger);
		font-size: 0.76rem;
	}

	.result.won {
		color: var(--good);
	}

	.error {
		margin: 0 1rem 0.6rem;
		color: var(--danger);
		font-size: 0.78rem;
	}

	nav {
		display: flex;
		gap: 0.25rem;
		padding: 0 0.8rem 0.5rem;
		border-bottom: 1px solid var(--line);
	}

	nav button {
		padding: 0.3rem 0.7rem;
		border: 0;
		border-radius: 2px;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	nav button.on {
		background: rgb(231 220 198 / 0.1);
		color: var(--ink);
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0.6rem 0.8rem 1rem;
		scrollbar-width: thin;
	}

	.hint {
		color: var(--muted);
		font-size: 0.8rem;
	}

	.file {
		display: block;
		margin-top: 0.6rem;
		padding: 0.6rem 0.8rem;
		border: 1px dashed var(--line-strong);
		border-radius: 2px;
		color: var(--ink);
		font-size: 0.8rem;
		text-decoration: none;
		cursor: pointer;
	}

	.file input {
		display: block;
		margin-top: 0.4rem;
		color: var(--muted);
	}

	ol,
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.turn {
		position: sticky;
		top: -0.6rem;
		margin: 0.7rem -0.8rem 0.3rem;
		padding: 0.25rem 0.8rem;
		background: var(--chrome);
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1rem;
		z-index: 1;
	}

	.muted {
		opacity: 0.4;
	}

	.step button {
		display: grid;
		grid-template-columns: 2.1rem minmax(0, 1fr);
		column-gap: 0.4rem;
		width: 100%;
		padding: 0.28rem 0.4rem;
		border: 0;
		border-left: 2px solid transparent;
		border-radius: 0 2px 2px 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.78rem;
		text-align: left;
		cursor: pointer;
	}

	.step.past button {
		color: #c9bfab;
	}

	.step.now button {
		border-left-color: var(--who);
		background: rgb(220 207 178 / 0.1);
		color: var(--ink);
	}

	.step button:hover {
		background: var(--wash);
	}

	.n {
		padding-top: 0.1rem;
		color: var(--muted);
		font-size: 0.66rem;
		text-align: right;
	}

	.what b {
		color: var(--who);
		font-weight: 650;
	}

	.what i {
		margin-left: 0.3rem;
		color: var(--muted);
		font-size: 0.68rem;
		font-style: normal;
	}

	.out {
		grid-column: 2;
		color: var(--muted);
		font-size: 0.72rem;
	}

	.out.bad {
		color: var(--danger);
	}

	.out.good {
		color: var(--good);
	}

	.out.head {
		display: none;
	}

	.note {
		position: relative;
		margin: 0.35rem 0 0.2rem 2.5rem;
		padding: 0.4rem 0.6rem;
		border-left: 2px solid var(--who);
		border-radius: 0 3px 3px 0;
		background: var(--wash);
		font-size: 0.76rem;
		transition: background 200ms ease;
	}

	.note.why {
		background: none;
		font-family: var(--font-display);
		font-size: 0.84rem;
		font-style: italic;
	}

	.note.issue {
		border-left-color: var(--warn);
		background: rgb(214 165 73 / 0.08);
	}

	.note.live {
		background: rgb(220 207 178 / 0.1);
	}

	.note.focused {
		outline: 1px solid var(--paper);
	}

	.note .by {
		color: var(--who);
		font-family: var(--font-ui);
		font-size: 0.7rem;
		font-style: normal;
		font-weight: 650;
	}

	.note.issue .by {
		color: var(--warn);
	}

	.note .time {
		float: right;
		color: var(--muted);
		font-family: var(--font-ui);
		font-size: 0.64rem;
		font-style: normal;
	}

	.note p {
		margin: 0.15rem 0 0;
		line-height: 1.38;
	}

	.notes {
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.notes .lead {
		margin: 0.2rem 0 0;
		font-size: 0.92rem;
	}

	.notes h2 {
		margin: 1rem 0 0.3rem;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 400;
	}

	.notes p {
		margin: 0;
	}

	.notes ul li {
		position: relative;
		padding: 0.15rem 0 0.15rem 0.9rem;
	}

	.notes ul li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.7em;
		width: 0.3rem;
		height: 0.3rem;
		border-radius: 50%;
		background: var(--good);
	}

	.finding {
		margin-top: 0.5rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 3px;
	}

	.finding .kind {
		color: var(--warn);
		font-size: 0.75rem;
	}

	.finding .fix {
		margin-top: 0.25rem;
		color: var(--muted);
	}

	.games li + li {
		margin-top: 0.4rem;
	}

	.games button {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.15rem 0.5rem;
		width: 100%;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.games button:hover {
		border-color: var(--line-strong);
	}

	.games button.on {
		border-color: var(--paper);
	}

	.games .title {
		font-family: var(--font-display);
		font-size: 1.1rem;
	}

	.tag {
		align-self: center;
		padding: 0.05rem 0.45rem;
		border-radius: 2px;
		background: rgb(207 91 62 / 0.16);
		color: var(--danger);
		font-size: 0.68rem;
	}

	.tag.won {
		background: rgb(141 181 156 / 0.16);
		color: var(--good);
	}

	.tag.live {
		background: rgb(231 220 198 / 0.1);
		color: var(--muted);
	}

	.meta,
	.sum {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 0.72rem;
	}

	.sum {
		color: #c9bfab;
	}
</style>
