import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameNotes, IndexGame, ReplayIndex } from '@repo/game';
import type { Audit } from './audit.ts';
import type { LabConfig } from './config.ts';
import { labRoot, repoRoot } from './config.ts';

/** What the lab remembers about each recorded game, kept beside the recordings themselves. */
export type RecordMeta = {
	id: string;
	steps: number;
	startedAt: number;
	endedAt: number;
	players: { name: string; character: string; job: string }[];
};

export const recordFile = (index: number) => `g${String(index).padStart(2, '0')}.json`;

export const notesFile = (config: LabConfig) => join(labRoot, 'notes', `${config.run}.json`);

const readJson = <T>(path: string, fallback: T): T =>
	existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;

/** The campaign page's list: every recorded game of the run, with the operator's notes on each. */
export function buildIndex(config: LabConfig & { runDir: string }): ReplayIndex {
	const records = join(config.runDir, 'records');
	const meta = readJson<Record<string, RecordMeta>>(join(records, 'meta.json'), {});
	const audit = readJson<Audit | null>(join(config.runDir, 'audit.json'), null);
	const notes = readJson<Record<string, GameNotes>>(notesFile(config), {});
	const files = existsSync(records)
		? readdirSync(records)
				.filter(name => /^g\d+\.json$/.test(name))
				.toSorted()
		: [];
	const games: IndexGame[] = files.flatMap(file => {
		const key = file.slice(0, -5);
		const index = Number(key.slice(1));
		const entry = meta[key];
		const game = audit?.games.find(candidate => candidate.index === index);
		if (!entry || !game) return [];
		return [
			{
				id: key,
				file,
				month: game.month,
				attempt: game.attempt,
				outcome: game.outcome ? { won: game.outcome.won, reason: game.outcome.reason } : null,
				turns: game.outcome?.turns ?? 0,
				steps: entry.steps,
				startedAt: entry.startedAt,
				endedAt: entry.endedAt,
				players: entry.players,
				notes: notes[key] ?? null,
			},
		];
	});
	return { run: config.run, title: `Playtest ${config.run}`, updatedAt: Date.now(), games };
}

/** Serves the built app, and the run's recordings under `/lab/records/`, for the lab and for reviewing a finished run. */
export function servePages(config: LabConfig & { runDir: string }) {
	const buildDir = join(repoRoot, 'apps/ui/build');
	const records = join(config.runDir, 'records');
	return Bun.serve({
		hostname: '127.0.0.1',
		port: config.port,
		async fetch(request) {
			const path = decodeURIComponent(new URL(request.url).pathname);
			if (path === '/lab/records/index.json') return Response.json(buildIndex(config));
			if (path.startsWith('/lab/records/')) {
				const name = path.slice('/lab/records/'.length);
				const file = Bun.file(join(records, name));
				return /^g\d+\.json$/.test(name) && (await file.exists())
					? new Response(file)
					: new Response('no such recording', { status: 404 });
			}
			const file = Bun.file(join(buildDir, path));
			return new Response(path !== '/' && (await file.exists()) ? file : Bun.file(join(buildDir, 'index.html')));
		},
	});
}

export const replaysUrl = (port: number) => `http://127.0.0.1:${port}/replay?index=/lab/records/index.json`;
