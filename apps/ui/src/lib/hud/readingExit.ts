import { getContext, setContext } from "svelte";

/**
 * Where a Legacy reading goes once the table has put it away, in place of the game it was read for: a page that
 * shows the reading alone, such as `/debug/legacy`, sets it, and the Unboxing's last button then says so.
 */
export type ReadingExit = { label: string; leave: () => void };

const KEY = Symbol("reading-exit");

export const setReadingExit = (exit: ReadingExit) => setContext(KEY, exit);
export const readingExit = () => getContext<ReadingExit | undefined>(KEY);
