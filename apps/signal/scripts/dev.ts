#!/usr/bin/env bun
import env from '../../../packages/shared/src/env.ts';

const wrangler = Bun.spawn(
	[
		'bun',
		'x',
		'wrangler',
		'dev',
		'--ip',
		'127.0.0.1',
		'--port',
		String(env.DEV_SIGNAL_PORT),
		'--var',
		`SIGNAL_SECRET:${env.DEV_SIGNAL_SECRET}`,
		'--show-interactive-dev-session=false',
	],
	{ cwd: new URL('..', import.meta.url).pathname, stdio: ['inherit', 'inherit', 'inherit'] },
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => wrangler.kill(signal));
process.exit(await wrangler.exited);
