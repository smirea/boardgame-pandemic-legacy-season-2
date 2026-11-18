import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { Command, GameRecord, PublicState, Save } from '@repo/game';

type Connection = { mode: string; status: string; peers: number; notice: string | null; fatal: string | null };

declare const window: {
	DEBUG?: {
		getState(): PublicState | null;
		setState(state: unknown): void;
		send(command: Command): string | null;
		connection(): Connection;
		getRecord(): GameRecord | null;
		setName(name: string): void;
	};
	__lab?: HTMLElement[];
	/** What each control said when it was listed, so a click on one that has since changed is refused. */
	__labText?: string[];
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

/** Opens one player's tab and brings it into the game the way a person would: passphrase, Host or Join, then a name. */
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
		await page.locator('[data-testid=passphrase]').fill(options.passphrase);
		await page.locator(`[data-testid=${options.host ? 'host' : 'join'}]`).click();
	}
	await page.waitForFunction(() => Boolean(window.DEBUG), null, { timeout: 30_000 });
	await page.evaluate(name => window.DEBUG!.setName(name), options.name);
	return tab;
}

export const readState = (tab: Tab) => tab.page.evaluate(() => JSON.stringify(window.DEBUG?.getState() ?? null));

/** The last step the host's own recorder kept: what a click sent, and whose tab it came from. */
export const lastHostStep = (tab: Tab) =>
	tab.page.evaluate(() => {
		const step = window.DEBUG?.getRecord()?.steps.at(-1);
		return step ? { command: step.command, by: step.by } : null;
	});

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
		// A choice drawn as a row hides its radio, so the row's label is what a person reads and presses.
		const nodes = [...document.querySelectorAll<HTMLElement>('button, input, select, textarea, [role="button"]')]
			.map(node =>
				node instanceof HTMLInputElement && (node.type === 'radio' || node.type === 'checkbox')
					? (node.labels?.[0] ?? node)
					: node,
			)
			.filter(visible);
		window.__lab = nodes;
		window.__labText = nodes.map(node => node.innerText);
		const controls = nodes.map((node, index) => {
			const field = node as HTMLInputElement;
			if (node instanceof HTMLSelectElement) {
				const entries = [...node.options].map(option => option.text.trim());
				const chosen = node.selectedOptions[0]?.text.trim() ?? '';
				return {
					index,
					tag: 'select',
					text: `now "${chosen}", entries: ${entries.join(', ')}`.slice(0, 200),
					disabled: node.disabled,
				};
			}
			const text = (
				node.innerText ||
				node.getAttribute('aria-label') ||
				node.querySelector('input[aria-label]')?.getAttribute('aria-label') ||
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
		const cities = [...document.querySelectorAll<HTMLElement>('.anchor[data-city]')].map(node => node.dataset['city']!);
		// Cities lit as targets for the action or card being played, which a tap on one finishes.
		const lit = [...document.querySelectorAll<HTMLElement>('.anchor[data-highlight=target]')].map(
			node => node.dataset['city']!,
		);
		// An element on its way out is inert until its exit finishes. A person no longer reads it as part of the screen.
		const labels = [...document.querySelectorAll<HTMLElement>('[inert]')];
		for (const label of labels) label.style.display = 'none';
		const text = document.body.innerText
			.replace(/[ \t]+/g, ' ')
			.replace(/\s*\n\s*/g, ' | ')
			.trim();
		for (const label of labels) label.style.display = '';
		return { controls, cities, lit, text };
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
		...(seen.lit.length ? [`LIT AS TARGETS (tap one to finish what you chose): ${seen.lit.join(' ')}`] : []),
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
		if (node.innerText !== (window.__labText ?? [])[nodes.indexOf(node)])
			return {
				error: 'The screen changed since your last `look`, and that control now says something else. Run `look` again.',
			};
		if ((node as HTMLButtonElement).disabled) return { error: `That control is disabled: ${node.innerText.trim()}` };
		node.scrollIntoView({ block: 'center', inline: 'center' });
		const box = node.getBoundingClientRect();
		// A control can be partly under another, like a card in a fanned hand. A person clicks the part that shows.
		const spots = [0.5, 0.15, 0.85].flatMap(fx => [0.5, 0.2, 0.8].map(fy => ({ fx, fy })));
		let covering: Element | null = null;
		for (const { fx, fy } of spots) {
			const x = box.x + box.width * fx;
			const y = box.y + box.height * fy;
			const hit = document.elementFromPoint(x, y);
			if (!hit || hit === node || node.contains(hit) || hit.contains(node))
				return { x, y, text: node.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) };
			covering ??= hit;
		}
		return {
			error: `Something covers that control: <${covering!.tagName.toLowerCase()} class="${covering!.className}">. A person could not click it.`,
		};
	}, target);
	if ('error' in point) return point.error!;
	await tab.page.mouse.click(point.x!, point.y!);
	await tab.page.waitForTimeout(350);
	return `Clicked "${point.text}".`;
}

/** Clicks a city on the 3D board, at the empty anchor each marker keeps at its disc's centre. */
export async function tapCity(tab: Tab, city: string): Promise<string> {
	const label = tab.page.locator(`.anchor[data-city="${city}"]`);
	if ((await label.count()) === 0) return `No city "${city}" on the board.`;
	const point = await label.evaluate(node => {
		const box = node.getBoundingClientRect();
		return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
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

/** Picks an entry of a drop-down from the last `look`, by its visible text. */
export async function chooseOption(tab: Tab, index: string, label: string): Promise<string> {
	const handle = await tab.page.evaluateHandle(wanted => (window.__lab ?? [])[Number(wanted)] ?? null, index);
	const element = handle.asElement();
	if (!element) return 'No such control now. Run `look` again.';
	const picked = await element.selectOption({ label }).catch(() => null);
	await tab.page.waitForTimeout(250);
	return picked?.length ? `Chose "${label}".` : `That drop-down has no entry "${label}".`;
}

export async function pressKey(tab: Tab, key: string): Promise<string> {
	await tab.page.keyboard.press(key);
	await tab.page.waitForTimeout(250);
	return `Pressed ${key}.`;
}
