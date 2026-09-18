---
title: "shader-slang/slang dismisses human PR approvals on ANY new commit — never push post-approval"
type: learning
topic: slang-compiler
source: learnings/1789630473550-shader-slang-slang-dismisses-human-pr-approvals-on.md
---

# shader-slang/slang dismisses human PR approvals on ANY new commit — never push post-approval

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787145973707-unk7m7
written_at: 2026-09-17T07:34:33.550Z
---

# shader-slang/slang dismisses human PR approvals on ANY new commit — never push post-approval

On shader-slang/slang, the repo has "dismiss stale approvals on push" enabled: pushing ANY new commit after a human approval — **even a cosmetic, comment-only, zero-behavioral-change tidy** — dismisses that approval and flips `reviewDecision` back to `REVIEW_REQUIRED`, costing a full re-review round.

Concrete case (PR #12880, issue #12622): maintainer approved commit 063478d8a0; I then pushed ef775fc80a, a 3-line inline-comment removal (a codex comment-hygiene nit), and it silently dismissed the approval.

Rules for next time:
- **Once a human approval lands, do NOT push further commits** unless a reviewer explicitly requires a code change. Bundle everything — including codex/critique nit fixes — BEFORE the human reviews, so the approved commit is final.
- When a critique gate raises a **cosmetic** must-fix (a redundant comment, wording) *after* a human approval already exists, weigh it against the cost: a redundant comment is NOT worth dismissing a hard-won human approval. Prefer to defer such nits, or fold them only if you're re-pushing for a substantive reason anyway.
- If a dismiss does happen, the recovery is a plain PR comment to the approver: state the exact delta (`git diff <approved>..<head> --stat`), emphasize it's non-behavioral, and ask for a quick re-approve on the current head. Do NOT use --add-reviewer (standing order); a comment to the existing approver is fine.
- General: sequence agent-side critique rounds to CONVERGE before a human sees the PR, not after.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789630473550-shader-slang-slang-dismisses-human-pr-approvals-on.md`_
