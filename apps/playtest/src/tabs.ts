import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { Command, PublicState, Save } from '@repo/game';

type Connection = { mode: string; status: string; peers: number; notice: string | null; fatal: string | null };

declare const window: {
	DEBUG?: {
		getState(): PublicState | null;
		setState(state: unknown): void;
		send(command: Command): string | null;
		connection(): Connection;
	};
	__lab?: HTMLElement[];
};
declare const document: Document;

export type Tab = { id: string; page: Page; errors: string[] };

export async function launch(headed: boolean): Promise<{ browser: Browser; context: BrowserContext }> {
	const browser = await chromium.launch({
		headless: !headed,
		args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
	});
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	return { browser, context };
}

/** Opens one player's tab and brings it into the game the way a person would: name, passphrase, Host or Join. */
export async function openTab(
	context: BrowserContext,
	options: {
		id: string;
		url: string;
		name: string;
		passphrase: string;
		host: boolean;
		onError: (text: string) => void;
	},
): Promise<Tab> {
	const page = await context.newPage();
	const tab: Tab = { id: options.id, page, errors: [] };
	const note = (text: string) => {
		tab.errors.push(text);
		options.onError(text);
	};
	page.on('pageerror', error => note(`pageerror: ${error.message}`));
	page.on('console', message => {
		if (message.type() === 'error' && !message.text().includes('WebGL')) note(`console: ${message.text()}`);
	});
	await page.goto(options.url);
	const resumed = await page.evaluate(() => Boolean(window.DEBUG));
	if (!resumed) {
		await page.locator('[data-testid=name]').fill(options.name);
		await page.locator('[data-testid=passphrase]').fill(options.passphrase);
		await page.locator(`[data-testid=${options.host ? 'host' : 'join'}]`).click();
	}
	await page.waitForFunction(() => Boolean(window.DEBUG), null, { timeout: 30_000 });
	return tab;
}

export const readState = (tab: Tab) => tab.page.evaluate(() => JSON.stringify(window.DEBUG?.getState() ?? null));

export const connection = (tab: Tab) => tab.page.evaluate(() => window.DEBUG?.connection() ?? null);

export const sendCommand = (tab: Tab, command: Command) =>
	tab.page.evaluate(sent => (window.DEBUG ? window.DEBUG.send(sent) : 'This tab has no game session'), command);

/** Replaces the host's campaign. The page reloads and resumes hosting from the save. */
export async function loadSave(tab: Tab, save: Save) {
	await Promise.all([
		tab.page.waitForEvent('load'),
		tab.page.evaluate(next => window.DEBUG!.setState(next), save as unknown as Record<string, unknown>),
	]);
	await tab.page.waitForFunction(() => Boolean(window.DEBUG?.getState()), null, { timeout: 30_000 });
}

type Seen = { index: number; tag: string; text: string; disabled: boolean };

/** What a person could press right now, numbered, plus the text on screen. */
export async function look(tab: Tab): Promise<string> {
	const seen = await tab.page.evaluate(() => {
		const visible = (node: Element) => {
			const box = node.getBoundingClientRect();
			return (
				box.width > 2 && box.height > 2 && !node.closest('[inert]') && getComputedStyle(node).visibility !== 'hidden'
			);
		};
		const nodes = [
			...document.querySelectorAll<HTMLElement>('button, input, select, textarea, [role="button"]'),
		].filter(visible);
		window.__lab = nodes;
		const controls = nodes.map((node, index) => {
			const field = node as HTMLInputElement;
			const text = (
				node.innerText ||
				node.getAttribute('aria-label') ||
				node.title ||
				field.placeholder ||
				field.value ||
				''
			)
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 100);
			return { index, tag: node.tagName.toLowerCase(), text, disabled: Boolean(field.disabled) };
		});
		const cities = [...document.querySelectorAll<HTMLElement>('.label[data-city]')].map(node => node.dataset['city']!);
		// The map labels would bury the panels' text, so they are hidden for the read. Cities are listed on their own.
		const labels = [...document.querySelectorAll<HTMLElement>('.label[data-city]')];
		for (const label of labels) label.style.display = 'none';
		const text = document.body.innerText
			.replace(/[ \t]+/g, ' ')
			.replace(/\s*\n\s*/g, ' | ')
			.trim();
		for (const label of labels) label.style.display = '';
		return { controls, cities, text };
	});
	const controls = (seen.controls as Seen[]).map(
		control =>
			`  [${control.index}] ${control.tag}${control.disabled ? ' (disabled)' : ''}: ${control.text || '(no text)'}`,
	);
	return [
		'ON SCREEN:',
		seen.text.slice(0, 3000),
		'',
		'CONTROLS (click <number>):',
		...controls,
		'',
		`CITIES ON THE BOARD (tap <city-id>): ${seen.cities.join(' ') || 'none'}`,
	].join('\n');
}

/** A real mouse click on a numbered control from the last `look`, refused when something else covers it. */
export async function click(tab: Tab, target: string): Promise<string> {
	const point = await tab.page.evaluate(wanted => {
		const nodes = window.__lab ?? [];
		const index = Number(wanted);
		const node = Number.isInteger(index)
			? nodes[index]
			: nodes.find(candidate => candidate.innerText.replace(/\s+/g, ' ').trim().toLowerCase() === wanted.toLowerCase());
		if (!node || !node.isConnected) return { error: 'No such control now. Run `look` again.' };
		if ((node as HTMLButtonElement).disabled) return { error: `That control is disabled: ${node.innerText.trim()}` };
		node.scrollIntoView({ block: 'center', inline: 'center' });
		const box = node.getBoundingClientRect();
		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;
		const hit = document.elementFromPoint(x, y);
		if (hit && hit !== node && !node.contains(hit) && !hit.contains(node))
			return {
				error: `Something covers that control: <${hit.tagName.toLowerCase()} class="${hit.className}">. A person could not click it.`,
			};
		return { x, y, text: node.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) };
	}, target);
	if ('error' in point) return point.error!;
	await tab.page.mouse.click(point.x!, point.y!);
	await tab.page.waitForTimeout(350);
	return `Clicked "${point.text}".`;
}

/** Clicks a city on the 3D board. The marker sits where its label would be without the label's sideways offset. */
export async function tapCity(tab: Tab, city: string): Promise<string> {
	const label = tab.page.locator(`.label[data-city="${city}"]`);
	if ((await label.count()) === 0) return `No city "${city}" on the board.`;
	const point = await label.evaluate(node => {
		const box = node.getBoundingClientRect();
		const style = getComputedStyle(node);
		return {
			x: box.x + box.width / 2 - parseFloat(style.getPropertyValue('--dx')),
			y: box.y + box.height / 2 - parseFloat(style.getPropertyValue('--dy')),
		};
	});
	await tab.page.mouse.click(point.x, point.y);
	await tab.page.waitForTimeout(350);
	return `Clicked ${city} on the board.`;
}

export async function typeInto(tab: Tab, index: string, text: string): Promise<string> {
	const ok = await tab.page.evaluate(wanted => {
		const node = (window.__lab ?? [])[Number(wanted)];
		if (!node?.isConnected) return false;
		node.focus();
		return true;
	}, index);
	if (!ok) return 'No such control now. Run `look` again.';
	await tab.page.keyboard.press('ControlOrMeta+a');
	await tab.page.keyboard.type(text);
	return `Typed "${text}".`;
}

export async function pressKey(tab: Tab, key: string): Promise<string> {
	await tab.page.keyboard.press(key);
	await tab.page.waitForTimeout(250);
	return `Pressed ${key}.`;
}
