import { MAX_FRAME_BYTES, type Link, type LinkHandlers, type ListenHandlers, type Transport } from './transport.ts';
import { NetError, type PeerId } from './types.ts';

export type MemoryTransport = Transport & {
	/** Severs every link `id` is part of, as a network failure would. Both sides see `close`. */
	drop(id: PeerId): void;
	/** While congested, lossy sends from `id` report backpressure and drop. */
	setCongested(id: PeerId, congested: boolean): void;
};

type HostEntry = { id: PeerId; handlers: ListenHandlers };
type Pair = { ids: [PeerId, PeerId]; fail(): void };

/**
 * An in-process network: one instance stands in for the signaling Worker and every WebRTC connection. Delivery is
 * asynchronous and ordered per direction, like a data channel.
 */
export function createMemoryTransport(): MemoryTransport {
	let host: HostEntry | null = null;
	const hostWaiters = new Set<() => void>();
	const pairs = new Set<Pair>();
	const congested = new Set<PeerId>();

	const createPair = (hostId: PeerId, peerId: PeerId) => {
		const handlers: [LinkHandlers | null, LinkHandlers | null] = [null, null];
		/** Which side closed it, or `failed` when the network severed both. */
		let closed: 0 | 1 | 'failed' | null = null;
		const deliverFrame = (to: 0 | 1, lane: 'reliable' | 'lossy', frame: Uint8Array) =>
			queueMicrotask(() => {
				if (closed !== to && closed !== 'failed') handlers[to]?.frame(lane, frame);
			});
		const deliverClose = (to: 0 | 1) => queueMicrotask(() => handlers[to]?.close());
		const pair: Pair = {
			ids: [hostId, peerId],
			fail() {
				if (closed !== null) return;
				closed = 'failed';
				pairs.delete(pair);
				deliverClose(0);
				deliverClose(1);
			},
		};
		pairs.add(pair);

		const end = (self: 0 | 1): Link => {
			const other = self === 0 ? 1 : 0;
			const selfId = pair.ids[self];
			const send = (lane: 'reliable' | 'lossy', frame: Uint8Array) => {
				if (frame.length > MAX_FRAME_BYTES)
					throw new RangeError(`Frame of ${frame.length} bytes exceeds ${MAX_FRAME_BYTES}`);
				deliverFrame(other, lane, frame.slice());
			};
			return {
				remoteId: pair.ids[other],
				sendReliable(frame) {
					if (closed === null) send('reliable', frame);
				},
				sendLossy(frame) {
					if (closed !== null || congested.has(selfId)) return false;
					send('lossy', frame);
					return true;
				},
				close() {
					if (closed !== null) return;
					closed = self;
					pairs.delete(pair);
					deliverClose(other);
				},
			};
		};
		return {
			hostEnd: end(0),
			peerEnd: end(1),
			attach(side: 0 | 1, h: LinkHandlers) {
				handlers[side] = h;
			},
		};
	};

	const waitForHost = (signal: AbortSignal) =>
		new Promise<HostEntry>((resolve, reject) => {
			const check = () => {
				if (signal.aborted) return finish(() => reject(signal.reason));
				if (host) {
					const found = host;
					finish(() => resolve(found));
				}
			};
			const finish = (settle: () => void) => {
				hostWaiters.delete(check);
				signal.removeEventListener('abort', check);
				settle();
			};
			hostWaiters.add(check);
			signal.addEventListener('abort', check);
			check();
		});

	return {
		listen(selfId, handlers) {
			if (host && host.id !== selfId) {
				const taken = new NetError('host-taken', `${host.id} is already hosting`);
				queueMicrotask(() => handlers.fail(taken));
				return { close() {} };
			}
			if (host) {
				const replaced = host;
				queueMicrotask(() => replaced.handlers.fail(new NetError('replaced', `${selfId} started hosting again`)));
			}
			const entry: HostEntry = { id: selfId, handlers };
			host = entry;
			queueMicrotask(() => {
				if (host === entry) handlers.status('connected');
			});
			for (const wake of hostWaiters) wake();
			return {
				close() {
					if (host === entry) host = null;
				},
			};
		},

		async connect(selfId, handlers, signal) {
			const target = await waitForHost(signal);
			const { hostEnd, peerEnd, attach } = createPair(target.id, selfId);
			attach(1, handlers);
			attach(0, target.handlers.link(hostEnd));
			return peerEnd;
		},

		drop(id) {
			for (const pair of pairs) if (pair.ids.includes(id)) pair.fail();
		},

		setCongested(id, on) {
			if (on) congested.add(id);
			else congested.delete(id);
		},
	};
}
