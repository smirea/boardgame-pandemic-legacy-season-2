import { afterEach, describe, expect, test } from 'bun:test';
import {
	createHost,
	createMemoryTransport,
	createWebRtcTransport,
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

async function until(check: () => boolean, label: string, timeoutMs = 2_000) {
	const deadline = performance.now() + timeoutMs;
	while (!check()) {
		if (performance.now() > deadline) throw new Error(`Timed out waiting for: ${label}`);
		await Bun.sleep(5);
	}
}

async function table() {
	const net = createMemoryTransport();
	const h = host(net);
	const a = peer(net, ALICE);
	const b = peer(net, BOB);
	await until(
		() => [h, a, b].every(r => r.session.peers.filter(p => p.connected).length === 3),
		'everyone sees three connected players',
	);
	return { net, h, a, b };
}

describe('roster', () => {
	test('every client sees the same full roster, host included', async () => {
		const { h, a, b } = await table();
		const expected = [
			{ id: HOST, name: 'host name', connected: true },
			{ id: ALICE, name: 'alice name', connected: true },
			{ id: BOB, name: 'bob name', connected: true },
		];
		for (const r of [h, a, b]) expect(r.session.peers).toEqual(expected);
		expect(h.rosters.length).toBe(2);
		expect(a.statuses).toEqual(['connected']);
	});
});

describe('reliable messages', () => {
	test('host broadcast reaches every peer in order', async () => {
		const { h, a, b } = await table();
		for (let n = 0; n < 50; n++) h.session.send({ n });
		await until(() => a.messages.length === 50 && b.messages.length === 50, 'both peers get 50 messages');
		for (const r of [a, b]) {
			expect(r.messages.map(m => m.msg.n)).toEqual([...Array(50).keys()]);
			expect(r.messages.every(m => m.from === HOST)).toBe(true);
		}
	});

	test('host targeted send reaches only that peer', async () => {
		const { h, a, b } = await table();
		h.session.send({ n: 7 }, BOB);
		await until(() => b.messages.length === 1, 'bob gets the targeted message');
		await Bun.sleep(20);
		expect(a.messages).toEqual([]);
		expect(() => h.session.send({ n: 1 }, peerId('stranger'))).toThrow('Unknown peer');
	});

	test('peer messages go to the host with the sender id', async () => {
		const { h, a, b } = await table();
		a.session.send({ n: 1 });
		b.session.send({ n: 2 });
		await until(() => h.messages.length === 2, 'host gets both');
		expect(h.messages.toSorted((x, y) => x.msg.n - y.msg.n)).toEqual([
			{ msg: { n: 1, text: undefined }, from: ALICE },
			{ msg: { n: 2, text: undefined }, from: BOB },
		]);
		expect(() => a.session.send({ n: 3 }, BOB)).toThrow('only send to the host');
	});

	test('a 500 KB message survives chunking in both directions', async () => {
		const { h, a } = await table();
		const text = Array.from({ length: 500 * 1024 }, (_, i) => String.fromCharCode(32 + (i % 90))).join('') + 'é✓🎲';
		h.session.send({ n: 1, text });
		a.session.send({ n: 2, text });
		await until(() => a.messages.length === 1 && h.messages.length === 1, 'both sides get the big message');
		expect(a.messages[0]!.msg.text).toBe(text);
		expect(h.messages[0]!.msg.text).toBe(text);
	});

	test('a message that fails parsing is reported and never delivered', async () => {
		const { h, a } = await table();
		a.session.send({ n: 'nope' } as never);
		a.session.send({ n: 2 });
		await until(() => h.messages.length === 1, 'the valid message still arrives');
		expect(h.messages[0]!.msg.n).toBe(2);
		expect(h.errors.map(e => e.code)).toEqual(['invalid-message']);
	});
});

describe('presence', () => {
	test('a burst coalesces to the latest value and the host relays it with the sender id', async () => {
		const { h, a, b } = await table();
		for (let x = 0; x < 100; x++) a.session.sendPresence({ x, y: 0 });
		await until(() => b.presence.length > 0 && h.presence.length > 0, 'presence arrives');
		await Bun.sleep(100);
		expect(h.presence).toEqual([{ value: { x: 99, y: 0 }, from: ALICE }]);
		expect(b.presence).toEqual([{ value: { x: 99, y: 0 }, from: ALICE }]);
		expect(a.presence).toEqual([]);
	});

	test('sends at most presenceHz per second and ends on the latest value', async () => {
		const { h, a } = await table();
		const start = performance.now();
		let x = 0;
		while (performance.now() - start < 500) {
			h.session.sendPresence({ x: x++, y: 1 });
			await Bun.sleep(1);
		}
		await Bun.sleep(100);
		expect(x).toBeGreaterThan(100);
		expect(a.presence.length).toBeGreaterThanOrEqual(10);
		expect(a.presence.length).toBeLessThanOrEqual(0.5 * 30 + 2);
		expect(a.presence.at(-1)).toEqual({ value: { x: x - 1, y: 1 }, from: HOST });
	});

	test('a backed-up lane drops instead of queueing stale values', async () => {
		const { net, h, a } = await table();
		net.setCongested(ALICE, true);
		for (let x = 0; x < 5; x++) {
			a.session.sendPresence({ x, y: 0 });
			await Bun.sleep(40);
		}
		expect(h.presence).toEqual([]);
		net.setCongested(ALICE, false);
		await until(() => h.presence.length > 0, 'presence resumes');
		await Bun.sleep(100);
		expect(h.presence).toEqual([{ value: { x: 4, y: 0 }, from: ALICE }]);
	});

	test('presence that fails parsing is reported and dropped', async () => {
		const { h, a, b } = await table();
		a.session.sendPresence({ x: 'left' } as never);
		await until(() => h.errors.length === 1, 'host reports it');
		expect(h.errors[0]!.code).toBe('invalid-presence');
		await Bun.sleep(50);
		expect(h.presence).toEqual([]);
		expect(b.presence).toEqual([]);
	});
});

describe('connection lifecycle', () => {
	test('a peer that loses the host reconnects under the same id', async () => {
		const { net, h, a } = await table();
		net.drop(ALICE);
		await until(() => a.statuses.includes('reconnecting'), 'alice goes to reconnecting');
		await until(() => a.session.status === 'connected', 'alice reconnects');
		expect(a.statuses).toEqual(['connected', 'reconnecting', 'connected']);
		const aliceStates = h.rosters.map(r => r.find(p => p.id === ALICE)?.connected);
		expect(aliceStates.slice(-2)).toEqual([false, true]);
		a.session.send({ n: 5 });
		await until(() => h.messages.length === 1, 'host hears alice again');
		expect(h.messages[0]!.from).toBe(ALICE);
	});

	test('peers recover when the host reloads', async () => {
		const { net, h, a, b } = await table();
		h.session.close();
		await until(() => a.session.status === 'reconnecting' && b.session.status === 'reconnecting', 'peers notice');
		expect(a.session.peers.find(p => p.id === HOST)?.connected).toBe(false);
		const reloaded = host(net);
		await until(() => reloaded.session.peers.filter(p => p.connected).length === 3, 'both peers rejoin');
		await until(() => a.session.status === 'connected' && b.session.status === 'connected', 'peers connected');
		reloaded.session.send({ n: 9 });
		await until(() => a.messages.length === 1 && b.messages.length === 1, 'new host reaches both');
	});

	test('a second host is refused with a clear error', async () => {
		const { net } = await table();
		const intruder = host(net, peerId('intruder'));
		await until(() => intruder.session.status === 'closed', 'intruder closes');
		expect(intruder.errors.map(e => e.code)).toEqual(['host-taken']);
	});

	test('the same id joining from a newer tab replaces the older one', async () => {
		const { net, h, a } = await table();
		const newer = peer(net, ALICE);
		await until(() => a.session.status === 'closed', 'older tab closes');
		expect(a.errors.map(e => e.code)).toEqual(['replaced']);
		await until(() => newer.session.status === 'connected', 'newer tab connected');
		newer.session.send({ n: 1 });
		await until(() => h.messages.length === 1, 'host hears the newer tab');
		expect(h.session.peers.filter(p => p.id === ALICE)).toEqual([{ id: ALICE, name: 'alice name', connected: true }]);
	});
});

describe('configuration fails at construction', () => {
	const net = createMemoryTransport();
	const base = { selfId: HOST, name: 'h', transport: net, parseMsg, parsePresence };

	test('session options', () => {
		expect(() => createHost({ ...base, selfId: 'bad id!' as PeerId })).toThrow('Invalid peer id');
		expect(() => joinHost({ ...base, name: ' ' })).toThrow('name');
		expect(() => createHost({ ...base, presenceHz: 0 })).toThrow('presenceHz');
		expect(() => createHost({ ...base, parseMsg: undefined as never })).toThrow('parseMsg');
	});

	test('webrtc transport options', () => {
		expect(() => createWebRtcTransport({ signalUrl: 'nope', secret: 's' })).toThrow('signalUrl');
		expect(() => createWebRtcTransport({ signalUrl: 'ftp://x', secret: 's' })).toThrow('http(s) or ws(s)');
		expect(() => createWebRtcTransport({ signalUrl: 'https://x', secret: '' })).toThrow('secret');
		expect(() => createWebRtcTransport({ signalUrl: 'https://x', secret: 's', iceServers: [{} as never] })).toThrow(
			'iceServers',
		);
	});
});
