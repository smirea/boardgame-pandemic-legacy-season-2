#!/usr/bin/env bun
/**
 * Plays one whole October game through the real UI in a headless browser: lobby, full setup, every
 * turn until the game ends, the game-end spending step, and the start of the next game. Every move
 * is a click on the built app. Pass `--shots` to keep screenshots of each stage in e2e/shots.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import type { PublicState } from '@repo/game';

declare const window: { DEBUG: { getState(): PublicState } } & Record<string, unknown>;

const root = join(import.meta.dir, '..');
const buildDir = join(root, 'build');
const shotsDir = join(import.meta.dir, 'shots');
const keepShots = process.argv.includes('--shots');
const seed = Number(process.argv.find(arg => arg.startsWith('--seed='))?.slice(7) ?? 1);

let random = seed * 2654435761;
const chance = () => {
	random = (random + 0x6d2b79f5) | 0;
	let t = random;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pickOne = <T>(items: T[]) => items[Math.floor(chance() * items.length)]!;

function ok(label: string, detail = '') {
	console.log(`ok   ${label}${detail ? ` (${detail})` : ''}`);
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

await Bun.$`bun run build`.cwd(root).quiet();
const server = Bun.serve({
	hostname: '127.0.0.1',
	port: 0,
	async fetch(request) {
		const path = new URL(request.url).pathname;
		const file = Bun.file(join(buildDir, path));
		return new Response(path !== '/' && (await file.exists()) ? file : Bun.file(join(buildDir, 'index.html')));
	},
});
await Bun.$`bun x playwright install chromium-headless-shell`.cwd(root).quiet();
const browser = await chromium.launch({
	args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
	if (message.type() === 'error' && !message.text().includes('WebGL')) errors.push(message.text());
});

const testid = (id: string) => page.locator(`[data-testid=${id}]`);
const state = () => page.evaluate(() => window.DEBUG.getState());
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function shot(name: string) {
	if (!keepShots) return;
	mkdirSync(shotsDir, { recursive: true });
	await page.screenshot({ path: join(shotsDir, `${name}.png`) });
}

async function click(id: string) {
	await testid(id).click();
	await pause(40);
}

/** For the play loop: an element caught fading out is skipped, and the loop looks at the screen again. */
async function tap(target: ReturnType<Page['locator']>) {
	await target.click({ timeout: 1500 }).catch(() => {});
	await pause(40);
}

/** Clicks a city on the 3D board. The marker sits where its label would be without the label's sideways offset. */
async function clickCity(page: Page, id: string) {
	const point = await page.locator(`.label[data-city="${id}"]`).evaluate(node => {
		const box = node.getBoundingClientRect();
		const style = getComputedStyle(node);
		return {
			x: box.x + box.width / 2 - parseFloat(style.getPropertyValue('--dx')),
			y: box.y + box.height / 2 - parseFloat(style.getPropertyValue('--dy')),
		};
	});
	if (process.argv.includes('--debug')) {
		const hit = await page.evaluate(({ x, y }) => {
			const node = document.elementFromPoint(x, y) as HTMLElement | null;
			return node
				? `${node.tagName}.${node.className} pe=${getComputedStyle(node).pointerEvents} parent=${node.parentElement?.tagName}.${node.parentElement?.className}`
				: 'nothing';
		}, point);
		console.log(`     click ${id} at ${Math.round(point.x)},${Math.round(point.y)} hits ${hit}`);
	}
	await page.mouse.click(point.x, point.y);
	await pause(120);
}

try {
	await page.goto(`http://127.0.0.1:${server.port}/debug/game?DEBUG_ID=e2e`);
	await page.locator('.bar button', { hasText: 'Menu' }).click();
	await click('scenario-october');
	await page.locator('.lobby h1', { hasText: 'October' }).waitFor();
	ok('the October scenario loads into the lobby');

	const rationing = Number(await testid('rationing').innerText());
	await page.locator('.rationing button', { hasText: '+' }).click();
	assert(Number(await testid('rationing').innerText()) === rationing + 1, 'rationing did not go up');
	await page.locator('.rationing button', { hasText: '−' }).click();
	const haven = page.locator('input.haven').first();
	await haven.fill('Avalon');
	await haven.blur();
	await page.locator('.label .name', { hasText: /^Avalon$/ }).waitFor();
	ok('lobby controls: rationing moves and a renamed haven shows on the board');

	await page.locator('.lobby label select').nth(2).selectOption({ label: 'Cy' });
	await shot('1-lobby');
	await click('start-game');
	await page.locator('.briefing').waitFor();
	const briefing = await page.locator('.briefing').innerText();
	assert(briefing.includes('October'), 'the October Legacy card was not read');
	await click('ack-briefing');
	let snap = await state();
	assert(snap.phase === 'setup.supply', `expected supply setup, got ${snap.phase}`);
	assert(snap.world.campaign.objectives.join() === 'buildCenters,defect', 'October objectives are wrong');
	ok('setup step 2: the Legacy deck is read', 'objectives: build 3 supply centers, turn the Hollow Men');

	const before = snap.world.game!.stockpile;
	await clickCity(page, 'cairo');
	await clickCity(page, 'cairo');
	snap = await state();
	assert(
		snap.world.game!.locations['cairo' as never]!.supplies === 2 && snap.world.game!.stockpile === before - 2,
		'clicking Cairo did not place cubes',
	);
	await shot('2-supply');
	await click('auto-supply');
	snap = await state();
	assert(snap.world.game!.stockpile === 0, 'cubes are left unplaced');
	ok('setup step 3: supplies placed', `2 by clicking Cairo on the board, ${before - 2} spread`);

	await click('confirm-supply');
	snap = await state();
	const hollow = Object.values(snap.world.game!.locations).reduce((sum, location) => sum + location.hollow, 0);
	assert(snap.phase === 'setup.events' && hollow === 3, `expected 3 Hollow Men after setup infection, got ${hollow}`);
	ok('setup step 4: opening infection', `${snap.world.game!.incidents} incidents, 3 Hollow Men placed`);

	const cards = page.locator('.events .card');
	const total = await cards.count();
	const picks = snap.world.game!.pickedEvents.length;
	if (total > picks) {
		await cards.nth(0).click();
		await cards.nth(total - 1).click();
		await pause(100);
		snap = await state();
		assert(snap.world.game!.pickedEvents.length === picks, 'swapping an event changed the count');
	}
	await click('confirm-events');
	snap = await state();
	assert(snap.phase === 'playing.actions', `the game did not begin: ${snap.phase}`);
	ok(
		'setup steps 6 to 9: events chosen, hands dealt, first player picked',
		`${snap.world.game!.playerDeck.order.length} cards in the Player deck`,
	);
	await shot('3-first-turn');

	const WEIGHT: Record<string, number> = {
		'Build supply center': 30,
		Broadcast: 30,
		Recon: 12,
		'Build tower': 8,
		'Build shelter': 5,
		'Produce supplies': 8,
		Deliver: 7,
		'Make supplies': 6,
		Search: 6,
		'Supply line': 4,
		'Sea lane': 4,
		Monitor: 3,
		'Shuttle flight': 3,
		'Drive / Ferry': 3,
		Transmit: 2,
		'Share knowledge': 2,
		'Move a pawn': 1,
		Sail: 1,
		'Charter boat': 1,
		'Pick up': 1,
		Transfer: 1,
		Inoculate: 1,
	};
	const used = new Set<string>();
	let clicks = 0;
	let idle = 0;
	let lastSignature = '';
	let turnShot = false;

	for (let guard = 0; guard < 8000; guard++) {
		const view = await page.evaluate(() => {
			const snapshot = window.DEBUG.getState();
			const game = snapshot.world.game!;
			const text = (selector: string) =>
				[...document.querySelectorAll(selector)].map(node =>
					(node as HTMLElement).innerText.replace(/\n/g, ' ').trim(),
				);
			return {
				phase: snapshot.phase,
				turn: game.turn,
				actionsLeft: game.actionsLeft,
				signature: `${game.nextSeq}:${game.actionsLeft}:${game.pending.length}:${Object.values(game.players)
					.map(player => `${player.location}${player.supplies}${player.hand.length}`)
					.join()}`,
				briefing: Boolean(document.querySelector('.scrim:not([inert]) .briefing')),
				discards: document.querySelectorAll('[data-testid=hand] .card.discard').length,
				prompt: (document.querySelector('.dock .prompt') as HTMLElement | null)?.innerText ?? '',
				tabs: text('.hands nav button'),
				decisions: text('.middle > .chips:not([data-testid]) button'),
				chips: text('[data-testid=actions] button:not([disabled])'),
				rows: document.querySelectorAll('[data-testid=chooser]:not([inert]) .rows button').length,
				multi: Boolean(document.querySelector('[data-testid=chooser]:not([inert]) [data-testid=chooser-confirm]')),
				playable: document.querySelectorAll('[data-testid=hand] .card.play').length,
			};
		});
		if (view.phase === 'over') break;
		idle = view.signature === lastSignature ? idle + 1 : 0;
		lastSignature = view.signature;
		assert(idle < 60, `no progress in ${view.phase}: ${JSON.stringify(view)}`);
		clicks++;

		if (view.turn === 3 && !turnShot) {
			turnShot = true;
			await shot('4-mid-game');
		}
		if (view.briefing) {
			await tap(testid('ack-briefing'));
		} else if (view.rows > 0) {
			const rows = page.locator('[data-testid=chooser]:not([inert]) .rows button');
			if (view.multi) {
				await tap(rows.nth(0));
				if (view.rows > 1) await tap(rows.nth(1));
				await tap(testid('chooser-confirm'));
				used.add('multi-pick');
			} else {
				await tap(rows.nth(Math.floor(chance() * view.rows)));
			}
		} else if (view.decisions.length > 0) {
			const real = view.decisions.filter(label => label !== 'Skip');
			const label = real.length && chance() < 0.7 ? pickOne(real) : pickOne(view.decisions);
			await tap(page.locator('.middle > .chips:not([data-testid]) button', { hasText: label }).first());
			used.add(`decision: ${view.prompt.slice(0, 40)}`);
		} else if (
			view.prompt.includes('must discard') ||
			view.prompt.startsWith('Discard') ||
			view.prompt.includes(': Discard')
		) {
			if (view.discards === 0) {
				const owner = view.tabs.find(tab => view.prompt.includes(tab.split(' ')[0]!));
				if (owner) await tap(page.locator('.hands nav button', { hasText: owner.split(' ')[0]! }).first());
				else await tap(page.locator('.hands nav button').nth(idle % Math.max(1, view.tabs.length)));
			} else {
				await tap(page.locator('[data-testid=hand] .card.discard').first());
			}
		} else if (view.phase === 'playing.draw') {
			await tap(testid('draw'));
		} else if (view.phase === 'playing.infect') {
			await tap(testid('infect'));
		} else if (view.playable > 0 && chance() < 0.12) {
			await tap(page.locator('[data-testid=hand] .card.play').first());
			used.add('event or companion');
		} else if (view.actionsLeft === 0 || view.chips.length === 0 || idle > 5) {
			await tap(testid('end-actions'));
		} else {
			const scored = view.chips.map(label => ({
				label,
				weight: Object.entries(WEIGHT).find(([name]) => label.startsWith(name))?.[1] ?? 1,
			}));
			let roll = chance() * scored.reduce((sum, chip) => sum + chip.weight, 0);
			const chosen = scored.find(chip => (roll -= chip.weight) <= 0) ?? scored[0]!;
			used.add(Object.keys(WEIGHT).find(name => chosen.label.startsWith(name)) ?? chosen.label);
			await tap(page.locator('[data-testid=actions] button:not([disabled])', { hasText: chosen.label }).first());
		}
	}

	snap = await state();
	assert(snap.phase === 'over', 'the game never ended');
	const game = snap.world.game!;
	await shot('5-game-over');
	ok(
		'the game is played to its end',
		`${game.turn} turns, ${clicks} clicks, ${game.outcome!.won ? 'won' : `lost: ${game.outcome!.reason}`}`,
	);
	ok(
		'actions taken through the UI',
		[...used]
			.filter(name => !name.startsWith('decision'))
			.sort()
			.join(', '),
	);
	const decisions = [...used].filter(name => name.startsWith('decision'));
	if (decisions.length) ok('choices answered through the UI', decisions.map(name => name.slice(10)).join(' | '));

	await click('continue');
	snap = await state();
	assert(snap.phase === 'upkeep', 'the game-end screen did not open');
	if (snap.world.campaign.briefing.length) {
		ok('game end: the Legacy deck is read on', snap.world.campaign.briefing.map(line => line.split(':')[0]).join(', '));
		await click('ack-briefing');
	}
	await page.locator('.upkeep').waitFor();
	await page.locator('.briefing').waitFor({ state: 'detached' });
	const units = snap.world.game!.upkeep!.units;
	const campaignBefore = snap.world.campaign;
	await shot('6-upkeep');
	const bought: string[] = [];
	// One of each kind of upgrade while the units last: structures and population first, then cards, then abilities.
	const KINDS = [/^Permanent/, /^Population/, /^Infection card/, /^City card/, /^Restore/, /./];
	const groupNames = await page.locator('.upkeep .groups button strong').allInnerTexts();
	const wanted = KINDS.flatMap(
		kind =>
			groupNames.find(
				name => kind.test(name) && !KINDS.slice(0, KINDS.indexOf(kind)).some(earlier => earlier.test(name)),
			) ?? [],
	);
	for (const name of new Set(wanted)) {
		const group = page.locator('.upkeep .groups button', {
			has: page.locator('strong', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }),
		});
		if ((await group.count()) === 0) continue;
		await group.first().click();
		const target = page.locator('.upkeep .targets button').first();
		if ((await target.count()) === 0) continue;
		bought.push(`${name}: ${await target.innerText()}`);
		await target.click();
		await pause(80);
	}
	snap = await state();
	const spent = units - snap.world.game!.upkeep!.units;
	assert(bought.length >= 2 && spent > 0, `expected at least two purchases, made ${bought.length}`);
	ok('game end: upgrades bought with production units', `${spent} of ${units} units: ${bought.join('; ')}`);
	const changes = snap.world.game!.upkeep!.populationChanges.length;
	ok('game end: population adjusted', `${changes} locations changed`);

	const afterPurchases = snap.world.campaign;
	await click('finish-upkeep');
	snap = await state();
	assert(snap.phase === 'lobby' && snap.world.game === null, 'the campaign did not return to the lobby');
	const { campaign } = snap.world;
	assert(campaign.results.length === campaignBefore.results.length + 1, 'the result was not recorded');
	assert(
		JSON.stringify(campaign.characters) === JSON.stringify(afterPurchases.characters),
		'character upgrades were lost',
	);
	assert(JSON.stringify(campaign.locations) === JSON.stringify(afterPurchases.locations), 'location changes were lost');
	const last = campaign.results.at(-1)!;
	ok(
		'the calendar moves on',
		`October ${last.won ? 'won' : 'lost'}, next is month ${campaign.month} attempt ${campaign.attempt}, rationing ${campaign.rationing}`,
	);

	await page.locator('.lobby label select').nth(2).selectOption({ label: 'Cy' });
	await click('start-game');
	if (await page.locator('.briefing').count()) await click('ack-briefing');
	snap = await state();
	assert(snap.phase === 'setup.supply', 'the next game did not reach setup');
	const permanent = Object.values(snap.world.campaign.locations).reduce(
		(sum, location) => sum + location.permanent.length,
		0,
	);
	const standing = Object.values(snap.world.game!.locations).filter(
		location => location.center || location.tower || location.shelter,
	).length;
	assert(standing >= permanent && permanent > 0, 'permanent structures are missing from the next setup');
	ok('the next game sets up with what the campaign kept', `${permanent} permanent structures standing`);

	assert(errors.length === 0, `page errors: ${errors.slice(0, 5).join(' | ')}`);
	console.log('PASS a full October game through the UI');
} catch (error) {
	if (keepShots) await page.screenshot({ path: join(shotsDir, 'failure.png') }).catch(() => {});
	console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
	if (errors.length) console.error(`page errors: ${errors.slice(0, 5).join(' | ')}`);
	process.exitCode = 1;
} finally {
	await browser.close();
	await server.stop(true);
}
