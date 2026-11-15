#!/usr/bin/env bun
/**
 * End to end over real WebRTC: the signaling Worker under `wrangler dev`, the demo page, and Chromium pages for one
 * host and two peers, each in its own browser context like separate laptops.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { serveDemo } from '../demo/serve.ts';
import type { DemoMsg, DemoState } from '../demo/main.ts';

type Demo = {
	state: DemoState;
	send(msg: DemoMsg, to?: string): void;
	sendSeq(count: number, to?: string): void;
	sendBlob(size: number, seed: number, to?: string): void;
	hasBlob(size: number, seed: number, from: string): boolean;
	seqFrom(from: string): number[];
};
declare const demo: Demo;

const SECRET = 'e2e-secret';
const SEQ = 200;
const BLOB = 500 * 1024;
const TIMEOUT_MS = 30_000;
const signalDir = join(import.meta.dir, '../../../apps/signal');

const freePort = () => {
	const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() });
	const { port } = probe;
	probe.stop(true);
	return port;
};

await Bun.$`bun x playwright install chromium-headless-shell`.cwd(import.meta.dir).quiet();

const signalPort = freePort();
const persistDir = mkdtempSync(join(tmpdir(), 'net-e2e-'));
const wranglerLog: string[] = [];
const startSignal = () => {
	const proc = Bun.spawn(
		[
			'bun',
			'x',
			'wrangler',
			'dev',
			'--ip',
			'127.0.0.1',
			'--port',
			String(signalPort),
			'--var',
			`SIGNAL_SECRET:${SECRET}`,
			'--persist-to',
			persistDir,
			'--show-interactive-dev-session=false',
			'--log-level',
			'warn',
		],
		{ cwd: signalDir, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } },
	);
	for (const stream of [proc.stdout, proc.stderr])
		void (async () => {
			for await (const chunk of stream) wranglerLog.push(new TextDecoder().decode(chunk));
		})();
	return proc;
};
const waitForSignal = async () => {
	const deadline = performance.now() + 60_000;
	for (;;) {
		const response = await fetch(`http://127.0.0.1:${signalPort}/`).catch(() => null);
		if (response?.status === 426) return;
		if (wrangler.exitCode !== null || performance.now() > deadline)
			throw new Error(`wrangler dev did not start:\n${wranglerLog.join('')}`);
		await Bun.sleep(200);
	}
};
let wrangler = startSignal();

const demoServer = serveDemo();
let browser: Browser | undefined;
const pageLogs: string[] = [];
const started = performance.now();

async function step(label: string, run: () => Promise<void>) {
	const t = performance.now();
	await run();
	console.log(`ok   ${label} (${Math.round(performance.now() - t)} ms)`);
}

async function until(page: Page, predicate: (arg: never) => boolean, arg: unknown, label: string) {
	try {
		await page.waitForFunction(predicate as never, arg as never, { timeout: TIMEOUT_MS, polling: 50 });
	} catch (error) {
		const state = await page.evaluate(() => demo.state).catch(() => 'page unavailable');
		throw new Error(`${label}\nstate: ${JSON.stringify(state, (k, v) => (k === 'received' ? v.length : v))}`, {
			cause: error,
		});
	}
}

const connectedCount = (page: Page, count: number, label: string) =>
	until(
		page,
		((n: number) =>
			demo.state.status === 'connected' && demo.state.peers.filter(p => p.connected).length === n) as never,
		count,
		label,
	);

try {
	await step(`signaling Worker up on :${signalPort}`, waitForSignal);

	browser = await chromium.launch();
	const urlFor = (role: string, id: string) =>
		`${demoServer.url}?role=${role}&id=${id}&name=${id}&signal=ws://127.0.0.1:${signalPort}&secret=${SECRET}`;
	const open = async (role: string, id: string) => {
		const context = await browser!.newContext({ viewport: { width: 900, height: 600 } });
		const page = await context.newPage();
		page.on('console', msg => pageLogs.push(`[${id}] ${msg.type()}: ${msg.text()}`));
		page.on('pageerror', error => pageLogs.push(`[${id}] pageerror: ${error.message}`));
		await page.goto(urlFor(role, id));
		return page;
	};

	let host = await open('host', 'host');
	const alice = await open('peer', 'alice');
	const bob = await open('peer', 'bob');

	await step('host and two peers connect and share a three-player roster', async () => {
		for (const [page, name] of [
			[host, 'host'],
			[alice, 'alice'],
			[bob, 'bob'],
		] as const)
			await connectedCount(page, 3, `${name} sees three connected players`);
		const rosters = await Promise.all([host, alice, bob].map(p => p.evaluate(() => JSON.stringify(demo.state.peers))));
		if (new Set(rosters).size !== 1) throw new Error(`Rosters differ: ${rosters.join(' | ')}`);
	});

	await step(`${SEQ} reliable messages arrive in order host -> peers and peers -> host`, async () => {
		await host.evaluate(n => demo.sendSeq(n), SEQ);
		await alice.evaluate(n => demo.sendSeq(n), SEQ);
		await bob.evaluate(n => demo.sendSeq(n), SEQ);
		const inOrder = ((args: { from: string; n: number }) => {
			const seq = demo.seqFrom(args.from);
			return seq.length === args.n && seq.every((value, index) => value === index);
		}) as never;
		await until(alice, inOrder, { from: 'host', n: SEQ }, 'alice got the host sequence in order');
		await until(bob, inOrder, { from: 'host', n: SEQ }, 'bob got the host sequence in order');
		await until(host, inOrder, { from: 'alice', n: SEQ }, 'host got the alice sequence in order');
		await until(host, inOrder, { from: 'bob', n: SEQ }, 'host got the bob sequence in order');
	});

	await step('a 500 KB message survives host -> peer and peer -> host', async () => {
		await host.evaluate(([size, to]) => demo.sendBlob(size as number, 1, to as string), [BLOB, 'alice']);
		await bob.evaluate(size => demo.sendBlob(size, 2), BLOB);
		await until(
			alice,
			(([size, from]: [number, string]) => demo.hasBlob(size, 1, from)) as never,
			[BLOB, 'host'],
			'alice got the blob',
		);
		await until(
			host,
			(([size, from]: [number, string]) => demo.hasBlob(size, 2, from)) as never,
			[BLOB, 'bob'],
			'host got the blob',
		);
		const bobGotTargeted = await bob.evaluate(size => demo.hasBlob(size, 1, 'host'), BLOB);
		if (bobGotTargeted) throw new Error('A message targeted at alice reached bob');
	});

	await step("alice's cursor shows on bob's screen through the host", async () => {
		await alice.mouse.move(10, 10);
		const before = await bob.evaluate(() => demo.state.cursorUpdates);
		const moveStart = performance.now();
		for (let i = 1; i <= 60; i++) {
			await alice.mouse.move(10 + i * 7, 10 + i * 4);
			await Bun.sleep(16);
		}
		const moveMs = performance.now() - moveStart;
		const at = (([from, x, y]: [string, number, number]) => {
			const cursor = demo.state.cursors[from];
			return cursor?.x === x && cursor?.y === y;
		}) as never;
		await until(bob, at, ['alice', 430, 250], "bob sees alice's cursor at its final position");
		await until(host, at, ['alice', 430, 250], "host sees alice's cursor");
		const updates = (await bob.evaluate(() => demo.state.cursorUpdates)) - before;
		const perSecond = updates / (moveMs / 1000);
		console.log(
			`     bob got ${updates} cursor updates over ${Math.round(moveMs)} ms of movement (${perSecond.toFixed(1)}/s, cap 30/s)`,
		);
		if (perSecond < 15 || perSecond > 33) throw new Error(`Cursor rate ${perSecond.toFixed(1)}/s is outside 15-33/s`);
		const drawn = await bob.locator('.cursor', { hasText: 'alice' }).boundingBox();
		if (drawn?.x !== 430 - 4 || drawn.y !== 250 - 4)
			throw new Error(`alice's cursor is drawn at ${JSON.stringify(drawn)}`);
	});

	await step('a reloaded peer reconnects under the same id', async () => {
		await alice.reload();
		await connectedCount(alice, 3, 'alice is back with three players');
		await until(
			host,
			(() =>
				demo.state.rosters.some(r => r.find(p => p.id === 'alice')?.connected === false) &&
				demo.state.peers.find(p => p.id === 'alice')?.connected === true) as never,
			undefined,
			'host saw alice leave and return',
		);
		await alice.evaluate(() => demo.send({ kind: 'seq', n: 1000 }));
		await until(host, (() => demo.seqFrom('alice').includes(1000)) as never, undefined, 'host hears reloaded alice');
	});

	await step('peers recover when the host reloads', async () => {
		await host.reload();
		await until(
			alice,
			(() => demo.state.statuses.includes('reconnecting')) as never,
			undefined,
			'alice went to reconnecting',
		);
		await until(
			bob,
			(() => demo.state.statuses.includes('reconnecting')) as never,
			undefined,
			'bob went to reconnecting',
		);
		await connectedCount(host, 3, 'reloaded host sees both peers');
		await connectedCount(alice, 3, 'alice reconnected');
		await connectedCount(bob, 3, 'bob reconnected');
		await host.evaluate(() => demo.send({ kind: 'seq', n: 2000 }));
		for (const [page, name] of [
			[alice, 'alice'],
			[bob, 'bob'],
		] as const)
			await until(
				page,
				(() => demo.seqFrom('host').includes(2000)) as never,
				undefined,
				`${name} hears the reloaded host`,
			);
	});

	await step('peers recover when the host browser is killed and the host comes back', async () => {
		const server = await chromium.launchServer();
		const doomed = await chromium.connect(server.wsEndpoint());
		const doomedHost = await (await doomed.newContext()).newPage();
		await host.close();
		await doomedHost.goto(urlFor('host', 'host'));
		await connectedCount(doomedHost, 3, 'host in its own browser sees both peers');
		const killedAt = performance.now();
		await server.kill();
		await until(alice, (() => demo.state.status === 'reconnecting') as never, undefined, 'alice noticed the dead host');
		console.log(`     alice noticed the killed host after ${Math.round(performance.now() - killedAt)} ms`);
		host = await open('host', 'host');
		await connectedCount(host, 3, 'new host tab sees both peers');
		await connectedCount(alice, 3, 'alice reconnected');
		await connectedCount(bob, 3, 'bob reconnected');
	});

	await step('a signaling Worker restart leaves game links up and the host re-registers', async () => {
		wrangler.kill();
		await wrangler.exited;
		await until(host, (() => demo.state.status === 'reconnecting') as never, undefined, 'host lost signaling');
		await bob.evaluate(() => demo.send({ kind: 'seq', n: 3000 }));
		await until(
			host,
			(() => demo.seqFrom('bob').includes(3000)) as never,
			undefined,
			'game traffic flows without signaling',
		);
		wrangler = startSignal();
		await waitForSignal();
		await until(host, (() => demo.state.status === 'connected') as never, undefined, 'host re-registered');
		await bob.reload();
		await connectedCount(bob, 3, 'bob rejoins through the restarted Worker');
	});

	await step('a second host is refused with host-taken', async () => {
		const intruder = await open('host', 'intruder');
		await until(
			intruder,
			(() => demo.state.status === 'closed' && demo.state.errors.includes('host-taken')) as never,
			undefined,
			'intruder refused',
		);
	});

	await step('a wrong secret is refused with unauthorized', async () => {
		const context = await browser!.newContext();
		const page = await context.newPage();
		await page.goto(urlFor('peer', 'mallory').replace(SECRET, 'wrong'));
		await until(
			page,
			(() => demo.state.status === 'closed' && demo.state.errors.includes('unauthorized')) as never,
			undefined,
			'mallory refused',
		);
	});

	const pageErrors = pageLogs.filter(line => line.includes('pageerror'));
	if (pageErrors.length > 0) throw new Error(`Page errors:\n${pageErrors.join('\n')}`);
	console.log(`PASS end to end in ${((performance.now() - started) / 1000).toFixed(1)} s`);
} catch (error) {
	console.error(`FAIL ${error instanceof Error ? error.message : error}`);
	console.error(pageLogs.slice(-40).join('\n'));
	process.exitCode = 1;
} finally {
	await browser?.close();
	await demoServer.stop(true);
	wrangler.kill();
	await wrangler.exited;
	await Bun.$`trash ${persistDir}`.quiet().nothrow();
}
