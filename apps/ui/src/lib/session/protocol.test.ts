import { describe, expect, test } from 'bun:test';
import { parseMsg, parsePresence } from './protocol';

describe('session wire protocol', () => {
	test('accepts draw-clear and ping messages and rejects malformed coordinates', () => {
		expect(parseMsg({ t: 'draw-clear' })).toEqual({ t: 'draw-clear' });
		expect(parseMsg({ t: 'ping', id: 'p1', player: 'alice', x: 1.5, z: -2.5 })).toEqual({
			t: 'ping',
			id: 'p1',
			player: 'alice',
			x: 1.5,
			z: -2.5,
		});
		expect(() => parseMsg({ t: 'ping', id: 'p1', player: 'alice', x: Number.NaN, z: 0 })).toThrow();
	});

	test('accepts presence with optional drawing tool and rejects unknown tools', () => {
		expect(parsePresence(null)).toBeNull();
		expect(parsePresence({ x: 3, z: 4 })).toEqual({ x: 3, z: 4 });
		expect(parsePresence({ x: 3, z: 4, tool: 'pen' })).toEqual({ x: 3, z: 4, tool: 'pen' });
		expect(parsePresence({ x: 3, z: 4, tool: 'eraser' })).toEqual({ x: 3, z: 4, tool: 'eraser' });
		expect(() => parsePresence({ x: 3, z: 4, tool: 'laser' })).toThrow();
	});
});
