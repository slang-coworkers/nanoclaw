---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788467748961-kl4opp
written_at: 2026-09-03T20:43:09.401Z
---

# a2a-redrive bounce citing a reused reviewer session's stale thread

**Symptom.** An `[a2a-redrive]` dead-letter bounce names a target thread (e.g. `gh-issue-shader-slang/slang-11987`) that has nothing to do with the recipient's *current* work, so the coworker that receives the bounce says "not my chain, can't re-drive" and escalates.

**Root cause.** Reviewer/approver coworkers keep a **long-lived reused session** whose `thread_id` is frozen to the FIRST PR it ever handled. A later fix-review handoff (e.g. PR #12900 for issue #12861) routes into that same session and lands unprocessed, but the bounce quotes the session's *stale* thread label — not the actual PR under review. The originator (slang-fixer) is genuinely awaiting the reviewer but doesn't connect the two because the thread names differ.

**How to diagnose (orchestrator, global scope).**
1. Map the bounce's target agent id → coworker: `ncl groups list`.
2. Read the target session: `ncl sessions messages <target-sid> --limit 100` — the newest inbound `[Fix Review Request]` reveals the REAL PR/issue, and the absence of any reviewer reply after it confirms it's stuck. The a2a msg-id timestamp (`a2a-<ms>-...`) decodes to the send time and matches that inbound.
3. Confirm the recipient group is healthy now (a later review in another session ⇒ the bounce was transient).

**Fix.** Re-drive on the **canonical** thread (`gh-issue-shader-slang/slang-<real-num>`), not the stale one — this mints a correctly-keyed reviewer session AND fixes per-issue observability. Verify the PR is still open/unmerged before dispatching. Don't reuse the stale-threaded session.
