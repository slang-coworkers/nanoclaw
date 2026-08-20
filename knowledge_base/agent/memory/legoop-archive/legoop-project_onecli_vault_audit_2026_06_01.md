---
type: project
title: "Snapshot of OneCLI dev vault (10256) — every secret either auto-refreshed or has a documented manual-rotation reason. Closes the orphaned-"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# Snapshot of OneCLI dev vault (10256) — every secret either auto-refreshed or has a documented manual-rotation reason. Closes the orphaned-secret class of bugs (e.g. a043b2b3 stayed empty for weeks).

OneCLI dev vault (port 10256) audit 2026-06-01. **15 secrets, 10 auto-refreshed every 30min by `/home/ubuntu/haaggarwal/refresh-gh-tokens-dev.sh`, 5 intentionally manual.**

**Why this matters:** before today, `a043b2b3` (`/szihs/slang.git/*`) was created but never wired to the refresh loop. It stayed empty for weeks; coworker pushes to szihs/slang silently failed with "Invalid username or token." The audit closes that class of orphan.

## The 10 auto-refreshed secrets

| Secret ID | Host / path | Install ID | Format | Used by |
|---|---|---|---|---|
| `6095bdd0` | api.github.com `/repos/shader-slang/*` | 122982130 | bearer | gh api / SDK calls on shader-slang repos |
| `434a0755` | api.github.com `/graphql` | 122982130 | bearer | GraphQL queries (ProjectsV2, etc.) |
| `044ada7d` | api.github.com `/repos/shader-slang/slang-skills*` | 122982130 | bearer | gh api on slang-skills repo |
| `ec24a81e` | api.github.com `/repos/slang-coworkers/*` | 123550981 | bearer | gh api on slang-coworkers repos |
| `637593ed` | api.github.com `/_disabled_2026-05-21/*` | 123550981 | bearer | DISABLED (pathPattern parked in no-match prefix; was shadowing /graphql) |
| `5b162e39` | github.com `/shader-slang/slang.git/*` | 122982130 | basic | git push to shader-slang/slang |
| `e1d49377` | github.com `/shader-slang/slangpy.git/*` | 122982130 | basic | git push to shader-slang/slangpy |
| `b37ad8e6` | github.com `/shader-slang/*` | 122982130 | basic | git fetch/clone shader-slang repos |
| `81055907` | github.com `/slang-coworkers/*` | 123550981 | basic | git push/clone slang-coworkers repos |
| `a043b2b3` | github.com `/szihs/slang.git/*` | 122269597 | basic | **NEW 2026-06-01** — git push to szihs/slang fork (coworker fork-PR flow) |

## The 5 manually-managed secrets (intentional)

| Secret ID | Host / path | Why no refresh |
|---|---|---|
| `1312a45c` | api.github.com `/_disabled_2026-05-27/*` | **Disabled** — superseded by 637593ed; pathPattern parked |
| `292f0169` | github.com `/szihs/*` | **Manual human PAT slot** — orchestrator-only (mode=all), holds a human-szihs fine-grained PAT with `workflow` scope. Refresh disabled because installation tokens don't carry `workflows` permission and would silently break workflow-file pushes. Rotate manually when PAT expires. See `project_szihs_pat_path_routing.md`. |
| `0390e02d` | discord.com (any path) | Static Discord bot token from the developer portal — Discord doesn't issue rotating tokens for bot apps |
| `9557fbce` | inference-api.nvidia.com (any path) | Anthropic-dev API key for NVIDIA inference proxy — manually provisioned, no rotation cycle |
| `3501d9ba` | inference-api.nvidia.com `/v1/responses*` | CODEX endpoint key — manually provisioned alongside 9557fbce |

## Audit invariant

Every secret in the vault must have **one of three justifications**:

1. An `update_secret …` line in `/home/ubuntu/haaggarwal/refresh-gh-tokens-dev.sh` (auto-refresh)
2. A documented manual-rotation reason matching one of the patterns above
3. **REMOVED** — if neither of the above applies, the secret is orphaned and should be deleted, not left to accumulate

## How to re-run this audit

```bash
# Vault inventory
ONECLI_API_HOST="http://172.17.0.1:10254 (NOTE: dev vault was :10256; prod is :10254)" curl -sS "http://172.17.0.1:10254 (NOTE: dev vault was :10256; prod is :10254)/api/secrets" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); s=d if isinstance(d,list) else d.get('secrets',[]); [print(f\"{x.get('id','')[:8]} {x.get('hostPattern','') or '(none)'} {x.get('pathPattern') or '(none)'} | {x.get('name','')}\") for x in sorted(s, key=lambda y: ((y.get('hostPattern','') or '')+(y.get('pathPattern','') or '')))]"

# Refresh-script coverage
grep -E "^update_secret " /home/ubuntu/haaggarwal/refresh-gh-tokens-dev.sh | grep -oE '[a-f0-9]{8}-[a-f0-9-]+'
```

Run this audit any time someone touches the vault (creates a new secret, changes pathPattern). Catches orphans before they bite weeks later.

## Related

- [[project_szihs_pat_path_routing]] — the 292f0169 manual PAT, why orchestrator-only
- [[project_onecli_match_priority]] — pattern-priority quirks; null-path catch-all behavior
- [[reference_onecli_injection_modes]] — how the gateway actually injects (header-only, no env-var injection)

