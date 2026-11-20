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
  repo (`payload3r.json`), re-scan. Compare `pr` counts against the previous **payload1** (prfix/botbind add ~20 PRs in payload3), and find the stripped set as chains whose previous payload1 had comments/pr and this one has none (tick 326: 41 contiguous #12909–#12962; carried pr/comments/our_last_push/issue_open, re-fetched the 1 that moved).

- **Build `lo-cache.json`/`prev-la.json` before launching `run-pull.sh`** — they are not among the copied helpers; a missing
  `lo-cache.json` makes `pull.sh` die at its line-83 `open()` after the cost-cap stamp (~1 min lost, tick 333).
- **`payload3.json` `chains` is a dict keyed by thread** (no `key` field; `sessions` is a list of ids) — build `lo-cache.json` as `{thread:{ts:our_last_outbound,text:last_outbound_text,sess:sessions}}`. Include **every** chain, also those with `ts: null` — `pull.sh:594` reuses an entry only on a key hit, so dropping the null ones turns ~1,300 chains into `ncl` cache misses (tick 324 caught it before launch).
- **The mid-tick `ncl sessions list` re-list can come back empty** (0-byte stdout, exit 0) — `moved.py` then dies on `json.load`. Retry until the file is non-empty (tick 307).
- **`ncl sessions messages` truncates every row to 300 chars unless `--full` is passed** — hold reasons and operator asks get cut mid-sentence. `tick305/msgs.py` passes `--full`. Any `ncl` call made while `pull.sh` is running fails with `database is locked`; do GitHub-only checks (auto-merge sweep, closed-since) during the pull instead (tick 305).
- **Relayed posts in the dashboard session are stored cut to ~500 chars even with `--full`** (tick 319: the 08:44Z maintainer relay ended mid-sentence). Find the sending Main session by `last_active` near the post time and read its own `out` row with `--full`.

- **A predecessor tick that died mid-pull (tick 354: 0-byte payload1, session death 12:06Z) does not corrupt the next tick** — `memory/supervisor-state.json` stays at the last COMPLETED tick's final state, which is exactly the right pre-tick snapshot. Build `lo-cache.json` from the last completed tick's `payload3.json` (tick 353's, not the dead tick's), and `prev-la.json` from the dead tick's `sessions.json` if it got that far (fresher). Check the previous tick dir for `pull.done`/nonzero `payload1.json` before trusting it (tick 355).
- **If `pull.sh` ran with the `--state` file missing (tick 355: a `cp` landed in the default cwd), the payload comes back with `state: {}` and no disposition rehydration — do NOT re-pull.** The state file's only two uses in pull.sh are the `payload['state']` key and per-chain `disposition` rehydration (pull.sh ~line 606). Post-hoc: inject the pre-tick state into `payload['state']` and copy each chain's `disposition` from it, then continue the pipeline. Verify the save with 0 dropped keys vs pre-tick (the usual guard still applies).

## Harness + helper plumbing (ticks 343, 345)

- **Tick 345: `bgA.sh` (runs.py → ci.py) races the disposition pass.** ci.py reads `payload5.json` + `scan-out3.json`, which only exist after the mid-tick disposition re-run (`apply_disp.py payload2b → payload5` + scan). Launching the CI background job right after `pull.done` makes ci.py die on FileNotFoundError (exit 1 in `ci.done`) and it must be re-run. Launch bgA only after payload5/scan-out3 exist, or make bgA wait for `payload5.json`.

- **Copied helpers hardcode the PREVIOUS tick's paths**: `runs.py` wrote `runs.json` to `/workspace/agent/tick342/runs.json` (tick 343: it overwrote the old tick's cache and `ci.py` then died on a missing local `runs.json`). Grep the copied `*.py`/`*.sh` for `tick<N-1>` and fix every hit before running.
- **`run_in_background: true` is still killed at the default 120 s timeout in this harness** (tick 343: pull died mid-run at 120 s, 0-byte payload1). Pass an explicit large `timeout:` with it, or run long steps in the foreground with a 600 s cap and a done-marker file.
- **`cd X && (…) & (…) & (…) & wait` binds the `cd` to the FIRST background job only** — bash parses `cd X && (…) &` as one background job; the other subshells run in the original cwd (tick 343: titles/GC subshells ran in `/workspace/agent`, created stray `*.done`/`wt-dirs*` files there and died on script paths). Put an explicit `cd` INSIDE every subshell, or run the steps sequentially.
- **Never swap `payload['sessions']` for the raw `ncl sessions list` re-list.** The pull's session list is stamped (`cost_status`, `group_folder`); the raw list has neither, so scan misclassifies en masse (tick 343: 37 false `awaiting_us` nudge rows, 2 false escalates, cost_stopped count 0→wrong). Use the re-list only to (a) diff for brand-new canonical threads, (b) feed `blind.py`/`moved.py`, and (c) recover a missing session's id when hand-journaling a mid-tick chain — via a minimal chain record, never a sessions swap.
- **`refetch_none.py` can exceed the runbook's 90 s window** (tick 364, 10,451 sessions: first run exit 124 with no output file; a 300 s retry fixed 0 and finished). Retry once with `timeout 300` before treating it as broken; a clean run with `fixed 0` means the lo-cache already covered everything.

## State

- **scan's `delta=updated` overcounts** when a cache refresh moves stamps backwards (tick 269: 59 raw → 20 real). Filter
  real updates by activity after the previous pull's start (`real-why.json`). It can also be entirely real (tick 276).
- **Merge state key-by-key:** scan's `state` drops closed chains, so after writing it back, re-add every pre-tick key
  the scan omitted (tick 284: 9 closed keys would have been lost).
- **A Main session can edit an existing key's `disposition` mid-tick, and scan's `state` silently reverts it** — scan copies the disposition from the pre-tick state, so `out[k].update(scan[k])` overwrites the live edit (tick 335: #14053's 12:00Z ready-flip disposition). Merge onto the live file, then for every key where live ≠ pre-tick, re-apply the live fields that changed.
- **Not every state value is a dict:** `gh-issue-shader-slang/slang-12432_note` is a bare string, so a key-by-key merge that does `dict(old).update(new)` crashes. Merge dicts, assign anything else verbatim (tick 306).
- **A Main session can journal a new chain into `supervisor-state.json` between ticks** (tick 331: #14398 written 03:30Z with a disposition). scan then reports it `updated`, not `new`; diff the state's keys against the previous tick's `state-final.json` and count such keys as 🆕 (force it with a 🆕 `notes.json` entry).
- **When building the board message, append the 🔼 rows to the 🆕 table with no blank line in between** — a blank line ends the markdown table and the 🔼 rows render as raw pipes (caught before sending, tick 331).
- **New-chain diff must union `_archived`.** State has ~830 top-level keys plus ~1,260 in `_archived`; diffing threads
  against top-level keys alone reports ~1,250 false "new" chains. Sub-thread sessions (`…-<n>/<suffix>`) need a
  `subthread:` journal entry by hand — scan never creates one (tick 288).

## CI cells

- **`ci.py` merge=UNKNOWN is GitHub computing mergeStateStatus lazily**, not a change (tick 278: 207 rows flipped, ⤵️
  dropped). When the run id is unchanged, carry the prior cell and merge state.
- **`ci.py` can pick a yielded bot `workflow_dispatch` over the PR's own `pull_request` run** (#13880, ticks 312–313: cell ⏸️ from run 40725539917 while the PR rollup was 58 SUCCESS / 7 SKIPPED). For an approved PR whose cell is ⏸️/❌, read `gh pr view --json statusCheckRollup` and override the cell in `ci.json`.
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
  (`gh run view <id> --log`) before trusting a ⏸️ yield to self-heal (ticks 288, 290). Re-measured
  11-18 00:14Z: "still active (**230** runs)"; the 11-17 base-refresh batch alone left ~10 fresh
  zombie `workflow_dispatch` runs (fix/issue-13534/-13800/-14292/-13348/-14430/-13833/-14524/
  -14518/-14557 + -13858). Disposition per #13126/#13864: the owning fixer **cancels** its zombie
  run — cancelled ⇒ `failed_only_because_priority_gate`=False ⇒ never re-picked, and one fewer
  guard-tripper for everyone. #13858's check loop (9 hourly re-checks waiting on the rerun,
  11-17/18) is the failure mode in action: terminate such loops with this fact, don't re-arm.
  **All 10 cancelled 11-18 (Main-verified; 0 waiting dispatch runs left)** — but every new bot
  draft-testing dispatch recreates one, so re-check on refresh batches. Sweep gotcha: a per-branch
  `gh run list --limit N` can be all newer `pull_request` runs while an older `waiting`
  `workflow_dispatch` run sits outside the window — filter on `event==workflow_dispatch` (bit the
  fixer's sweep 11-18; learning in shared/learnings/ag-1780667166439-vmjrwe/1794961760356-*).

## GitHub API

- **`gh api rate_limit` → OneCLI `app_not_connected` is not an outage.** Probe with `gh api -i repos/shader-slang/slang`
  (`X-Ratelimit-Limit: 6000`) + `gh api graphql -f query='{viewer{login}}'` before reporting auth trouble (tick 284).
- **Auto-merge sweep / closed-since without GraphQL search:** the org-wide GraphQL `search` 502s intermittently; use
  REST `repos/shader-slang/<r>/pulls?state=open&per_page=100&page=N` filtered on `.auto_merge!=null` (**6 pages** for slang — 544 open PRs at tick 333, 445 at tick 292; 3 pages missed the armed #10769/#10098 on page 4),
  and `gh search issues --owner shader-slang --closed '>=<date>' --include-prs` (raw `gh api search/issues?q=…closed:>=`
  returns empty JSON).
- **Armed-PR mergeable check — GraphQL field names (tick 347):** `PullRequest.mergeableState`, `AutoMergeRequest.state`
  and `AutoMergeRequest.enabledMethod` do NOT exist; the working query is `mergeable mergeStateStatus reviewDecision
  isDraft autoMergeRequest{mergeMethod}`. **Simpler one-call sweep (tick 376):** `gh pr list -R shader-slang/slang --state
  open --limit 400 --json number,autoMergeRequest,mergeStateStatus` returns armed PRs directly (`autoMergeRequest != null`
  = armed, with `enabledAt`/`enabledBy`/`mergeMethod` inside) — no REST pagination, no GraphQL; retry once on an HTTP 502.

- **`ncl pr-mappings list` returns only 200 rows by default** — pass `--limit 10000` (1,069 rows at tick 337). Tick 336's
  `prmap.json` was truncated, so `deliv.py` missed mappings for older PRs.
- **`gh api --paginate` on `actions/runs` (and on `pulls?state=open`) gets a OneCLI 401 `app_not_connected` from page 2 on** (the Link header points at
  `/repositories/<id>/…`, which the gateway does not credential). The error JSON lands in stdout and the count stops at 100.
  Page by hand with `&per_page=100&page=N` and cross-check `total_count` (tick 317: 159 `waiting` runs, not 100).

- **A `gh api … --jq` filter containing `pull_request!=null` is refused by a PreToolUse hook** ("Blocked by hook"; tick 339,
  three calls lost). To tell an issue from a PR, use `gh pr view <n> -R <o>/<r> --json number,author,state,isDraft` (it errors on an issue).

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
- **Read the free-space trend from a tier's `.worktree-gc/history.log`, not one `df`** (tick 324: 681→232 GB in 12 h, 9.4% at 00:07Z, 313 GB at 00:2xZ; every tier reaped 0). The tier GC only covers the six prod tiers: `eval-slang-*` groups have no worktree-gc task, and `eval-slang-reviewer` alone held 328 GB. `du -sh prod-groups/*` names the consumer; that goes to the operator, since the supervisor never reaps.
- Common REAP shape: merged-PR reviewer worktrees (`wt-<pr>-verify/-revA/-base/-master`), owned by the reviewer
  session on the chain whose `pr.number` matches (or the `slang-ci-nightly-*` thread for nightly-PR chains).

- **The copied `bg*.sh`/`run-pull.sh` batch scripts hardcode `cd /workspace/agent/tick<NNN>` of the tick they were written in** (measured tick 356, 2026-11-17: bgall.sh still said `cd tick355`, so runs/ci/titles/gc wrote fresh outputs into the PREVIOUS tick's dir — harmless, but the new tick found no ci.json and tick355's intermediates were clobbered). After copying helpers, `sed -i '1s|.*|cd "$(dirname "$0")"|' bg*.sh run-pull.sh ghfeeds.sh` (tick 356 already fixed its copies, so ticks ≥357 inherit the relative form). Also `setsid` background launches survive tool-call timeouts, but a launch call killed inside its first ~15 s can take the child with it — after launching, verify the PID is alive before waiting on the done-files.
