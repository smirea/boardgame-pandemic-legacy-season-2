import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export type Harness = 'api' | 'ui' | 'screen' | 'desktop';

export type PlayerConfig = {
	/** Short id used on the command line, such as `vex`. */
	id: string;
	name: string;
	/** Markdown file describing how this player thinks and talks. */
	persona: string;
	/** Markdown file the player reads at the start of a game and rewrites at the end. Left out, every game starts from nothing. */
	memory?: string;
	/**
	 * `api` sends commands through the tab's debug API. `ui` may only click what a person could click, found
	 * by its text. `screen` has pictures of the screen and a pointer and keyboard aimed by pixel, and nothing else.
	 * `desktop` has a real browser window on this machine's desktop, which the player drives with a computer-use
	 * tool of their own, and the lab gives them only whose turn the desktop is.
	 */
	harness: Harness;
	/** The T3 provider and model that plays this seat, recorded so a run can be repeated. */
	provider: string;
	model: string;
	effort: string;
};

export type LabConfig = {
	/** Names the run folder under `runs/`, which holds saves, the journal, reports and briefs. */
	run: string;
	seed: number;
	/** What the campaign starts from when the run has no save of its own yet. */
	start: {
		save?: string;
		scenario?: string;
		/** A stage from `stages.ts` that arranges the table once, on the first action step of every game. */
		stage?: string;
		/** Runs whose recordings count as already exercised, so the briefs list only what no run has reached. */
		coverage?: string[];
	};
	/** Stop handing out briefs once this month has been played. */
	lastMonth: number;
	passphrase: string;
	/** The page port. The control port is one above it. */
	port: number;
	signalPort: number;
	headed: boolean;
	/** The first player hosts the game in their tab. Seats follow this order. */
	players: PlayerConfig[];
};

export const labRoot = resolve(import.meta.dir, '..');
export const repoRoot = resolve(labRoot, '../..');

const fromLab = (path: string) => (isAbsolute(path) ? path : join(labRoot, path));

export function loadConfig(path: string): LabConfig & { file: string; runDir: string } {
	const file = resolve(path);
	if (!existsSync(file)) throw new Error(`no config at ${file}`);
	const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<LabConfig>;
	const need = <K extends keyof LabConfig>(key: K): NonNullable<LabConfig[K]> => {
		if (raw[key] === undefined || raw[key] === null) throw new Error(`${file}: "${key}" is required`);
		return raw[key] as NonNullable<LabConfig[K]>;
	};
	const players = need('players');
	if (players.length < 1 || players.length > 4) throw new Error(`${file}: 1 to 4 players`);
	const ids = new Set(players.map(player => player.id));
	if (ids.size !== players.length || ids.has('lab'))
		throw new Error(`${file}: player ids must be unique and not "lab"`);
	for (const player of players) {
		for (const key of ['id', 'name', 'persona', 'harness', 'provider', 'model', 'effort'] as const)
			if (!player[key]) throw new Error(`${file}: player "${player.id ?? '?'}" needs "${key}"`);
		if (!['api', 'ui', 'screen', 'desktop'].includes(player.harness))
			throw new Error(`${file}: harness is "api", "ui", "screen" or "desktop"`);
		player.persona = fromLab(player.persona);
		if (player.memory) player.memory = fromLab(player.memory);
		if (!existsSync(player.persona)) throw new Error(`${file}: no persona file at ${player.persona}`);
	}
	const start = raw.start ?? {};
	if (start.save) {
		start.save = isAbsolute(start.save) ? start.save : join(dirname(file), start.save);
		if (!existsSync(start.save)) throw new Error(`${file}: no save at ${start.save}`);
	}
	const run = need('run');
	return {
		run,
		seed: need('seed'),
		start,
		lastMonth: raw.lastMonth ?? 12,
		passphrase: raw.passphrase ?? 'playtest',
		port: raw.port ?? 6230,
		signalPort: raw.signalPort ?? 8787,
		headed: raw.headed ?? false,
		players,
		file,
		runDir: join(labRoot, 'runs', run),
	};
}
