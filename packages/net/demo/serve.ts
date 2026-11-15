#!/usr/bin/env bun
import index from './index.html';

export function serveDemo(port = 0) {
	return Bun.serve({ hostname: '127.0.0.1', port, development: false, routes: { '/': index } });
}

if (import.meta.main) {
	const server = serveDemo(Number(process.argv[2] ?? 6191));
	const signal = process.argv[3] ?? 'ws://127.0.0.1:8787';
	console.log(`Demo on ${server.url}`);
	console.log(`Host: ${server.url}?role=host&id=host&name=Host&signal=${signal}&secret=dev-secret`);
	console.log(`Peer: ${server.url}?role=peer&id=alice&name=Alice&signal=${signal}&secret=dev-secret`);
}
