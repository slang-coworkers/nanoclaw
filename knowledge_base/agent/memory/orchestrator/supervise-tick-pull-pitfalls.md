---
type: runbook
description: Pitfalls in the /supervise-issues tick pipeline — pull/cache keys, state merging, CI cells, GitHub API quirks, and worktree GC — each with the tick that hit it and the fix. Split from the tick runbook 2026-10-18.
---

# /supervise-issues tick pitfalls (pull, state, CI, GitHub, worktree GC)

Procedure: [[orchestrator/supervise-tick-runbook.md]]. Outage modes: [[orchestrator/supervise-tick-degraded.md]].

## Pull and cache

- **Cache keys must compare SORTED session lists.** Stored lists are in pull order; comparing to `sorted(...)` misses
  almost every chain. Bit `refetch_lo.py` (tick 269: 530 re-fetches instead of 27) and `pull.sh:594` (tick 271: timed
  out at 1800/1876). Both fixed (`sorted(x or [])`) and carried in the copied helpers. If a pull is <50% after 5 min,
  check the cache hit rate before waiting it out.
- **`pull.sh` can drop last-outbound** (tick 267: `None` for 31 of 53 re-fetched chains) — runbook step 3 repairs it.
  `refetch_lo.py` / `refetch_none.py` crash at the final `json.dump` without an output arg (tick 284).
- **A GraphQL 5xx silently strips a repo batch.** `pull.err` showing `HTTP 504` → `graphql fallback for <repo> batch N`
  left `pr`/`comments` empty on 50 rhi chains (tick 278: 2 false nudges + 3 false escalations). Grep `pull.err` for
  `HTTP 5`/`fallback` and compare per-repo `with pr`/`with comments` counts against the previous payload3. Fix: confirm
  nothing moved (`gh api repos/<o>/<r>/issues?state=all&since=<prev tick>`), carry the previous fields forward for that
  repo (`payload3r.json`), re-scan.

- **`ncl sessions messages` truncates every row to 300 chars unless `--full` is passed** — hold reasons and operator asks get cut mid-sentence. `tick305/msgs.py` passes `--full`. Any `ncl` call made while `pull.sh` is running fails with `database is locked`; do GitHub-only checks (auto-merge sweep, closed-since) during the pull instead (tick 305).

## State

- **scan's `delta=updated` overcounts** when a cache refresh moves stamps backwards (tick 269: 59 raw → 20 real). Filter
  real updates by activity after the previous pull's start (`real-why.json`). It can also be entirely real (tick 276).
- **Merge state key-by-key:** scan's `state` drops closed chains, so after writing it back, re-add every pre-tick key
  the scan omitted (tick 284: 9 closed keys would have been lost).
- **Not every state value is a dict:** `gh-issue-shader-slang/slang-12432_note` is a bare string, so a key-by-key merge that does `dict(old).update(new)` crashes. Merge dicts, assign anything else verbatim (tick 306).
- **New-chain diff must union `_archived`.** State has ~830 top-level keys plus ~1,260 in `_archived`; diffing threads
  against top-level keys alone reports ~1,250 false "new" chains. Sub-thread sessions (`…-<n>/<suffix>`) need a
  `subthread:` journal entry by hand — scan never creates one (tick 288).

## CI cells

- **`ci.py` merge=UNKNOWN is GitHub computing mergeStateStatus lazily**, not a change (tick 278: 207 rows flipped, ⤵️
  dropped). When the run id is unchanged, carry the prior cell and merge state.
- **A tracked CI run can 404** (GitHub purged runs created ~10-01T20:05Z→10-07T22:25Z; 30 open PR heads had 0 check
  suites as of 10-12). `ci.py` then falls back to an older cancelled run → `❌(recheck)`. Check the PR's
  `statusCheckRollup` is empty before treating it as a rebase-nudge case.
- **A ✅ cell can come from a filter-only dispatch** (#12749: 2 success + 48 skipped). Check the job breakdown before
  reading ✅ as "built and tested" (tick 290).
- **Draft bot-PR CI is deadlocked, not slow.** `ci-retry-yielded-bot` (the real name; `retry-yielded-bot-ci.yml`
  matches nothing) logged "CI is still active (83–107 runs)" on ~98 of 100 fires since 10-15, because ~88 runs sit
  `waiting` on `falcor-build-approval-gate`. A fixer holding its Fix Report "until the retry re-runs CI" waits forever,
  and scan reads it as `awaiting_human` (#13716). Any coworker claim that the retry will re-run a `waiting` run is
  false while the deadlock holds — correct it on the board. Classify the helper's decision lines
  (`gh run view <id> --log`) before trusting a ⏸️ yield to self-heal (ticks 288, 290).

## GitHub API

- **`gh api rate_limit` → OneCLI `app_not_connected` is not an outage.** Probe with `gh api -i repos/shader-slang/slang`
  (`X-Ratelimit-Limit: 6000`) + `gh api graphql -f query='{viewer{login}}'` before reporting auth trouble (tick 284).
- **Auto-merge sweep / closed-since without GraphQL search:** the org-wide GraphQL `search` 502s intermittently; use
  REST `repos/shader-slang/<r>/pulls?state=open&per_page=100&page=N` filtered on `.auto_merge!=null` (**5 pages** for slang — 445 open PRs at tick 292; 3 pages missed the armed #10769/#10098 on page 4),
  and `gh search issues --owner shader-slang --closed '>=<date>' --include-prs` (raw `gh api search/issues?q=…closed:>=`
  returns empty JSON).

## Worktree GC

- **Build `wt-dirs.txt`** with `find /workspace/extra/ephemeral/prod-groups -maxdepth 3 -mindepth 3 -name .git -type f`
  (worktrees sit at `prod-groups/<folder>/<wt>/.git`; `-maxdepth 2` finds 0 — tick 280). Drop submodule `.git` files
  (gitdir containing `/modules/`), and re-filter to paths whose `.git` still exists right before `gc_resolve.py` — it
  crashes if a worktree vanishes mid-tick (tick 289, `slang-triager/wt-13603-bisect`).
- **`worktree-gc.py` reads stdin only** (`--in` is ignored; it hangs). Build the payload from `wt-resolved.json`'s `path`
  field, not `dir` (the basename — every size lookup missed).
- **The payload since tick 280 omits `kind`/`idle_days`.** Without them only closed/merged trees are reaped (12 at tick
  290); with them (`kind` from the `wt-<repo>[-pr]-<n>` name, `idle_days` from dir/build mtimes) scratch trees idle > 2 d
  go too (45). Open question: decide once which input is right before comparing tick-to-tick counts.
- Common REAP shape: merged-PR reviewer worktrees (`wt-<pr>-verify/-revA/-base/-master`), owned by the reviewer
  session on the chain whose `pr.number` matches (or the `slang-ci-nightly-*` thread for nightly-PR chains).
