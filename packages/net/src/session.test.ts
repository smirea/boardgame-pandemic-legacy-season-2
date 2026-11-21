import { afterEach, describe, expect, test } from 'bun:test';
import {
	createHost,
	createMemoryTransport,
	joinHost,
	peerId,
	type MemoryTransport,
	type NetError,
	type PeerId,
	type PeerInfo,
	type Session,
} from './index.ts';

type Msg = { n: number; text?: string };
type Cursor = { x: number; y: number };

const parseMsg = (raw: unknown): Msg => {
	const value = raw as Msg;
	if (typeof value?.n !== 'number') throw new Error('n must be a number');
	if (value.text !== undefined && typeof value.text !== 'string') throw new Error('text must be a string');
	return { n: value.n, text: value.text };
};
const parsePresence = (raw: unknown): Cursor => {
	const value = raw as Cursor;
	if (typeof value?.x !== 'number' || typeof value?.y !== 'number') throw new Error('bad cursor');
	return { x: value.x, y: value.y };
};

const HOST = peerId('host');
const ALICE = peerId('alice');
const BOB = peerId('bob');

type Recorded = {
	session: Session<Msg, Cursor>;
	messages: { msg: Msg; from: PeerId }[];
	presence: { value: Cursor; from: PeerId }[];
	rosters: PeerInfo[][];
	statuses: string[];
	errors: NetError[];
};

const open: Session<Msg, Cursor>[] = [];
afterEach(() => {
	for (const session of open.splice(0)) session.close();
});

function record(session: Session<Msg, Cursor>): Recorded {
	open.push(session);
	const r: Recorded = { session, messages: [], presence: [], rosters: [], statuses: [], errors: [] };
	session.on('message', (msg, from) => r.messages.push({ msg, from }));
	session.on('presence', (value, from) => r.presence.push({ value, from }));
	session.on('peers', peers => r.rosters.push(peers));
	session.on('status', status => r.statuses.push(status));
	session.on('error', error => r.errors.push(error));
	return r;
}

function host(net: MemoryTransport, id = HOST) {
	return record(createHost({ selfId: id, name: `${id} name`, transport: net, parseMsg, parsePresence }));
}

function peer(net: MemoryTransport, id: PeerId) {
	return record(joinHost({ selfId: id, name: `${id} name`, transport: net, parseMsg, parsePresence }));
}

/** The memory transport delivers on microtasks, so draining the event loop settles every exchange without a clock. */
async function settle() {
	for (let turn = 0; turn < 50; turn++) await new Promise(resolve => setImmediate(resolve));
}

async function table() {
	const net = createMemoryTransport();
	const h = host(net);
	const a = peer(net, ALICE);
	const b = peer(net, BOB);
	await settle();
	expect([h, a, b].every(r => r.session.peers.filter(p => p.connected).length === 3)).toBe(true);
	return { net, h, a, b };
}

describe('reliable messages', () => {
	test('a host broadcast reaches every peer once, in the order it was sent', async () => {
		const { h, a, b } = await table();
		for (let n = 0; n < 50; n++) h.session.send({ n });
		await settle();
		for (const r of [a, b]) {
			expect(r.messages.map(m => m.msg.n)).toEqual([...Array(50).keys()]);
			expect(r.messages.every(m => m.from === HOST)).toBe(true);
		}
	});

	test('a host relay reaches every peer but the one it came from', async () => {
		const { h, a, b } = await table();
		h.session.send({ n: 7 }, { except: ALICE });
		await settle();
		expect(a.messages).toEqual([]);
		expect(b.messages.map(m => m.msg.n)).toEqual([7]);
	});

	test('a peer message reaches the host under the id of the link it came on', async () => {
		const { h, a, b } = await table();
		a.session.send({ n: 1 });
		b.session.send({ n: 2 });
		await settle();
		expect(h.messages.toSorted((x, y) => x.msg.n - y.msg.n)).toEqual([
			{ msg: { n: 1, text: undefined }, from: ALICE },
			{ msg: { n: 2, text: undefined }, from: BOB },
		]);
	});

	test('a message larger than one frame arrives whole in both directions', async () => {
		const { h, a } = await table();
		const text = Array.from({ length: 500 * 1024 }, (_, i) => String.fromCharCode(32 + (i % 90))).join('') + 'é✓🎲';
		h.session.send({ n: 1, text });
		a.session.send({ n: 2, text });
		await settle();
		expect(a.messages.map(m => m.msg.text)).toEqual([text]);
		expect(h.messages.map(m => m.msg.text)).toEqual([text]);
	});

	test('a message that fails parsing is reported and never delivered, and later messages still arrive', async () => {
		const { h, a } = await table();
		a.session.send({ n: 'nope' } as never);
		a.session.send({ n: 2 });
		await settle();
		expect(h.messages.map(m => m.msg.n)).toEqual([2]);
		expect(h.errors.map(e => e.code)).toEqual(['invalid-message']);
	});
});

describe('one host, one tab per player', () => {
	test('a second host is refused', async () => {
		const { net } = await table();
		const intruder = host(net, peerId('intruder'));
		await settle();
		expect(intruder.session.status).toBe('closed');
		expect(intruder.errors.map(e => e.code)).toEqual(['host-taken']);
	});

	test('the same id joining from a newer tab replaces the older one', async () => {
		const { net, h, a } = await table();
		const newer = peer(net, ALICE);
		await settle();
		expect(a.session.status).toBe('closed');
		expect(a.errors.map(e => e.code)).toEqual(['replaced']);
		expect(newer.session.status).toBe('connected');
		newer.session.send({ n: 1 });
		await settle();
		expect(h.messages.map(m => m.from)).toEqual([ALICE]);
		expect(h.session.peers.filter(p => p.id === ALICE)).toEqual([{ id: ALICE, name: 'alice name', connected: true }]);
	});
});
