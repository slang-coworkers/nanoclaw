---
name: nanoclaw-build
license: MIT
description: "Clone, build, and test NanoClaw. Use when the repo needs setup, a rebuild, or when tests fail."
provides: [code.build, test.run, test.gen, ci.inspect]
allowed-tools: Bash(git:*), Bash(pnpm:*), Bash(npm:*), Bash(bun:*), Bash(vitest:*), Read, Grep, Glob
---

# Build & Test

## Prerequisites

**Check all of these before starting the build.** Request any missing packages in a single `install_packages` call — the container will be rebuilt and you must restart the build from scratch after that, so identify everything upfront.

Required apt packages:
- `nodejs`, `npm` — Node.js runtime
- `python3` — needed by some npm native addons

Check:
```bash
for pkg in nodejs npm python3; do
  dpkg -l "$pkg" 2>/dev/null | grep -q "^ii" || echo "MISSING: $pkg"
done
```

Required npm globals (check with `which pnpm bun`):
- `pnpm` — package manager (`npm install -g pnpm`)
- `bun` — agent-runner test runner (`npm install -g bun`)

If any are missing, call `install_packages` or install npm globals before proceeding. After the container rebuilds, re-invoke this skill from scratch.

## Quick build

```bash
pnpm install
pnpm run build          # tsc → dist/
npm run rebuild:claude   # regenerate groups/*/CLAUDE.md from lego spine
```

## Tests

```bash
pnpm exec vitest run                    # host tests (src/, setup/, dashboard/)
npm run validate:templates              # verify all lego types compose cleanly
cd container/agent-runner && bun test   # agent-runner tests (bun:test)
```

## Container

```bash
cd container/agent-runner && bun install    # agent-runner deps
cd container/mcp-servers/slang-mcp && uv sync  # MCP server Python deps
./container/build.sh                        # build Docker image
```

## CI checks (same as `.github/workflows/ci.yml`)

1. `pnpm run format:check` — prettier
2. `pnpm exec tsc --noEmit` — typecheck
3. `npm run validate:templates` — spine composition
4. `pnpm exec vitest run` — tests

## Common issues

- `bun install --frozen-lockfile` fails with EEXIST → non-critical symlink issue, safe to ignore
- `rebuild:claude` fails with ENOENT → `mkdir -p groups/main` first (the only target the script rebuilds; `groups/global/` is retired)
- Container build uses `--no-cache` but COPY steps still cached → `docker buildx prune -f` then rebuild
