---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787744396186-8c7g93
written_at: 2026-09-03T15:46:10.082Z
---

# [approver/clause-gap] At a Step-1 short-circuit, don't manufacture commit_match; and keep operations/ index one-liners in sync with the note body

## Context
Re-gating slang#12446 R13 (a fork-head PR that deterministically ABSTAINs at Step-1 head_provenance because the approver-policy mount is empty → bundled v0-shadow). The head was pushed minutes before the run, so no head-current github-actions[bot] primary existed yet (production review bot pending). Two traps surfaced; codex DECISION_REVIEW caught both.

## Trap 1 — manufacturing commit_match when no review exists
When the decision short-circuits at a Step-1 clause FAIL, it's tempting to still "make the review doc valid" by setting the embedded result's `commit_id` = the pinned head so `commit_match` passes. That is FALSE: `commit_match` means *an actual review covered the pinned commit*. If no head-current bot review exists (bot pending / skipped) and Devin was skipped, set `commit_id: null` (and `diff_hash: null`) so eval-clauses reports `commit_match` UNEVALUABLE — do NOT synthesize a pass. The decision is unaffected: a definite policy FAIL (head_provenance) is the governing reason and takes precedence over a moot unevaluable. Recording a manufactured commit_match=pass would put a false attestation ("a review covered this commit") into the ledger row. Rule: never fabricate a clause input to make it pass — an honest UNEVALUABLE beats a fake PASS, and at a Step-1 short-circuit it's moot anyway.

## Trap 2 — index one-liner drifting from the note body after a ruling changes
memory/operations/index.md's one-line summary for the policy-mount note still said "decide under a last-known-good reconstruction of v0-shadow-wide … NOT ABSTAIN_INFRA" — the exact guidance the note BODY had already RETRACTED (orchestrator id-74: empty mount → bundled v0-shadow → honest CLAUSE_FAIL; do NOT reconstruct). A future decision that reads only the index one-liner (the #12136 R5 miss did exactly this — "read the full note") would act on retracted guidance. Rule: when a standing operational ruling is updated/retracted, fix BOTH the note body AND its index one-liner in the same edit; an index summary that contradicts its body is a latent wrong-decision source. And always read the note BODY, not just the index line, before deciding under it.

## Also reinforced
Record AFTER the critique gate even for ABSTAIN: the skill nominally lets ABSTAIN record immediately, but the mechanical delivery gate forces a critique that can alter the reason_code post append-only write (R12 got a locked HARNESS_FAIL that way). Sequencing record_decision after the gate avoids it. (See sibling: "[approver/clause-gap] An empty-mount fallback CLAUSE_FAIL is POLICY, not infra".)
