<script lang="ts">
	import { insights, isForsaken, legalActions, legalDecides, legalPlays, onGrid, pack, scenarios } from '@repo/game';
	import type { Action, CardId, CityId, Command, EdgeDef, Play, SeatId } from '@repo/game';
	import Board from '#lib/board/Board.svelte';
	import type { BoardView, CityView, Fx, FxKind } from '#lib/board/types.ts';
	import type { GameSession } from '#lib/session/session.svelte.ts';
	import { LS } from '#lib/storage.ts';
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Dock from './Dock.svelte';
	import InsightsPanel from './InsightsPanel.svelte';
	import {
		ACTION_NAMES,
		actionDetail,
		actionTarget,
		cardName,
		cityName,
		playGroup,
		playTarget,
		seatName,
		SEAT_COLORS,
		setNames,
	} from './labels.svelte.ts';
	import Lobby from './Lobby.svelte';
	import PlayersPanel from './PlayersPanel.svelte';
	import TopBar from './TopBar.svelte';
	import Upkeep from './Upkeep.svelte';

	let { session }: { session: GameSession } = $props();

	const snap = $derived(session.state!);
	const world = $derived(snap.world);
	const campaign = $derived(world.campaign);
	const game = $derived(world.game);
	const info = $derived(insights(world));
	const gridSet = $derived(new Set(onGrid(world)));
	const playing = $derived(snap.phase.startsWith('playing'));
	$effect.pre(() => setNames(campaign.names));

	let mine = $state<SeatId[]>(LS.get('mySeats', []));
	const solo = $derived(session.mode === 'solo');
	const canAct = $derived(game !== null && (solo || mine.includes(game.active)));
	let viewing = $state<SeatId | null>(null);
	$effect(() => {
		// The dock follows whoever's turn it is, until the player picks a hand to look at.
		void game?.active;
		viewing = null;
	});

	const actions = $derived(game && snap.phase === 'playing.actions' && canAct ? legalActions(world, game.active) : []);
	const plays = $derived(playing ? legalPlays(world) : []);
	const decides = $derived(playing ? legalDecides(world) : []);

	type Option = { label: string; detail: string; run: () => void; city?: CityId };
	type Chooser = {
		title: string;
		options: Option[];
		multi?: { max: number; verb: string; confirm: (picked: Option[]) => void };
	};
	const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label);
	let selected = $state<CityId | null>(null);
	let targeting = $state.raw<{ label: string; cities: Map<CityId, Option[]> } | null>(null);
	let chooser = $state.raw<Chooser | null>(null);
	let filter = $state('');
	let picked = $state.raw<Option[]>([]);
	$effect(() => {
		void chooser;
		filter = '';
		picked = [];
	});
	const shown = $derived(
		chooser?.options.filter(option =>
			`${option.label} ${option.detail}`.toLowerCase().includes(filter.trim().toLowerCase()),
		) ?? [],
	);
	function pick(option: Option) {
		if (!chooser?.multi) return option.run();
		if (picked.includes(option)) picked = picked.filter(other => other !== option);
		else if (picked.length < chooser.multi.max) picked = [...picked, option];
	}
	let menu = $state(false);
	let resetView = $state(0);

	const send = (command: Command) => session.send(command);
	function act(action: Action) {
		send({ type: 'ACTION', seat: game!.active, action });
		targeting = null;
		chooser = null;
	}
	const actionOption = (action: Action): Option => ({
		label: ACTION_NAMES[action.a],
		detail: actionDetail(world, action),
		run: () => act(action),
	});

	const cityOptions = $derived.by(() => {
		const map = new Map<CityId, Option[]>();
		for (const action of actions) {
			const target = actionTarget(world, action);
			if (target) map.set(target, [...(map.get(target) ?? []), actionOption(action)]);
		}
		return map;
	});

	function choose(title: string, options: Option[]) {
		if (options.length === 1) options[0]!.run();
		else if (options.length > 1) chooser = { title, options };
	}

	function clickCity(city: CityId) {
		selected = city;
		if (snap.phase === 'setup.supply') return send({ type: 'PLACE_SUPPLY', city, count: 1 });
		const options = (targeting?.cities ?? cityOptions).get(city) ?? [];
		if (targeting && options.length === 0) return;
		chooser = null;
		choose(cityName(city), options);
		if (options.length <= 1) targeting = null;
	}

	function group(name: Action['a']) {
		const variants = actions.filter(action => action.a === name);
		const aimed = variants.filter(action => actionTarget(world, action));
		if (aimed.length === variants.length && variants.length > 1) {
			const cities = new Map<CityId, Option[]>();
			for (const action of aimed) {
				const target = actionTarget(world, action)!;
				cities.set(target, [...(cities.get(target) ?? []), actionOption(action)]);
			}
			targeting = { label: `${ACTION_NAMES[name]}: pick a destination on the map or from the list`, cities };
			// The same destinations as a list, for anyone who would sooner read names than hunt for a city.
			chooser = {
				title: ACTION_NAMES[name],
				options: aimed
					.map(action => ({
						label: cityName(actionTarget(world, action)!),
						detail: actionDetail(world, action),
						run: () => act(action),
					}))
					.sort(byLabel),
			};
		} else {
			choose(ACTION_NAMES[name], variants.map(actionOption));
		}
	}

	function playCard(seat: SeatId, card: CardId) {
		const variants = plays.filter(option => option.seat === seat && option.card === card);
		const run = (play: Play) => () => {
			send({ type: 'PLAY', seat, card, play });
			targeting = null;
			chooser = null;
		};
		const aim = (subset: typeof variants, label: string) => {
			const cities = new Map<CityId, Option[]>();
			for (const option of subset)
				cities.set(playTarget(option.play)!, [{ label: cardName(world, card), detail: '', run: run(option.play) }]);
			targeting = { label: `${label}: pick a location on the map or from the list`, cities };
			chooser = {
				title: label,
				options: subset
					.map(option => ({
						label: cityName(playTarget(option.play)!),
						detail: '',
						run: run(option.play),
					}))
					.sort(byLabel),
			};
		};
		const held = world.campaign.playerCards[card];
		if (held?.kind === 'event' && held.event === 'safeHouses') {
			// The card places up to three shelters at once, so its cities are ticked off a list and confirmed together.
			const cities = [...new Set(variants.map(option => playTarget(option.play)!))];
			targeting = null;
			chooser = {
				title: 'Safe Houses',
				options: cities
					.map(target => ({ label: cityName(target), detail: '', run: () => {}, city: target }))
					.sort(byLabel),
				multi: {
					max: Math.min(3, game!.pieces.shelter),
					verb: 'Place shelters',
					confirm: chosen => {
						send({ type: 'PLAY', seat, card, play: { e: 'safeHouses', cities: chosen.map(option => option.city!) } });
						chooser = null;
					},
				},
			};
			return;
		}
		const groups = [...new Set(variants.map(option => playGroup(world, option.play)))];
		const aimed = variants.every(option => playTarget(option.play));
		if (variants.length === 1) return run(variants[0]!.play)();
		if (aimed && groups.length === 1) return aim(variants, cardName(world, card));
		chooser = {
			title: cardName(world, card),
			options: groups.map(name => {
				const subset = variants.filter(option => playGroup(world, option.play) === name);
				return {
					label: name || cardName(world, card),
					detail: '',
					run: aimed ? () => aim(subset, name) : run(subset[0]!.play),
				};
			}),
		};
	}

	function claim(seat: SeatId) {
		mine = mine.includes(seat) ? mine.filter(other => other !== seat) : [...mine, seat];
		LS.set({ mySeats: mine });
	}

	let fx = $state.raw<Fx[]>([]);
	let toasts = $state.raw<{ id: number; text: string; tone: string }[]>([]);
	let banner = $state.raw<{ id: number; title: string; text: string } | null>(null);
	let lastSeq = untrack(() => game?.log.at(-1)?.seq ?? 0);
	let nextFx = 1;

	function toast(text: string, tone = '') {
		const id = nextFx++;
		toasts = [...toasts, { id, text, tone }];
		setTimeout(() => (toasts = toasts.filter(entry => entry.id !== id)), 5200);
	}

	$effect(() => {
		const log = game?.log ?? [];
		const newest = log.at(-1)?.seq ?? 0;
		if (newest < lastSeq) lastSeq = 0;
		const fresh = log.filter(entry => entry.seq > lastSeq);
		if (fresh.length === 0) return;
		lastSeq = newest;
		const added: Fx[] = [];
		const pulse = (city: CityId, kind: FxKind) => added.push({ id: nextFx++, city, kind, delay: added.length * 240 });
		for (const entry of fresh) {
			if (entry.t === 'infect' && entry.effect !== 'skipped' && entry.effect !== 'blocked') {
				pulse(entry.city, entry.effect === 'supply' ? 'infect' : entry.effect === 'hollow' ? 'hollow' : entry.effect);
			} else if (entry.t === 'incident') pulse(entry.city, 'plague');
			else if (entry.t === 'outbreak') pulse(entry.city, 'outbreak');
			else if (entry.t === 'connected') pulse(entry.city, 'connected');
			else if (entry.t === 'structure') pulse(entry.city, 'build');
			else if (entry.t === 'epidemic') {
				if (entry.city) pulse(entry.city, 'epidemic');
				const id = nextFx++;
				banner = {
					id,
					title: 'Epidemic',
					text: entry.city
						? `${cityName(entry.city)} loses ${entry.removed} cubes. Infection rate ${entry.rate}.`
						: `Infection rate ${entry.rate}.`,
				};
				setTimeout(() => banner?.id === id && (banner = null), 3400);
			} else if (entry.t === 'objective') toast('Objective complete', 'good');
			else if (entry.t === 'unlock')
				toast(`Opened: ${pack.bundles.find(bundle => bundle.id === entry.bundle)?.name}`, 'good');
			else if (entry.t === 'death')
				toast(`${campaign.characters[entry.character]?.name} died in ${cityName(entry.at)}`, 'bad');
			else if (entry.t === 'exposure' && entry.result === 'scar')
				toast(`${seatName(world, entry.seat)} takes a scar`, 'bad');
		}
		untrack(() => {
			fx = [...fx, ...added];
			const ids = new Set(added.map(entry => entry.id));
			setTimeout(() => (fx = fx.filter(entry => !ids.has(entry.id))), 6000);
		});
	});

	$effect(() => {
		const notice = session.notice;
		if (notice) untrack(() => toast(notice.text, 'bad'));
	});

	const boardView = $derived.by((): BoardView => {
		const targets = new Set((targeting?.cities ?? cityOptions).keys());
		const showOdds = (playing || snap.phase === 'setup.supply') && info !== null;
		const cities = Object.fromEntries(
			pack.cities.map((city): [CityId, CityView] => {
				const record = campaign.locations[city.id]!;
				const location = game?.locations[city.id];
				const odds = showOdds ? (info!.infection.odds[city.id] ?? 0) : 0;
				return [
					city.id,
					{
						name: cityName(city.id),
						revealed: record.revealed,
						onGrid: gridSet.has(city.id),
						supplies: location?.supplies ?? 0,
						plague: location?.plague ?? 0,
						hollow: location?.hollow ?? 0,
						population: record.population,
						center: location?.center ?? record.permanent.includes('center'),
						tower: location?.tower ?? record.permanent.includes('tower'),
						shelter: location?.shelter ?? record.permanent.includes('shelter'),
						infested: record.infested,
						forsaken: isForsaken(campaign, city.id),
						lab: record.lab,
						highlight: selected === city.id ? 'selected' : targets.has(city.id) ? 'target' : null,
						// Odds only earn label space where a hit would hurt: an empty city, or a nearly empty one at real risk.
						odds:
							odds > 0 && ((location?.supplies ?? 0) === 0 || ((location?.supplies ?? 0) === 1 && odds >= 0.3))
								? odds
								: null,
					},
				];
			}),
		) as Record<CityId, CityView>;
		const here = game?.players[game.active]?.location;
		const ghostEdges: EdgeDef[] = here
			? actions.flatMap(action =>
					action.a === 'establishLine' || action.a === 'chartLane'
						? [{ a: here, b: action.to, kind: action.a === 'establishLine' ? ('land' as const) : ('sea' as const) }]
						: [],
				)
			: [];
		return {
			cities,
			edges: campaign.edges,
			ghostEdges,
			pawns: (game?.seats ?? []).map((seat, index) => ({
				id: seat,
				city: game!.players[seat]!.location,
				color: SEAT_COLORS[index]!,
				name: seatName(world, seat),
				active: game!.active === seat && playing,
			})),
			cursors: Object.entries(session.cursors).map(([id, point], index) => ({
				id,
				name: session.peers.find(peer => peer.id === id)?.name ?? 'player',
				color: SEAT_COLORS[(index + 1) % SEAT_COLORS.length]!,
				...point,
			})),
			fx,
		};
	});

	const selectedInfo = $derived.by(() => {
		if (!selected || !info) return null;
		const count = (record: Record<string, number>) => record[selected!] ?? 0;
		return {
			inDeck: info.infection.strata.reduce((sum, stratum) => sum + count(stratum.cities), 0),
			inDiscard: count(info.infection.discard),
			odds: count(info.infection.odds),
		};
	});

	let fileInput = $state<HTMLInputElement>();
	function download() {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([session.exportSave()], { type: 'application/json' }));
		link.download = `campaign-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<svelte:window onkeydown={event => event.key === 'Escape' && ((targeting = null), (chooser = null), (menu = false))} />

<div class="game">
	<TopBar
		{snap}
		{info}
		status={session.status}
		players={session.peers.filter(peer => peer.connected).length}
		solo={session.mode === 'solo'}
		onwaive={objective =>
			confirm('Mark this objective impossible for this game? The remaining objectives then decide the win.') &&
			send({ type: 'WAIVE_OBJECTIVE', objective })}
		onreset={() => resetView++}
		onmenu={() => (menu = !menu)}
	/>

	<main class="stage">
		<Board view={boardView} oncity={clickCity} onpointer={point => session.pointer(point)} {resetView} />

		{#if game && snap.phase !== 'upkeep'}
			<aside class="left">
				<PlayersPanel {world} {mine} {solo} {viewing} onview={seat => (viewing = seat)} onclaim={claim} />
			</aside>
		{/if}
		{#if game && info && snap.phase !== 'upkeep'}
			<aside class="right">
				<InsightsPanel
					{world}
					{info}
					onfocus={city => (selected = city)}
					onlockdown={card => send({ type: 'LOCKDOWN', card })}
				/>
			</aside>
		{/if}

		{#if selected && campaign.locations[selected]?.revealed}
			{@const record = campaign.locations[selected]!}
			<div class="cityinfo" transition:fade={{ duration: 120 }}>
				<strong>{cityName(selected)}</strong>
				<span>Population {record.population}</span>
				{#if selectedInfo}
					<span title="This city's Infection cards"
						>Infection cards: {selectedInfo.inDeck} in deck, {selectedInfo.inDiscard} discarded</span
					>
					<span>Hit next turn: {Math.round(selectedInfo.odds * 100)}%</span>
				{/if}
				{#if record.infested}<span class="bad">Infested</span>{/if}
				<button onclick={() => (selected = null)} aria-label="Close">×</button>
			</div>
		{/if}

		{#if targeting}
			<div class="targeting" transition:fly={{ y: 12, duration: 180 }}>
				{targeting.label}
				<button onclick={() => (targeting = null)}>Cancel</button>
			</div>
		{/if}

		{#if chooser}
			<div class="chooser" transition:fly={{ y: 16, duration: 180 }} data-testid="chooser">
				<header>{chooser.title}<button onclick={() => (chooser = null)} aria-label="Close">×</button></header>
				{#if chooser.options.length > 8}
					<input bind:value={filter} placeholder="Type to filter" aria-label="Filter the list" />
				{/if}
				<div class="rows">
					{#each shown as option (option)}
						<button class:picked={picked.includes(option)} onclick={() => pick(option)}
							><strong>{option.label}</strong><span>{option.detail}</span></button
						>
					{:else}
						<p>Nothing matches.</p>
					{/each}
				</div>
				{#if chooser.multi}
					{@const multi = chooser.multi}
					<button
						class="primary"
						disabled={picked.length === 0}
						onclick={() => multi.confirm(picked)}
						data-testid="chooser-confirm"
					>
						{multi.verb}: {picked.length} of up to {multi.max}
					</button>
				{/if}
			</div>
		{/if}

		<div class="toasts">
			{#each toasts as entry (entry.id)}
				<div class={entry.tone} in:fly={{ y: -16, duration: 220 }} out:fade={{ duration: 300 }}>{entry.text}</div>
			{/each}
		</div>

		{#if banner}
			{#key banner.id}
				<div class="banner" in:fly={{ x: -400, duration: 450 }} out:fly={{ x: 400, duration: 450 }}>
					<strong>{banner.title}</strong>
					<span>{banner.text}</span>
				</div>
			{/key}
		{/if}

		{#if campaign.briefing.length}
			<div class="scrim" transition:fade={{ duration: 200 }}>
				<div class="briefing" in:fly={{ y: 24, duration: 300 }}>
					<h2>New this game</h2>
					<ul>
						{#each campaign.briefing as line, index (index)}<li>{line}</li>{/each}
					</ul>
					<button class="primary" onclick={() => send({ type: 'ACK_BRIEFING' })} data-testid="ack-briefing"
						>Got it</button
					>
				</div>
			</div>
		{:else if snap.phase === 'lobby' || snap.phase === 'finished'}
			<div class="scrim" transition:fade={{ duration: 200 }}><Lobby {snap} {send} /></div>
		{:else if snap.phase === 'upkeep'}
			<div class="scrim" transition:fade={{ duration: 200 }}><Upkeep {snap} {send} /></div>
		{/if}

		{#if menu}
			<div class="menu" transition:fly={{ y: -10, duration: 160 }}>
				<button onclick={download}>Export campaign save</button>
				{#if session.mode !== 'join'}
					<button onclick={() => fileInput?.click()}>Import campaign save</button>
					<button onclick={() => session.importSave(scenarios.october())} data-testid="scenario-october"
						>Load scenario: October</button
					>
					<button onclick={() => session.importSave(scenarios.december())} data-testid="scenario-december"
						>Load scenario: December</button
					>
					<button
						class="danger"
						onclick={() =>
							confirm('Start a new campaign? The current one is erased unless you exported it.') &&
							session.newCampaign()}>New campaign</button
					>
					<input
						bind:this={fileInput}
						type="file"
						accept="application/json"
						hidden
						onchange={async event => session.importSave(await event.currentTarget.files![0]!.text())}
					/>
				{/if}
			</div>
		{/if}
	</main>

	{#if game && snap.phase !== 'upkeep'}
		<Dock
			{snap}
			{canAct}
			{viewing}
			{actions}
			{plays}
			{decides}
			{send}
			onview={seat => (viewing = seat)}
			ongroup={group}
			onplaycard={playCard}
		/>
	{/if}
</div>

<style>
	.game {
		--ink: #e9e6dc;
		--muted: #8a9aa8;
		--accent: #7dfcc0;
		--warn: #ffd166;
		--danger: #ff6b6b;
		--line: rgb(255 255 255 / 0.1);
		--panel: rgb(14 20 27 / 0.82);
		--panel-solid: #0e141b;
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		grid-template-columns: minmax(0, 1fr);
		background: #070b0f;
		color: var(--ink);
		font-family: 'Avenir Next', 'Segoe UI', system-ui, sans-serif;
		font-variant-numeric: tabular-nums;
		overflow: hidden;
	}

	.stage {
		position: relative;
		min-height: 0;
	}

	aside {
		position: absolute;
		top: 0.7rem;
		z-index: 30;
	}

	.left {
		left: 0.7rem;
		width: 15rem;
	}

	.right {
		right: 0.7rem;
		width: 15.5rem;
		max-height: calc(100% - 1.4rem);
		display: flex;
	}

	.cityinfo,
	.targeting {
		position: absolute;
		left: 50%;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.35rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--panel);
		backdrop-filter: blur(8px);
		font-size: 0.74rem;
		transform: translateX(-50%);
		white-space: nowrap;
	}

	.cityinfo {
		bottom: 0.7rem;
	}

	.cityinfo span {
		color: var(--muted);
	}

	.cityinfo .bad {
		color: #c79bff;
	}

	.targeting {
		top: 0.7rem;
		border-color: var(--accent);
		color: var(--accent);
	}

	.cityinfo button,
	.targeting button,
	.chooser header button {
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		cursor: pointer;
	}

	.chooser {
		position: absolute;
		left: 50%;
		bottom: 0.8rem;
		z-index: 40;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 22rem;
		max-height: min(72%, 28rem);
		padding: 0.6rem;
		border: 1px solid var(--line);
		border-radius: 0.7rem;
		background: var(--panel);
		backdrop-filter: blur(12px);
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.5);
		transform: translateX(-50%);
	}

	.chooser header {
		display: flex;
		justify-content: space-between;
		color: var(--muted);
		font-size: 0.65rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.chooser input {
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		background: rgb(255 255 255 / 0.05);
		color: var(--ink);
		font: inherit;
		font-size: 0.78rem;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-height: 0;
		overflow: auto;
	}

	.rows p {
		margin: 0;
		color: var(--muted);
		font-size: 0.75rem;
	}

	.rows button {
		display: flex;
		flex: none;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 0.4rem;
		background: rgb(255 255 255 / 0.04);
		color: var(--ink);
		font: inherit;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
	}

	.rows button:hover,
	.rows button.picked {
		border-color: var(--accent);
	}

	.rows button.picked {
		background: rgb(125 252 192 / 0.12);
	}

	.rows span {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.7rem;
		text-align: right;
	}

	.toasts {
		position: absolute;
		top: 3.2rem;
		left: 50%;
		z-index: 50;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.toasts div {
		padding: 0.3rem 0.8rem;
		border-radius: 999px;
		background: var(--panel-solid);
		border: 1px solid var(--line);
		font-size: 0.76rem;
	}

	.toasts .good {
		border-color: var(--accent);
		color: var(--accent);
	}

	.toasts .bad {
		border-color: var(--danger);
		color: var(--danger);
	}

	.banner {
		position: absolute;
		top: 34%;
		left: 0;
		right: 0;
		z-index: 45;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 1.1rem 0;
		background: linear-gradient(
			90deg,
			transparent,
			rgb(255 59 107 / 0.85) 25%,
			rgb(255 59 107 / 0.85) 75%,
			transparent
		);
		color: white;
		pointer-events: none;
	}

	.banner strong {
		font-size: 2.2rem;
		letter-spacing: 0.3em;
		text-transform: uppercase;
	}

	.scrim {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgb(4 7 10 / 0.55);
	}

	.briefing {
		width: min(34rem, 90vw);
		padding: 1.3rem 1.5rem;
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: var(--panel);
		backdrop-filter: blur(14px);
	}

	.briefing h2 {
		margin: 0 0 0.6rem;
		font-size: 1.2rem;
	}

	.briefing ul {
		margin: 0 0 1rem;
		padding-left: 1.1rem;
		color: var(--ink);
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.primary {
		padding: 0.45rem 1rem;
		border: 1px solid var(--accent);
		border-radius: 0.4rem;
		background: var(--accent);
		color: #06120c;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.menu {
		position: absolute;
		top: 0.4rem;
		right: 0.7rem;
		z-index: 70;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.6rem;
		border: 1px solid var(--line);
		border-radius: 0.6rem;
		background: var(--panel-solid);
		font-size: 0.8rem;
	}

	.menu button {
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 0.35rem;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.menu .danger {
		color: var(--danger);
	}

	.menu p {
		margin: 0;
		color: var(--muted);
	}
</style>
