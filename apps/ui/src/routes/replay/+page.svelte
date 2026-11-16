<script lang="ts">
	import Engraving from '#lib/board/Engraving.svelte';
	import Game from '#lib/hud/Game.svelte';
	import { SEAT_COLORS } from '#lib/hud/labels.svelte.ts';
	import { gameTitle, load, ReplaySession } from '#lib/replay/replay.svelte.ts';
	import type { IndexGame, Loaded, ReplayIndex } from '#lib/replay/replay.svelte.ts';
	import { LS } from '#lib/storage.ts';
	import { tick } from 'svelte';

	const params = new URLSearchParams(location.search);
	const session = new ReplaySession();

	let loaded = $state.raw<Loaded | null>(null);
	let index = $state.raw<ReplayIndex | null>(null);
	let current = $state<string | null>(null);
	let frame = $state(0);
	let playing = $state(false);
	let speed = $state(1);
	let tab = $state<'timeline' | 'notes' | 'games'>('timeline');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let list = $state<HTMLElement>();

	const total = $derived(loaded?.record.steps.length ?? 0);
	const step = $derived(frame > 0 ? (loaded?.timeline[frame - 1] ?? null) : null);
	const game = $derived(index?.games.find(entry => entry.id === current) ?? null);
	const notes = $derived(game?.notes ?? null);
	const turnStarts = $derived.by(() => {
		const starts: number[] = [];
		let last = -1;
		for (const entry of loaded?.timeline ?? []) {
			if (entry.turn !== last) starts.push(entry.frame);
			last = entry.turn;
		}
		return starts;
	});
	const names = $derived.by(() => {
		const seen: string[] = [];
		for (const entry of [...(loaded?.record.steps ?? []), ...(loaded?.record.notes ?? [])])
			if (entry.by && !seen.includes(entry.by)) seen.push(entry.by);
		return seen;
	});
	const colorOf = (name: string | null) => (name ? SEAT_COLORS[names.indexOf(name) % SEAT_COLORS.length] : '#8a9aa8');
	const clock = (at: number) =>
		new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

	function show(raw: unknown, id: string | null = null) {
		error = null;
		try {
			loaded = load(raw);
			current = id ?? loaded.record.id;
			frame = 0;
			playing = false;
			session.state = loaded.frames[0]!;
			tab = 'timeline';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}
	}

	async function fetchJson(url: string): Promise<unknown> {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`${url} answered ${response.status}`);
		return response.json();
	}

	async function open(entry: IndexGame) {
		busy = true;
		try {
			show(await fetchJson(new URL(entry.file, new URL(params.get('index')!, location.href)).href), entry.id);
			history.replaceState(null, '', `?index=${encodeURIComponent(params.get('index')!)}&game=${entry.id}`);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}
		busy = false;
	}

	async function start() {
		const source = params.get('src');
		const indexUrl = params.get('index');
		try {
			if (indexUrl) {
				index = (await fetchJson(indexUrl)) as ReplayIndex;
				const wanted = index.games.find(entry => entry.id === params.get('game')) ?? index.games.at(-1);
				if (wanted) await open(wanted);
				if (!params.get('game')) tab = 'games';
			} else if (source === 'local') {
				const record = LS.get('record');
				if (record) show(record);
				else error = 'This browser holds no recording. Host or play a game here first.';
			} else if (source) {
				show(await fetchJson(source));
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}
	}
	void start();

	function go(to: number) {
		if (!loaded) return;
		frame = Math.max(0, Math.min(total, to));
		session.state = loaded.frames[frame]!;
	}

	const turnBack = () => go(turnStarts.findLast(at => at < frame) ?? 0);
	const turnOn = () => go(turnStarts.find(at => at > frame) ?? total);

	$effect(() => {
		if (!playing || !loaded) return;
		if (frame >= total) {
			playing = false;
			return;
		}
		// A step with thinking attached stays up longer, so it can be read.
		const upcoming = loaded.timeline[frame]!;
		const wait = (900 + Math.min(upcoming.notes.length, 3) * 1400) / speed;
		const timer = setTimeout(() => go(frame + 1), wait);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		void frame;
		if (tab !== 'timeline') return;
		void tick().then(() => list?.querySelector('.now')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
	});

	$effect(() => {
		// Notes and the games list start at their top, wherever the timeline had scrolled to.
		if (tab !== 'timeline' && list) list.scrollTop = 0;
	});

	function onkey(event: KeyboardEvent) {
		if (!loaded || event.target instanceof HTMLInputElement) return;
		if (event.key === 'ArrowRight') go(frame + 1);
		else if (event.key === 'ArrowLeft') go(frame - 1);
		else if (event.key === 'ArrowUp') turnBack();
		else if (event.key === 'ArrowDown') turnOn();
		else if (event.key === ' ') playing = !playing;
		else return;
		event.preventDefault();
		event.stopImmediatePropagation();
	}

	async function pick(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (file) show(await file.text());
	}
</script>

<svelte:head>
	<title>Legacy: replay</title>
</svelte:head>

<svelte:window onkeydowncapture={onkey} />

<div class="viewer" class:empty={!loaded}>
	{#if !loaded}<Engraving />{/if}
	{#if loaded && session.state}
		<Game {session} spectator />

		<footer class="transport" data-testid="transport">
			<div class="buttons">
				<button onclick={() => go(0)} title="Start" aria-label="Start">⏮</button>
				<button onclick={turnBack} title="Previous turn (↑)" aria-label="Previous turn">⏪</button>
				<button onclick={() => go(frame - 1)} title="Step back (←)" aria-label="Step back" data-testid="step-back"
					>◀</button
				>
				<button class="play" onclick={() => (playing = !playing)} title="Play or pause (space)" data-testid="play"
					>{playing ? '❚❚' : '▶'}</button
				>
				<button
					onclick={() => go(frame + 1)}
					title="Step forward (→)"
					aria-label="Step forward"
					data-testid="step-forward">▶</button
				>
				<button onclick={turnOn} title="Next turn (↓)" aria-label="Next turn">⏩</button>
				<button onclick={() => go(total)} title="End" aria-label="End">⏭</button>
			</div>
			<input
				type="range"
				min="0"
				max={total}
				value={frame}
				oninput={event => go(Number(event.currentTarget.value))}
				aria-label="Position in the game"
				data-testid="scrub"
			/>
			<div class="where" data-testid="where">
				<strong>{frame} / {total}</strong>
				<span>{step ? `Turn ${step.turn}, ${clock(step.at)}` : 'start'}</span>
			</div>
			<select bind:value={speed} aria-label="Speed">
				{#each [0.5, 1, 2, 4, 8] as option (option)}<option value={option}>{option}×</option>{/each}
			</select>
		</footer>
	{/if}

	<aside class="side">
		<header>
			<p class="eyebrow">
				{#if index}<a href="/debug/runs" title="All runs">Runs</a> / {index.title}{:else}Replay{/if}
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
				<label class="file">Choose a recording <input type="file" accept="application/json" onchange={pick} /></label>
				<a class="file" href="?src=local">Replay the game in this browser</a>
			{:else if loaded && tab === 'timeline'}
				<ol class="timeline">
					{#each loaded.timeline as entry, at (entry.frame)}
						{#if at === 0 || loaded.timeline[at - 1]!.turn !== entry.turn}
							<li class="turn">{entry.turn === 0 ? 'Setup' : `Turn ${entry.turn}`}</li>
						{/if}
						{#each entry.notes as note (note)}
							<li class="note {note.kind}" style:--who={colorOf(note.by)}>
								<span class="by"
									>{note.by}{note.kind === 'why' ? ' thinks' : note.kind === 'issue' ? ' reports' : ''}</span
								>
								<span class="time">{clock(note.at)}</span>
								<p>{note.text}</p>
							</li>
						{/each}
						<li class="step" class:now={entry.frame === frame} class:past={entry.frame < frame}>
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
					{#each loaded.trailing as note (note)}
						<li class="note {note.kind}" style:--who={colorOf(note.by)}>
							<span class="by">{note.by}</span><span class="time">{clock(note.at)}</span>
							<p>{note.text}</p>
						</li>
					{/each}
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
				{#if !index.games.length}<p class="hint">No game of this run has been recorded yet.</p>{/if}
			{/if}
		</div>
	</aside>
</div>

<style>
	.viewer {
		--side: 21.5rem;
		--bar: 3.4rem;
		--game-inset: 0 var(--side) var(--bar) 0;
		position: fixed;
		inset: 0;
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
		font-variant-numeric: tabular-nums;
	}

	/* On a smaller laptop the timeline gives the board more of the width. */
	@media (width < 1400px) {
		.viewer {
			--side: 17.5rem;
		}
	}

	.viewer.empty {
		--side: min(30rem, 100vw);
		display: grid;
		place-items: center;
	}

	.transport {
		position: fixed;
		left: 0;
		right: var(--side);
		bottom: 0;
		height: var(--bar);
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0 0.9rem;
		border-top: 1px solid var(--line);
		background: var(--chrome);
		z-index: 90;
	}

	.buttons {
		display: flex;
		gap: 0.2rem;
	}

	.transport button {
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		background: none;
		color: var(--ink);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.transport button:hover {
		border-color: var(--accent);
	}

	.transport .play {
		width: 2.6rem;
		background: var(--paper);
		border-color: var(--paper);
		color: var(--paper-ink);
		font-weight: 700;
	}

	.transport input[type='range'] {
		flex: 1;
		accent-color: var(--paper);
	}

	.where {
		display: flex;
		flex-direction: column;
		min-width: 8.5rem;
		font-size: 0.72rem;
		line-height: 1.25;
	}

	.where span {
		color: var(--muted);
	}

	.transport select {
		padding: 0.25rem 0.3rem;
		border: 1px solid var(--line);
		border-radius: 0.35rem;
		background: var(--chrome);
		color: var(--ink);
		font: inherit;
		font-size: 0.75rem;
	}

	.side {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: var(--side);
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--line);
		background: var(--chrome);
		z-index: 90;
	}

	.empty .side {
		position: relative;
		height: auto;
		max-height: 90vh;
		border: 1px solid var(--line);
		border-radius: 3px;
	}

	header {
		padding: 0.9rem 1rem 0.5rem;
	}

	.eyebrow {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.eyebrow a {
		color: inherit;
		text-decoration: none;
	}

	.eyebrow a:hover {
		color: var(--accent);
	}

	h1 {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-size: 1.45rem;
		font-weight: 400;
		line-height: 1.1;
	}

	.result {
		margin: 0.2rem 0 0;
		color: var(--danger);
		font-size: 0.74rem;
	}

	.result.won {
		color: var(--accent);
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
		font-size: 0.76rem;
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
		font-size: 0.95rem;
		z-index: 1;
	}

	.step button {
		display: grid;
		grid-template-columns: 2.1rem minmax(0, 1fr);
		column-gap: 0.4rem;
		width: 100%;
		padding: 0.28rem 0.4rem;
		border: 0;
		border-left: 2px solid transparent;
		border-radius: 0 0.35rem 0.35rem 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.76rem;
		text-align: left;
		cursor: pointer;
	}

	.step.past button {
		color: #c9bfab;
	}

	.step.now button {
		border-left-color: var(--paper);
		background: rgb(220 207 178 / 0.1);
		color: var(--ink);
	}

	.step button:hover {
		background: var(--wash);
	}

	.n {
		color: var(--muted);
		font-size: 0.66rem;
		text-align: right;
		padding-top: 0.1rem;
	}

	.what b {
		color: var(--who);
		font-weight: 650;
	}

	.what i {
		margin-left: 0.3rem;
		color: var(--muted);
		font-size: 0.66rem;
		font-style: normal;
	}

	.out {
		grid-column: 2;
		color: var(--muted);
		font-size: 0.7rem;
	}

	.out.bad {
		color: var(--danger);
	}

	.out.good {
		color: var(--accent);
	}

	.out.head {
		display: none;
	}

	.note {
		position: relative;
		margin: 0.35rem 0 0.2rem 2.5rem;
		padding: 0.4rem 0.6rem;
		border-left: 2px solid var(--who);
		border-radius: 0 0.45rem 0.45rem 0;
		background: var(--wash);
		font-size: 0.74rem;
	}

	.note.why {
		background: none;
		font-style: italic;
	}

	.note.issue {
		border-left-color: var(--warn);
		background: rgb(214 165 73 / 0.08);
	}

	.note .by {
		color: var(--who);
		font-size: 0.68rem;
		font-style: normal;
		font-weight: 650;
	}

	.note.issue .by {
		color: var(--warn);
	}

	.note .time {
		float: right;
		color: var(--muted);
		font-size: 0.64rem;
		font-style: normal;
	}

	.note p {
		margin: 0.15rem 0 0;
		line-height: 1.35;
	}

	.notes {
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.notes .lead {
		margin: 0.2rem 0 0;
		font-size: 0.9rem;
	}

	.notes h2 {
		margin: 1rem 0 0.3rem;
		color: var(--ink);
		font-family: var(--font-display);
		font-size: 1.05rem;
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
		background: var(--accent);
	}

	.finding {
		margin-top: 0.5rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
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
		border-radius: 0.55rem;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.games button.on {
		border-color: var(--paper);
	}

	.games .title {
		font-family: var(--font-display);
		font-size: 1.05rem;
	}

	.tag {
		align-self: center;
		padding: 0.05rem 0.45rem;
		border-radius: 2px;
		background: rgb(207 91 62 / 0.16);
		color: var(--danger);
		font-size: 0.66rem;
	}

	.tag.won {
		background: rgb(141 181 156 / 0.16);
		color: var(--accent);
	}

	.tag.live {
		background: rgb(231 220 198 / 0.1);
		color: var(--muted);
	}

	.meta,
	.sum {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 0.7rem;
	}

	.sum {
		color: #c9bfab;
	}
</style>
