<script lang="ts">
	import { insights, isForsaken, legalActions, legalDecides, legalPlays, onGrid, pack, scenarios } from '@repo/game';
	import type { Action, CardId, CityId, Command, EdgeDef, Play, SeatId } from '@repo/game';
	import Board from '#lib/board/Board.svelte';
	import type { BoardPoint } from '#lib/board/projection.ts';
	import { travelOf } from '#lib/board/travel.ts';
	import type { BoardMarks, BoardView, CityView, Fx, FxKind, Travel } from '#lib/board/types.ts';
	import type { SessionView } from '#lib/session/session.svelte.ts';
	import { inkOn } from '#lib/color.ts';
	import { LS } from '#lib/storage.ts';
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { backOut } from 'svelte/easing';
	import { fade, fly, scale } from 'svelte/transition';
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
	import Objectives from './Objectives.svelte';
	import PlayersPanel from './PlayersPanel.svelte';
	import TopBar from './TopBar.svelte';
	import Upkeep from './Upkeep.svelte';

	// A spectator owns no seat, whatever this browser claimed in a live game. Replays use it, and draw their own
	// players and step marks over the board, so the panels a player acts from stay out of the way.
	let {
		session,
		spectator = false,
		marks,
		announce = true,
		children,
	}: {
		session: SessionView;
		spectator?: boolean;
		marks?: BoardMarks;
		/** False when a spectator jumped rather than stepped, so the events in between are not announced. */
		announce?: boolean;
		children?: Snippet;
	} = $props();

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
	const owns = (seat: SeatId) => !spectator && (solo || mine.includes(seat));
	const canAct = $derived(game !== null && owns(game.active));
	const unclaimed = $derived(game !== null && !spectator && !solo && !game.seats.some(seat => mine.includes(seat)));
	let viewing = $state<SeatId | null>(null);
	$effect(() => {
		// The dock follows whoever's turn it is, until the player picks a hand to look at.
		void game?.active;
		viewing = null;
	});

	const actions = $derived(game && snap.phase === 'playing.actions' && canAct ? legalActions(world, game.active) : []);
	const plays = $derived(playing ? legalPlays(world, snap.phase) : []);
	const decides = $derived(playing ? legalDecides(world) : []);
	$effect(() => {
		// When one of this client's characters has to discard, the dock turns to that hand.
		const owed = decides.find(decide => decide.d === 'discard' && owns(decide.seat));
		if (owed?.d === 'discard') viewing = owed.seat;
	});

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
	let stage = $state<HTMLElement | null>();
	let leftPanel = $state<HTMLElement | null>();
	let rightPanel = $state<HTMLElement | null>();
	let legendPanel = $state<HTMLElement | null>();
	// Where the corner panels sit, so the board can keep city labels out from under them.
	let covered = $state.raw<{ x: number; y: number; width: number; height: number }[]>([]);
	$effect(() => {
		// `bind:this` hands back null, not undefined, once a panel leaves the screen.
		const panels = [leftPanel, rightPanel, legendPanel].filter(
			(panel): panel is HTMLElement => panel instanceof HTMLElement,
		);
		if (!stage || panels.length === 0) return void (covered = []);
		const measure = () => {
			const origin = stage!.getBoundingClientRect();
			covered = panels.map(panel => {
				const box = panel.getBoundingClientRect();
				return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height };
			});
		};
		const observer = new ResizeObserver(measure);
		for (const panel of [stage, ...panels]) observer.observe(panel);
		measure();
		return () => observer.disconnect();
	});
	let resetView = $state(0);

	const send = (command: Command) => session.send(command);

	/** How a pawn made its most recent move, which picks its vehicle and the way it goes. */
	function lastMove(seat: SeatId): { travel: Travel; course: BoardPoint[] | null } {
		const log = game?.log ?? [];
		for (let index = log.length - 1; index >= 0; index--) {
			const entry = log[index]!;
			if (entry.t === 'move' && entry.seat === seat) return travelOf(entry, campaign.edges);
		}
		return { travel: 'land', course: null };
	}
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
		if (snap.phase === 'setup.supply') return send({ type: 'PLACE_SUPPLY', city, count: 1 });
		selected = city;
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

	// A spectator cannot acknowledge a briefing for the table, so closing it is theirs alone.
	let briefingRead = $state('');

	function claim(seat: SeatId) {
		if (spectator) return;
		mine = mine.includes(seat) ? mine.filter(other => other !== seat) : [...mine, seat];
		LS.set({ mySeats: mine });
	}

	let fx = $state.raw<Fx[]>([]);
	let toasts = $state.raw<{ id: number; text: string; tone: string }[]>([]);
	let banner = $state.raw<{ id: number; title: string; text: string } | null>(null);
	let turnBanner = $state.raw<{ id: number; name: string; color: string } | null>(null);
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
		// A spectator jumping through a recording skips over events rather than living through each one at once,
		// and what was announced where they jumped from no longer applies.
		const jumped = spectator && (newest < lastSeq || !untrack(() => announce));
		if (newest < lastSeq) lastSeq = spectator ? newest : 0;
		if (jumped) {
			lastSeq = newest;
			untrack(() => {
				toasts = [];
				banner = null;
				turnBanner = null;
				fx = [];
			});
			return;
		}
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
			} else if (entry.t === 'turn') {
				const id = nextFx++;
				turnBanner = {
					id,
					name: seatName(world, entry.seat),
					color: SEAT_COLORS[game!.seats.indexOf(entry.seat)] ?? '#fff',
				};
				setTimeout(() => turnBanner?.id === id && (turnBanner = null), 1900);
			} else if (entry.t === 'objective') toast('Objective complete', 'good');
			else if (entry.t === 'unlock')
				toast(`Opened: ${pack.bundles.find(bundle => bundle.id === entry.bundle)?.name}`, 'good');
			else if (entry.t === 'death')
				toast(`${campaign.characters[entry.character]?.name} died in ${cityName(entry.at)}`, 'bad');
			else if (entry.t === 'exposure' && entry.result === 'scar')
				toast(`${seatName(world, entry.seat)} takes a scar`, 'bad');
			else if (entry.t === 'note') toast(entry.text, 'good');
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
		const showOdds = playing && info !== null;
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
				...lastMove(seat),
			})),
			cursors: Object.entries(session.cursors).map(([id, point], index) => ({
				id,
				name: session.peers.find(peer => peer.id === id)?.name ?? 'player',
				color: SEAT_COLORS[(index + 1) % SEAT_COLORS.length]!,
				...point,
			})),
			fx,
			marks,
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

	/** Space advances the turn, Z undoes, F fits the map, Escape closes whatever is open. */
	function onkey(event: KeyboardEvent) {
		const typing =
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLSelectElement ||
			event.target instanceof HTMLButtonElement;
		if (event.key === 'Escape') {
			targeting = null;
			chooser = null;
			menu = false;
		}
		if (typing || event.metaKey || event.ctrlKey || !game) return;
		const key = event.key.toLowerCase();
		if (key === 'f') resetView++;
		if (key === 'z' && snap.canUndo && canAct) send({ type: 'UNDO' });
		if (key !== ' ' || !canAct) return;
		event.preventDefault();
		if (snap.phase === 'playing.actions') send({ type: 'END_ACTIONS', seat: game.active });
		else if (snap.phase === 'playing.draw') send({ type: 'DRAW' });
		else if (snap.phase === 'playing.infect') send({ type: 'INFECT' });
	}

	function downloadRecord() {
		const record = session.exportRecord();
		if (!record) return;
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([record], { type: 'application/json' }));
		link.download = `recording-${(JSON.parse(record) as { id: string }).id}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}

	let fileInput = $state<HTMLInputElement>();
	function download() {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([session.exportSave()], { type: 'application/json' }));
		link.download = `campaign-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	}
</script>

<svelte:window onkeydown={onkey} />

<div class="game">
	<TopBar
		{snap}
		{info}
		status={session.status}
		players={session.peers.filter(peer => peer.connected).length}
		solo={session.mode === 'solo' || spectator}
		onreset={() => resetView++}
		onmenu={() => (menu = !menu)}
	/>

	<main class="stage" bind:this={stage}>
		<Board view={boardView} oncity={clickCity} onpointer={point => session.pointer(point)} {resetView} {covered} />

		{#if game && snap.phase !== 'upkeep' && !spectator}
			<aside class="left" bind:this={leftPanel}>
				<PlayersPanel {world} {mine} {solo} {viewing} onview={seat => (viewing = seat)} onclaim={claim} />
			</aside>
		{/if}
		{#if game && info && snap.phase !== 'upkeep' && !spectator}
			<aside class="right" bind:this={rightPanel}>
				<InsightsPanel
					{world}
					{info}
					onfocus={city => (selected = city)}
					onlockdown={card => send({ type: 'LOCKDOWN', card })}
				/>
			</aside>
		{/if}

		{#if game && playing && !spectator}
			<!-- The chart's key, printed in its corner: what each mark beside a city name means. -->
			<dl class="legend" aria-label="Map key" bind:this={legendPanel} in:fly={{ y: 20, duration: 500, delay: 600 }}>
				<dt><b class="num">3</b></dt>
				<dd>Population</dd>
				<dt><b class="supplies">1</b></dt>
				<dd>Supply cubes</dd>
				<dt><b class="plague">1</b></dt>
				<dd>Plague cubes</dd>
				<dt><b class="hollow">1</b></dt>
				<dd>Hollow Men</dd>
				<dt><b class="odds">6%</b></dt>
				<dd>Chance it is infected next</dd>
				<dt><b class="ring"></b></dt>
				<dd>Somewhere you can act</dd>
				<dt><b class="line"></b></dt>
				<dd>Supply line</dd>
				<dt><b class="lane"></b></dt>
				<dd>Sea lane</dd>
				<dt><b class="haven"></b></dt>
				<dd>Haven</dd>
				<dt><b class="pawn"></b></dt>
				<dd>A character</dd>
				<dt><b class="border"></b></dt>
				<dd>Region boundary</dd>
			</dl>
		{/if}
		{#if game && snap.phase !== 'upkeep'}
			<div class="goals">
				<Objectives
					{snap}
					onwaive={objective =>
						confirm('Mark this objective impossible for this game? The remaining objectives then decide the win.') &&
						send({ type: 'WAIVE_OBJECTIVE', objective })}
				/>
			</div>
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

		{#if unclaimed}
			<!-- A networked player has to say which pawn is theirs before any control is offered. Asking beats leaving the dock empty. -->
			<div class="whoami" data-testid="whoami" transition:fly={{ y: 12, duration: 180 }}>
				<span>Who do you play?</span>
				{#each game!.seats as seat (seat)}
					<button onclick={() => claim(seat)}>{seatName(world, seat)}</button>
				{/each}
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
					{#each shown as option, index (option)}
						<button style:--i={Math.min(index, 12)} class:picked={picked.includes(option)} onclick={() => pick(option)}
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
				<div class="banner" out:fade={{ duration: 450 }}>
					<strong>{banner.title}</strong>
					<span>{banner.text}</span>
				</div>
			{/key}
		{/if}

		{#if turnBanner && !banner}
			{#key turnBanner.id}
				<div
					class="turn-banner"
					style:--seat={turnBanner.color}
					style:--on={inkOn(turnBanner.color)}
					in:fly={{ y: -24, duration: 320 }}
					out:fade={{ duration: 450 }}
				>
					<i></i>{turnBanner.name}'s turn
				</div>
			{/key}
		{/if}

		{#if banner}
			{#key banner.id}<div class="flash" out:fade={{ duration: 200 }}></div>{/key}
		{/if}

		{#if game?.outcome && snap.phase === 'over'}
			<div class="outcome" class:won={game.outcome.won} in:scale={{ start: 0.7, duration: 600, easing: backOut }}>
				<strong>{game.outcome.won ? 'Victory' : 'Defeat'}</strong>
				<span>{game.outcome.reason}</span>
			</div>
		{/if}

		{#if campaign.briefing.length && briefingRead !== campaign.briefing.join('|')}
			<!-- A spectator reads the briefing beside the board instead of in front of it, so what was just revealed stays in view. -->
			<div class="scrim" class:passive={spectator} transition:fade={{ duration: 200 }}>
				<div class="briefing" in:fly={{ y: 24, duration: 300 }}>
					<h2>New this game</h2>
					<ul>
						{#each campaign.briefing as line, index (index)}
							{@const split = line.indexOf(': ')}
							<li>
								{#if split > 0 && split < 48}<strong>{line.slice(0, split)}</strong>
									{line.slice(split + 2)}{:else}{line}{/if}
							</li>
						{/each}
					</ul>
					<button
						class="primary"
						onclick={() => (spectator ? (briefingRead = campaign.briefing.join('|')) : send({ type: 'ACK_BRIEFING' }))}
						data-testid="ack-briefing">Continue</button
					>
				</div>
			</div>
		{:else if snap.phase === 'lobby' || snap.phase === 'finished'}
			<div class="scrim" transition:fade={{ duration: 200 }}><Lobby {snap} {send} /></div>
		{:else if snap.phase === 'upkeep'}
			<div class="scrim" transition:fade={{ duration: 200 }}><Upkeep {snap} {send} /></div>
		{/if}

		{@render children?.()}

		{#if menu}
			<div class="menu" transition:scale={{ start: 0.92, duration: 180, opacity: 0 }}>
				<button onclick={download}>Export campaign save</button>
				{#if session.mode !== 'join' && !spectator}
					<button onclick={downloadRecord} data-testid="save-recording">Save this game's recording</button>
					<a href="/replay?src=local" target="_blank" data-testid="open-replay">Replay this game</a>
				{/if}
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

	{#if game && snap.phase !== 'upkeep' && !spectator}
		<Dock
			{snap}
			{canAct}
			{owns}
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
		position: fixed;
		/* A page that hosts the game beside something else, such as the replay viewer, sets the inset. */
		inset: var(--game-inset, 0);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		grid-template-columns: minmax(0, 1fr);
		background: var(--table);
		color: var(--ink);
		font-family: var(--font-ui);
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
		width: 11.5rem;
	}

	.right {
		right: 0.7rem;
		width: 12rem;
		max-height: calc(100% - 1.4rem);
		display: flex;
	}

	.goals {
		position: absolute;
		top: 0.6rem;
		left: 50%;
		z-index: 30;
		transform: translateX(-50%);
	}

	.legend {
		position: absolute;
		left: 0.9rem;
		bottom: 3.4rem;
		z-index: 25;
		display: grid;
		grid-template-columns: 1.6rem auto;
		align-items: center;
		gap: 0.05rem 0.4rem;
		margin: 0;
		padding: 0.4rem 0.6rem;
		border: 1px solid rgb(42 32 23 / 0.35);
		background: rgb(236 227 207 / 0.92);
		box-shadow: var(--slip-shadow);
		color: var(--slip-ink);
		font-size: 0.68rem;
		line-height: 1.3;
		rotate: -0.4deg;
		pointer-events: none;
	}

	.legend dt {
		display: flex;
		justify-content: center;
	}

	.legend dd {
		margin: 0;
	}

	.legend b {
		min-width: 0.9rem;
		padding: 0 0.2rem;
		border-radius: 1px;
		font-weight: 600;
		line-height: 1.25;
		text-align: center;
	}

	.legend .num {
		color: #6f604c;
		font-weight: 500;
	}

	.legend .supplies {
		border: 1px solid #2a2017;
		background: #f1e9d6;
	}

	.legend .plague {
		background: #6f8a22;
		color: #f3f0dc;
	}

	.legend .hollow {
		background: #4e3b63;
		color: #efe6f7;
	}

	.legend .odds {
		color: #8b5a12;
		font-style: italic;
	}

	.legend .line,
	.legend .lane {
		width: 1.2rem;
		min-width: 0;
		height: 0;
		padding: 0;
		border-top: 3px solid #8e3a24;
		border-radius: 0;
	}

	.legend .lane {
		border-top: 2px dashed #2d5873;
	}

	.legend .border {
		width: 1.2rem;
		min-width: 0;
		height: 0;
		padding: 0;
		border-top: 3px dashed #6e1e14;
		border-radius: 0;
	}

	.legend .haven {
		width: 0.95rem;
		height: 0.85rem;
		min-width: 0;
		padding: 0;
		background: #2f8f74;
		clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%);
	}

	.legend .pawn {
		width: 0.7rem;
		height: 0.95rem;
		min-width: 0;
		padding: 0;
		background: #d9573f;
		clip-path: polygon(50% 0, 72% 22%, 60% 40%, 100% 100%, 0 100%, 40% 40%, 28% 22%);
	}

	.legend .ring {
		width: 0.95rem;
		height: 0.95rem;
		min-width: 0;
		padding: 0;
		border: 2px solid #b5521f;
		border-radius: 50%;
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
		border-radius: 3px;
		background: var(--panel);
		backdrop-filter: blur(8px);
		font-size: 0.8rem;
		transform: translateX(-50%);
		white-space: nowrap;
	}

	.cityinfo {
		bottom: 0.7rem;
	}

	.cityinfo strong {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 400;
	}

	.cityinfo span {
		color: var(--muted);
	}

	.cityinfo .bad {
		color: var(--hollow);
	}

	.targeting {
		top: 3.2rem;
		border-color: var(--warn);
		color: var(--warn);
	}

	.whoami {
		position: absolute;
		top: 5.6rem;
		left: 50%;
		z-index: 31;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--paper);
		border-radius: 3px;
		background: var(--panel-solid);
		font-size: 0.9rem;
		transform: translateX(-50%);
		white-space: nowrap;
	}

	.whoami button {
		padding: 0.25rem 0.7rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--wash);
		color: var(--paper);
		font: inherit;
		cursor: pointer;
	}

	.whoami button:hover {
		border-color: var(--paper);
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

	.cityinfo button:hover,
	.targeting button:hover,
	.chooser header button:hover {
		color: var(--ink);
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
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--panel);
		backdrop-filter: blur(12px);
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.55);
		transform: translateX(-50%);
	}

	.chooser header {
		display: flex;
		justify-content: space-between;
		padding: 0 0.15rem;
		font-family: var(--font-display);
		font-size: 1rem;
	}

	.chooser input {
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.82rem;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-height: 0;
		overflow: auto;
		scrollbar-width: thin;
	}

	.rows p {
		margin: 0;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.rows button {
		display: flex;
		flex: none;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--wash);
		color: var(--ink);
		font: inherit;
		font-size: 0.85rem;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease;
	}

	.rows button:hover {
		border-color: var(--line-strong);
	}

	.rows button.picked {
		border-color: var(--paper);
		background: rgb(220 207 178 / 0.12);
	}

	.rows span {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.75rem;
		text-align: right;
	}

	.toasts {
		position: absolute;
		top: 5.6rem;
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
		border: 1px solid var(--line);
		border-radius: 2px;
		background: var(--panel-solid);
		font-size: 0.82rem;
	}

	.toasts .good {
		border-color: var(--good);
		color: var(--good);
	}

	.toasts .bad {
		border-color: var(--danger);
		color: var(--danger);
	}

	/* The epidemic lands like a quarantine stamp across the chart: it overshoots, settles, and bleeds. */
	.banner {
		position: absolute;
		top: 30%;
		left: 50%;
		z-index: 45;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.7rem 2.6rem 0.8rem;
		border: 3px double rgb(176 48 28 / 0.9);
		background: rgb(28 12 8 / 0.82);
		color: #e46a4c;
		translate: -50% 0;
		rotate: -3deg;
		pointer-events: none;
		animation: stamp 520ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
	}

	.banner strong {
		font-family: var(--font-display);
		font-size: 3rem;
		font-weight: 400;
		line-height: 1;
		letter-spacing: 0.04em;
	}

	.banner span {
		color: var(--ink);
		font-size: 0.9rem;
	}

	@keyframes stamp {
		from {
			opacity: 0;
			scale: 1.7;
		}
		60% {
			opacity: 1;
		}
		to {
			scale: 1;
		}
	}

	.turn-banner {
		position: absolute;
		top: 3.3rem;
		left: 50%;
		z-index: 44;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.3rem 1.1rem 0.35rem;
		border-radius: 2px;
		background: var(--seat);
		color: var(--on);
		box-shadow: 0 0.6rem 1.6rem rgb(0 0 0 / 0.45);
		font-family: var(--font-display);
		font-size: 1.15rem;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.turn-banner i {
		width: 0.55rem;
		height: 0.55rem;
		border: 2px solid var(--on);
		border-radius: 50%;
	}

	.flash {
		position: absolute;
		inset: 0;
		z-index: 43;
		box-shadow: inset 0 0 10rem 2rem rgb(140 28 18 / 0.6);
		animation: flash 1.6s ease-out forwards;
		pointer-events: none;
	}

	@keyframes flash {
		0% {
			opacity: 0;
		}
		12% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	.outcome {
		position: absolute;
		top: 28%;
		left: 50%;
		z-index: 46;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 1.3rem 3.5rem 1.5rem;
		border: 1px solid var(--danger);
		border-radius: 2px;
		background: rgb(20 18 14 / 0.9);
		backdrop-filter: blur(10px);
		color: var(--danger);
		translate: -50% 0;
		pointer-events: none;
	}

	.outcome.won {
		border-color: var(--good);
		color: var(--good);
	}

	.outcome strong {
		font-family: var(--font-display);
		font-size: 3.6rem;
		font-weight: 400;
		line-height: 1;
	}

	.outcome span {
		color: var(--ink);
		font-size: 1rem;
	}

	.scrim {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgb(12 10 8 / 0.62);
	}

	.scrim.passive {
		place-items: start center;
		padding-top: 3.2rem;
		background: none;
		pointer-events: none;
	}

	.scrim.passive .briefing {
		width: min(26rem, 90vw);
		padding: 0.9rem 1.1rem 0.9rem;
		pointer-events: auto;
	}

	.scrim.passive .briefing ul {
		max-height: 30vh;
		font-size: 0.85rem;
	}

	.briefing {
		width: min(34rem, 90vw);
		padding: 1.4rem 1.6rem 1.3rem;
		border-radius: 2px;
		background: var(--paper);
		color: var(--paper-ink);
		box-shadow:
			0 1.5rem 4rem rgb(0 0 0 / 0.6),
			inset 0 0 3rem rgb(120 86 48 / 0.18);
	}

	.briefing h2 {
		margin: 0 0 0.7rem;
		font-family: var(--font-display);
		font-size: 1.7rem;
		font-weight: 400;
	}

	.briefing ul {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		max-height: 60vh;
		margin: 0 0 1.1rem;
		padding: 0;
		overflow: auto;
		list-style: none;
		font-size: 0.95rem;
		line-height: 1.45;
	}

	.briefing li {
		padding-left: 0.7rem;
		border-left: 2px solid rgb(42 32 23 / 0.3);
	}

	.briefing strong {
		display: block;
		font-family: var(--font-display);
		font-size: 1.08rem;
		font-weight: 400;
	}

	.briefing li::marker {
		color: var(--paper-muted);
	}

	.primary {
		padding: 0.45rem 1.1rem;
		border: 1px solid var(--paper);
		border-radius: 2px;
		background: var(--paper);
		color: var(--paper-ink);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.briefing .primary {
		border-color: var(--paper-ink);
		background: var(--paper-ink);
		color: var(--paper);
	}

	.menu {
		transform-origin: top right;
		position: absolute;
		top: 0.4rem;
		right: 0.7rem;
		z-index: 70;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 3px;
		background: var(--panel-solid);
		box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.5);
		font-size: 0.85rem;
	}

	.menu > * {
		animation: rise 260ms calc(var(--n, 0) * 30ms) both;
	}

	.menu > :nth-child(2) {
		--n: 1;
	}

	.menu > :nth-child(3) {
		--n: 2;
	}

	.menu > :nth-child(4) {
		--n: 3;
	}

	.menu > :nth-child(5) {
		--n: 4;
	}

	.menu > :nth-child(n + 6) {
		--n: 5;
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 0.4rem;
		}
	}

	.rows button {
		animation: rise 240ms calc(var(--i, 0) * 25ms) both;
	}

	.menu button,
	.menu a {
		padding: 0.35rem 0.7rem;
		border: 1px solid transparent;
		border-radius: 2px;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.menu button:hover,
	.menu a:hover {
		border-color: var(--line);
		background: var(--wash);
	}

	.menu .danger {
		color: var(--danger);
	}

	.menu p {
		margin: 0;
		color: var(--muted);
	}
</style>
