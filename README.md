<!--
Agents: this README is the scaffold's placeholder. Once the project is fleshed out, rewrite it for this project: what it is, how to run it, and the few things a newcomer must know. Keep it short, move component details into nested READMEs, and delete this comment.
-->

# boardgame-pandemic-legacy-season-2

Created on 2026-11-15 with [setup-new-app](https://github.com/smirea/stefan-utils/tree/master/scripts/setup-new-app) (`--type svelte`). `.github/CI.md` describes the CI checks.

SvelteKit UI and Bun API in a Bun workspace.

- `apps/ui/`: SvelteKit SPA with TanStack Query and Tailwind
- `apps/server/`: Bun API that also serves the built UI
- `packages/shared/`: shared code and the generated env reader

```sh
bun install            # also installs the git hooks
bun run env:generate   # after editing .env or .env.local
bun run dev            # UI and API, with reload
```

The UI runs at http://boardgame-pandemic-legacy-season-2.localhost and proxies `/api/*` to the API. Configuration lives in the root `.env` (tracked schema and defaults) and `.env.local` (ignored local values), managed by `env-manager`.

`AGENTS.md` lists the stack and conventions.
