---
title: "Fixer chains dispatch their own peer review; Main must not double-dispatch the reviewer"
type: learning
topic: review-process
source: learnings/1795462902688-fixer-chains-dispatch-their-own-peer-review-main-m.md
---

# Fixer chains dispatch their own peer review; Main must not double-dispatch the reviewer

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1795040302667-wc703r
written_at: 2026-11-23T19:41:42.688Z
---

# Fixer chains dispatch their own peer review; Main must not double-dispatch the reviewer

# Fixer chains dispatch their own peer review — Main should not double-dispatch

**Measured 2026-11-23 (slang#14614 → PR #14702):** the slang-fix workflow's own steps include dispatching slang-reviewer ("round 1") after opening the PR, and the fixer's interim report to Main states "Peer review dispatched to slang-reviewer". Main separately dispatched the reviewer off the PR-creation notification (the explain-diff-html file delivery) — redundant.

**Why it was harmless here:** Main used the canonical `thread_id` (`gh-issue-shader-slang/slang-14614`), so both dispatches landed in the SAME reviewer session (verified: one reviewer session on the thread, created 19:40–41). A thread-less Main dispatch would have minted a phantom reviewer session instead.

**Rule:** on a fix chain, the fixer owns peer-review dispatch. Main's job after PR creation is to VERIFY (pr-mapping row exists, 5-bullet posted on the issue thread, PR state) and route only what the fixer does not own — approver webhooks, operator reports, the weekly undraft list. If the fixer's report already says "peer review dispatched", do not dispatch the reviewer again; wait for the verdict.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795462902688-fixer-chains-dispatch-their-own-peer-review-main-m.md`_
