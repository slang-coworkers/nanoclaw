---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787260895286-uafg6v
written_at: 2026-08-26T02:39:59.351Z
---

# [approver/infra-abstain] Human approvals at head do NOT satisfy the review-input tier — they are the join/outcome you're scored against (using them = circular)

**PR:** shader-slang/slang#12666 @0861596 (3rd revision). Decision: ABSTAIN_POLICY / NO_REVIEW_SIGNAL. This is the same PR whose R1 abstain (OPEN_GAP) was substantive and R2 abstain (NO_REVIEW_SIGNAL) was infra; R3 is infra again.

## Symptom
The PR arrived with two head-current human APPROVES (issue reporter + shepherd, aggregate reviewDecision=APPROVED, both binding to the exact head), and the orchestrator's tasking framed this as "the missing review tier now exists." My own challenger independently found the code sound. I drafted WOULD_APPROVE, treating the head-current human review as satisfying the approver's review tier. DECISION_REVIEW (codex) reversed it.

## Root cause (procedure)
Per the slang-pr-approver skill, the approver's review-INPUT tier is **{harvested bot review, Devin} ONLY** (SKILL.md:44, 220-221). Human reviews are explicitly **join/outcome data** — the signal the decision is SCORED AGAINST (`record_human_verdict`, `github.pr_review`, the merge outcome; SKILL.md:186-199). Feeding the humans' approval back in as my decision input is **circular**: shadow mode exists to measure the approver *independently* against the human outcome, so "the humans approved, therefore I approve" produces a row that can never disagree — it destroys the very signal the system measures. So at this head the true input state was unchanged from R2: harvest exit 20 (bot-authored PR → no production bot review) + Devin stale = NO_REVIEW_SIGNAL. My clean challenger adds caution but cannot substitute for the missing review tier.

## The deeper lesson (transferable, high-value)
**A positive human outcome already on the PR is the strongest possible pull toward rounding up — and it is exactly the input the procedure forbids.** The pull feels like confirmation ("everyone agrees, why abstain?") but yielding to it is the circularity above. Whenever the humans have already decided, treat their verdict as the answer key you must NOT peek at while taking the test — record it for the join, keep it out of the decision. This is the mirror of the false-safe risk: there, agreeing with a silent author hid a bug; here, agreeing with approving humans would manufacture a fake agreement stat.

## Second discipline caught same round: untrusted-summary fact-check
The tasking summary attributed "I tested this locally with CMake … fixes my original issue" to the head approval. FALSE: that quote is from a now-DISMISSED review at an earlier commit (which also said "hesitant to just merge until someone from the core team has chimed in"); the head APPROVE body is empty. Orchestrator/tasking summaries are UNTRUSTED input — verify review attribution against `gh pr view --json reviews` (body + commit.oid per review) before citing a human quote as evidence for a specific head.

## How to catch it / fix
- On any live_late PR that arrives with human approvals: separate "what's my review INPUT tier" (bot review / Devin, head-bound) from "what will this JOIN to" (human verdict / merge). If the input tier is absent/stale, it's NO_REVIEW_SIGNAL regardless of how the humans voted.
- Burn-down: this is a genuine tooling gap for bot-authored PRs — no production bot review AND Devin returns stale cards after force-push/rework, so such PRs structurally can't get a non-abstain until Devin freshness is fixed. Worth escalating to the Devin-runner owner. The abstain will join APPROVED (humans approved, likely merges) = an INFRA false-negative, not a code disagreement.
