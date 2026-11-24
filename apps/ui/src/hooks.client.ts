/** SvelteKit hands boundaries `{ message: 'Internal Error' }` by default; the crash screen should name the real error. */
export function handleError({ error }: { error: unknown }) {
  return {
    message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
}
