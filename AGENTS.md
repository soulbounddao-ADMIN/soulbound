# AGENTS.md

## Cursor Cloud specific instructions

SoulBound is a pnpm monorepo (`packages/*`, `apps/*`). At this phase the repo is a
**contract + toolchain freeze bundle**: the only package is `packages/core` (a pure
TypeScript domain library). There is **no runnable app or long-running service** yet
(no `apps/`, no `supabase/`, no dev server, no `dev`/`start` scripts). "Running" the
project means the build/test/audit pipeline below.

### Toolchain / environment gotchas
- Requires **Node >= 24** and **pnpm 11.1.3** (`engineStrict: true` in `pnpm-workspace.yaml`
  enforces this). The base VM's default `node` on `PATH` may be v22 (via `/exec-daemon/node`);
  nvm's `default` alias is set to 24, so a normal login shell already resolves Node 24 and the
  corepack `pnpm` shim. If a command reports Node 22, run `nvm use 24` first.
- `pnpm-workspace.yaml` holds all pnpm settings (pnpm 11 moved them out of `.npmrc`). Build-script
  approvals live under `allowBuilds:` as a `package: true|false` map. `esbuild` is set to `false`
  (its native binary comes from the `@esbuild/linux-x64` platform package, so vitest works without
  running esbuild's postinstall). Leaving a package undecided there makes `pnpm install`/`pnpm -r`
  exit non-zero with `ERR_PNPM_IGNORED_BUILDS` because `strictDepBuilds` defaults to true.

### Commands (run from repo root)
- Install: `pnpm install`
- Typecheck: `pnpm -r typecheck`
- Build `@soulbound/core`: `pnpm -F @soulbound/core build` (emits `packages/core/dist/`)
- Static invariant audit: `pnpm audit:local` (or `bash scripts/audit.sh`) — must print `AUDIT PASSED`.
  It SKIPs checks for `apps/` and `supabase/` while those paths don't exist; that is expected.
- Tests: `pnpm -F @soulbound/core test`

### Tests are intentionally RED (do not "fix" them)
`pnpm -F @soulbound/core test` currently reports **19 failing tests**, all throwing
`NOT_IMPLEMENTED: implement in Cline Task 2`. This is the **documented, correct** freeze state:
`DefaultAdmissionService` / `DefaultMembershipService` bodies are stubbed until Task 2. Do NOT
`.skip`/`.todo` or edit these frozen tests to make them green (the audit forbids `.skip`/`.todo`
in `packages/core/src`). Files marked `CONTRACT-FROZEN` (types, policy, tests) must not be weakened
unless the user explicitly says "unfreeze contract".
