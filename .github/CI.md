# Continuous integration

`workflows/ci.yml` runs on pull requests, default-branch pushes, and manual dispatches. Every check is its own job and the jobs run in parallel, so a run takes as long as its slowest check. A newer push to the same branch or pull request cancels the run in progress. All CI helpers run with Bun, pinned by `.bun-version`.

Actions are pinned to commit SHAs. Dependabot checks for action updates weekly.

Bun jobs run the root `lint:ci`, `typecheck`, `test`, and `build` scripts, one job each, with a 5-minute timeout. Each takes seconds, so they start at once and run on every change, with no change detection in front of them. Keep CI checks read-only. `.bun-version` and `packageManager` pin Bun; update them together. Commit `bun.lock` after changing dependencies. CI caches package downloads, then always installs with `--frozen-lockfile`.

The pre-commit hook (`lefthook.yml`) already ran lint, typecheck, and the tests before the commit existed, through the same package scripts. There is no pre-push hook. CI repeats the checks for what a hook can't see: a merge, a machine without the hooks, and the build. A CI failure the hook could have caught is a hook bug, so fix the hook. Tests follow the `tests` skill: logic only, in-process, never in a browser. A new check is a package script first. Add it to the hook if it finishes in seconds, and to the `task` matrix as its own job.

Apps using env-manager never install or run it in CI. The committed reader (`packages/shared/src/env.ts`) validates the environment, and Bun loads the tracked `.env` defaults for the scripts CI runs from the repository root. Keep defaults harmless and complete enough for CI. If a test needs a credential, supply it explicitly through GitHub Actions secrets. Never commit `.env.local` or native local secrets, and never cache environment outputs.

Configure branch protection to require the job names you need. After renaming the default branch, update the workflow's push branch.
