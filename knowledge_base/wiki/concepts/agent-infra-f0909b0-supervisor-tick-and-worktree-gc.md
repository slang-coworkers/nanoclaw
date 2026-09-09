---
title: "Supervisor Tick Reliability and Worktree-GC Repo Binding"
type: concept
group: agent-infra
tags: [supervise-issues, pull-universe, thread-key, worktree-gc, gitdir, datetime, gh-401]
source_count: 10
---

## TL;DR

The `/supervise-issues` instrument pipeline (`pull-universe.sh | scan.py`) and its
worktree-GC step have recurring "an instrument reading looks identical to reality"
defects. Verify the instrument before nudging or reaping.

- **The thread-key regex is greedy and must not swallow sub-task suffixes.** The spine
  *instructs* agents to append `gh-issue-<owner>/<repo>-<num>/<sub-task>`, so
  `gh-issue-(.+/.+)-(\d+)$` mis-parses to a nonexistent repo → "no public footprint" on
  every tick. Use `^gh-issue-([^/]+/[^/]+)-(\d+)(?:/.*)?$` — greedy-WITHIN-segment keeps
  hyphenated repo names (`slang-rhi`) intact; test any fix against a hyphenated-repo key.
- **Normalize naive timestamps at the single `parse_ts` chokepoint** (`ts.tzinfo is None
  → replace(tzinfo=utc)`). A naive/aware `max()` mix crashes scan.py with 0-byte output;
  because the ~19-min pull-universe feeds it, one crash freezes state and fires no nudge
  for ~23h — and the recovery tick then produces a false surge.
- **A `gh` 401 `app_not_connected` aborts the whole tick** (pull-universe runs under
  `set -euo pipefail`); `GH_TOKEN` being the sentinel `ROUTED_VIA_ONECLI_PROXY` is not
  evidence of a live connection. Diagnose with `gh api rate_limit`; the fix is
  operator-only (reopen the OneCLI connect URL). Report BLOCKED with honest `ncl`-only
  partial state; never fabricate a classified board.
- **Worktree-GC must resolve the owning repo from the `.git` gitdir pointer**
  (`cat <wt>/.git` → `gitdir: /workspace/agent/<repo>/.git/worktrees/…`), NEVER from the
  tier folder or the bare number. Issue/PR numbers collide across slang / slang-rhi /
  slangpy; a bare `wt-<N>` does not name its repo.
- **GC PR-state must key on the worktree's ACTUAL checked-out branch**
  (`git -C <wt> rev-parse --abbrev-ref HEAD`), not `fix/issue-<dirnum>` — fixers create
  `-v2`/`-batch2` branches; the convention name may resolve to a CLOSED/merged sibling PR
  while the worktree backs a live successor.
- **The dangerous reap is a CLOSED-unmerged PR on an OPEN issue** (a v2/successor very
  often exists); a MERGED-PR reap is safe. Verify the biggest/most-destructive candidates
  live before dispatch; always include the "reply 'active' to keep it" backstop.
- **The GC "save-then-push to wip/reap/*" step is vacuous when the tree is clean** — a
  stale local `origin/*` makes a worktree look "ahead"; don't push already-merged PR-head
  snapshots to a production remote. Verify the save step's purpose (unsaved reviewer
  notes) directly; fetch before trusting ahead/behind.

## Synthesis

### The instrument-vs-reality failure shape

Every atom here is an instance of one shape: a supervisor instrument renders "no artifact
found / must nudge / reapable" identically to the true state, so absence of evidence looks
like evidence of absence. The general remedy is to check the instrument's own error log or
authoritative source before acting on its reading.

**The thread-key regex** is the cleanest example. `pull-universe.sh` parsed canonical
webhook thread keys with `re.match(r"gh-issue-(.+/.+)-(\d+)$", t)`; `(.+/.+)` is greedy, so
a spine-sanctioned sub-thread key `gh-issue-shader-slang/slang-8125/review-12304` parses to
repo `shader-slang/slang-8125/review`, issue `12304` — a nonexistent repo. The artifact
lookup then finds nothing on every tick and reports "No GitHub artifact recorded / no public
footprint," nudging an agent whose work *was* posted 10 days earlier; the GraphQL error
(`Could not resolve to a Repository`) sat in the supervisor's own pull log, read past
([supervisor thread-key regex is greedy](../learnings/1786408898253-supervisor-thread-key-regex-is-greedy-spine-sancti.md),
[who spoke last is not a human unanswered](../learnings/1786453196243-supervisor-nudge-who-spoke-last-is-not-a-human-is-.md)).
This recurs because the spine instructs agents to create these keys. The tested fix,
`^gh-issue-([^/]+/[^/]+)-(\d+)(?:/.*)?$`, anchors, forbids the repo swallowing path
segments, and tolerates the suffix — but critically keeps greedy matching WITHIN a segment
so hyphenated repo names (`slang-rhi`) survive; a naive non-greedy `[^/]+/[^/]+?` also
passes the happy cases but silently mangles hyphenated repos. When a monitor reports a
missing artifact, check its own error log for a resolution failure first; when nudged for a
missing artifact, verify live against the real repo rather than accepting the premise —
don't let an authority gradient carry an unverified instrument reading into your report.

### Tick-killing crashes and auth drops

Two failures take out the entire tick. First, a **naive-datetime crash**: `parse_ts()`
returned a naive datetime for a timestamp lacking `Z`/offset, so
`compute_last_activity_by_us → max(candidates)` mixed naive with the always-aware
session-dispatch ts and raised `TypeError`, crashing scan.py with 0-byte output on every
tick. Because the expensive `pull-universe.sh` (a `gh` walk of ~914 chains, ~19 min) pipes
straight into scan.py, no tick wrote state or fired a nudge for ~23h, and the first clean
scan then flagged 115 rows — an instrument-recovery backlog, not a workload
([naive-datetime crash froze state](../learnings/1787059894213-supervise-issues-scan-py-naive-datetime-crash-froz.md)).
The durable fix is normalizing naive→UTC at the single `parse_ts` chokepoint (an earlier
tick patched it at input and it came back — patch the chokepoint, not each call site).

Second, an **OneCLI GitHub disconnect** returns HTTP 401 `app_not_connected` from every
`gh` call; under `set -euo pipefail` the first 401 aborts pull-universe with empty stdout,
and scan.py reports `stdin is not valid JSON`. `GH_TOKEN` holding the literal proxy
sentinel `ROUTED_VIA_ONECLI_PROXY` is not evidence of a working connection — the real
credential is injected per-request by the gateway. Diagnose with `gh api rate_limit`
(clean JSON = working; `app_not_connected` = lapsed); the agent cannot self-heal (no
`onecli` verb reconnects an OAuth app — it is a browser flow), so escalate the connect URL
to the operator. Do not fabricate a board: without `gh`, PR/CI/closed-issue/artifact reads
are all impossible, so report BLOCKED with honest `ncl`-only partial counts and leave state
at last-good ([supervisor tick blocks when gh 401s](../learnings/1787832314750-supervisor-tick-blocks-when-gh-401s-on-onecli-gith.md)).

### Worktree-GC: bind the repo from the gitdir, key PR-state on the actual branch

The worktree-GC step has a *recurring* class of false reaps, corrected at least four times
(Aug 17, Aug 20, Aug 22, Aug 30) because the fix was never applied to the discovery step.
The root cause is always identifier ambiguity: a bare `wt-<N>` number is unique only within
a repo, and the GC resolved it against a repo inferred from the tier folder or defaulted to
`shader-slang/slang`. The authoritative binding is the worktree's `.git` gitdir pointer:
`cat <wt>/.git → gitdir: /workspace/agent/<repo>/.git/worktrees/…`
([worktree GC must resolve owning repo from the gitdir](../learnings/1787401355432-worktree-gc-must-resolve-owning-repo-from-the-gitd.md),
[bare-number resolver ignores repo binding](../learnings/1787490790849-supervise-issues-worktree-gc-bare-number-resolver-.md),
[supervisor worktree GC must bind repo from gitdir](../learnings/1788098045338-supervisor-worktree-gc-must-bind-repo-from-gitdir-.md),
[worktree GC must bind repo from .git gitdir](../learnings/1788098052948-worktree-gc-must-bind-repo-from-git-gitdir-not-the.md)).
The canonical collision: `wt-810-review`/`wt-810-r2` are `slang-rhi` worktrees (OPEN draft
PR #810) but the GC resolved "810" against `shader-slang/slang#810` (CLOSED "IRBuilder
simplifications") and dispatched a reap; the literal `git -C /workspace/agent/slang worktree
remove` would itself have errored "not a working tree" because slang doesn't own a slang-rhi
worktree — a signal the binding is wrong. Also note the read-only supervisor mount shows
these under `/workspace/extra/ephemeral/prod-groups/<tier>/` while the reviewer sees
`/workspace/agent/<dir>` — same tree, different mount path.

A second GC defect is keying PR-state on the wrong branch. The `#<issue> → fix/issue-<issue>`
derivation assumes one PR per issue; fixers create `-v2`/`-batch2` branches when an approach
is superseded, so the convention name resolves to a stale/merged sibling PR
([GC PR-state must key on the worktree's actual branch](../learnings/1786971355711-worktree-gc-pr-state-must-key-on-the-worktree-s-ac.md),
[false-reaps batched-issue worktrees](../learnings/1786984117495-worktree-gc-py-false-reaps-batched-issue-worktrees.md)).
For issue #8125, `gh pr list --head fix/issue-8125` returned CLOSED PR #11657, but the
worktree was on `fix/issue-8125-v2` (OPEN PR #12304). For issue #11917 the derived
batch-1 PR #11920 was merged while the live worktree drove `fix/issue-11917-batch2` (OPEN PR
#12336). Resolve the actual branch (`git -C <wt> rev-parse --abbrev-ref HEAD`), key the GC
exclusion ledger on the gitdir-proven owner, and treat a CLOSED-unmerged PR on an OPEN issue
as the dangerous case (a successor very often exists) vs a safe MERGED-PR reap.

Two safety practices caught real collisions before harm: **verify the biggest/most-destructive
reap candidates live before dispatch** (caught the slangpy-vs-slang #827 collision, 17 false
→ 6 real), and **always include the "reply 'active' to keep it" backstop** — declining a
reap is safe, so a false dispatch costs a wasted dispatch and a wrong board line, not lost
work ([GC PR-state must key on actual branch](../learnings/1786971355711-worktree-gc-pr-state-must-key-on-the-worktree-s-ac.md),
[bare-number resolver](../learnings/1787490790849-supervise-issues-worktree-gc-bare-number-resolver-.md)).

### The GC "save" step is a false push trigger on a clean tree

The GC's `git status non-empty OR ahead of upstream → commit+push to wip/reap/<branch>` save
step can fire falsely. In one case both reviewer worktrees were clean (`git status --porcelain`
empty; the only ignored files were `tests/**/*.actual.txt` + `build/` artifacts, zero review
notes) yet appeared "ahead" purely because local `origin/master` was ~2 weeks stale — the
"extra" commits were real merged upstream PRs. The HEADs were orphaned PR-head snapshots
authored by `nv-slang-bot[bot]`, reachable from no remote ref, on a production `origin`.
Pushing already-merged snapshots to `wip/reap/*` there is junk on the real upstream for zero
value ([GC save step is vacuous when tree clean](../learnings/1787400986130-worktree-gc-save-step-is-vacuous-when-tree-clean-o.md)).
The rule: the save step's purpose is "don't lose ad-hoc reviewer notes" — verify that purpose
directly (clean tree + no non-artifact ignored files) rather than mechanically firing on a
stale-ref "ahead" signal, and fetch before trusting any local `origin/*` ahead/behind count.

**Source learnings (10):**
- [Supervisor thread-key regex is greedy — sub-threads parse to a nonexistent repo](../learnings/1786408898253-supervisor-thread-key-regex-is-greedy-spine-sancti.md) — `^gh-issue-([^/]+/[^/]+)-(\d+)(?:/.*)?$`, greedy-within-segment for hyphenated repos; check the instrument's error log before nudging.
- [scan.py naive-datetime crash froze state ~23h and produced a 115-nudge false surge](../learnings/1787059894213-supervise-issues-scan-py-naive-datetime-crash-froz.md) — normalize naive→UTC at the parse_ts chokepoint; a recovery-tick surge is a backlog, hold and escalate.
- [supervisor tick blocks when gh 401s on OneCLI GitHub disconnect](../learnings/1787832314750-supervisor-tick-blocks-when-gh-401s-on-onecli-gith.md) — `set -euo pipefail` aborts on the first 401; diagnose with `gh api rate_limit`, report BLOCKED, escalate the connect URL, never fabricate a board.
- [worktree GC PR-state must key on the worktree's actual branch, not fix/issue-N](../learnings/1786971355711-worktree-gc-pr-state-must-key-on-the-worktree-s-ac.md) — a -v2/renamed branch can be live while the convention name is CLOSED; the "reply active" affordance is the recoverable backstop.
- [worktree-gc.py false-reaps batched-issue worktrees (missing -batchN suffix)](../learnings/1786984117495-worktree-gc-py-false-reaps-batched-issue-worktrees.md) — multi-batch fixes break the 1-PR-per-issue assumption; resolve the actual branch.
- [worktree GC must resolve owning repo from the gitdir pointer, never the tier default](../learnings/1787401355432-worktree-gc-must-resolve-owning-repo-from-the-gitd.md) — reviewer worktrees review any repo; bare numbers collide; key the exclusion ledger on the gitdir-proven owner.
- [Worktree-GC save step is vacuous when tree clean + origin is production](../learnings/1787400986130-worktree-gc-save-step-is-vacuous-when-tree-clean-o.md) — stale local origin/* fakes "ahead"; verify the save purpose (unsaved notes), don't push merged snapshots to a production remote.
- [supervise-issues worktree GC bare-number resolver ignores repo binding in .git gitdir](../learnings/1787490790849-supervise-issues-worktree-gc-bare-number-resolver-.md) — two collisions in one tick; verify the largest destructive candidates live before dispatch.
- [supervisor worktree GC must bind repo from gitdir not tier folder](../learnings/1788098045338-supervisor-worktree-gc-must-bind-repo-from-gitdir-.md) — the `git -C /workspace/agent/slang worktree remove` erroring "not a working tree" is itself a signal the binding is wrong.
- [Worktree GC must bind repo from .git gitdir, not the tier folder](../learnings/1788098052948-worktree-gc-must-bind-repo-from-git-gitdir-not-the.md) — confirm PR state and that local tips are ancestors of refs/pull/<n>/head before removing any OPEN-PR worktree.
