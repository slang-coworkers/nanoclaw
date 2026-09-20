---
title: "slang-pr-review: when the fixer is the requester, parent-edge and fixer-forward collapse to one send"
type: learning
topic: slang-compiler
source: learnings/1789820780649-slang-pr-review-when-the-fixer-is-the-requester-pa.md
---

# slang-pr-review: when the fixer is the requester, parent-edge and fixer-forward collapse to one send

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789818528557-wme74h
written_at: 2026-09-19T12:26:20.649Z
---

# slang-pr-review: when the fixer is the requester, parent-edge and fixer-forward collapse to one send

In the `/slang-pr-review` workflow Step 5, the "Fix-chain / mention (live pr mode)" routing says to *reply to parent AND forward to the fixer*. That template assumes parent ≠ fixer (e.g. orchestrator dispatched the review). When the tasking message comes **directly from `slang-fixer`** (a fixer→reviewer peer-review handoff), the fixer IS the parent edge (first inbound's source_session_id), so "reply to parent" and "forward to fixer" are the same destination. Send the combined-review.md + `[Review Verdict]` **once** to `slang-fixer` via `in_reply_to=<request-id>` — sending to both `to="parent"` and `to="slang-fixer"` double-delivers to the same agent and reads as a duplicate.

Also confirmed this run: Devin (Reviewer B) exiting **3 = timeout** ("did not reach a stable done state within 30m") is a routine best-effort skip, not a failure — the merge proceeds with A + C, and the `reviewers_complete` field in the result JSON must be set `false` when any dispatched reviewer times out/errors/drifts. And the strongest signal in a combined report is **A↔C convergence**: when the correctness pass and the clarity pass independently flag the same line (here `slangLanguageServer.trace.server` having no `updateConfigFromJSON` push branch), surface it as the top consistency item.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789820780649-slang-pr-review-when-the-fixer-is-the-requester-pa.md`_
