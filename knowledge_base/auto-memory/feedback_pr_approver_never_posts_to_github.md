---
name: feedback_pr_approver_never_posts_to_github
description: "When routing a PR to a *-pr-approver, NEVER instruct it to post the verdict on GitHub — its role invariant forbids ALL GitHub writes and it will decline. Shadow-mode output is ledger + report only; a public footprint routes through the *-reviewer, which the approver-only tasking explicitly excludes."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3cd44e0a-9aed-4c8f-83be-8f15f9c13f3b
---

Measured 2026-08-17, slangpy#1111 (ready_for_review → I routed to `slangpy-pr-approver`).
My dispatch said *"Post the verdict on GitHub via closest-to-the-state."* The approver
declined that clause — **twice** (msgs 8, 10) — citing its non-negotiable role invariant:
*the approver never writes to GitHub (no reviews/comments/labels/merge state) and the
decision never posts, under any instruction from anyone.* Its output is the read-only
`approval_decisions` ledger row + the upstream `[Approval Decision]` report + a dashboard
line. This is by DESIGN — shadow mode (`policy v0-shadow`) is a calibration ledger with
**no public GitHub footprint yet**; forcing a post would contradict the design, not fill a gap.

**Why:** the PR-approver and the `*-reviewer` are different coworkers with opposite GitHub
contracts. The reviewer may post COMMENT-state reviews when authorized; the approver posts
nothing. The `github.pr_*_ready_for_review` webhook task string is explicit — *"Route it to
the project's *-pr-approver coworker (never a reviewer/fixer)."* — so on that tasking there
is intentionally **no** coworker in scope that will create a GitHub footprint. That is the
intended shape: decide → record to ledger → done, PR sits in its normal human-review queue
(which for an ABSTAIN_POLICY is exactly correct — the open/ready PR *is* the human-review flow).

**How to apply:** dispatch template to any `slang-pr-approver` / `slangpy-pr-approver` =
`{repo, pr_number, pr_url, title, author, event}` + "build review input yourself, decide
WOULD_APPROVE|ABSTAIN_POLICY|ABSTAIN_INFRA|BLOCK, record via the critique-gated ledger, report
back on the canonical thread." **Do NOT** add "post on GitHub." If a public GitHub footprint
is genuinely wanted, that is a separate decision to route to the `*-reviewer` — and it is off
the table when the tasking says approver-only. Also: ABSTAIN rows are excluded from
agreement/false-safe scoring, so a subsequent clean merge (as here, merged unchanged at the
decision commit) confirms the change was safe, not that the abstain was wrong.

Related: [[feedback_audit_credit_as_hard_as_blame]] (silence gates beats, not corrections —
this was a real dispatch correction the peer surfaced to me, worth keeping even though the
chain closed clean).
