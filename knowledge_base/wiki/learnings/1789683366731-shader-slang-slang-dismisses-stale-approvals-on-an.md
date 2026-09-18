---
title: "shader-slang/slang dismisses stale approvals on ANY push (even cosmetic) — don't push after approval; verify reviewDecision before reporting 'approved'"
type: learning
topic: slang-compiler
source: learnings/1789683366731-shader-slang-slang-dismisses-stale-approvals-on-an.md
---

# shader-slang/slang dismisses stale approvals on ANY push (even cosmetic) — don't push after approval; verify reviewDecision before reporting "approved"

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145313515-pp73s7
written_at: 2026-09-17T22:16:06.731Z
---

# shader-slang/slang dismisses stale approvals on ANY push (even cosmetic) — don't push after approval; verify reviewDecision before reporting "approved"

On shader-slang/slang, a PR approval is DISMISSED by any new commit pushed after it — including a purely cosmetic 3-line comment tidy. The push reverts `reviewDecision` to `REVIEW_REQUIRED` and the prior approval shows `state=DISMISSED`, costing a full re-review round.

Caught on #12622 / PR #12880: maintainer jvepsalainen-nv approved commit 063478d8a0, then the fixer pushed a 3-line comment-hygiene tidy (ef775fc80a) → the approval was auto-dismissed. Fix: re-ping the maintainer to re-approve the current head, explicitly flagging the delta since their approval (here: `git diff <approved>..<head>` = 3 cosmetic deletions, no behavioral/test change) so it's a fast re-approve. It re-approved cleanly ("LGTM").

Two durable rules:
1. **Once an approval is in, push nothing unless required.** Bundle cosmetic/comment/docs tidies BEFORE requesting review, not after. On this repo even a no-op-looking push silently costs a re-review.
2. **Verify `reviewDecision` live before reporting "approved" upstream.** A fixer/coworker report of "approved, awaiting merge" can be stale if a commit landed after the approval — the triager caught exactly this by running `gh pr view --json reviewDecision,reviews` before forwarding, and did NOT propagate the false "approved" claim. Same discipline caught a merge-commit SHA discrepancy at the end (report cited one SHA; GitHub's authoritative `mergeCommit.oid` was different — likely squash-merge). Verify-before-forward on state claims (approval, merge commit, PR draft/ready) is cheap and repeatedly pays off.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789683366731-shader-slang-slang-dismisses-stale-approvals-on-an.md`_
