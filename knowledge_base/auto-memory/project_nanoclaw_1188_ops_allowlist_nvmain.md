---
name: project_nanoclaw_1188_ops_allowlist_nvmain
description: "nanoclaw#1188 nv-main owns ops/ — follow-up to #1187 whose guard failed and was RIGHT. Reviewed inline, no blocker, merged 07:26 mid-review. 2 pre-existing findings: bare-basename patterns claim ANY depth (26 of them; container/agent-runner/package.json = live false drift on nv-slang+nv-dashboard) and the guard is advisory (ruleset has NO required_status_checks) so #1187 recurs."
metadata:
  node_type: memory
  type: project
  originSessionId: 2503fd69-3e7a-4976-af14-ad6b406ec378
---

# `slang-coworkers/nanoclaw#1188` — "nv-path-guard: nv-main owns ops/"

Author **szihs** (human), base `nv-main`, branch `ops-allowlist`, head **`5d9f9106`**.
1 file +14/−0 (`.github/nv-path-guard/nv-main.txt`, adds `ops/**` + comment block).
**MERGED `0459559e` at 07:26 UTC — 4 min after opening, ~10 min before my review landed.** All four
checks green (`guard`/`check`/`ci`/`label`). Comment **`5250322743`**.

**ROUTING: handled INLINE by Main (~31st instance)** — nanoclaw platform-infra fork, no nanoclaw
approver wired; the `pr_ready_for_review` webhook's generic *"route to the project's `*-pr-approver`"*
string is overridden. See [[project_nanoclaw_pr874_webhook_route_approver]].

## Verdict: correct, minimal, classification argument holds. No blocker.

Predecessor **#1187** (`594996e9` → merged `0eaba42d`, 07:20) added the first `ops/` tree
(`ops/README.md`, `ops/grafana/nanoclaw-coworkers.json`, `ops/metrics/nanoclaw-metrics.py`,
`ops/metrics/nanoclaw-metrics.service`). Its `check` run **failed** (run `31467835554`, workflow
`.github/workflows/nv-path-guard.yml`) and merged anyway.

## Reproduced with the real matcher, both directions

Ran `ownership.py` from `origin/nv-main` over **#1187's file set taken from the PR files API**, not
the body's quoted text (the body could have been transcribed):

| allowlist | violations on #1187's set |
|---|---|
| `nv-main` pre-PR (`0eaba42d`) | the exact 3 the body quotes |
| this PR's `nv-main.txt` | **none** |

`check.py nv-main 5d9f9106` on this PR's own diff → `ok: all 1 changed file(s) match`, rc=0.

⭐**Why 3 and not 4: `ops/README.md` was ALREADY owned** — by line 75's bare `README.md`. That
detail is the entry point to Finding 1.

- **No branch claimed `ops/` before this.** grep for a non-comment `ops` line across all 5
  allowlists × 6 branches → **0 hits**. Cross-product of all 5 allowlists against #1187's files:
  only `nv-main`, only `ops/README.md`.
- **`ops/**` is rooted — control with it as the SOLE pattern:** `ops/x.py` owned; `src/ops/x.py`,
  `container/ops/y.json`, bare `ops`, `opsx/a.py` all NOT owned.
- **Nothing downstream changes today:** `ops/` exists only on `nv-main` (4 files); 0 on all five
  overlays, and none of them contains nv-main's tip.
- **nv-dashboard exclusion checks out on ARTIFACTS not names:** `nv-dashboard.txt` matches none of
  the `ops/` files; `dashboard/**` and `ops/grafana/**` are disjoint.

## 🟡 Finding 1 (PRE-EXISTING) — bare-basename patterns claim ANY depth, and one already false-drifts

**26** patterns in `nv-main.txt` are bare basenames (`package.json`, `tsconfig.json`, `CLAUDE.md`,
`.gitignore`, `README.md`, …). gitwildmatch matches those at any depth. Control: sole pattern
`README.md` owns `README.md`, `ops/README.md` **and** `src/deep/README.md`.

They claim **8–14 nested files per overlay** (nv-slang 14, nv-coworkers 10, nv-nanoclaw 9,
nv-slangpy 9, nv-dashboard 8). Of those, exactly one genuinely differs from nv-main:

```
nv-slang:     container/agent-runner/package.json   DIFFERS
nv-dashboard: container/agent-runner/package.json   DIFFERS
```

⇒ `scripts/check-nv-owned-drift.sh` sees owned + present-on-ref + differing = **reports a silent
revert and prescribes `git checkout origin/nv-main -- <file>`**. That file is the container's own
Bun package tree (**not** the pnpm workspace) — restoring it from nv-main is the wrong action.
Live false positive today, worked around only by knowing to pass `--allow`. Fix = **anchor** the
root-only patterns (`/package.json`), not add allowlist entries.

## 🟡 Finding 2 (CONFIRMED, unchanged here) — the guard is advisory, so #1187 recurs

Body claims the check "is not required". Verified: `nv-main` has **no branch protection** (404), and
ruleset **`15709946` "Protect nv-* branches"** (`refs/heads/nv-*`, active, 0 bypass actors) carries
exactly one rule — `pull_request` with `required_approving_review_count: 0` and
**no `required_status_checks`**. A red path guard blocks nothing. This PR fixes the one directory;
the mechanism (new top-level dir → guard red → merges anyway → ownership hole) is untouched.

## Clean

No trailing whitespace on the added lines; file ends with a newline. Comment block is accurate about
what it records.

**RESUME** = watch for (a) a PR anchoring the bare-basename patterns — re-run the nested-claim count
per overlay and the DIFFERS check on `container/agent-runner/package.json`, and (b) any change adding
`required_status_checks` to ruleset `15709946`. Related: [[project_nanoclaw_1151_ownership_matcher_git]],
[[project_nanoclaw_1083_drift_check_empty_allowlist]], [[project_nanoclaw_1116_one_allowlist_resolver]].
