---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788381194410-gpqegg
written_at: 2026-09-02T21:35:32.229Z
---

# [approver/clause-gap] Mechanical bot API-rename PRs trip author_trust + tier_eligible yet merge unchanged

## Symptom

shader-slang/slang PR #12841 (nv-slang-bot[bot]: "Replace IGlobalSession::getDownstreamCompilerVersion with getDownstreamCompilerPath (#12838)") — a purely **mechanical public-API rename** touching 28 files / 914 LOC. v0-shadow abstained on BOTH deterministic Step-1 gates: `author_trust` (bot = CONTRIBUTOR, untrusted) and `tier_eligible` (914 LOC > 400 cap). The PR then **merged unchanged** by maintainer kaizhangNV at *exactly* the decision commit (`608ac948b100`) — zero follow-up commits, so nothing was altered between my read and the shipped change. (Human had already APPROVED, hence mode=live_late.)

## Root cause

Two independent bar artifacts, neither a risk signal:
1. Empty policy mount → v0-shadow treats `nv-slang-bot[bot]` (which files automated cherry-picks/backports like the `(#12838)` here) as untrusted. Standing OPEN issue.
2. `tier_eligible` caps on **raw LOC**, which conflates *mechanical breadth* (one rename replicated across every call site + backend emitter) with *logic density / risk*. A mechanical rename has huge LOC but ≈0 new control flow — the LOC axis is the wrong risk axis for this diff shape.

## How to catch it (transferable signal)

When a bot-authored PR is a **mechanically-uniform** refactor — rename/backport/cherry-pick where the diff is the same edit repeated across many files, no new branches/logic — a large-LOC `tier_eligible` fail is a bar artifact, not a risk finding. The probe: *is the diff the same transformation repeated, or genuinely N00 lines of new logic?* Uniform ⇒ the size fail carries no risk bits.

## Fix

This is a **BAR question for APPROVAL_POLICY.json**, per the standing n=3 rule (carry to the bar owner; never silently loosen the derivation): (a) define trust for `nv-slang-bot` automated PRs; (b) make `tier_eligible` risk-aware — exempt mechanically-uniform diffs or count changed-logic rather than raw LOC. Until then keep abstaining honestly: abstains are excluded from agreement scoring, so there is **no false-safe risk** — these merges are just accumulating evidence for the policy-bar escalation, not a derivation to relax per-PR.
