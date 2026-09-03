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
- **R10 — Never `schedule_task` a `cron` for a single issue/PR.** R1's scan and GitHub webhooks
  already cover state changes, and a per-issue cron never self-cancels — it wakes a fresh container
  forever. For a one-time future check use `process_after` (no `cron`); for a human blocker,
  escalate (R7). The only recurrence you schedule is this skill's own 12h cron (below).

## Procedure

### 1. Build the status table

**Use `scripts/pull-universe.sh` (preferred).** It exhaustively enumerates all `gh-issue-*` sessions
via `ncl --limit 10000`, fetches PR/comments/outbound for each chain via `gh`/`ncl`, stamps each
session's live cost-cap status via `ncl cost-cap status` (so `scan.py` can tell a session that's
merely idle apart from one deliberately `stopped` pending a human cost decision — see Step 2), filters
out closed issues (skips expensive fetches), and pipes the result directly into `scan.py`:

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
human comment is and without waiting for any stale window). **Exception — bot-last is ambiguous:**
a fixer-owned chain with no PR and no human-owned disposition that has gone silent is a promise we
still owe, not a handoff → `awaiting_us`, nudge the fixer (reference.md → *Classification states*,
fixer-owned carve-out; root cause of slang#12002). **Bounce limb (additive):** a fixer-owned, no-PR
chain whose owning container is `stopped` with an error-class last outbound (`last_outbound_error_class`
∈ transient|unknown) has *bounced* — it will not self-recover, so it is `awaiting_us` even if the
silence clock is still fresh (the #12097 shape). **Cost-stopped (highest priority — checked before
all of the above):** a session that hit its Tier-2 cost ceiling is `cost_stopped`, never `awaiting_us`
or `silent`, regardless of who spoke last or how long it's been quiet — see Step 3 for what that
becomes on the board (a factual notice, not a nudge). `scan.py` emits the decision as `action` (`nudge`
iff `needs_nudge`, else `none`) plus an enum `non_nudge_reason` on non-nudge rows — you act on those
fields in Step 3, you do not re-derive the call.

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

**[MUST] Act on `scan.py`'s `action` field — it is mechanically enforced, not advisory.** Each row
carries `action: 'nudge' | 'none'`. `action` is a strict 1:1 with `needs_nudge` — there is **no
`suppress` action and no way to turn off a nudge row.** Every `action='nudge'` row gets **exactly one**
message this tick. Do **not** skip it because a coworker session exists on the thread and you narrate
the chain as "fixer dispatched" / "already assigned" / "in progress" / "queued" / "auth-blocked" —
prose is not a suppression mechanism. `scan.py` already accounts for live work (a `running` container
that acted within the working window is `fixing`/`pr_open`, `action='none'`) and for genuine human
ownership (a human-owned disposition never reaches `needs_nudge`; it surfaces as `action='none'` with
an enum `non_nudge_reason`). So a row that reaches Step 3 as `action='nudge'` has a **dead or stalled**
container or a **bounced handoff** (exited mid-task, idle-exited, killed at the ceiling, or an a2a
handoff that errored on a transient auth/provider outage — the #12097 shape, flagged via
`last_outbound_error_class`). The "dispatched"/"queued" story is exactly the stall being mistaken for
progress (the #12059 miss: a killed fixer left `awaiting_us` on the board, never woken because the
tick narrated it as dispatched; and the #12097 miss: a bounced handoff parked as "queued; self-heals"
— it does not, unless the host redrive is deployed). The board row and the nudge are not
alternatives — write the row **and** send the nudge; a dead session wakes on the inbound.

**[MUST] Fails-loudly reconciliation.** After the nudge pass, count the nudges you actually sent this
tick and compare to `summary.must_nudge` from `scan.py`. If `sent_nudges != must_nudge`, the tick is
**NOT clean**: emit a `[SUPERVISOR INVARIANT VIOLATION]` line naming every `action='nudge'` thread
that did not receive a nudge, and escalate via `ask_user_question`. This is the hard backstop that
makes "never suppress a nudge row" checkable instead of a request the LLM can rationalize around
(PR #901's wording alone was violated — #12097). Never report a tick as clean while
`sent_nudges < must_nudge`.

**Cost-stopped chains — a factual notice, never a nudge.** A row with `state == 'cost_stopped'` has a
session that hit its Tier-2 cost ceiling and is hard-blocked pending a human Continue/Stop decision on
the dashboard's cost-approval card (`ncl cost-cap status --session <id>` reports `stopped`). It is
deliberately never `needs_nudge` — nudging it accomplishes nothing, the container cannot process
another turn until a human acts (`container/agent-runner/src/db/session-state.ts::CostCapStatus`). This
is the **one exception to R6** ("closest-to-the-state authors; the supervisor enforces, never
substitutes"): R6 assumes the owning coworker *can* act but hasn't yet, which is false here — the
coworker is provably incapacitated, so the supervisor posts the notice itself instead of nudging a
session that cannot respond. When a row carries `needs_cost_notice: true`, post **exactly one** short,
factual comment on the chain's issue/PR — a transient for-human diagnostic, never phrased as a ping,
nobody needs to reply. `scan.py` hands you three ready-made fields on that row —
`cost_notice_folder`, `cost_notice_session`, `cost_notice_link` — interpolate them for
`<folder>`/`<session>`/`<link>` in this **verbatim** template:

```bash
# Post via `--body-file -` fed by a QUOTED heredoc (`<<'EOF'`). The body is
# multi-line markdown containing backticks, so a fragile inline double-quoted
# `--body` would mangle it — and an UNquoted heredoc would run the backticks as
# shell command substitution. Substitute the three <…> placeholders with the
# row's field values as literal text before posting; leave every backtick intact.
gh issue comment <num> --repo <owner>/<repo> --body-file - <<'EOF'
_[Supervisor] Cost-escalation diagnostic — transient status note, for the human maintainer._

This chain's coworker session reached its Tier-2 cost ceiling and is **paused pending a human cost decision** (dashboard → **Continue** to raise the ceiling, or **Stop**). It resumes automatically once decided — **no action is needed on this issue.**

- Coworker: `<folder>`
- Session: `<session>`
- Dashboard: `<link>`

_Automated note — coworkers do not act on their own supervisor comments; this will not trigger further activity._
EOF
# PR-bearing chain: post the SAME heredoc body with
#   gh pr comment <pr> --repo <owner>/<repo> --body-file -
# instead of `gh issue comment`.
```

The `<link>` deep-link is a **relative hash route** (`cost_notice_link` = `#/cw/<folder>/s/<session>`,
session mode — the parser lives at `dashboard/public/app.js`), deliberately domain-less. It is **not**
auto-clickable in GitHub, and that is by design: it keeps the internal dashboard host out of the
**public** shader-slang issue/PR comment. A maintainer who already has the dashboard open pastes it
after their own base URL.

`needs_cost_notice` is `scan.py`'s own dedup gate for this — **do not build a second one.** It is
`true` only on the tick a chain enters (or changes within) `cost_stopped`, reusing the same
`delta`/`lastState`-transition tracking already computed for the board's 🆕/🔼/• tags (R4's spirit:
one clock, not two). A chain that stays `cost_stopped` tick-to-tick with nothing else changed carries
`needs_cost_notice: false` — do **not** post again; the row still appears on the board (state
`cost_stopped`, `non_nudge_reason: 'cost-stopped'`), just without a repeated comment. If a session
later resumes (a human clicked Continue) and is re-stopped afterward, `needs_cost_notice` re-arms on
its own — `state` necessarily passes through something other than `cost_stopped` in between, so no
manual bookkeeping is needed. Never escalate a cost-stopped chain via `ask_user_question` (`escalate`
is always `false` here) — the dashboard card already carries that decision to the human; duplicating
it in chat is noise, not help.

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

Reclaim abandoned worktrees across **all tiers** (fixer *and* reviewer/triager/slangpy — reviewer
worktrees are freehand-named and a `wt-*` glob silently misses them; discover name-agnostically by
`.git`-as-file, see reference.md). Run the GC scan every tick *before* the per-chain pass, and
surface `worktree-vol: <N>GB free` in the rollup. Discover the reap set from disk, resolve each
worktree's issue + PR state, and hand the set to `scripts/worktree-gc.py` for the deterministic tier
decision (`REAP` / `KEEP` / `STALE-OPEN` / `NO-PR`) — don't re-derive the thresholds in-context; the
script owns them. Dispatch the matching action to the owning coworker — the tier the worktree lives
under, not always a fixer (R8): save-then-remove for `REAP`, build-only reclaim for `STALE-OPEN` —
never delete from this session. Escalate to operator when free < 10 GB — and when the reap set can't clear the pressure,
the escalation must name the operator-only docker reclaim (`/ephemeral/docker` is root-only, the
supervisor can't prune it) rather than implying worktrees are the whole story. Commands, the
dispatch body, and the docker-escalation wording are in reference.md → *Worktree GC*.

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
