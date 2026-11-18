import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { framesOf, parseRecord } from '@repo/game';
import type { PublicState, World } from '@repo/game';
import { newAudit, observe, universe } from './audit.ts';
import type { Audit } from './audit.ts';
import { labRoot } from './config.ts';

export type RunCoverage = { run: string; games: number; won: number; audit: Audit; world: World | null };

/**
 * Replays every recording of a run through the audit. The recordings hold every state the game went
 * through, so this counts what happened even when the lab that watched the game was restarted mid-run.
 */
export function coverageOfRun(runOrPath: string): RunCoverage {
	// A path names a run directory anywhere, such as another checkout's, which a worktree has no runs of its own to count.
	const run = runOrPath.includes('/') ? basename(resolve(runOrPath)) : runOrPath;
	const dir = runOrPath.includes('/') ? join(resolve(runOrPath), 'records') : join(labRoot, 'runs', run, 'records');
	if (!existsSync(dir)) throw new Error(`run "${run}" has no recordings at ${dir}`);
	const audit = newAudit();
	let previous: PublicState | null = null;
	const files = readdirSync(dir)
		.filter(file => /^g\d+\.json$/.test(file))
		.toSorted();
	for (const file of files) {
		const record = parseRecord(JSON.parse(readFileSync(join(dir, file), 'utf8')));
		const frames = framesOf(record);
		observe(audit, previous, frames[0]!, null);
		record.steps.forEach((step, index) => observe(audit, frames[index]!, frames[index + 1]!, step.command));
		previous = frames.at(-1)!;
	}
	const finished = audit.games.filter(game => game.outcome);
	return {
		run,
		games: finished.length,
		won: finished.filter(game => game.outcome!.won).length,
		audit,
		world: previous?.world ?? null,
	};
}

/** What the named runs have exercised between them, against everything the engine can do. */
export function renderCoverage(runs: string[]): string {
	// A glob over another checkout's runs takes in runs that recorded nothing, which have nothing to count.
	const empty = runs.filter(run => run.includes('/') && !existsSync(join(resolve(run), 'records')));
	const covered = runs.filter(run => !empty.includes(run)).map(coverageOfRun);
	const world = covered.findLast(entry => entry.world)?.world;
	if (!world) throw new Error('no recorded game in those runs');
	const keys = universe(world).map(entry => entry.key);
	const firstSeen = (key: string) => covered.find(entry => entry.audit.exercised[key])?.run ?? null;
	const missing = keys.filter(key => !firstSeen(key));
	const lines = [
		`Runs: ${covered.map(entry => `${entry.run} (${entry.games} games, ${entry.won} won)`).join(', ')}.`,
		...(empty.length ? [`Skipped, no recordings: ${empty.map(run => basename(resolve(run))).join(', ')}.`] : []),
		`${keys.length - missing.length} of ${keys.length} tracked mechanics happened in recorded play.`,
		'',
	];
	for (const entry of covered.slice(1)) {
		const added = keys.filter(key => firstSeen(key) === entry.run);
		lines.push(`First seen in ${entry.run} (${added.length}): ${added.join(', ') || 'none'}.`, '');
	}
	lines.push(`Never seen in recorded play (${missing.length}): ${missing.join(', ') || 'none'}.`);
	const problems = covered.flatMap(entry =>
		entry.audit.problems.map(problem => `${entry.run} game ${problem.game}, ${problem.at}: ${problem.text}`),
	);
	lines.push('', `Invariant and schedule problems (${problems.length}):`, ...problems.map(text => `- ${text}`));
	return lines.join('\n');
}
