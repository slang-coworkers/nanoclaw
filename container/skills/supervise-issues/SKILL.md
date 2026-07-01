---
name: supervise-issues
license: MIT
description: Periodic supervisor for in-flight GitHub issue chains. Lists active issue sessions, computes stuck-time, nudges silent chains, checks each PR's CI and nudges the fixer to rebase master when a run is stale or behind, verifies a resumable GitHub artifact exists for every chain, and escalates blockers to the operator. Self-scheduled on a 12-hour cron via schedule_task.
---

# /supervise-issues — Issue chain supervisor

You are the orchestrator (or a coworker it delegated supervision to). Every tick, walk all
in-flight issue chains, find the stuck ones, and nudge or escalate. Designed to run on a recurring
`schedule_task` (suggested cron `0 */12 * * *`, fresh session each tick).

Lookup tables, command snippets, and the rationale behind each rule live in
[reference.md](./reference.md). This file is the rules and the procedure.

## What "in-flight" means

A chain is in-flight when you hold a session whose `thread_id` is `gh-issue-<owner>/<repo>-<num>`
and the issue is still open with no merged fix. A chain is real **whether or not it produced a PR
of ours** — many resolve at triage and are then driven by an external contributor, a maintainer, a
human design debate, or a self-close. `thread_id` names the chain, not the work product: a
coworker session is reused across issues, so never infer a chain's PR (or which issue a PR fixes)
from `thread_id`. Resolve the real PR with `gh` (see reference.md → *Resolving a chain's real PR*).

## Core rules

These hold across every step below; the steps reference them by number rather than restating them.

- **R1 — Discover live every tick.** The chain universe is `ncl sessions list --limit 10000 --json`
  filtered client-side to `thread_id` starting `gh-issue-` (the default limit is 200 which silently
  truncates — `--limit 10000` is mandatory; there is **no** `--thread-prefix` flag — `ncl` silently
  ignores unknown flags and returns *all* sessions, so the prefix filter MUST happen in your pipe;
  see reference.md → *Live discovery + the scan script*), unioned with the keys in
  `supervisor-state.json`. The tracker and state JSON are the *prior snapshot* (for deltas), never
  the list of chains. Any `gh-issue-` session not already journaled is a 🆕 NEW chain to add this
  tick. Hand the per-chain payload to `scripts/scan.py` for the deterministic classification
  (NEW-set math, the by-us activity clock, ball-direction, PR↔issue resolution) — the rules that
  kept getting re-derived wrong are now tested code.
- **R2 — Dedup on keys, not prose.** "Already journaled" means a top-level or `_archived` *key*
  exists for the chain. An issue number appearing somewhere in narrative text does not count.
  Compute novelty as a set operation on keys: `NEW = {live gh-issue threads} − {top-level keys} −
  {_archived keys}`. An "awareness: session pending" note never becomes a key — re-evaluate it
  every tick and promote it the instant a session exists.
- **R3 — Every chain needs a resumable GitHub artifact, at all times.** An open PR, a comment on
  the PR, or a comment on the issue — something a human can land on and pick up from, whether the
  chain is in progress or parked. For a no-PR chain the artifact is its triage/review comment and
  its disposition rides in the `next` field (see reference.md → *No-PR chain dispositions*). A
  chain you can give neither an artifact nor a disposition is the loudest thing in your report.
- **R4 — "Activity" means activity by us.** Stuck/silent clocks measure `last_activity_by_us` (our
  outbound, our commit/push, or a bot comment/review). A human comment, maintainer review, or CI
  event *starts* our responsiveness clock; it never resets it.
- **R5 — Route by `thread_id`, never `in_reply_to`.** Set `thread_id="gh-issue-<owner>/<repo>-<num>"`
  on every nudge/dispatch and add nothing else. `in_reply_to` overrides `thread_id` and can land
  the message in a reused session for a different issue. One `<message>` per chain on its canonical
  key — never a consolidated dump from a thread-less session.
- **R6 — Closest-to-the-state authors; the supervisor enforces, never substitutes.** The coworker
  holding a verdict writes the GitHub comment for it. You verify the comment exists and nudge if it
  doesn't — you do not post it on their behalf.
- **R7 — Deliver once, `to="orchestrator-dashboard"`, verbatim from the on-disk tracker.** One
  session, one complete board, posted as the last step. Inline board first, file second. (A
  delegated supervisor uses `to="parent"`.) See reference.md → *Delivery*.
- **R8 — Never `git worktree remove` from the supervisor session.** Worktrees belong to the
  fixers. Decide the reap set by `gh` issue state + PR state (issue CLOSED → reap regardless of
  PR state) and dispatch the deletion to the owning fixer (a `stopped` session wakes on the
  inbound). Never reap on the `prunable` flag your read-only mount shows.
- **R9 — Read CI yourself; nudge the fixer to rebase, never re-dispatch CI.** The orchestrator
  computes each PR-bearing chain's CI from its own container (`gh` works there) — no dependency on
  the babysitter, which keeps its own separate rerun/eviction job. Our PRs sit in draft and drive
  CI by `workflow_dispatch`, so the signal is the **latest `workflow_dispatch` run per
  `fix/issue-<num>` branch**, not the PR's auto checks. The only remedy you dispatch is
  **rebase/merge master** (re-runs CI on a stable base); you never call `gh run rerun` yourself.
  See reference.md → *CI status + rebase nudge*.

## Procedure

### 1. Build the status table

**Use `scripts/pull-universe.sh` (preferred).** It exhaustively enumerates all `gh-issue-*` sessions
via `ncl --limit 10000`, fetches PR/comments/outbound for each chain via `gh`/`ncl`, filters out
closed issues (skips expensive fetches), and pipes the result directly into `scan.py`:

```bash
bash scripts/pull-universe.sh --state memory/supervisor-state.json \
  | python3 scripts/scan.py > scan-out.json
```

The output `scan-out.json` contains `{rows, summary, state}` — read `rows` for the board, write
`state` back to `memory/supervisor-state.json`. Closed issues appear with minimal data
(`issue_open: false`) so scan.py can archive them; active issues get full PR/comments/outbound.
Report **total** (all chains) and **active** (open issues) counts in the board header.

**Fallback (manual assembly):** if the script fails, discover the universe live (R1) and dedup
against journal keys (R2). For each chain, resolve its real PR with `gh` and confirm the target
issue from the PR body (reference.md → *Resolving a chain's real PR*); if the PR `Fixes` a
different issue than the `thread_id` suggests, record it under the issue the PR actually fixes and
flag the mismatch. Journal no-PR chains too, with their disposition and triage-comment artifact (R3).
For PR-bearing chains, also read the CI cell (R9) and record the latest `workflow_dispatch` run id
(reference.md → *CI status + rebase nudge*). Build one row per chain:
`repo / issue / thread_id / pr / ci / last_activity_by_us / state`.

Compute a delta vs. the snapshot in `supervisor-state.json` and tag each row **🆕 NEW** /
**🔼 UPDATED** (cite what changed) / **• same**. Write fresh snapshots back at the end of the tick.

### 2. Classify each row

For each chain, compute `last_activity_by_us` (R4) and the direction of the ball, then assign a
state from the classification table (reference.md → *Classification states + thresholds*). The
discriminator that matters most: bot spoke last → `awaiting_human` (leave alone); human spoke last
and we haven't answered → `awaiting_us` (stuck now, nudge immediately, regardless of how recent the
human comment is and without waiting for any stale window).

### 2b. CI check (PR-bearing chains)

Read each PR's CI cell (R9) from the latest non-`skipped` CI run for its `fix/issue-<num>` branch
(reference.md → *CI status + rebase nudge* for the exact commands and the full cell legend):

- **⏸️ yielded** — the latest run is a `failure` whose failing job is `wait-for-human-priority`.
  This is an *intentional* yield to human-PR priority, not a real failure, and a dedicated
  `retry-yielded-bot-ci.yml` auto-reruns it. **Show it; never nudge.**
- **⏳ running** / **✅ green** — leave alone.
- **❌ stale** — the latest run is a *real* `failure` (failing job is not the yield gate) or
  `cancelled` (treated the same), **and** it is the *same run id* recorded last tick (nobody
  re-dispatched). A bad run with a newer id was already re-dispatched — do not nudge.
- **✅⤵️ BEHIND** — the run is green and settled but `mergeStateStatus=BEHIND` (main moved on).

For **❌ stale** or **✅⤵️ BEHIND**, nudge the fixer to rebase/merge master (Step 3) — a clean base
re-dispatches CI, which clears external-factor failures and makes the PR ready for review once
state changes.

### 3. Nudge

A nudge is a message back into the assigned coworker's session, not a fresh dispatch — most "silent"
cases are containers that exited mid-task and need a wake. Route by `thread_id` (R5):

```
<message to="<coworker>" thread_id="gh-issue-<owner>/<repo>-<num>">[Supervisor nudge — gh-issue-X/Y-N] No outbound for {duration}. Are you blocked? Reply: status, blocker, ETA. If your container restarted and you lost context, re-read your task memory and resume.</message>
```

CI rebase nudge (from Step 2b — to the fixer, keyed on the chain's thread):

```
<message to="<fixer>" thread_id="gh-issue-<owner>/<repo>-<num>">[Supervisor — CI — gh-issue-X/Y-N] PR #<pr>'s last workflow_dispatch ended <failure|cancelled> and hasn't re-run (likely external: flake/cancel/eviction). main is stable now — rebase/merge master to re-dispatch CI on a clean base. Once it goes green, mark ready for review.</message>
```

Don't open new threads, don't multi-cast, and don't escalate before nudging. If a chain has been
nudged twice with no response, escalate via `ask_user_question` instead of nudging a third time.

### 4. Closing-report rollup

If a chain's deepest tier emitted `[Resolution]`/`[Report]` more than 30 min ago but no upstream
tier rolled it up, send a peer message to the missing tier asking them to roll up. Do not roll up
on their behalf.

### 5. GitHub-comment verification

Before letting any `closing` chain drop off the table, verify its human-observability comment
exists on the originating issue/PR (reference.md → *GitHub-comment existence test*). If absent, the
chain is `closed_no_github_comment` — identify the responsible coworker (closest to the state) and
nudge them to post (R6); track the request and escalate if unmet after 2 nudges.

### 6. Output

Build the canonical 11-column board and deliver it once (R7). The board schema, the session
deep-link rule, and the collapse rules are in reference.md → *11-column board spec* and *Delivery*.
Lead the chat reply with the inline table (🆕/🔼 rows on top, `active: human-debate` never
collapsed), follow with the 5-bullet summary, then optionally attach the tracker file. Every live
chain is a full row in `reports/issue-chain-tracker.md`; collapsing happens only in chat.

### 7. Superseded-PR postmortem

When an issue is closed by a PR that isn't ours, capture the learning — someone solved what we were
working on, possibly better. Fires once per chain. Detect command, gap analysis, `append_learning`,
and draft-close steps are in reference.md → *Superseded-PR postmortem*. Skip for our own merged PRs
and for `not_planned` closes without a PR.

### 8. Worktree GC sweep

Reclaim abandoned fixer worktrees. Run the GC scan every tick *before* the per-chain pass, and
surface `worktree-vol: <N>GB free` in the rollup. Discover the reap set from disk, resolve each to
**both** issue state and PR state (`REAP` = PR merged/closed OR issue closed; `KEEP` = issue open +
PR open/running), and dispatch a save-then-remove to the owning fixer (R8) — never delete from this
session. Escalate to operator when free < 10 GB. Commands and the dispatch body are in
reference.md → *Worktree GC*.

## Scheduling

On first run, schedule yourself. Three cost levers keep ticks cheap: the **12-hour cadence** (issue
chains move on the scale of hours), **`new_session: true`** (each tick starts clean — all durable
state is in `supervisor-state.json`, which is exactly why live rediscovery per R1 is mandatory),
and the **wake gate** (a tick with nothing stuck is a no-op). A tick that does wake reports only
the delta (Step 1).

The gate runs as **bash inside your container** (the agent-runner runs the task `script` via
`bash`, reads the last stdout line as JSON, and wakes the agent only when `wakeAgent` is `true`).
So it uses **`ncl`** (on `PATH` at `/usr/local/bin/ncl`), not a dashboard HTTP endpoint. Do **not**
fetch `http://…:3000/api/sessions/in-flight`: that endpoint does not exist and `:3000` is not the
dashboard port (it varies per instance via `DASHBOARD_PORT`), so the old fetch always failed → the
gate degraded to "wake every tick" (no saving). `ncl sessions list --json` needs no port and no auth.

```js
schedule_task({
  prompt: '/supervise-issues',
  cron: '0 */12 * * *',
  new_session: true,
  script: `
    # Wake only when a gh-issue chain has been silent (by us) for >60 min.
    # ncl is in-container; --json returns {id,ok,data:[...]}. ncl ignores unknown
    # flags silently — there is NO --thread-prefix; filter client-side.
    ncl sessions list --json 2>/dev/null | python3 -c "
import json, sys, datetime
now = datetime.datetime.now(datetime.timezone.utc)
data = json.load(sys.stdin).get('data', [])
def stale(s):
    la = s.get('last_active')
    if not la: return True
    t = datetime.datetime.fromisoformat(la.replace('Z', '+00:00'))
    return (now - t).total_seconds() > 3600
gh = [s for s in data if (s.get('thread_id') or '').startswith('gh-issue-')]
st = [s for s in gh if stale(s)]
print(json.dumps({'wakeAgent': len(st) > 0, 'data': {'gh_chains': len(gh), 'stale': len(st)}}))
"`,
});
```

(On a `ncl`/`python3` error the script exits non-zero → the agent-runner fail-closes and skips the
tick rather than burning a model tick on a broken gate; the next cron fire retries.)

Any custom prompt attached to the scheduled task must keep a `DISCOVER` step (live `ncl sessions
list`, per R1) *ahead* of any "refresh from tracker" step, and must scope the tracker to "prior
snapshot for deltas," never "the list of chains."

## State

One canonical path: `/workspace/agent/memory/supervisor-state.json`. Do not write a second copy at
the workspace root — a stale duplicate has caused a tick to reconcile against day-old state. Load
at the start of every tick, write back at the end (the once-per-chain postmortem idempotency
depends on it surviving). The human-facing board file is `reports/issue-chain-tracker.md`.

Per chain (`threadId` key):
- `nudgedAt: [iso, …]`, `escalatedAt`, `lastObservedActivity` — nudge/escalation bookkeeping.
- `githubCommentRequestedAt`, `githubCommentUrl` — Step 5 enforcement.
- `postmortem: {done, supersededByPr, learningTitle, at}` — Step 7, once per chain.
- `disposition`, `githubArtifactUrl` — no-PR chains (R3). Terminal (`closed-by-us`) chains move to
  `_archived` with the URL + reason.
- `ci: {cell, latestRunId}` — Step 2b. `latestRunId` is the last CI run's `databaseId`; "stale" =
  a bad conclusion on the *same* id next tick (nobody re-dispatched).

Invariant: every routed+triaged `gh-issue-` chain is in the in-flight set OR `_archived`, never
absent from both.

## When called manually

If the operator invokes `/supervise-issues` outside the cron, run the same scan but report ALL
chains regardless of staleness — they want the full picture.
