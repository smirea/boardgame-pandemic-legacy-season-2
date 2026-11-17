#!/usr/bin/env bun
/**
 * Plays the start of a solo turn with the mouse, the way a player does, at each laptop width: the action list with
 * its reasons, Drive / Ferry by clicking a lit city, the actions round the pawn's own city beside its hover slip, a
 * card's Charter boat tag, and the draw and infect steps. Needs `bun run dev` running. `--shots` keeps screenshots
 * in e2e/shots, and `--chrome` draws the board on the real GPU.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { actionMenu, botCommand, legalActions, pack } from '@repo/game';
import type { CardId, CityId, Command, PublicState, World } from '@repo/game';
import env from '../../../packages/shared/src/env.ts';

declare const window: {
	DEBUG: { getState(): PublicState; send(command: Command): string | null; setState(state: unknown): void };
};

const url = `http://127.0.0.1:${env.UI_PORT}`;
const shotsDir = join(import.meta.dir, 'shots');
const keepShots = process.argv.includes('--shots');
if (
	!(await fetch(url).then(
		response => response.ok,
		() => false,
	))
)
	throw new Error(`No dev server at ${url}. Start it with \`bun run dev\`.`);

const ok = (label: string, detail = '') => console.log(`ok   ${label}${detail ? ` (${detail})` : ''}`);
function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const centre = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const chrome = process.argv.includes('--chrome');
const browser = await chromium.launch({
	channel: chrome ? 'chrome' : undefined,
	args: chrome
		? ['--ignore-gpu-blocklist']
		: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function play(width: number, height: number) {
	const page = await browser.newPage({ viewport: { width, height } });
	page.setDefaultTimeout(90_000);
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	const shot = async (name: string) => {
		if (!keepShots) return;
		mkdirSync(shotsDir, { recursive: true });
		await page.screenshot({ path: join(shotsDir, `actions-${width}-${name}.png`) });
	};
	const state = () => page.evaluate(() => window.DEBUG.getState());
	const here = (snap: PublicState) => snap.world.game!.players[snap.world.game!.active]!.location;

	await page.goto(`${url}/?DEBUG_ID=actions-e2e-${width}-${Date.now()}`);
	await page.locator('[data-testid=solo]').click({ noWaitAfter: true });
	await page.waitForFunction(() => window.DEBUG?.getState()?.phase === 'lobby');
	const rng = { seed: 11 };
	for (let tries = 0; tries < 200; tries++) {
		const snap = await state();
		if (snap.phase === 'playing.actions') break;
		await page.evaluate(next => window.DEBUG.send(next), botCommand(snap.world, snap.phase, rng, 3));
	}
	await arrange(page, world => ({ world }));
	const fits = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1);
	assert(fits, `the page scrolls at ${width}×${height}`);

	let snap = await state();
	const rows = page.locator('[data-testid=actions] button[data-action]');
	await rows.first().waitFor();
	const open = await rows.evaluateAll(nodes =>
		nodes.filter(node => !(node as HTMLButtonElement).disabled).map(node => (node as HTMLElement).dataset['action']),
	);
	const menu = actionMenu(snap.world, snap.world.game!.active);
	assert(
		open.toSorted().join() ===
			menu
				.filter(choice => choice.actions.length)
				.map(choice => choice.a)
				.toSorted()
				.join(),
		`the list offers ${open.join()} where the rules allow ${menu.filter(choice => choice.actions.length).map(choice => choice.a)}`,
	);
	for (const choice of menu.filter(entry => !entry.actions.length)) {
		const text = await page.locator(`[data-testid=actions] button[data-action=${choice.a}]`).innerText();
		assert(text.includes(choice.reason!), `${choice.a} does not say why it is closed: ${text}`);
	}
	ok(
		`${width}: the list offers what the rules allow, and says why the rest is closed`,
		`${open.length} of ${menu.length} open`,
	);
	await shot('1-list');

	// Drive / Ferry lights exactly the cities it reaches, and a click on one moves the pawn there.
	const from = here(snap);
	const drives = legalActions(snap.world, snap.world.game!.active).flatMap(action =>
		action.a === 'drive' ? [action.to] : [],
	);
	assert(drives.length > 1, 'the pawn has fewer than two places to drive to');
	await page.mouse.click(...xy(await rows.and(page.locator('[data-action=drive]')).boundingBox()));
	await page.getByTestId('aiming').waitFor();
	const lit = await page
		.locator('.anchor[data-highlight=target]')
		.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset['city']));
	assert(lit.toSorted().join() === drives.toSorted().join(), `the map lights ${lit} for a drive to ${drives}`);
	await shot('2-drive-targets');
	const to = drives[0]!;
	await clickCity(page, to);
	await page.waitForFunction(city => {
		const game = window.DEBUG.getState().world.game!;
		return game.players[game.active]!.location === city;
	}, to);
	assert((await page.getByTestId('aiming').count()) === 0, 'the map is still waiting for a target');
	ok(`${width}: Drive / Ferry lights the cities it reaches and a click moves the pawn`, `${from} to ${to}`);

	// Clicking the pawn's own city shows its actions round it, clear of the hover slip.
	snap = await state();
	await clickCity(page, here(snap));
	const ring = page.getByTestId('city-ring');
	await ring.locator('button').first().waitFor();
	// The pills fan out from the city's centre, so they are measured once they have landed.
	await ring.evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)));
	const entries = await ring
		.locator('button')
		.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset['action']));
	const legal = actionMenu(snap.world, snap.world.game!.active)
		.filter(choice => choice.actions.length)
		.map(choice => choice.a);
	assert(
		entries.toSorted().join() === legal.toSorted().join(),
		`the ring shows ${entries} where the rules allow ${legal}`,
	);
	await shot('3-ring');
	const slip = await page.getByTestId('board-hint').boundingBox();
	assert(slip, 'no hover slip beside the open ring');
	for (const button of await ring.locator('button').all())
		assert(!overlaps((await button.boundingBox())!, slip), 'an action in the ring lies under the hover slip');
	await page.keyboard.press('Escape');
	await ring.waitFor({ state: 'detached' });
	// A click on one of the ring's actions starts it: Drive / Ferry lights where it goes.
	await clickCity(page, here(snap));
	const drive = ring.locator('button[data-action=drive]');
	await drive.waitFor();
	await page.waitForTimeout(400);
	await page.mouse.click(...xy(await drive.boundingBox()));
	await page.getByTestId('aiming').waitFor();
	const [hx, hy] = xy(await page.locator(`.anchor[data-city="${here(snap)}"]`).boundingBox());
	await page.mouse.move(hx, hy, { steps: 2 });
	await page.mouse.click(hx, hy, { button: 'right' });
	await page.getByTestId('aiming').waitFor({ state: 'detached' });
	ok(
		`${width}: the pawn's own city shows its actions round it, beside the hover slip, and a click on one starts it`,
		entries.join(', '),
	);

	// A port's card in hand offers Charter boat as a tag; the tag lights the ports and a click sails there.
	const { port, card: held } = await arrange(page, charterTable);
	snap = await state();
	const ports = legalActions(snap.world, snap.world.game!.active).flatMap(action =>
		action.a === 'charter' ? [action.to] : [],
	);
	const card = page.locator(`[data-testid=hand] .slot[data-card="${held}"]`);
	const showing = await card.evaluate(node => {
		const box = node.getBoundingClientRect();
		for (const fx of [0.5, 0.3, 0.15, 0.7, 0.85])
			for (const fy of [0.5, 0.3, 0.7]) {
				const x = box.x + box.width * fx;
				const y = box.y + box.height * fy;
				if (node.contains(document.elementFromPoint(x, y))) return [x, y] as [number, number];
			}
		return null;
	});
	assert(showing, `no part of ${cityName(port)}'s card shows in the hand`);
	await page.mouse.move(...showing, { steps: 4 });
	// The card rises out of the fan before its tags stand over it.
	await page.waitForTimeout(600);
	const tag = card.locator('[data-testid=card-uses] button[data-use=charter]');
	await tag.waitFor({ timeout: 15_000 }).catch(async error => {
		await page.screenshot({ path: join(shotsDir, `actions-${width}-tag-failed.png`) });
		console.log(
			JSON.stringify(
				await page.evaluate(
					([x, y, id]) => {
						const hit = document.elementFromPoint(x!, y!);
						const slot = document.querySelector(`[data-card="${id}"]`);
						return {
							hit: `${hit?.tagName}.${hit?.className}`,
							hitSlot: hit?.closest('.slot')?.getAttribute('data-card'),
							hovered: slot?.matches(':hover'),
							tags: slot?.querySelector('[data-testid=card-uses]')?.textContent,
							phase: (window as any).DEBUG.getState().phase,
						};
					},
					[...showing, held] as [number, number, string],
				),
			),
		);
		throw error;
	});
	await page.waitForTimeout(300);
	await shot('4-card-tag');
	await page.mouse.move(...xy(await tag.boundingBox()), { steps: 3 });
	await page.mouse.click(...xy(await tag.boundingBox()));
	const sails = await page
		.locator('.anchor[data-highlight=target]')
		.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset['city']));
	if (ports.length > 1) {
		await page.getByTestId('aiming').waitFor();
		assert(sails.toSorted().join() === ports.toSorted().join(), `charter lights ${sails} for ports ${ports}`);
		await clickCity(page, ports[0]!);
	}
	await page.waitForFunction(city => {
		const game = window.DEBUG.getState().world.game!;
		return game.players[game.active]!.location === city;
	}, ports[0]!);
	ok(`${width}: a port's card shows a Charter boat tag that sails`, `${cityName(port)} to ${cityName(ports[0]!)}`);

	// The draw and infect steps show what was drawn and flipped in full.
	await page.getByTestId('end-actions').click();
	await page.getByTestId('draw').click();
	await page
		.getByTestId('draw')
		.click()
		.catch(() => undefined);
	await page.waitForFunction(
		() => window.DEBUG.getState().phase === 'playing.infect' || window.DEBUG.getState().world.game!.pending.length > 0,
	);
	snap = await state();
	if (snap.phase === 'playing.infect') {
		await page.getByTestId('drawn').waitFor();
		const drawn = await page.locator('[data-testid=drawn] .drawn').count();
		assert(drawn === 2, `${drawn} drawn cards shown in the infect step`);
		await page.getByTestId('infect').click();
		await page.locator('[data-testid=flipped] .flipcard').first().waitFor();
		const heading = await page.locator('.dock .say strong').innerText();
		assert(heading === 'Infect cities', `the infect step reads ${heading}`);
		await shot('5-infect');
		await page
			.waitForFunction(
				() => {
					const box = document.querySelector('[data-testid=flipped] .flipcard')?.getBoundingClientRect();
					return box && box.width > 30;
				},
				undefined,
				{ timeout: 10_000 },
			)
			.catch(() => undefined);
		const flippedBox = await page.locator('[data-testid=flipped] .flipcard').first().boundingBox();
		await page
			.locator('.dock')
			.evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)));
		assert(
			flippedBox && flippedBox.width > 30 && flippedBox.y + flippedBox.height <= height,
			`the flipped card is not in view: ${JSON.stringify(flippedBox)}`,
		);
		const title = await page.locator('.dock .say strong').boundingBox();
		assert(title && title.y >= height - 170, 'the infect headline rides up over the chart');
		ok(`${width}: the infect step shows the drawn and flipped cards`);
	} else ok(`${width}: the draw ended in a choice, so the infect step is left for another seed`, snap.phase);
	assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
	await page.close();
}

const cityName = (id: CityId) => pack.cities.find(city => city.id === id)!.name;
const xy = (box: Box | null): [number, number] => {
	assert(box, 'nothing on screen to point at');
	const point = centre(box);
	return [point.x, point.y];
};

/** Clicks a city where a player would, on its disc, after resting the pointer there long enough for the slip. */
async function clickCity(page: Page, city: CityId) {
	await settle(page);
	const anchor = page.locator(`.anchor[data-city="${city}"]`);
	const [x, y] = xy(await anchor.boundingBox());
	const under = await page.evaluate(
		([px, py]) => {
			const hit = document.elementFromPoint(px!, py!);
			return hit?.closest('canvas') ? null : `${hit?.tagName}.${hit?.className}`;
		},
		[x, y],
	);
	assert(under === null, `${city} lies under ${under}`);
	await page.mouse.move(x - 3, y, { steps: 3 });
	await page.mouse.move(x, y, { steps: 2 });
	await page.mouse.click(x, y);
}

/** Waits for the camera to stop gliding, read from where the cities stand on screen. */
async function settle(page: Page) {
	const read = () =>
		page.locator('.anchor[data-city]').evaluateAll(nodes =>
			nodes
				.map(node => {
					const box = node.getBoundingClientRect();
					return `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)}`;
				})
				.join(' '),
		);
	let last = await read();
	for (let tries = 0; tries < 120; tries++) {
		await page.waitForTimeout(250);
		const now = await read();
		if (now === last) return;
		last = now;
	}
	throw new Error('the camera never settled');
}

/** Puts the active pawn on a port with sea routes, holding that port's card, so it can charter a boat. */
function charterTable(world: World): { world: World; port: CityId; card: CardId } | null {
	const game = world.game!;
	const me = game.players[game.active]!;
	for (const card of Object.values(world.campaign.playerCards)) {
		if (card.kind !== 'city' || !world.campaign.locations[card.city]?.revealed) continue;
		const trial = structuredClone(world);
		const player = trial.game!.players[trial.game!.active]!;
		for (const other of Object.values(trial.game!.players)) other.hand = other.hand.filter(id => id !== card.id);
		trial.game!.playerDeck.order = trial.game!.playerDeck.order.filter(id => id !== card.id);
		trial.game!.playerDiscard = trial.game!.playerDiscard.filter(id => id !== card.id);
		player.hand = [...me.hand.filter(id => id !== card.id).slice(0, 3), card.id];
		player.location = card.city;
		const charters = legalActions(trial, trial.game!.active).filter(action => action.a === 'charter');
		if (charters.length > 1) return { world: trial, port: card.city, card: card.id };
	}
	return null;
}

/** Rearranges the table through a save, which reloads the page, and waits for the action step to be on screen. */
async function arrange<T extends { world: World }>(page: Page, edit: (world: World) => T | null): Promise<T> {
	const snap = await page.evaluate(() => window.DEBUG.getState());
	const result = edit(snap.world);
	assert(result, 'no table could be arranged');
	if (result.world !== snap.world) {
		await page.evaluate(save => window.DEBUG.setState(save), { v: 1, phase: snap.phase, world: result.world });
		await page.waitForFunction(() => window.DEBUG?.getState()?.phase === 'playing.actions');
	}
	const briefing = page.getByTestId('ack-briefing');
	if (await briefing.count()) await briefing.click();
	await page.locator('[data-testid=actions]').waitFor();
	await settle(page);
	return result;
}

try {
	await play(1440, 900);
	await play(1280, 800);
} finally {
	await browser.close();
}
