---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788160103044-c8efqg
written_at: 2026-08-31T07:50:29.546Z
---

# [approver/human-agreement] bulk mechanical test-idiom migration merged as-is: size-cap ABSTAIN is correct, the merits hinge on the ONE underlying behavioral claim (slang#12846)

## Observation
shader-slang/slang#12846 ("migrate the -dump-ir discard idiom off /dev/null") — a ~972-file / 999-directive purely-mechanical `docs/generated/tests/` corpus migration (`-o /dev/null` → `-o -`) plus ~30 generation-prompt edits — **merged by the author at the exact commit I decided on** (`61bac5bd6cfc`, no follow-up commits). My decision was `ABSTAIN_POLICY (CLAUSE_FAIL:tier_eligible)` because ~972 files >> the 150-file cap. Abstain is excluded from agreement scoring, but the merge (APPROVED-equivalent) confirms my on-merits read.

## Transferable rule for this shape
A **bulk mechanical migration of a test-directive idiom across a generated corpus** is a recurring PR shape (see also the sibling `tests/` migration #12333/#12334). Two calibrated takeaways:

1. **The N near-identical edits carry almost no independent risk; the risk lives in the ONE behavioral premise the mechanical change relies on.** Here that premise was "which stream does `-dump-ir` use, and does `-o -` therefore keep it uncontaminated?" Verifying that single claim in source (`-dump-ir` → diagnostic sink → **stderr**, `slang-pass-wrapper.cpp:46`; `-o -` target → stdout; slang-test captures them as separate FileCheck blocks) settles the whole PR far more cheaply than sampling hundreds of directive diffs. When you review this shape, spend your budget on the premise, not the repetitions.

2. **A residual clarity nit that merges unchanged confirms a "low-severity" call.** I flagged that `control-flow/_prompt.md` kept a now-stale "IR dump goes to stdout" sentence after the swap; it merged as-is. For a doc-generation *prompt* file where the emitted command (`-o -`) is correct, a stale rationale sentence is genuinely non-blocking — a maintainer will not gate a bulk cleanup on it. Do not inflate this class of nit toward BLOCK/OPEN_GAP.

## Also confirmed safe about the size-cap abstain
The `tier_eligible` abstain was correct *policy* (route a 972-file change to a human), and the human agreed by merging — but note the abstain was driven purely by file count, independent of the merits. On a large-but-mechanical migration that lands *within* a future tightened size cap, the same clean-merits read (verified premise + clean head-current Devin) is what would justify a WOULD_APPROVE; the shape itself is low-risk.
