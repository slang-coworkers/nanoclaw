# [approver/human-agreement] PR-12095 ABSTAIN-CHALLENGER_CONCERN-VINDICATED: unproven-🔴-fixed-before-merge, decision-head-not-the-merged-head

## PR shader-slang/slang#12095 — "Fix autodiff promotion placement across loops" (saipraveenb25, autodiff loop family #12071)

**Decision:** ABSTAIN_POLICY (CHALLENGER_CONCERN) @ pinned head `485ba73ba81b`, decided 2026-07-14. Primary claude-code-action = APPROVE_WITH_NITS (0🔴). Abstained on two withheld concerns, chiefly: **CodeRabbit secondary 🔴 SSA-dominance** in `slang-ir-autodiff-transpose.cpp` — the PR reconstructed a forward-block `newInst` referencing a primal `newOperand` placed at `oldLoc` (reverse block), a transient invalid-SSA shape the challenger could not disprove.

**Human outcome (2026-07-30 join, SHA-verified live):**
- MERGED, but the **merged head was `ede2eab8`, NOT my decision head `485ba73b`.** Head moved after my decision.
- Only substantive delta: ONE commit **"Preserve SSA when promoting autodiff operands"** (landed 07-28) — 26+/49- in exactly `slang-ir-autodiff-transpose.cpp`. It DELETED the reconstructed `newInst` path entirely: `promoteOperandsToTargetType` now returns `List<IRInst*>` of promoted operands instead of rebuilding the inst. New code comment verbatim: *"A differential promotion belongs in the forward block, while a primal promotion belongs at its reverse-mode use, so no single block can hold a reconstructed instruction that references both kinds while preserving SSA dominance."* = my concern #1, confirmed a REAL defect.
- `kaizhangNV` APPROVED **only at the revised head `ede2eab8`**; NOBODY approved `485ba73b`. saipraveenb25 self-merged the revised head.
- Recorded `record_human_verdict(485ba73b) = CHANGES_REQUESTED` — the flagged code was changed before it earned an approval.

**Symptom:** An ABSTAIN on an unproven-but-plausible secondary-bot 🔴 that the primary review missed.

**Root cause of the correct call:** Holding at ABSTAIN (not rounding up to WOULD_APPROVE on the FP narrative) meant the pinned head never received a false-safe. The head then moved to fix the exact concern → directional AGREEMENT.

**How to catch / score it:** On a `pr_merged` join, ALWAYS diff decision-head vs merged-head FIRST (join-SHA rule). Here the head moved by one SSA-fix commit — had I stamped APPROVED blindly on the merge event I'd have mis-scored a vindication as agreement-on-a-different-artifact. `record_human_verdict` takes the DECISION commit; a merged-but-revised head where the revision fixes your flagged concern = CHANGES_REQUESTED relative to your pinned SHA, and your ABSTAIN is VINDICATED (do-not-round-up class), not over-caution.

**Fix:** confirmed pattern — ABSTAIN on an unrefuted plausible 🔴 in a representation/SSA-invariant area is warranted even when the primary review is clean and CI is green; the defect can be CI-invisible and only surface via a maintainer-driven revision. Mirrors [[pr-12141-decided]] (OPEN_GAP later remediated in a post-decision commit = full-arc detection+remediation). Contrast [[pr-12098]] false-safe (challenger cleared a design/representation gap as "future-proofing" → the exact axis the human then re-architected). Adjacent autodiff: [[pr-11667]].
