#!/usr/bin/env bun
import { botCommand, campaignAt, createGameActor, phaseOf, scenarios as saves } from '@repo/game';
import type { Command, Save } from '@repo/game';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import type { CDPSession, Page } from 'playwright';

/*
 * What the game costs while it is being played. A real, GPU-backed Chromium window stands on a game at an action
 * step and each interaction is made with real input, while this reads how long the page kept the main thread
 * (script, style, layout), which frames ran long, and how late the first frame after a click was.
 *
 *   ./apps/playtest/src/interact.ts                                every interaction on a July game
 *   ./apps/playtest/src/interact.ts --month 12 --throttle 4        the worst case: a December game on a slow CPU
 *   ./apps/playtest/src/interact.ts --only move,turn --profile /tmp/play
 *   ./apps/playtest/src/interact.ts --url http://127.0.0.1:6390    another dev server or a built app
 */

const { values: flags } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://boardgame-pandemic-legacy-season-2.localhost:6190' },
		month: { type: 'string', default: '7' },
		only: { type: 'string' },
		out: { type: 'string' },
		profile: { type: 'string' },
		/** Saves a browser trace per interaction here and prints where its longest frames went, paint and decode included. */
		trace: { type: 'string' },
		width: { type: 'string', default: '1512' },
		height: { type: 'string', default: '860' },
		scale: { type: 'string', default: '2' },
		/** Styles added to the page, to measure the game with a rule changed: `--css '.panel { backdrop-filter: none }'`. */
		css: { type: 'string' },
		/** Slows the CPU by this factor, as a laptop on battery would be. */
		throttle: { type: 'string', default: '1' },
		/**
		 * Draws as fast as the machine can instead of at the screen's rate, so the time per frame is what a frame costs.
		 * A frame that fits the screen's rate with room to spare here is one a slower machine can still draw in time.
		 */
		uncapped: { type: 'boolean', default: false },
	},
});

/** A game standing at a player's action step with its briefing read. */
function actionSave(month: number): Save {
	const rng = { seed: 7 };
	const actor = createGameActor({ seed: 12, save: campaignAt(month) });
	actor.start();
	for (let step = 0; step < 400; step++) {
		const snapshot = actor.getSnapshot();
		const phase = phaseOf(snapshot);
		const world = snapshot.context.world;
		const idle = phase === 'playing.actions' && world.game!.pending.length === 0;
		if (idle && world.campaign.briefing.length === 0) return { v: 1, phase, world };
		actor.send(idle ? { type: 'ACK_BRIEFING' } : botCommand(world, phase, rng, 4));
	}
	throw new Error(`month ${month} never reached an action step`);
}

type Moment = { save: Save; command: Command };
/**
 * A bot's whole game of the month, from its lobby to the end of its upkeep: the save before each command and the
 * command. A scenario loads one of the saves and sends the commands after it, so the browser plays a moment of a real
 * game (the opening deal, an Epidemic, an exposure, the end) without playing the whole game up to it.
 */
function botGame(month: number): Moment[] {
	const rng = { seed: 7 };
	const actor = createGameActor({ seed: 12, save: campaignAt(month) });
	actor.start();
	const moments: Moment[] = [];
	for (let step = 0; step < 4000; step++) {
		const snapshot = actor.getSnapshot();
		const phase = phaseOf(snapshot);
		const world = snapshot.context.world;
		if (moments.length > 0 && (phase === 'lobby' || phase === 'finished')) return moments;
		const reading = world.campaign.briefing.length > 0 && phase === 'playing.actions';
		const command: Command = reading ? { type: 'ACK_BRIEFING' } : botCommand(world, phase, rng, 4);
		moments.push({ save: structuredClone({ v: 1, phase, world }), command });
		actor.send(command);
	}
	throw new Error(`month ${month} never finished its game`);
}
let played: Moment[] | null = null;
const moments = () => (played ??= botGame(Number(flags.month)));
/** The first moment of the bot's game that `found` is true of. */
function momentAt(found: (save: Save) => boolean, what: string): number {
	const index = moments().findIndex(moment => found(moment.save));
	if (index < 0) throw new Error(`The bot's game of month ${flags.month} has no ${what}`);
	return index;
}
const logged = (kind: string) => (save: Save) => (save.world.game?.log ?? []).some(entry => entry.t === kind);

type Frame = { at: number; ms: number };
type LongFrame = {
	ms: number;
	blocking: number;
	layout: number;
	scripts: { name: string; ms: number; forced: number }[];
};
type Probe = { frames: Frame[]; long: LongFrame[]; events: { name: string; ms: number }[]; last: number; on: boolean };

declare const window: Window & {
	DEBUG?: {
		getState(): {
			phase: string;
			world: { game: { active: string; pending: unknown[] } | null; table: { seats: { player: string }[] } };
		} | null;
		setState(state: unknown): void;
		send(command: unknown): string | null;
	};
	__probe: Probe;
};

const PROBE = () => {
	const probe: Probe = (window.__probe = { frames: [], long: [], events: [], last: 0, on: false });
	const tick = (now: number) => {
		if (probe.on && probe.last) probe.frames.push({ at: now, ms: now - probe.last });
		probe.last = now;
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
	type Script = {
		invoker: string;
		sourceFunctionName: string;
		sourceURL: string;
		duration: number;
		forcedStyleAndLayoutDuration: number;
	};
	type Loaf = PerformanceEntry & { blockingDuration: number; styleAndLayoutStart: number; scripts: Script[] };
	new PerformanceObserver(list => {
		if (!probe.on) return;
		for (const entry of list.getEntries() as Loaf[])
			probe.long.push({
				ms: entry.duration,
				blocking: entry.blockingDuration,
				layout: entry.styleAndLayoutStart ? entry.startTime + entry.duration - entry.styleAndLayoutStart : 0,
				scripts: entry.scripts
					.filter(script => script.duration >= 2)
					.map(script => ({
						name: `${script.invoker} ${script.sourceFunctionName} ${script.sourceURL.split('/').slice(-2).join('/').split('?')[0]}`,
						ms: script.duration,
						forced: script.forcedStyleAndLayoutDuration,
					})),
			});
	}).observe({ type: 'long-animation-frame', buffered: false });
	new PerformanceObserver(list => {
		if (!probe.on) return;
		for (const entry of list.getEntries()) probe.events.push({ name: entry.name, ms: entry.duration });
	}).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type TraceEvent = { name: string; ph: string; ts: number; dur?: number; tid: number; pid: number; args?: unknown };
/**
 * What a CPU profile cannot show: the work the browser does around the page's script. Lists the single longest pieces
 * of work on any thread (a decoded image, a raster, a layout), with what each was given.
 */
function slowest(trace: Buffer, floor = 12): string[] {
	const { traceEvents } = JSON.parse(trace.toString()) as { traceEvents: TraceEvent[] };
	const threads = new Map<string, string>();
	for (const event of traceEvents)
		if (event.name === 'thread_name')
			threads.set(`${event.pid}:${event.tid}`, (event.args as { name: string }).name.replace(/\/\d+$/, ''));
	const wrappers =
		/^(RunTask|ThreadControllerImpl::RunTask|ThreadPool_RunTask|SimpleWatcher::OnHandleReady|Receive mojo message|Closed mojo endpoint|TaskGraphRunner::RunTask|MessagePumpKqueue::.*|Thread::.*)$/;
	return traceEvents
		.filter(event => event.ph === 'X' && (event.dur ?? 0) >= floor * 1000 && !wrappers.test(event.name))
		.toSorted((a, b) => b.dur! - a.dur!)
		.slice(0, 14)
		.map(event => {
			const detail = JSON.stringify(event.args ?? {}).replace(/https?:\/\/[^/"]+/g, '');
			return `${(event.dur! / 1000).toFixed(0).padStart(4)}ms ${threads.get(`${event.pid}:${event.tid}`) ?? '?'} › ${event.name} ${detail.length > 2 ? detail.slice(0, 150) : ''}`;
		});
}

const browser = await chromium.launch({
	headless: false,
	args: [
		'--ignore-gpu-blocklist',
		'--disable-backgrounding-occluded-windows',
		'--disable-renderer-backgrounding',
		'--disable-features=CalculateNativeWinOcclusion',
		...(flags.uncapped ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : []),
	],
});
const context = await browser.newContext({
	viewport: { width: Number(flags.width), height: Number(flags.height) },
	deviceScaleFactor: Number(flags.scale),
});
await context.addInitScript(PROBE);
if (flags.css)
	await context.addInitScript(css => {
		addEventListener('DOMContentLoaded', () => {
			const style = document.createElement('style');
			style.textContent = css;
			document.head.append(style);
		});
	}, flags.css);
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const client = await context.newCDPSession(page);
await client.send('Performance.enable');
if (Number(flags.throttle) > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: Number(flags.throttle) });

let actionStep: Save | null = null;
const atActions = () => (actionStep ??= actionSave(Number(flags.month)));

async function load(page: Page, save: Save) {
	await page.goto(`${flags.url}/debug/game?DEBUG_ID=interact`);
	await page.waitForFunction(() => Boolean(window.DEBUG?.getState()), null, { timeout: 30_000 });
	await Promise.all([page.waitForEvent('load'), page.evaluate(next => window.DEBUG!.setState(next), save)]);
	await page.waitForFunction(phase => window.DEBUG?.getState()?.phase === phase, save.phase, { timeout: 30_000 });
	await page.waitForSelector('.anchor[data-city]', { timeout: 60_000 });
	await sleep(6000);
}

const metrics = async (client: CDPSession) => {
	const { metrics } = (await client.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
	return Object.fromEntries(metrics.map(metric => [metric.name, metric.value]));
};

const center = async (selector: string, nth = 0) => {
	const box = await page.locator(selector).nth(nth).boundingBox({ timeout: 1500 });
	if (!box) throw new Error(`Nothing on screen matches ${selector}`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const cities = () =>
	page.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>('.anchor[data-city]')]
			.map(node => {
				const box = node.getBoundingClientRect();
				return { city: node.dataset['city']!, x: box.x + box.width / 2, y: box.y + box.height / 2 };
			})
			.filter(point => point.x > 300 && point.x < innerWidth - 300 && point.y > 120 && point.y < innerHeight - 260),
	);

const rng = { seed: 11 };
/** A legal command the bot would send, sent the way a click would. Returns the phase it was sent in. */
async function bot(): Promise<string> {
	const state = (await page.evaluate(() => window.DEBUG!.getState())) as unknown as Save;
	const command =
		state.world.campaign.briefing.length > 0
			? ({ type: 'ACK_BRIEFING' } as const)
			: botCommand(state.world, state.phase, rng, 4);
	const refused = await page.evaluate(next => window.DEBUG!.send(next), command);
	if (refused) throw new Error(`The game refused the bot's ${command.type} in ${state.phase}: ${refused}`);
	return state.phase;
}

/** Sends the bot's own commands from `from` up to `to`, each given `pause(phase)` to play out on the board. */
async function replay(from: number, to: number, pause: (phase: string) => number) {
	for (const moment of moments().slice(from, to)) {
		await page.evaluate(next => window.DEBUG!.send(next), moment.command);
		await sleep(pause(moment.save.phase));
	}
}

/** The pointer crosses everything on screen that matches, resting on each. */
async function sweep(selector: string, rest: number, limit = 12) {
	const boxes = await page
		.locator(selector)
		.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()).map(box => ({ ...box.toJSON() })));
	for (const box of boxes.filter(box => box.width > 0 && box.height > 0).slice(0, limit)) {
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
		await sleep(rest);
	}
}

/**
 * A scenario plays on the game at an action step, as the one before it left it, unless it names a save of its own,
 * which is loaded first. The ones that play the bot's moves start from the action step again, so the game they
 * measure does not depend on where an earlier scenario's clicks landed.
 */
type Scenario = { id: string; run: () => Promise<void>; settle?: number; save?: () => Save };

const scenarios: Scenario[] = [
	{
		id: 'hover-cities',
		async run() {
			const points = (await cities()).slice(0, 24);
			for (const point of points) await page.mouse.move(point.x, point.y, { steps: 8 });
		},
	},
	{
		id: 'hover-hand',
		async run() {
			const cards = await page.locator('[data-testid=hand] [data-card]').count();
			for (let index = 0; index < Math.min(cards, 8); index++) {
				const point = await center('[data-testid=hand] [data-card]', index).catch(() => null);
				if (point) await page.mouse.move(point.x, point.y, { steps: 6 });
				await sleep(120);
			}
			await page.mouse.move(700, 300, { steps: 6 });
		},
	},
	{
		id: 'hover-seats',
		async run() {
			for (const corner of [
				{ x: 150, y: 150 },
				{ x: Number(flags.width) - 150, y: 150 },
				{ x: 150, y: Number(flags.height) - 120 },
				{ x: Number(flags.width) - 150, y: Number(flags.height) - 120 },
			]) {
				await page.mouse.move(corner.x, corner.y, { steps: 10 });
				await sleep(250);
			}
			await page.mouse.move(700, 300, { steps: 6 });
		},
	},
	{
		id: 'hover-decks',
		async run() {
			for (const id of [
				'player-deck-count',
				'infection-deck-count',
				'storage-deck',
				'frequency-scanner',
				'hollow-supply',
				'at-risk',
				'campaign-status',
				'objectives',
			]) {
				const point = await center(`[data-testid=${id}]`).catch(() => null);
				if (!point) continue;
				await page.mouse.move(point.x, point.y, { steps: 8 });
				await sleep(350);
			}
			await page.mouse.move(700, 300, { steps: 6 });
		},
	},
	{
		id: 'pan',
		async run() {
			await page.mouse.move(760, 400);
			await page.mouse.down();
			for (let step = 0; step < 60; step++) {
				await page.mouse.move(760 + Math.sin(step / 9) * 220, 400 + Math.cos(step / 7) * 120);
				await sleep(16);
			}
			await page.mouse.up();
		},
		settle: 1500,
	},
	{
		id: 'zoom',
		async run() {
			await page.mouse.move(760, 400);
			for (let step = 0; step < 30; step++) {
				await page.mouse.wheel(0, -60);
				await sleep(16);
			}
			await sleep(300);
			for (let step = 0; step < 30; step++) {
				await page.mouse.wheel(0, 60);
				await sleep(16);
			}
		},
		settle: 1500,
	},
	{
		// A long line with the pen held, then the eraser dragged back across it.
		id: 'draw',
		async run() {
			const at = (step: number) => ({ x: 420 + step * 2.6, y: 400 + Math.sin(step / 9) * 130 });
			await page.mouse.move(at(0).x, at(0).y);
			await page.keyboard.down('f');
			await page.mouse.down();
			for (let step = 1; step <= 260; step++) {
				await page.mouse.move(at(step).x, at(step).y);
				await sleep(8);
			}
			await page.mouse.up();
			await page.keyboard.up('f');
			await page.keyboard.press('e');
			await page.mouse.down();
			for (let step = 260; step >= 120; step -= 2) {
				await page.mouse.move(at(step).x, at(step).y);
				await sleep(8);
			}
			await page.mouse.up();
			await page.keyboard.press('e');
		},
	},
	{
		id: 'ring',
		async run() {
			for (const point of (await cities()).slice(0, 6)) {
				await page.mouse.click(point.x, point.y);
				await sleep(350);
				await page.keyboard.press('Escape');
				await sleep(150);
			}
		},
	},
	{
		id: 'dialogs',
		async run() {
			for (const id of ['open-box', 'open-legacy-deck', 'frequency-scanner']) {
				const point = await center(`[data-testid=${id}]`).catch(() => null);
				if (!point) continue;
				await page.mouse.click(point.x, point.y);
				await sleep(900);
				await page.keyboard.press('Escape');
				await sleep(500);
			}
		},
	},
	{
		id: 'move',
		save: atActions,
		async run() {
			for (let step = 0; step < 4; step++) {
				await bot();
				await sleep(1200);
			}
		},
		settle: 2000,
	},
	{
		id: 'turn',
		save: atActions,
		async run() {
			for (let step = 0; step < 40; step++) {
				const sent = await bot();
				await sleep(sent.startsWith('playing.actions') ? 500 : 900);
			}
		},
		settle: 3000,
	},
	{
		id: 'undo',
		save: atActions,
		async run() {
			for (let step = 0; step < 3; step++) {
				await bot();
				await sleep(400);
			}
			for (let step = 0; step < 3; step++) {
				await page.evaluate(() => window.DEBUG!.send({ type: 'UNDO' }));
				await sleep(600);
			}
		},
	},
	{
		// Each action the panel offers is started, its lit cities, pawns and cards crossed, and put down again.
		id: 'aim',
		async run() {
			const offered = await page.locator('[data-testid=action-list] [data-action]').count();
			for (let index = 0; index < Math.min(offered, 8); index++) {
				const point = await center('[data-testid=action-list] [data-action]', index).catch(() => null);
				if (!point) continue;
				await page.mouse.click(point.x, point.y);
				await sleep(300);
				for (const city of (await cities()).slice(0, 5)) await page.mouse.move(city.x, city.y, { steps: 6 });
				await page.keyboard.press('Escape');
				await sleep(150);
			}
		},
	},
	{
		// What a deck's tooltip knows, section by section, each laying its cards out beside it.
		id: 'spread',
		async run() {
			for (const id of ['player-deck-count', 'infection-deck-count', 'storage-deck']) {
				const point = await center(`[data-testid=${id}]`).catch(() => null);
				if (!point) continue;
				await page.mouse.move(point.x, point.y, { steps: 8 });
				await sleep(400);
				for (let section = 0; section < 5; section++) {
					await page.keyboard.press('ArrowDown');
					await sleep(450);
				}
				await page.mouse.move(700, 420, { steps: 6 });
				await sleep(300);
			}
		},
	},
	{
		// The lobby of our own campaign: every character card, the faces at its foot, the blank card and its havens.
		id: 'lobby',
		save: () => saves.canonical(),
		async run() {
			// The table agrees which game is next, and the characters come up.
			await page.evaluate(() => {
				for (const { player } of window.DEBUG!.getState()!.world.table.seats)
					window.DEBUG!.send({ type: 'READY', player, start: 'month' });
			});
			await page.waitForSelector('[data-testid=character-select]', { timeout: 5000 });
			await sleep(1200);
			await sweep('[data-testid=character-select] [data-testid^=claim-]', 350);
			const claim = await center('[data-testid=character-select] [data-testid^=claim-]').catch(() => null);
			if (claim) {
				await page.mouse.click(claim.x, claim.y);
				await sleep(600);
				await sweep('[data-testid^=face-]', 120, 8);
			}
			await sweep('[data-testid=new-character]', 500, 1);
			await sweep('[data-testid=new-character] button', 200, 10);
			await page.mouse.move(700, 60, { steps: 6 });
		},
		settle: 1200,
	},
	{
		// A game opens: the supply cubes are dealt across the board and the nine Infection cards are flipped.
		id: 'opening',
		save: () => moments()[0]!.save,
		async run() {
			const first = momentAt(save => save.phase === 'playing.actions', 'action step');
			await replay(0, first, phase => (phase === 'setup.infect' ? 1600 : 2500));
		},
		settle: 2500,
	},
	{
		// An Epidemic from the draw that turns it up to the Intensify that ends it.
		id: 'epidemic',
		save: () => moments()[momentAt(save => save.world.game?.pending[0]?.t === 'epidemicDrawn', 'Epidemic') - 1]!.save,
		async run() {
			const drawn = momentAt(save => save.world.game?.pending[0]?.t === 'epidemicDrawn', 'Epidemic');
			await replay(drawn - 1, drawn + 3, () => 4200);
		},
		settle: 2500,
	},
	{
		// An exposure: the box grows out of the character's track and is scratched open in front of the table.
		id: 'exposure',
		save: () => moments()[momentAt(logged('exposure'), 'exposure') - 1]!.save,
		async run() {
			const exposed = momentAt(logged('exposure'), 'exposure');
			await replay(exposed - 1, exposed + 1, () => 5000);
		},
		settle: 2500,
	},
	{
		// The last turn, the game played back on the board, and the spending between games.
		id: 'ending',
		save: () => moments()[momentAt(save => save.phase === 'over', 'end') - 4]!.save,
		async run() {
			const over = momentAt(save => save.phase === 'over', 'end');
			await replay(over - 4, over, () => 1500);
			// The outcome is announced, then the time lapse plays for about twenty seconds.
			await sleep(26_000);
			await replay(over, moments().length, phase => (phase === 'over' ? 9000 : 500));
		},
		settle: 2500,
	},
].filter(scenario => !flags.only || flags.only.split(',').includes(scenario.id));

type Row = {
	scenario: string;
	seconds: number;
	frames: number;
	/** Frames that took longer than 1.5, 2 and 3 frames of a 60 Hz screen. */
	over25: number;
	over34: number;
	over50: number;
	worstFrame: number;
	p95Frame: number;
	meanFrame: number;
	scriptMs: number;
	styleMs: number;
	layoutMs: number;
	styleRecalcs: number;
	layouts: number;
	longFrames: number;
	blockingMs: number;
	worstEvent: number;
	top: string[];
};

const rows: Row[] = [];
let standing: Save | null = null;
try {
	for (const scenario of scenarios) {
		const wanted: Save | null = scenario.save?.() ?? (standing === atActions() ? null : atActions());
		if (wanted) await load(page, (standing = wanted));
		// A scenario with a save of its own leaves the game wherever it ended, so the next starts from the action step.
		if (scenario.save) standing = null;
		await page.mouse.move(700, 300);
		await sleep(1500);
		if (flags.profile) {
			await client.send('Profiler.enable');
			await client.send('Profiler.setSamplingInterval', { interval: 200 });
			await client.send('Profiler.start');
		}
		if (flags.trace)
			await browser.startTracing(page, {
				categories: [
					'devtools.timeline',
					'disabled-by-default-devtools.timeline',
					'blink.user_timing',
					'loading',
					'cc',
					'gpu',
					'viz',
				],
			});
		const before = await metrics(client);
		const started = performance.now();
		await page.evaluate(() => {
			const probe = window.__probe;
			probe.frames = [];
			probe.long = [];
			probe.events = [];
			probe.on = true;
		});
		await scenario.run();
		await sleep(scenario.settle ?? 800);
		const probe = await page.evaluate(() => {
			window.__probe.on = false;
			return window.__probe;
		});
		const seconds = (performance.now() - started) / 1000;
		const after = await metrics(client);
		if (flags.profile) {
			const { profile } = await client.send('Profiler.stop');
			mkdirSync(flags.profile, { recursive: true });
			writeFileSync(`${flags.profile}/${scenario.id}.cpuprofile`, JSON.stringify(profile));
		}
		let slow: string[] = [];
		if (flags.trace) {
			const trace = await browser.stopTracing();
			mkdirSync(flags.trace, { recursive: true });
			writeFileSync(`${flags.trace}/${scenario.id}.json`, trace);
			slow = slowest(trace);
		}
		const frames = probe.frames.map(frame => frame.ms).toSorted((a, b) => a - b);
		const byScript = new Map<string, number>();
		for (const long of probe.long)
			for (const script of long.scripts) byScript.set(script.name, (byScript.get(script.name) ?? 0) + script.ms);
		const delta = (name: string) => (after[name]! - before[name]!) * 1000;
		rows.push({
			scenario: scenario.id,
			seconds,
			frames: frames.length,
			over25: frames.filter(ms => ms > 25).length,
			over34: frames.filter(ms => ms > 34).length,
			over50: frames.filter(ms => ms > 50).length,
			worstFrame: frames.at(-1) ?? 0,
			p95Frame: frames[Math.floor(frames.length * 0.95)] ?? 0,
			meanFrame: frames.reduce((total, ms) => total + ms, 0) / Math.max(1, frames.length),
			scriptMs: delta('ScriptDuration'),
			styleMs: delta('RecalcStyleDuration'),
			layoutMs: delta('LayoutDuration'),
			styleRecalcs: after['RecalcStyleCount']! - before['RecalcStyleCount']!,
			layouts: after['LayoutCount']! - before['LayoutCount']!,
			longFrames: probe.long.length,
			blockingMs: probe.long.reduce((total, long) => total + long.blocking, 0),
			worstEvent: Math.max(0, ...probe.events.map(event => event.ms)),
			top: [...byScript]
				.toSorted((a, b) => b[1] - a[1])
				.slice(0, 4)
				.map(([name, ms]) => `${ms.toFixed(0)}ms ${name}`),
		});
		const row = rows.at(-1)!;
		console.log(
			`${row.scenario.padEnd(13)} ${row.seconds.toFixed(1)}s  frames ${String(row.frames).padStart(4)}  mean ${row.meanFrame.toFixed(1).padStart(5)}ms  >25ms ${String(row.over25).padStart(3)}  >50ms ${String(row.over50).padStart(3)}  worst ${row.worstFrame.toFixed(0).padStart(4)}ms  ` +
				`script ${row.scriptMs.toFixed(0).padStart(5)}ms  style ${row.styleMs.toFixed(0).padStart(4)}ms (${row.styleRecalcs})  layout ${row.layoutMs.toFixed(0).padStart(4)}ms (${row.layouts})  ` +
				`long ${row.longFrames} blocking ${row.blockingMs.toFixed(0)}ms  event ${row.worstEvent.toFixed(0)}ms`,
		);
		for (const line of row.top) console.log(`    ${line}`);
		for (const line of slow) console.log(`    ${line}`);
	}
} finally {
	await browser.close();
}
if (errors.length) console.log(`\npage errors:\n${[...new Set(errors)].join('\n')}`);
if (flags.out) {
	mkdirSync(flags.out.replace(/\/[^/]*$/, ''), { recursive: true });
	writeFileSync(flags.out, JSON.stringify({ flags, rows, errors }, null, '\t'));
}
