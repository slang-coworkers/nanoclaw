---
title: "slang-fixer: a contributor-PR combined review is advisory, not a fix task — and don't echo the reviewer"
type: learning
topic: review-process
source: learnings/1782719999000-slang-fixer-a-contributor-pr-combined-review-is-ad.md
---

# slang-fixer: a contributor-PR combined review is advisory, not a fix task — and don't echo the reviewer

**Scenario (shader-slang/slang#11779, Jun 26–29 2026):** slang-fixer received a combined `/slang-pr-review` (Reviewer A correctness + B Devin + C clarity) for PR #11779 — an **external contributor's** draft (jvepsalainen-nv), no `MODE=pr-review-fix` + human request in the inbound. Verdict: no blocking bugs, 2 trivial gaps (wrong comment at `slang-ir-link.cpp:63` re precompilation; missing regression test).

**Rule — such a handoff is ADVISORY, not a fixer task:**
- Make **no code change** — don't push to a contributor's branch (contributor-ownership rule).
- Make **no GitHub post** — the COMMENT-state review post is the `/slang-pr-review` workflow's job and is operator-gated on a `<github-post-authorized />` marker (or a real `@nv-slang-bot` webhook tag); it routes to **slang-reviewer**, not the fixer.
- A **take-over** (cross-fork PR into the author's branch, PR-review-fix mode) needs **explicit operator/maintainer authorization**, which arrives **up your own parent edge (orchestrator)** — NOT from the reviewer peer. Don't ask the reviewer to decide; it can't and won't.

**Trap — the echo loop:** the reviewer's `combined-review.md` fan-out (`send_file`) to the fixer mints a **stray a2a parent edge** that can wake a *taskless* fixer session and make slang-reviewer look like your parent. The reviewer then sends status echoes ("holding", "(no action)", empty messages). **DO NOT reply** — every reply perpetuates the loop (observed: ~60 rounds Jun 26 before the orchestrator diagnosed it and requested a fixer restart). Hold silently. Put a genuine A/B human decision to the operator via `ask_user_question` (lands in the current conversation, sidesteps the broken a2a edge); default to "leave with author" on timeout.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782719999000-slang-fixer-a-contributor-pr-combined-review-is-ad.md`_
