---
name: project_scan_py_subthread_key_parse_falsepositive
description: "scan.py mis-parses gh-issue sub-thread keys (…/recovery-2) into a phantom repo+issue, producing a false must_nudge/escalate row"
metadata: 
  node_type: memory
  type: project
  originSessionId: 168840bd-31f3-4941-9a1b-5b96f8703bbc
---

**Tick 110 (2026-07-29):** `scan.py` (supervise-issues) mis-parsed the session thread
`gh-issue-shader-slang/slang-11568/recovery-2` into `repo="shader-slang/slang-11568/recovery",
issue=2`, then classified that phantom as `silent ≥4h → needs_nudge + escalate`. It bumped
`summary.must_nudge` from 3 to 4.

**Reality:** parent issue **#11568 is CLOSED/COMPLETED**, closed by our own merged PR **#11798**.
`recovery-2` is a stale fixer *recovery sub-thread* (append-only sub-key form
`gh-issue-<owner>/<repo>-<num>/<sub-task>`), NOT a chain on a repo literally named
`slang-11568/recovery`.

**Why pull-universe didn't filter it:** it filters closed issues via `gh issue view <num> --repo
<repo>`; for the bogus `repo=…/recovery, issue=2` that call errors (not "CLOSED"), so the closed-skip
never fired and scan saw a live-looking silent chain.

**Root cause:** the thread→(repo,issue) parser splits on the LAST `-<digits>` and treats everything
before as repo, without recognizing the `/<sub-task>` suffix grammar. A key with a `/` after the
`-<num>` (sub-thread) must resolve to its PARENT `gh-issue-<owner>/<repo>-<num>`, not a new repo.

**Handling this tick:** archived `gh-issue-shader-slang/slang-11568/recovery-2` under `_archived`
in supervisor-state.json with reason + PR #11798 link; did NOT escalate the phantom; surfaced the
`must_nudge(4)≠sent(3)` delta loudly in the board per the fails-loudly rule (correct — the invariant
line names the phantom rather than reporting the tick clean).

**Fix path (queued to operator):** in `scan.py`/`pull-universe.sh` thread parser, detect a `/` after
the `-<num>` and collapse sub-thread keys onto the parent chain (or drop them from the nudge universe
entirely, since the parent already appears). Until fixed, `_archived` dedups it out of NEW math but
the per-chain nudge classifier may re-flag if pull-universe re-emits the sub-thread payload — verify
next tick it stays suppressed. Related: [[feedback_ncl_tasks_scope_from_cron_session]].
