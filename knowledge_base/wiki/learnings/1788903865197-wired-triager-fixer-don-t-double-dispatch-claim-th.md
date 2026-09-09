---
title: "Wired triager→fixer: don't double-dispatch; claim the edge on the canonical thread"
type: learning
topic: agent-ops
source: learnings/1788903865197-wired-triager-fixer-don-t-double-dispatch-claim-th.md
---

# Wired triager→fixer: don't double-dispatch; claim the edge on the canonical thread

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788891200546-qfgubh
written_at: 2026-09-08T21:44:25.197Z
---

# Wired triager→fixer: don't double-dispatch; claim the edge on the canonical thread

## Situation (shader-slang/slang#12964, 2026-09-08)

On a `github.issue_opened` webhook I routed the issue to `slang-triager`. When the triager finished, it reported `READY-FOR-FIX` up to me AND — because it is **wired peer-to-peer to `slang-fixer`** — had *already dispatched the fix handoff directly to the fixer* moments earlier. I then also dispatched to `slang-fixer`. Two dispatches to the same coworker for one task.

## Why it didn't blow up (and the subtle risk that remained)

Both dispatches carried the **same canonical `thread_id`** (`gh-issue-shader-slang/slang-12964`), so per per-thread routing they **folded into ONE fixer session** — no phantom/duplicate session (the classic thread-less failure mode did NOT occur). The residual problem was different and subtler: the single fixer session now had **two upstream edges** (me + triager), so its `[Fix Report]` could route to whichever parent it replied to last.

## Resolution that worked

I claimed the edge explicitly: because both coworkers are my direct fleet destinations and I own the webhook chain + `report_pr_created` PR routing, **I drive the fixer's edge**. The triager sent the fixer a one-liner ("parent owns this chain — report your [Fix Report] to parent; disregard my dispatch as the routing edge; memo stands as reference") and stepped out of the reporting path. Clean single edge; chain completed normally (draft PR #12967, reviewed, awaiting CI + human).

## Rule going forward

- **Before dispatching a ready-for-fix issue to the fixer, remember the triager may be WIRED to the fixer and will auto-hand-off the instant it finishes triage.** Don't blindly dispatch on top of that.
- **Same canonical `thread_id` on both dispatches is the safety net** — it folds them into one session instead of spawning a duplicate. Always propagate `gh-issue-<owner>/<repo>-<num>` verbatim; that alone prevents the phantom-session bug even under a dispatch race.
- **When a race does happen, resolve the EDGE, not the session:** decide who is the fixer's single parent (default: the orchestrator that owns the webhook chain + PR mapping), have the other party send one disowning line, and keep any delivered memo as reference. Don't re-dispatch or retract.
- **Cheapest detector for a true duplicate:** `ncl sessions list | grep <fixer-group>` — two `running` sessions for one task means the thread_ids diverged; one session with two upstream edges is a routing-ambiguity, not a duplicate.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1788903865197-wired-triager-fixer-don-t-double-dispatch-claim-th.md`_
