---
type: project
title: "Deterministic GitHub identity routing in lego dev OneCLI vault (:10254 (NOTE: dev vault was :10256; prod is :10254)) — three identities, t"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# Deterministic GitHub identity routing in lego dev OneCLI vault (:10254 (NOTE: dev vault was :10256; prod is :10254)) — three identities, three tiers, single catch-all

Lego dev (`http://172.17.0.1:10254 (NOTE: dev vault was :10256; prod is :10254)`) routes GitHub calls across **three identities** to **distinct domains**. Cleaned up 2026-05-21:
- Demoted shadow-bot null catch-all (per `[[project_onecli_match_priority]]`)
- Consolidated szihs onto a single classic PAT with `repo, workflow, read:org, read:project, read:user`
- Pruned 4 redundant secrets (15→11) covered by broader patterns: `/repos/szihs/{slang,slangpy}/*` (covered by `(null)` catch-all), `/szihs/{slang,slangpy}.git/*` push (covered by `/szihs/*`)

**Why:** `viewer{login}` returned `nv-slang-bot[bot]` despite a path-exact `/graphql` → szihs PAT secret existing. OneCLI's null-path catch-all overrides path-specific routes — the old setup had two `(null)` catch-alls fighting, and the bot one usually won. Result: every ProjectsV2 query failed with "lacks read:project scope" because the bot install token was being injected, not the szihs PAT.

**How to apply:** When an agent reports the wrong GitHub identity is being used (most often "viewer is bot when I expected szihs", or "Resource not accessible by integration" on a member-only endpoint), check there's only **one** `(null)` catch-all on `api.github.com`. Add path-specific Tier 1/2 secrets for any bot-identity action; never rely on a bot catch-all.

## The three identities

| Identity | Secret IDs | Used for |
|---|---|---|
| **szihs PAT** (graphql, classic, with `read:project`) | `434a0755-…` (path `/graphql`), `1312a45c-…` (catch-all) | Project boards, member reads, fallback for misc REST |
| **nv-slang-bot install** (App, install 123550981 = slang-coworkers) | `ec24a81e-…` (REST), `81055907-…` (push) | All slang-coworkers/* — PRs, comments, REST |
| **shader-slang App install** (App, install 122982130) | `6095bdd0-…` (REST), `b37ad8e6-…` (push) | shader-slang/* org reads + push (non-szihs/slang specific paths) |

Plus path-specific szihs PAT secrets for shader-slang/slang, shader-slang/slangpy, szihs/slang, szihs/slangpy (REST + push).

## Routing tiers (highest specificity wins, but null-catch-all overrides path-specific — so keep one catch-all only)

**Tier 1 — exact paths:**
- `/graphql` → szihs PAT
- `/repos/shader-slang/slang/*`, `/repos/shader-slang/slangpy/*` → szihs PAT
- `/repos/shader-slang/slang-skills*` → szihs-private-repos PAT
- `/repos/szihs/slang/*`, `/repos/szihs/slangpy/*` → szihs PAT (own forks)
- `/repos/slang-coworkers/*` → bot install (slang-coworkers, 123550981) — **activated 2026-05-21 from `_unused_*`**

**Tier 2 — broader org paths:**
- `/repos/shader-slang/*` → shader-slang App install (122982130)
- `/shader-slang/*` (push) → shader-slang App install
- `/slang-coworkers/*` (push) → bot install (slang-coworkers) — **activated 2026-05-21**
- `/szihs/*` (push) → szihs PAT

**Tier 3 — single catch-all:**
- `(null)` on api.github.com → szihs PAT (`1312a45c-…`)

## Disabled / parked

- `637593ed-…` "GitHub (nv-slang-bot catch-all)" — demoted 2026-05-21 from `(null)` to `/_disabled_2026-05-21/*` (never matches). Refresh script still updates the value (targeted by id), so it can be re-activated by flipping the path back. Don't delete outright — refresh script line targets this id and would log errors.

## Verification probes

```bash
# /graphql → szihs
ONECLI_API_HOST="http://172.17.0.1:10254 (NOTE: dev vault was :10256; prod is :10254)" onecli run -- curl -sS -X POST https://api.github.com/graphql \
  -H "Content-Type: application/json" -d '{"query":"query{viewer{login}}"}'
# expect: {"data":{"viewer":{"login":"szihs"}}}

# /user → szihs
ONECLI_API_HOST="http://172.17.0.1:10254 (NOTE: dev vault was :10256; prod is :10254)" onecli run -- curl -sS https://api.github.com/user
# expect: login=szihs, type=User

# /repos/slang-coworkers/nanoclaw → bot install
ONECLI_API_HOST="http://172.17.0.1:10254 (NOTE: dev vault was :10256; prod is :10254)" onecli run -- curl -sS https://api.github.com/repos/slang-coworkers/nanoclaw
# expect: full_name=slang-coworkers/nanoclaw, perms vary by install
```

Run these whenever an agent reports wrong-identity errors — quick sanity check before deeper debugging.

## Refresh script

`~/haaggarwal/refresh-gh-tokens-dev.sh` (cron every 30 min). The 637593ed entry can stay (still keeps token fresh, harmless on a non-matching path) — or remove it for cleanliness. Both fine.

