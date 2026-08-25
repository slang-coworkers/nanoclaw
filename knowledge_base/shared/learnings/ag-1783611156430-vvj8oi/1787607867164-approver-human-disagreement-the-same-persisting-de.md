---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787595492347-tuzvxd
written_at: 2026-08-24T21:44:27.164Z
---

# [approver/human-disagreement] The same persisting defect can move BLOCK→ABSTAIN across revisions when the review TIER changes — BLOCK binds to a 🔴 in the review doc, not the approver's standalone source finding

**Symptom:** On slang#12693, R1 (@fb2339) was recorded BLOCK/RED_BUG for a verified coverage regression (check-actionlint.yml's new `paths:` filter omits `.github/actions/**`, dropping composite-action lint coverage the check had pre-PR). A `synchronize` advanced the head to c2f7b15; the interval diff removed ONLY explanatory comments — triggers/paths:/guards byte-identical, base unchanged — so the defect PERSISTED at head, verified from source. Yet R2 was correctly recorded ABSTAIN_POLICY/OPEN_GAP, not BLOCK, on the same defect.

**Root cause of the (correct) divergence:** The review TIER changed between revisions.
- R1 was FALLBACK tier (production review stale, harvest exit 10) → I decided from Devin's 🔴 as the sole signal → the R1 review doc carried a 🔴 → Step 2's "any 🔴 ⇒ BLOCK" parse-rule fired.
- R2 was PRIMARY tier (harvest exit 0): the production claude-code-action review matched the exact head and was ✅ Clean, explicitly discussing the filter without flagging the omission; AND the head-current Devin ("Analysis is up to date") RETRACTED its own 🔴 (its first pull showed the 🔴 under an "unknown" freshness marker; the up-to-date re-run dropped it). So the R2 review doc carried NO 🔴 in either tier.
- BLOCK is defined as "the review found a verified 🔴 Bug" — it binds to a 🔴 IN THE REVIEW DOC, not to the approver's standalone Step-3 source finding. With no 🔴 in the R2 doc, BLOCK cannot fire. The challenger still found the gap real and uncovered, and "investigation can only add caution, never upgrade," so WOULD_APPROVE was also unavailable → the honest floor is ABSTAIN_POLICY/OPEN_GAP (a human weighs the CI-cost-vs-lint-coverage tradeoff).

**How to catch / apply it:** (1) Re-run the FULL procedure per revision — never carry a prior revision's verdict forward; the decision for Rn cites only Rn's review doc. (2) When two reviewers (production + head-current Devin) clear at head a gap that only a freshness-unconfirmed earlier Devin once flagged, treat that convergence as real evidence the gap is a DEFENSIBLE TRADEOFF, not a hard defect → ABSTAIN (human decides), not BLOCK. (3) Keep one ledger row per commit_sha — the R1 BLOCK correctly stands for its commit; it does not bind the new head. (4) A comment-only interval diff means the substance is unchanged — but the review SIGNAL that classifies it can still legitimately change, so re-harvest rather than assuming the prior classification holds.
