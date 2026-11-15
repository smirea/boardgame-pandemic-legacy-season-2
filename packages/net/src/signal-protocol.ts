/**
 * Wire contract between the WebRTC transport and the signaling Worker. Pure types and constants, because the Worker
 * type-checks this file without the DOM lib.
 */

export const PEER_ID_PATTERN = /^[\w-]{1,64}$/;

export type SignalRole = 'host' | 'peer';

export const SignalClose = {
	replaced: 4000,
	unauthorized: 4001,
	hostTaken: 4009,
} as const;

/** The only frame the Worker answers without waking the Durable Object. */
export const KEEPALIVE = { ping: 'ping', pong: 'pong' } as const;

export type ClientMessage = { t: 'signal'; to: string; data: unknown };

export type ServerMessage = { t: 'ready' } | { t: 'host'; id: string } | { t: 'signal'; from: string; data: unknown };
