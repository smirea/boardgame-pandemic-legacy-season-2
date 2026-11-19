import { isFreeAction } from '@repo/game';
import type { Action } from '@repo/game';

/**
 * The ways a click offers to take an action. A free action that moves an amount moves one at a time: a second
 * click takes the next, and undo puts one back, so asking how many is a step nobody needs.
 */
export function ways(variants: Action[]): Action[] {
	const first = variants[0];
	if (!first || !isFreeAction(first.a)) return variants;
	return variants.filter(action => !('count' in action) || action.count === 1);
}
