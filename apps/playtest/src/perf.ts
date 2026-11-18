#!/usr/bin/env bun
import { botCommand, campaignAt, createGameActor, phaseOf } from '@repo/game';
import type { Save } from '@repo/game';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import type { CDPSession, Page } from 'playwright';

/*
 * What the game costs while nobody touches it. A real, GPU-backed Chromium window sits on each screen for a
 * fixed time while this counts the frames the page drew and the CPU time its processes burned.
 *
 *   ./apps/playtest/src/perf.ts                                    every screen, 5 runs of 15 s each
 *   ./apps/playtest/src/perf.ts --only january --runs 1 --profile /tmp/idle
 */

const { values: flags } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://boardgame-pandemic-legacy-season-2.localhost:6190' },
		runs: { type: 'string', default: '5' },
		seconds: { type: 'string', default: '15' },
		settle: { type: 'string', default: '12' },
		only: { type: 'string' },
		out: { type: 'string' },
		profile: { type: 'string' },
		shot: { type: 'string' },
		quiet: { type: 'string', default: '1.5' },
		css: { type: 'string' },
		width: { type: 'string', default: '1512' },
		height: { type: 'string', default: '860' },
		scale: { type: 'string', default: '2' },
	},
});
const RUNS = Number(flags.runs);
const SECONDS = Number(flags.seconds);
const SETTLE = Number(flags.settle);

/** A game standing at a player's action step, which is where a table spends its idle time. */
function idleSave(month: number): Save {
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

type Scenario = { id: string; path: string; save?: Save };
const scenarios: Scenario[] = [
	{ id: 'blank', path: 'about:blank' },
	{ id: 'landing', path: '/?DEBUG_ID=perf-landing' },
	{ id: 'january', path: '/debug/game?DEBUG_ID=perf-january', save: idleSave(1) },
	{ id: 'july', path: '/debug/game?DEBUG_ID=perf-july', save: idleSave(7) },
].filter(scenario => !flags.only || flags.only.split(',').includes(scenario.id));

declare const window: Window & {
	DEBUG?: { getState(): { phase: string } | null; setState(state: unknown): void };
	__perf: {
		callbacks: number;
		frames: number;
		drawn: number;
		draws: number;
		uploads: number;
		stamp: number;
		workers: number;
	};
};

/** Counts what the page does per frame without touching the app: animation callbacks, frames that drew, GL calls. */
const COUNTERS = () => {
	const perf = (window.__perf = { callbacks: 0, frames: 0, drawn: 0, draws: 0, uploads: 0, stamp: -1, workers: 0 });
	// The chart is painted in a worker that ends itself, so a page with none left has finished loading its board.
	const terminate = Worker.prototype.terminate;
	globalThis.Worker = new Proxy(Worker, {
		construct(target, args: ConstructorParameters<typeof Worker>) {
			perf.workers++;
			return new target(...args);
		},
	});
	Worker.prototype.terminate = function (this: Worker) {
		perf.workers--;
		terminate.call(this);
	};
	let drewAt = -1;
	const request = window.requestAnimationFrame.bind(window);
	window.requestAnimationFrame = callback =>
		request(time => {
			perf.callbacks++;
			if (time !== perf.stamp) {
				perf.stamp = time;
				perf.frames++;
			}
			callback(time);
		});
	const wrap = (proto: object, name: string, count: () => void) => {
		const original = (proto as Record<string, unknown>)[name];
		if (typeof original !== 'function') return;
		(proto as Record<string, unknown>)[name] = function (this: unknown, ...args: unknown[]) {
			count();
			return original.apply(this, args);
		};
	};
	for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
		for (const name of [
			'drawArrays',
			'drawElements',
			'drawArraysInstanced',
			'drawElementsInstanced',
			'drawRangeElements',
		])
			wrap(proto, name, () => {
				perf.draws++;
				if (drewAt !== perf.stamp) {
					drewAt = perf.stamp;
					perf.drawn++;
				}
			});
		for (const name of ['texImage2D', 'texSubImage2D']) wrap(proto, name, () => perf.uploads++);
	}
};

type Sample = {
	scenario: string;
	seconds: number;
	/** Frames the browser ran animation callbacks in, and frames in which WebGL drew, per second. */
	framesPerSecond: number;
	drawnPerSecond: number;
	callbacksPerFrame: number;
	drawCallsPerDrawnFrame: number;
	uploadsPerSecond: number;
	/** CPU time over wall time: 1 is one core kept busy. */
	rendererCpu: number;
	gpuProcessCpu: number;
	scriptCpu: number;
	styleAndLayoutCpu: number;
	styleRecalcsPerSecond: number;
	/** System-wide, so it includes whatever else the machine draws. */
	gpuUtilization: number;
	/** Cores the rest of the machine kept busy meanwhile. A crowded machine pushes this browser onto its slow cores. */
	otherCpu: number;
};

const processCpu = async (browser: CDPSession) => {
	const { processInfo } = (await browser.send('SystemInfo.getProcessInfo')) as {
		processInfo: { type: string; cpuTime: number }[];
	};
	const sum = (type: string) =>
		processInfo.filter(info => info.type === type).reduce((total, info) => total + info.cpuTime, 0);
	return { renderer: sum('renderer'), gpu: sum('GPU') };
};

const pageMetrics = async (client: CDPSession) => {
	const { metrics } = (await client.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
	return Object.fromEntries(metrics.map(metric => [metric.name, metric.value]));
};

const gpuUtilization = () => {
	const text = execFileSync('ioreg', ['-r', '-d', '1', '-c', 'IOAccelerator'], { encoding: 'utf8' });
	return Number(/"Device Utilization %"=(\d+)/.exec(text)?.[1] ?? NaN);
};

/** Cores in use by everything except this script and its browser. */
const otherCpu = () =>
	execFileSync('ps', ['-Ao', 'pid=,pcpu=,comm='], { encoding: 'utf8' })
		.split('\n')
		.map(line => /^\s*(\d+)\s+([\d.]+)\s+(.*)$/.exec(line))
		.filter(match => match && Number(match[1]) !== process.pid && !/Google Chrome for Testing|\/ps$/.test(match[3]!))
		.reduce((total, match) => total + Number(match![2]), 0) / 100;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function measure(page: Page, client: CDPSession, browser: CDPSession, scenario: string): Promise<Sample> {
	const read = async () => ({
		at: performance.now(),
		counters: await page.evaluate(() => ({ ...window.__perf })),
		cpu: await processCpu(browser),
		metrics: await pageMetrics(client),
	});
	const before = await read();
	const gpu: number[] = [];
	const other: number[] = [];
	for (let second = 0; second < SECONDS; second++) {
		await sleep(1000);
		gpu.push(gpuUtilization());
		other.push(otherCpu());
	}
	const after = await read();
	const seconds = (after.at - before.at) / 1000;
	const delta = (pick: (reading: typeof before) => number) => pick(after) - pick(before);
	const frames = delta(reading => reading.counters.frames);
	const drawn = delta(reading => reading.counters.drawn);
	return {
		scenario,
		seconds,
		framesPerSecond: frames / seconds,
		drawnPerSecond: drawn / seconds,
		callbacksPerFrame: frames ? delta(reading => reading.counters.callbacks) / frames : 0,
		drawCallsPerDrawnFrame: drawn ? delta(reading => reading.counters.draws) / drawn : 0,
		uploadsPerSecond: delta(reading => reading.counters.uploads) / seconds,
		rendererCpu: delta(reading => reading.cpu.renderer) / seconds,
		gpuProcessCpu: delta(reading => reading.cpu.gpu) / seconds,
		scriptCpu: delta(reading => reading.metrics.ScriptDuration!) / seconds,
		styleAndLayoutCpu:
			delta(reading => reading.metrics.RecalcStyleDuration! + reading.metrics.LayoutDuration!) / seconds,
		styleRecalcsPerSecond: delta(reading => reading.metrics.RecalcStyleCount!) / seconds,
		gpuUtilization: gpu.reduce((total, value) => total + value, 0) / gpu.length,
		otherCpu: other.reduce((total, value) => total + value, 0) / other.length,
	};
}

const browser = await chromium.launch({
	headless: false,
	args: [
		'--ignore-gpu-blocklist',
		// A window that another one covers stops drawing, which would read as an idle game.
		'--disable-backgrounding-occluded-windows',
		'--disable-renderer-backgrounding',
		'--disable-features=CalculateNativeWinOcclusion',
	],
});
const context = await browser.newContext({
	viewport: { width: Number(flags.width), height: Number(flags.height) },
	deviceScaleFactor: Number(flags.scale),
});
await context.addInitScript(COUNTERS);
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const client = await context.newCDPSession(page);
const browserClient = await browser.newBrowserCDPSession();
await client.send('Performance.enable');

const open = async (scenario: Scenario) => {
	const url = scenario.path.startsWith('/') ? flags.url + scenario.path : scenario.path;
	await page.goto(url);
	if (!scenario.save) return;
	await page.waitForFunction(() => Boolean(window.DEBUG?.getState()), null, { timeout: 30_000 });
	const phase = await page.evaluate(() => window.DEBUG!.getState()!.phase);
	if (phase === scenario.save.phase) return;
	await Promise.all([page.waitForEvent('load'), page.evaluate(save => window.DEBUG!.setState(save), scenario.save)]);
	await page.waitForFunction(phase => window.DEBUG?.getState()?.phase === phase, scenario.save.phase, {
		timeout: 30_000,
	});
};

const samples: Sample[] = [];
try {
	const renderer = await page.evaluate(() => {
		const gl = document.createElement('canvas').getContext('webgl2');
		const info = gl?.getExtension('WEBGL_debug_renderer_info');
		return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'no WebGL';
	});
	console.log(`renderer: ${renderer}`);
	console.log(`load: ${execFileSync('uptime', { encoding: 'utf8' }).trim()}`);
	// Runs are interleaved, so drift on the machine falls on every scenario alike.
	for (let run = 0; run < RUNS; run++) {
		for (const scenario of scenarios) {
			await open(scenario);
			await page.mouse.move(4, 4);
			if (flags.css) await page.addStyleTag({ content: flags.css });
			await page.waitForFunction(() => window.__perf.workers === 0, null, { timeout: 120_000 });
			await sleep(SETTLE * 1000);
			// Waits out other work on the machine, for up to ten minutes, then measures anyway and says so.
			for (let calm = 0, waited = 0; calm < 3 && waited < 600; waited++) {
				calm = otherCpu() < Number(flags.quiet) ? calm + 1 : 0;
				await sleep(1000);
			}
			if (run === 0) {
				const running = await page.evaluate(() =>
					document
						.getAnimations()
						.filter(animation => animation.playState === 'running')
						.map(animation => (animation as CSSAnimation).animationName ?? 'transition'),
				);
				if (running.length) console.log(`${scenario.id} animations still running: ${running.join(', ')}`);
			}
			if (run === 0 && flags.shot) await page.screenshot({ path: `${flags.shot}-${scenario.id}.png` });
			const profiled = Boolean(flags.profile) && run === 0 && scenario.id !== 'blank';
			if (profiled) {
				await client.send('Profiler.enable');
				await client.send('Profiler.start');
			}
			const sample = await measure(page, client, browserClient, scenario.id);
			if (profiled) {
				const { profile } = await client.send('Profiler.stop');
				writeFileSync(`${flags.profile}-${scenario.id}.cpuprofile`, JSON.stringify(profile));
			}
			samples.push(sample);
			console.log(
				`run ${run + 1} ${scenario.id.padEnd(8)} drawn ${sample.drawnPerSecond.toFixed(1)}/s of ${sample.framesPerSecond.toFixed(1)} frames/s, ` +
					`renderer ${(sample.rendererCpu * 100).toFixed(1)}% gpu-process ${(sample.gpuProcessCpu * 100).toFixed(1)}% ` +
					`gpu ${sample.gpuUtilization.toFixed(0)}%, other work ${sample.otherCpu.toFixed(1)} cores`,
			);
		}
	}
} finally {
	await browser.close();
}

const median = (values: number[]) => {
	const sorted = values.toSorted((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)]!;
};
const summary = scenarios.map(scenario => {
	const mine = samples.filter(sample => sample.scenario === scenario.id);
	const stat = (pick: (sample: Sample) => number) => {
		const values = mine.map(pick);
		return { median: median(values), min: Math.min(...values), max: Math.max(...values) };
	};
	return {
		scenario: scenario.id,
		runs: mine.length,
		framesPerSecond: stat(sample => sample.framesPerSecond),
		drawnPerSecond: stat(sample => sample.drawnPerSecond),
		callbacksPerFrame: stat(sample => sample.callbacksPerFrame),
		drawCallsPerDrawnFrame: stat(sample => sample.drawCallsPerDrawnFrame),
		uploadsPerSecond: stat(sample => sample.uploadsPerSecond),
		rendererCpu: stat(sample => sample.rendererCpu),
		gpuProcessCpu: stat(sample => sample.gpuProcessCpu),
		scriptCpu: stat(sample => sample.scriptCpu),
		styleAndLayoutCpu: stat(sample => sample.styleAndLayoutCpu),
		styleRecalcsPerSecond: stat(sample => sample.styleRecalcsPerSecond),
		gpuUtilization: stat(sample => sample.gpuUtilization),
		otherCpu: stat(sample => sample.otherCpu),
	};
});

const percent = (value: { median: number; min: number; max: number }) =>
	`${(value.median * 100).toFixed(1)}% (${(value.min * 100).toFixed(1)} to ${(value.max * 100).toFixed(1)})`;
console.log(`\nmedian of ${RUNS} runs of ${SECONDS} s (range)`);
for (const row of summary)
	console.log(
		`${row.scenario.padEnd(8)} drawn ${row.drawnPerSecond.median.toFixed(1)}/s, callbacks/frame ${row.callbacksPerFrame.median.toFixed(1)}, ` +
			`draw calls/frame ${row.drawCallsPerDrawnFrame.median.toFixed(0)}, renderer ${percent(row.rendererCpu)}, ` +
			`gpu process ${percent(row.gpuProcessCpu)}, script ${percent(row.scriptCpu)}, style+layout ${percent(row.styleAndLayoutCpu)}, ` +
			`system gpu ${row.gpuUtilization.median.toFixed(0)}% (${row.gpuUtilization.min.toFixed(0)} to ${row.gpuUtilization.max.toFixed(0)}), ` +
			`other work ${row.otherCpu.median.toFixed(1)} cores (up to ${row.otherCpu.max.toFixed(1)})`,
	);
if (errors.length) console.log(`\npage errors:\n${[...new Set(errors)].join('\n')}`);
if (flags.out) {
	mkdirSync(flags.out.replace(/\/[^/]*$/, ''), { recursive: true });
	writeFileSync(flags.out, JSON.stringify({ flags, summary, samples, errors }, null, '\t'));
}
