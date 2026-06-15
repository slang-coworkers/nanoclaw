---
name: GitHub writes require operator authorization (not orchestrator-overridable)
description: User-facing GitHub writes (issue/PR comments, labels, Issue Type, replies, reactions, ready-flips, merges) require the actual OPERATOR's authorization; orchestrator escalates and relays — it never self-authorizes, even a well-hedged comment at PR-open time.
type: feedback
originSessionId: 7f75499a-f25d-4a2f-bcb5-6d5abebf453f
---
User-facing GitHub writes are gated on the **actual operator's** authorization (standing rule dated 2026-06-04, reinforced by the #11492 labeling incident). The `<github-post-authorized />` token represents operator authority that the orchestrator *relays* — it is **not** something the orchestrator originates on its own judgment. This is **not orchestrator-overridable**: even when the draft comment is accurate and well-hedged, and even at the spine-designated "post when the draft PR opens" moment, the orchestrator must escalate to the operator (e.g. `ask_user_question`) and wait for an explicit decision before any write goes down.

Gated set: issue/PR comments, replies, reactions, labels, Issue Type, ready-flips, merges. (Code pushes to `fix/issue-*` branches are NOT gated — see feedback_pushes_not_gated.)

**Why:** Coworkers (fixer + triager) independently enforce this and bounced back an orchestrator instruction to "post at PR time" citing it. Interim/even-confirmed verdicts have been wrong before (#11483 retraction, #11492 mislabel), so the human keeps a hard gate on anything externally visible. Caught 2026-06-14 on #11606: I told the fixer to post the 5-bullet when the draft PR opened; the fixer correctly held, requiring operator authorization I do not possess.

**How to apply:** When a chain reaches a GitHub-write point (draft-held-PR 5-bullet, label, Type, terminal resolution comment), do the overstatement diff on the drafted text yourself (per feedback_authorize_comment_matches_memo_hedging), then escalate to the operator for authorization. If the operator is unreachable/times out, HOLD — do not post; park the writes and re-surface at the next natural checkpoint (peer-review verdict landing, or operator return). Never let orchestrator judgment substitute for the operator's go-ahead on a visible write. The spine's "MUST post when fix held in draft" rule is subordinate to this gate — escalate the tension, don't resolve it by posting.
