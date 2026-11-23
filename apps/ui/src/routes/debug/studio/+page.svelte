<script lang="ts">
	import { feedback } from '@stefan.inc/feedback-engine/svelte';
	import { createGameActor, parseSave, publicState, scenarios } from '@repo/game';
	import type { Save } from '@repo/game';
	import { parseScene, sceneOf, VIEWPORTS } from '#lib/studio/scene.ts';
	import type { StudioScene } from '#lib/studio/scene.ts';
	import { allShots, putShots, readShotFile, removeShots, shotFile } from '#lib/studio/shots.ts';
	import type { Shot } from '#lib/studio/shots.ts';
	import { STAGE_CHANGED } from '#lib/studio/stage.ts';
	import type { StageApi, StudioApi } from '#lib/studio/stage.ts';
	import { LS } from '#lib/storage.ts';
	import { onDestroy } from 'svelte';

	const view = LS.get('studioView', { viewport: { width: 1440, height: 810 }, panel: false });
	let viewport = $state(view.viewport);
	let panel = $state(view.panel);
	$effect(() => LS.set({ studioView: { viewport: { ...viewport }, panel } }));

	let frame = $state<HTMLIFrameElement>();
	let room = $state({ width: 0, height: 0 });
	const scale = $derived(
		Math.min(1, (room.width || viewport.width) / viewport.width, (room.height || viewport.height) / viewport.height),
	);

	let connected = $state(false);
	let info = $state.raw<{ phase: string; month: number; turn: number | null; at: number; states: number } | null>(null);
	let pinned = $state.raw<{ x: number; y: number } | null>(null);
	let busy = $state('');
	let problems = $state.raw<string[]>([]);
	let draft = $state('');
	let shots = $state.raw<Shot[]>([]);
	let selected = $state.raw<string[]>([]);
	let viewing = $state.raw<Shot | null>(null);
	let dialog = $state<HTMLDialogElement>();
	let fileInput = $state<HTMLInputElement>();
	let saveInput = $state<HTMLInputElement>();

	function stage(): StageApi {
		const api = frame?.contentWindow?.STAGE;
		if (!api) throw new Error('The stage has not loaded yet');
		return api;
	}

	function refresh() {
		const api = frame?.contentWindow?.STAGE;
		if (!api) return;
		const state = api.state();
		const history = api.history();
		info = {
			phase: state.phase,
			month: state.world.campaign.month,
			turn: state.world.game?.turn ?? null,
			at: history.at,
			states: history.saves.length,
		};
		pinned = api.pinned();
	}

	// The stage reloads on its own when its code changes, so each load is met again.
	async function met() {
		connected = false;
		const window = frame!.contentWindow!;
		while (!window.STAGE) await new Promise(resolve => setTimeout(resolve, 30));
		window.addEventListener(STAGE_CHANGED, refresh);
		window.addEventListener('keydown', onkey, true);
		await window.STAGE.ready();
		connected = true;
		refresh();
	}

	async function during<T>(label: string, work: () => Promise<T>): Promise<T> {
		busy = label;
		try {
			return await work();
		} catch (error) {
			problems = [error instanceof Error ? error.message : String(error)];
			throw error;
		} finally {
			busy = '';
		}
	}

	async function setViewport(width: number, height: number) {
		viewport = { width, height };
		// The frame takes its new size on the next frame, and the game lays itself out again after that.
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		await stage().ready();
	}

	const load = (scene: StudioScene) =>
		during('Loading', async () => {
			await setViewport(scene.viewport.width, scene.viewport.height);
			problems = await stage().load(scene);
			refresh();
			return problems;
		});

	const loadSave = (save: Save) => load(sceneOf(save, { viewport: { ...viewport } }));

	const describe = (scene: StudioScene) => {
		const { phase, world } = scene.save;
		const turn = world.game ? `, turn ${world.game.turn}` : '';
		return `${phase}, month ${world.campaign.month}${turn}`;
	};

	const capture = (name?: string) =>
		during('Capturing', async () => {
			const taken = await stage().capture();
			const shot: Shot = {
				id: crypto.randomUUID(),
				at: Date.now(),
				name: name ?? describe(taken.scene),
				scene: taken.scene,
				image: taken.image,
			};
			await putShots([shot]);
			shots = [shot, ...shots];
			return shot;
		});

	async function remove(ids: string[]) {
		await removeShots(ids);
		for (const id of ids) {
			const url = urls.get(id);
			if (url) URL.revokeObjectURL(url);
			urls.delete(id);
		}
		shots = shots.filter(shot => !ids.includes(shot.id));
		selected = selected.filter(id => !ids.includes(id));
	}

	async function importFile(raw: unknown) {
		const added = await readShotFile(raw);
		await putShots(added);
		shots = await allShots();
		return added;
	}

	const exportShots = (ids?: string[]) => shotFile(ids ? shots.filter(shot => ids.includes(shot.id)) : shots);

	function saveFile(name: string, content: string) {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
		link.download = name;
		link.click();
		URL.revokeObjectURL(link.href);
	}
	const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
	const download = (ids?: string[]) =>
		during('Exporting', async () =>
			saveFile(`studio-shots-${stamp()}.json`, JSON.stringify(await exportShots(ids), null, '\t')),
		);

	// Each picture is shown from an object URL, made once and released when its shot goes.
	const urls = new Map<string, string>();
	function urlOf(shot: Shot) {
		if (!urls.has(shot.id)) urls.set(shot.id, URL.createObjectURL(shot.image));
		return urls.get(shot.id)!;
	}
	onDestroy(() => urls.forEach(url => URL.revokeObjectURL(url)));

	void allShots().then(stored => (shots = stored));

	function togglePin() {
		const api = stage();
		const at = api.pointer();
		api.pin(at ?? null);
	}

	function onkey(event: KeyboardEvent) {
		if (!event.altKey || event.metaKey || event.ctrlKey) return;
		if (event.code === 'KeyC') void capture();
		else if (event.code === 'KeyP') togglePin();
		else return;
		event.preventDefault();
		event.stopPropagation();
	}

	const freshCampaign = (): Save => {
		const fresh = publicState(createGameActor({ seed: Math.floor(Math.random() * 2 ** 31) }).getSnapshot());
		return { v: 1, phase: fresh.phase, world: fresh.world };
	};
	const STARTS: Record<string, () => Save> = {
		'New campaign': freshCampaign,
		'Canonical save (September lobby)': () => scenarios.canonical(),
	};
	function startFrom(choice: string) {
		if (choice === 'file') return saveInput?.click();
		const make = STARTS[choice];
		if (make) void loadSave(make());
	}

	function readStage() {
		draft = JSON.stringify(stage().scene(), null, '\t');
	}
	$effect(() => {
		if (panel && connected && !draft) readStage();
	});

	function show(shot: Shot) {
		viewing = shot;
		dialog?.showModal();
	}

	const api: StudioApi = {
		ready: async () => {
			while (!frame?.contentWindow?.STAGE) await new Promise(resolve => setTimeout(resolve, 30));
			await stage().ready();
		},
		settle: () => stage().settle(),
		scene: () => stage().scene(),
		state: () => stage().state(),
		send: command => stage().send(command),
		bot: steps => stage().bot(steps),
		pin: point => stage().pin(point),
		history: () => stage().history(),
		rewind: at => stage().rewind(at),
		load,
		capture,
		shots: () => shots,
		remove,
		export: exportShots,
		import: importFile,
		setViewport,
		sceneOf,
		scenarios,
	};
	window.STUDIO = api;
	onDestroy(() => delete window.STUDIO);

	const when = (at: number) =>
		new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	const summary = (scene: StudioScene) =>
		JSON.stringify({ viewport: scene.viewport, player: scene.player, ui: scene.ui, save: describe(scene) }, null, 2);
</script>

<svelte:head>
	<title>Legacy: studio</title>
</svelte:head>

<svelte:window onkeydowncapture={onkey} />

<div class="studio" class:panel {@attach feedback('Studio', () => ({ viewport, info, shots: shots.length, selected }))}>
	<header class="bar">
		<a class="home" href="/debug">Debug</a>
		<h1>Studio</h1>

		<select
			aria-label="Start the stage from"
			onchange={event => {
				startFrom(event.currentTarget.value);
				event.currentTarget.value = '';
			}}
		>
			<option value="" selected disabled>Start from…</option>
			{#each Object.keys(STARTS) as name (name)}<option>{name}</option>{/each}
			<option value="file">A campaign save file…</option>
		</select>

		<select
			aria-label="Stage size"
			value={`${viewport.width}x${viewport.height}`}
			onchange={event => {
				const [width, height] = event.currentTarget.value.split('x').map(Number);
				void setViewport(width!, height!);
			}}
		>
			{#each VIEWPORTS as size (size.name)}
				<option value={`${size.width}x${size.height}`}>{size.name} · {size.width}×{size.height}</option>
			{/each}
			{#if !VIEWPORTS.some(size => size.width === viewport.width && size.height === viewport.height)}
				<option value={`${viewport.width}x${viewport.height}`}>Custom · {viewport.width}×{viewport.height}</option>
			{/if}
		</select>

		<div class="group" role="group" aria-label="State history">
			<button
				disabled={!info || info.at <= 0}
				onclick={() => void during('Rewinding', () => stage().rewind(info!.at - 1))}
				aria-label="The state before this one">◀</button
			>
			<span class="count" data-testid="history">{info ? `${info.at + 1} / ${info.states}` : '–'}</span>
			<button
				disabled={!info || info.at >= info.states - 1}
				onclick={() => void during('Rewinding', () => stage().rewind(info!.at + 1))}
				aria-label="The state after this one">▶</button
			>
		</div>

		<div class="group" role="group" aria-label="Random play">
			<span class="label">Bot</span>
			{#each [1, 10, 100] as steps (steps)}
				<button onclick={() => stage().bot(steps)}>+{steps}</button>
			{/each}
		</div>

		<span class="where" data-testid="where">
			{#if info}{info.phase} · month {info.month}{info.turn === null ? '' : ` · turn ${info.turn}`}{/if}
		</span>

		<span class="spacer"></span>
		{#if busy}<span class="busy">{busy}…</span>{/if}

		<button class:on={pinned !== null} onclick={() => stage().pin(null)} disabled={pinned === null} data-testid="pin">
			{pinned ? `Pointer pinned at ${Math.round(pinned.x)}, ${Math.round(pinned.y)} ×` : 'Pin pointer ⌥P'}
		</button>
		<button class="primary" disabled={!connected} onclick={() => void capture()} data-testid="capture"
			>Capture ⌥C</button
		>
		<button class:on={panel} onclick={() => (panel = !panel)} aria-pressed={panel}>Scene JSON</button>
	</header>

	<main class="room" bind:clientWidth={room.width} bind:clientHeight={room.height}>
		<div class="frame" style:width={`${viewport.width * scale}px`} style:height={`${viewport.height * scale}px`}>
			<!-- svelte-ignore a11y_missing_attribute -->
			<iframe
				bind:this={frame}
				aria-label="The game"
				src={`/debug/studio/stage${location.search}`}
				style:width={`${viewport.width}px`}
				style:height={`${viewport.height}px`}
				style:scale
				onload={met}
			></iframe>
			{#if pinned}
				<i class="pin" style:left={`${pinned.x * scale}px`} style:top={`${pinned.y * scale}px`}></i>
			{/if}
		</div>
		{#if problems.length}
			<div class="problems" role="alert">
				<button onclick={() => (problems = [])} aria-label="Dismiss">×</button>
				{#each problems as problem (problem)}<p>{problem}</p>{/each}
			</div>
		{/if}
	</main>

	{#if panel}
		<aside class="side" {@attach feedback('Scene JSON', () => ({ length: draft.length }))}>
			<header>
				<strong>Scene</strong>
				<button onclick={readStage}>Read stage</button>
				<button
					class="primary"
					onclick={() => {
						try {
							void load(parseScene(draft));
						} catch (error) {
							problems = [error instanceof Error ? error.message : String(error)];
						}
					}}>Apply</button
				>
			</header>
			<textarea bind:value={draft} spellcheck="false" aria-label="Scene JSON" data-testid="scene-json"></textarea>
		</aside>
	{/if}

	<footer class="shots" {@attach feedback('Shots', () => ({ shots: shots.length, selected }))}>
		<div class="tools">
			<strong>{shots.length} {shots.length === 1 ? 'shot' : 'shots'}</strong>
			<button disabled={!shots.length} onclick={() => void download()} data-testid="download-all">Download all</button>
			{#if selected.length}
				<button onclick={() => void download(selected)} data-testid="download-selected"
					>Download selected ({selected.length})</button
				>
				<button
					class="danger"
					onclick={() => confirm(`Delete ${selected.length} shots?`) && void remove(selected)}
					data-testid="delete-selected">Delete selected</button
				>
				<button onclick={() => (selected = [])}>Clear selection</button>
			{:else if shots.length}
				<button onclick={() => (selected = shots.map(shot => shot.id))}>Select all</button>
			{/if}
			<button onclick={() => fileInput?.click()}>Import</button>
		</div>
		<ol data-testid="shots">
			{#each shots as shot (shot.id)}
				{@const chosen = selected.includes(shot.id)}
				<li class:chosen data-shot={shot.id}>
					<button class="thumb" onclick={() => show(shot)}>
						<img src={urlOf(shot)} alt={shot.name} loading="lazy" />
					</button>
					<div class="meta">
						<label class="pick">
							<input
								type="checkbox"
								checked={chosen}
								onchange={() => (selected = chosen ? selected.filter(id => id !== shot.id) : [...selected, shot.id])}
							/>
							<input
								class="name"
								value={shot.name}
								aria-label="Name"
								onchange={event => {
									const renamed = { ...shot, name: event.currentTarget.value };
									shots = shots.map(other => (other.id === shot.id ? renamed : other));
									void putShots([renamed]);
								}}
							/>
						</label>
						<small>{when(shot.at)} · {shot.scene.viewport.width}×{shot.scene.viewport.height}</small>
						<pre>{summary(shot.scene)}</pre>
						<div class="row">
							<button onclick={() => void load(shot.scene)} data-testid="open-shot">Open</button>
							<button onclick={() => show(shot)}>View</button>
							<button class="danger" onclick={() => void remove([shot.id])}>Delete</button>
						</div>
					</div>
				</li>
			{:else}
				<li class="none">
					No shots yet. Capture the stage with the button above, or with Alt+C while the pointer rests on what you want
					hovered.
				</li>
			{/each}
		</ol>
	</footer>
</div>

<dialog bind:this={dialog} onclose={() => (viewing = null)} aria-label="Shot">
	{#if viewing}
		{@const shot = viewing}
		<header>
			<strong>{shot.name}</strong>
			<small>{when(shot.at)}</small>
			<span class="spacer"></span>
			<button
				onclick={() => {
					dialog?.close();
					void load(shot.scene);
				}}>Open in the stage</button
			>
			<button onclick={() => void navigator.clipboard.writeText(JSON.stringify(shot.scene, null, '\t'))}
				>Copy scene JSON</button
			>
			<button onclick={() => void download([shot.id])}>Download</button>
			<button onclick={() => dialog?.close()} aria-label="Close">×</button>
		</header>
		<div class="look">
			<img src={urlOf(shot)} alt={shot.name} />
			<pre data-testid="shot-json">{JSON.stringify(shot.scene, null, 2)}</pre>
		</div>
	{/if}
</dialog>

<input
	bind:this={fileInput}
	type="file"
	accept="application/json"
	hidden
	onchange={async event => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file) await during('Importing', async () => importFile(await file.text()));
	}}
/>
<input
	bind:this={saveInput}
	type="file"
	accept="application/json"
	hidden
	onchange={async event => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file) await during('Loading', async () => loadSave(parseSave(JSON.parse(await file.text()))));
	}}
/>

<style>
	.studio {
		--side: 0rem;
		position: fixed;
		inset: 0;
		display: grid;
		grid-template: auto minmax(0, 1fr) 13.5rem / minmax(0, 1fr) var(--side);
		background: #0d0c0a;
		color: var(--ink);
		font-family: var(--font-ui);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.studio.panel {
		--side: 26rem;
	}

	button,
	select {
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	button:hover:not(:disabled),
	select:hover {
		background: rgb(231 220 198 / 0.12);
	}

	button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	button.primary {
		border-color: var(--paper);
		background: var(--paper);
		color: var(--paper-ink);
		font-weight: 600;
	}

	button.primary:hover:not(:disabled) {
		background: #efe4c8;
	}

	button.on {
		border-color: var(--warn);
		color: var(--warn);
	}

	button.danger {
		color: var(--danger);
	}

	.bar {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.7rem;
		border-bottom: 1px solid var(--line);
		background: var(--chrome);
		white-space: nowrap;
	}

	.home {
		color: var(--muted);
		text-decoration: none;
	}

	.home:hover {
		color: var(--ink);
	}

	h1 {
		margin: 0 0.4rem 0 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 400;
	}

	.group {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.label,
	.where,
	.count {
		color: var(--muted);
	}

	.count {
		min-width: 3.6rem;
		text-align: center;
	}

	.where {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.spacer {
		flex: 1;
	}

	.bar select {
		max-width: 11rem;
	}

	.bar button {
		flex: none;
	}

	.busy {
		color: var(--warn);
	}

	.room {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		padding: 0.6rem;
		overflow: hidden;
	}

	.frame {
		position: relative;
		overflow: hidden;
		box-shadow:
			0 0 0 1px var(--line-strong),
			0 1rem 3rem rgb(0 0 0 / 0.6);
	}

	iframe {
		display: block;
		border: 0;
		transform-origin: 0 0;
	}

	/* Where the pinned pointer rests, shown over the stage and never in a capture. */
	.pin {
		position: absolute;
		width: 1.4rem;
		height: 1.4rem;
		border: 2px solid var(--warn);
		border-radius: 50%;
		translate: -50% -50%;
		pointer-events: none;
	}

	.problems {
		position: absolute;
		top: 1rem;
		left: 50%;
		max-width: 40rem;
		padding: 0.5rem 2rem 0.5rem 0.8rem;
		border: 1px solid var(--danger);
		border-radius: 3px;
		background: #2a1410;
		translate: -50% 0;
	}

	.problems p {
		margin: 0;
	}

	.problems button {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		padding: 0 0.4rem;
		border: 0;
	}

	.side {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-left: 1px solid var(--line);
		background: var(--chrome);
	}

	.side header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.6rem;
	}

	.side strong {
		margin-right: auto;
	}

	textarea {
		flex: 1;
		padding: 0.5rem 0.6rem;
		border: 0;
		border-top: 1px solid var(--line);
		background: #0d0c0a;
		color: var(--ink);
		font:
			0.72rem/1.4 ui-monospace,
			Menlo,
			monospace;
		tab-size: 2;
		white-space: pre;
		resize: none;
	}

	.shots {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-top: 1px solid var(--line);
		background: var(--chrome);
	}

	.tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.7rem;
	}

	.tools strong {
		margin-right: 0.4rem;
	}

	ol {
		flex: 1;
		display: flex;
		gap: 0.6rem;
		min-height: 0;
		margin: 0;
		padding: 0 0.7rem 0.6rem;
		overflow: auto hidden;
		list-style: none;
	}

	li {
		flex: none;
		display: flex;
		gap: 0.5rem;
		width: 31rem;
		padding: 0.4rem;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: var(--wash);
	}

	li.chosen {
		border-color: var(--paper);
	}

	li.none {
		width: auto;
		align-items: center;
		border-style: dashed;
		color: var(--muted);
	}

	.thumb {
		flex: none;
		width: 16rem;
		padding: 0;
		border: 0;
		background: #000;
	}

	.thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.meta {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.pick {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.name {
		flex: 1;
		min-width: 0;
		padding: 0.1rem 0.3rem;
		border: 1px solid transparent;
		border-radius: 2px;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 600;
	}

	.name:hover,
	.name:focus {
		border-color: var(--line-strong);
	}

	small {
		color: var(--muted);
	}

	pre {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0.3rem 0.4rem;
		overflow: auto;
		background: #0d0c0a;
		font:
			0.66rem/1.35 ui-monospace,
			Menlo,
			monospace;
	}

	.row {
		display: flex;
		gap: 0.3rem;
	}

	.row button {
		padding: 0.1rem 0.5rem;
	}

	dialog {
		width: 94vw;
		height: 92vh;
		padding: 0;
		border: 1px solid var(--line-strong);
		border-radius: 4px;
		background: var(--chrome);
		color: var(--ink);
		font-family: var(--font-ui);
		font-size: 0.85rem;
	}

	dialog[open] {
		display: flex;
		flex-direction: column;
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.7);
	}

	dialog header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.7rem;
		border-bottom: 1px solid var(--line);
	}

	.look {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 28rem;
		min-height: 0;
	}

	.look img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}

	.look pre {
		font-size: 0.7rem;
	}
</style>
