import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { GameNotes, IndexGame, ReplayIndex, RunSummary } from '@repo/game';
import type { Audit } from './audit.ts';
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

export const notesFile = (run: string) => join(labRoot, 'notes', `${run}.json`);

const runsDir = join(labRoot, 'runs');

const readJson = <T>(path: string, fallback: T): T =>
	existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;

/** Runs that recorded games. A run from before recording existed has nothing to replay. */
const recordedRuns = () =>
	existsSync(runsDir) ? readdirSync(runsDir).filter(run => existsSync(join(runsDir, run, 'records', 'meta.json'))) : [];

/** The campaign page's list: every recorded game of the run, with the operator's notes on each. */
export function buildIndex(run: string): ReplayIndex {
	const runDir = join(runsDir, run);
	const records = join(runDir, 'records');
	const meta = readJson<Record<string, RecordMeta>>(join(records, 'meta.json'), {});
	const audit = readJson<Audit | null>(join(runDir, 'audit.json'), null);
	const notes = readJson<Record<string, GameNotes>>(notesFile(run), {});
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
	return { run, title: `Playtest ${run}`, updatedAt: Date.now(), games };
}

export function listRuns(): RunSummary[] {
	return recordedRuns()
		.map(run => {
			const { games } = buildIndex(run);
			return {
				run,
				games: games.length,
				won: games.filter(game => game.outcome?.won).length,
				lost: games.filter(game => game.outcome && !game.outcome.won).length,
				updatedAt: Math.max(statSync(join(runsDir, run, 'records')).mtimeMs, ...games.map(game => game.endedAt)),
			};
		})
		.toSorted((a, b) => b.updatedAt - a.updatedAt);
}

/** The runs list and each run's recordings, served the same way by the app's server and by the lab. */
export const runRoutes = {
	'/api/runs': () => Response.json(listRuns()),
	'/api/runs/:run/:file': async (request: Bun.BunRequest<'/api/runs/:run/:file'>) => {
		const { run, file } = request.params;
		if (!recordedRuns().includes(run)) return Response.json({ ok: false, error: `No run ${run}` }, { status: 404 });
		if (file === 'index.json') return Response.json(buildIndex(run));
		const record = Bun.file(join(runsDir, run, 'records', file));
		return /^g\d+\.json$/.test(file) && (await record.exists())
			? new Response(record)
			: Response.json({ ok: false, error: `No recording ${file}` }, { status: 404 });
	},
};

/** Serves the built app and the runs' recordings, for the lab and for reviewing a finished run. */
export function servePages(port: number) {
	const buildDir = join(repoRoot, 'apps/ui/build');
	return Bun.serve({
		hostname: '127.0.0.1',
		port,
		routes: runRoutes,
		async fetch(request) {
			const path = decodeURIComponent(new URL(request.url).pathname);
			const file = Bun.file(join(buildDir, path));
			return new Response(path !== '/' && (await file.exists()) ? file : Bun.file(join(buildDir, 'index.html')));
		},
	});
}

export const replayPath = (run: string) => `/replay?index=${encodeURIComponent(`/api/runs/${run}/index.json`)}`;

export const replaysUrl = (port: number, run: string) => `http://127.0.0.1:${port}${replayPath(run)}`;
