#!/usr/bin/env bun
import { botCommand, campaignAt, createGameActor, phaseOf } from '@repo/game';
import type { Save } from '@repo/game';
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
		width: { type: 'string', default: '1512' },
		height: { type: 'string', default: '860' },
		scale: { type: 'string', default: '2' },
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
		getState(): { phase: string; world: { game: { active: string; pending: unknown[] } | null } } | null;
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
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const client = await context.newCDPSession(page);
await client.send('Performance.enable');
if (Number(flags.throttle) > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: Number(flags.throttle) });

const save = actionSave(Number(flags.month));

async function load(page: Page) {
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
	await page.evaluate(next => window.DEBUG!.send(next), command);
	return state.phase;
}

type Scenario = { id: string; run: () => Promise<void>; settle?: number };

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
try {
	await load(page);
	for (const scenario of scenarios) {
		await page.mouse.move(700, 300);
		await sleep(1500);
		if (flags.profile) {
			await client.send('Profiler.enable');
			await client.send('Profiler.setSamplingInterval', { interval: 200 });
			await client.send('Profiler.start');
		}
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
	}
} finally {
	await browser.close();
}
if (errors.length) console.log(`\npage errors:\n${[...new Set(errors)].join('\n')}`);
if (flags.out) {
	mkdirSync(flags.out.replace(/\/[^/]*$/, ''), { recursive: true });
	writeFileSync(flags.out, JSON.stringify({ flags, rows, errors }, null, '\t'));
}
