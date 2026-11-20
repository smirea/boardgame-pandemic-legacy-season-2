#!/usr/bin/env bun
/**
 * Assembles `apps/signal/site`, the static half of the deployed Worker: the UI built to signal on its own origin, and
 * the scans it links to under `/api/scans/`, where the Bun server serves them in development. Only the scans the
 * index names are copied, since the archive holds files the game never shows and one is over the assets file limit.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SITE_URL = 'https://pandemic-legacy-s2.stf.lol';
/** Cloudflare refuses a static asset over 25 MiB. */
const MAX_ASSET_BYTES = 25 * 1024 * 1024;

const root = new URL('../../../', import.meta.url).pathname;
const site = join(root, 'apps/signal/site');
const uiBuild = join(root, 'apps/ui/build');
const scans = join(root, 'docs/assets');

const build = Bun.spawnSync(['bun', 'run', 'build'], {
	cwd: join(root, 'apps/ui'),
	env: { ...process.env, SIGNAL_URL: `${SITE_URL}/signal` },
	stdio: ['inherit', 'inherit', 'inherit'],
});
if (build.exitCode !== 0) throw new Error('the UI build failed');

rmSync(site, { recursive: true, force: true });
cpSync(uiBuild, site, { recursive: true });

const index = readFileSync(join(root, 'apps/ui/src/lib/scans.generated.ts'), 'utf8');
const sources = new Set([...index.matchAll(/"(?:src|back)":"([^"]+)"/g)].map(match => match[1]!));
if (!sources.size) throw new Error('scans.generated.ts names no scans');

for (const src of sources) {
	const from = join(scans, src);
	if (!existsSync(from)) throw new Error(`scans.generated.ts names ${src}, which docs/assets lacks`);
	if (statSync(from).size > MAX_ASSET_BYTES) throw new Error(`${src} is over Cloudflare's 25 MiB asset limit`);
	const to = join(site, 'api/scans', src);
	mkdirSync(dirname(to), { recursive: true });
	copyFileSync(from, to);
}
console.log(`site: the UI and ${sources.size} scans in ${site}`);
