<script lang="ts">
	import Engraving from '#lib/board/Engraving.svelte';
	import Game from '#lib/hud/Game.svelte';
	import Caption from '#lib/replay/Caption.svelte';
	import Corner from '#lib/hud/Corner.svelte';
	import Panel from '#lib/replay/Panel.svelte';
	import { bubblesAt, dwellAt } from '#lib/replay/pacing.ts';
	import { keepStoredGame, LIBRARY_RUN, libraryIndex, libraryRecord } from '#lib/replay/library.ts';
	import { load, marksAt, ReplaySession } from '#lib/replay/replay.svelte.ts';
	import type { IndexGame, Loaded, PanelTab, ReplayIndex, SaidNote } from '#lib/replay/replay.svelte.ts';
	import Transport, { SPEEDS } from '#lib/replay/Transport.svelte';
	import { typing } from '#lib/keys.ts';
	import { LS } from '#lib/storage.ts';

	const params = new URLSearchParams(location.search);
	const session = new ReplaySession();
	const saved = { speed: 1, panel: true, bubbles: true, ...LS.get('replay') };

	let loaded = $state.raw<Loaded | null>(null);
	let index = $state.raw<ReplayIndex | null>(null);
	let current = $state<string | null>(null);
	let frame = $state(0);
	let playing = $state(false);
	let speed = $state(SPEEDS.includes(saved.speed) ? saved.speed : 1);
	let panel = $state(saved.panel);
	let bubbles = $state(saved.bubbles);
	let follow = $state<string | null>(null);
	let keys = $state(false);
	let focus = $state<number | null>(null);
	let tab = $state<PanelTab>('timeline');
	let error = $state<string | null>(null);
	let busy = $state(false);
	/** Whether the last move was one step forward, which the game screen announces, rather than a jump. */
	let stepped = $state(true);

	$effect(() => LS.set({ replay: { speed, panel, bubbles } }));

	const total = $derived(loaded?.record.steps.length ?? 0);
	const step = $derived(frame > 0 ? (loaded?.timeline[frame - 1] ?? null) : null);
	const seated = $derived((loaded?.cast ?? []).filter(member => member.seat).slice(0, 4));
	const said = $derived(loaded && bubbles ? bubblesAt(loaded, frame, follow) : new Map<string, SaidNote[]>());
	const marks = $derived(loaded ? marksAt(loaded, frame) : undefined);
	const colorOf = (name: string | null) => loaded?.cast.find(member => member.name === name)?.color ?? '#8a9aa8';
	const turnStarts = $derived([
		0,
		...(loaded?.markers ?? []).filter(marker => marker.kind === 'turn').map(marker => marker.frame),
	]);
	const moments = $derived(
		(loaded?.markers ?? []).filter(marker => marker.kind !== 'turn').map(marker => marker.frame),
	);

	function show(raw: unknown, id: string | null = null, players: string[] = []) {
		error = null;
		try {
			loaded = load(raw, players);
			current = id ?? loaded.record.id;
			frame = 0;
			playing = false;
			follow = null;
			focus = null;
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
			const library = index?.run === LIBRARY_RUN;
			const raw = library
				? await libraryRecord(entry.file)
				: await fetchJson(new URL(entry.file, new URL(params.get('index')!, location.href)).href);
			show(
				raw,
				entry.id,
				entry.players.map(player => player.name),
			);
			history.replaceState(
				null,
				'',
				library
					? `?src=library&game=${entry.id}`
					: `?index=${encodeURIComponent(params.get('index')!)}&game=${entry.id}`,
			);
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
				const wanted = index.games.find(entry => entry.id === params.get('game')) ?? index.games[0];
				if (wanted) await open(wanted);
				if (!params.get('game')) {
					tab = 'games';
					panel = true;
				}
			} else if (source === 'library') {
				await keepStoredGame().catch(cause => console.warn('The last recording was not kept:', cause));
				index = await libraryIndex();
				// The game just played is the one a player opening this from the game's menu wants.
				const wanted = index.games.find(entry => entry.id === params.get('game')) ?? index.games.at(-1);
				if (wanted) await open(wanted);
				else {
					tab = 'games';
					panel = true;
				}
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
		to = Math.max(0, Math.min(total, to));
		stepped = to === frame + 1;
		frame = to;
		session.state = loaded.frames[frame]!;
	}

	const turn = (direction: -1 | 1) =>
		go(direction < 0 ? (turnStarts.findLast(at => at < frame) ?? 0) : (turnStarts.find(at => at > frame) ?? total));
	const moment = (direction: -1 | 1) =>
		go(direction < 0 ? (moments.findLast(at => at < frame) ?? 0) : (moments.find(at => at > frame) ?? total));
	const cycleSpeed = () => (speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!);
	const toggleFollow = (name: string) => (follow = follow === name ? null : name);

	function reveal(note: SaidNote) {
		playing = false;
		panel = true;
		tab = 'timeline';
		focus = note.key;
	}

	$effect(() => {
		if (!playing || !loaded) return;
		if (frame >= total) {
			const games = index?.games ?? [];
			const at = games.findIndex(entry => entry.id === current);
			const next = at >= 0 ? games[at + 1] : undefined;
			if (!next) {
				playing = false;
				return;
			}
			// A run plays on through the year: the next game opens and keeps playing.
			const timer = setTimeout(() => open(next).then(() => (playing = !error)), 1500 / speed);
			return () => clearTimeout(timer);
		}
		const timer = setTimeout(() => go(frame + 1), dwellAt(loaded, frame, { bubbles, follow }) / speed);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		// A note brought into view stays marked only until the replay moves on.
		void frame;
		return () => (focus = null);
	});

	function onkey(event: KeyboardEvent) {
		if (!loaded || event.metaKey || event.ctrlKey || event.altKey || typing(event)) return;
		const key = event.key;
		if (key === 'ArrowRight') go(frame + 1);
		else if (key === 'ArrowLeft') go(frame - 1);
		else if (key === 'ArrowUp') turn(-1);
		else if (key === 'ArrowDown') turn(1);
		else if (key === '[') moment(-1);
		else if (key === ']') moment(1);
		else if (key === 'Home') go(0);
		else if (key === 'End') go(total);
		else if (key === ' ') playing = !playing;
		else if (key === 's' || key === 'S') cycleSpeed();
		else if (key === 'b' || key === 'B') bubbles = !bubbles;
		else if (key === 't' || key === 'T') panel = !panel;
		else if (key === '?') keys = !keys;
		else if (key === 'Escape' && keys) keys = false;
		else if (/^[1-4]$/.test(key) && seated[Number(key) - 1]) toggleFollow(seated[Number(key) - 1]!.name);
		else return;
		event.preventDefault();
		event.stopImmediatePropagation();
	}
</script>

<svelte:head>
	<title>Legacy: replay</title>
</svelte:head>

<svelte:window onkeydowncapture={onkey} />

<div class="viewer" class:empty={!loaded} class:closed={loaded && !panel}>
	{#if !loaded}<Engraving />{/if}
	{#if loaded && session.state}
		<Game {session} spectator {marks} announce={stepped}>
			{#snippet corner(seat, place)}
				{@const member = seated.find(entry => entry.seat === seat)}
				{#if member}
					<Corner
						name={member.name}
						{seat}
						color={member.color}
						world={session.state!.world}
						acting={session.state!.phase === 'playing.actions'}
						{place}
						notes={said.get(member.name) ?? []}
						dimmed={follow !== null && follow !== member.name}
						selected={follow === member.name}
						action={follow === member.name ? `Stop following ${member.name}` : `Follow ${member.name}`}
						selectedTag="Following"
						onselect={() => toggleFollow(member.name)}
						onnote={reveal}
					/>
				{/if}
			{/snippet}
			{#if session.state.world.game}
				<Caption {step} color={step?.by ? colorOf(step.by) : null} />
			{/if}
		</Game>

		<div class="rail">
			<Transport
				{frame}
				{total}
				turn={step?.turn ?? 0}
				clock={step ? new Date(step.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
				markers={loaded.markers}
				{playing}
				{speed}
				{bubbles}
				{panel}
				{follow}
				{keys}
				{go}
				onplay={() => (playing = !playing)}
				onspeed={cycleSpeed}
				onturn={turn}
				onbubbles={() => (bubbles = !bubbles)}
				onpanel={() => (panel = !panel)}
				onkeys={() => (keys = !keys)}
				onunfollow={() => (follow = null)}
			/>
		</div>
	{/if}

	{#if !loaded || panel}
		<div class="side">
			<Panel
				{loaded}
				{index}
				{current}
				{frame}
				bind:tab
				{focus}
				{follow}
				{busy}
				{error}
				{colorOf}
				{go}
				{open}
				pick={async file => show(await file.text())}
			/>
		</div>
	{/if}
</div>

<style>
	.viewer {
		--side: 22rem;
		--bar: 3.6rem;
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
			--side: 18.5rem;
		}
	}

	.viewer.closed {
		--side: 0rem;
	}

	.viewer.empty {
		--side: min(30rem, 100vw);
		display: grid;
		place-items: center;
	}

	.rail {
		position: fixed;
		left: 0;
		right: var(--side);
		bottom: 0;
		height: var(--bar);
		z-index: 90;
	}

	.side {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: var(--side);
		z-index: 90;
	}

	.empty .side {
		position: relative;
		height: auto;
		max-height: 90vh;
		border: 1px solid var(--line);
		border-radius: 3px;
		overflow: hidden;
	}
</style>
