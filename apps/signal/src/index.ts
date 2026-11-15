import { DurableObject } from 'cloudflare:workers';
import {
	KEEPALIVE,
	PEER_ID_PATTERN,
	SignalClose,
	type ClientMessage,
	type ServerMessage,
	type SignalRole,
} from '@repo/net/signal-protocol';

type Attachment = { id: string; role: SignalRole };

/**
 * One game, one object. It only relays offers, answers, and ICE candidates between the host and peers that are
 * connecting; game traffic never touches it. All state lives in socket tags and attachments, so hibernation loses
 * nothing and the object stores no rows.
 */
export class SignalRoom extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(KEEPALIVE.ping, KEEPALIVE.pong));
	}

	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const role = url.searchParams.get('role') as SignalRole;
		const id = url.searchParams.get('id')!;

		if (role === 'host') {
			const other = this.open('host').find(ws => attachment(ws).id !== id);
			if (other) return rejectSocket(SignalClose.hostTaken, `${attachment(other).id} is already hosting`);
		}
		for (const stale of this.open(idTag(id))) stale.close(SignalClose.replaced, 'replaced');

		const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
		this.ctx.acceptWebSocket(server, [role, idTag(id)]);
		server.serializeAttachment({ id, role } satisfies Attachment);

		if (role === 'host') {
			send(server, { t: 'ready' });
			for (const peer of this.open('peer')) send(peer, { t: 'host', id });
		} else {
			const host = this.open('host')[0];
			if (host) send(server, { t: 'host', id: attachment(host).id });
		}
		return new Response(null, { status: 101, webSocket: client });
	}

	override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const msg = typeof message === 'string' ? parseClientMessage(message) : null;
		if (!msg) return;
		const from = attachment(ws);
		const target = this.open(idTag(msg.to))[0];
		if (!target || attachment(target).role === from.role) return;
		send(target, { t: 'signal', from: from.id, data: msg.data });
	}

	private open(tag: string): WebSocket[] {
		return this.ctx.getWebSockets(tag).filter(ws => ws.readyState === WebSocket.OPEN);
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== '/') return new Response('Not found', { status: 404 });
		if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
			return new Response('Expected a WebSocket upgrade', { status: 426 });

		const role = url.searchParams.get('role');
		const id = url.searchParams.get('id') ?? '';
		if ((role !== 'host' && role !== 'peer') || !PEER_ID_PATTERN.test(id))
			return new Response('Expected role=host|peer and a valid id', { status: 400 });
		if (!env.SIGNAL_SECRET) throw new Error('SIGNAL_SECRET is not configured');
		if (!(await secretMatches(url.searchParams.get('secret') ?? '', env.SIGNAL_SECRET)))
			return rejectSocket(SignalClose.unauthorized, 'unauthorized');

		return env.SIGNAL_ROOM.getByName('session').fetch(request);
	},
} satisfies ExportedHandler<Env>;

/** Browsers hide HTTP status on a failed upgrade, so refusals complete the upgrade and close with a code they can read. */
function rejectSocket(code: number, reason: string): Response {
	const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
	server.accept();
	server.close(code, reason);
	return new Response(null, { status: 101, webSocket: client });
}

async function secretMatches(given: string, expected: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [a, b] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(given)),
		crypto.subtle.digest('SHA-256', encoder.encode(expected)),
	]);
	return crypto.subtle.timingSafeEqual(a, b);
}

function idTag(id: string): string {
	return `id:${id}`;
}

function attachment(ws: WebSocket): Attachment {
	return ws.deserializeAttachment() as Attachment;
}

function send(ws: WebSocket, msg: ServerMessage): void {
	ws.send(JSON.stringify(msg));
}

function parseClientMessage(text: string): ClientMessage | null {
	try {
		const raw = JSON.parse(text) as Partial<ClientMessage> | null;
		if (raw?.t !== 'signal' || typeof raw.to !== 'string' || !PEER_ID_PATTERN.test(raw.to)) return null;
		return { t: 'signal', to: raw.to, data: raw.data };
	} catch {
		return null;
	}
}
