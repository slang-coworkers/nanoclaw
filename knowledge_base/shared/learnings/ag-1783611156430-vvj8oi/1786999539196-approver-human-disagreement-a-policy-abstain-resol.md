---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786997458936-n09hgw
written_at: 2026-08-17T20:45:39.197Z
---

# [approver/human-disagreement] A policy abstain resolved by a merge is NOT a disagreement — score by reason family, not by decision string

## Symptom
slang#12580 (doc-only fix, author `nv-slang-bot[bot]`): I recorded ABSTAIN_POLICY with reason_code `CLAUSE_FAIL:author_trust`. The PR then merged unchanged (head == my decided commit `9319475feb0d`, single commit, zero follow-up commits) by a MEMBER who had already APPROVED at that head. A naive join — "I abstained, the human merged, therefore mismatch" — or the falsifiable frame "material enough not to merge as-is? a clean merge REFUTES it" — would score this as a false-abstain / disagreement. Both are wrong here.

## Root cause
An `ABSTAIN_POLICY` is not one thing. Its reason_code splits into two families with opposite calibration meaning against a merge:
- **Code-concern family** (`OPEN_GAP`, `CHALLENGER_CONCERN`): asserts "there may be something in the code a human should weigh." A clean merge with no interval fix *does* pressure this reading — score it.
- **Policy family** (`CLAUSE_FAIL:author_trust`, protected-path, size/class ineligible): asserts nothing about the code — only "this class of PR is not eligible for shadow auto-approval; route to a human by rule." A merge is the policy working as designed (a human took over), NOT evidence the abstain was wrong. `author_trust` in particular is explicitly "never optimized toward zero."

## How to catch it
On a `pr_merged`/`pr_review` join for an ABSTAIN row, read the **reason_code first**:
1. Policy-family reason (author_trust / protected_path / tier) → the merge confirms correct routing. The calibration signal that matters is whether your **informational challenger read** of the code agreed with the outcome (here: my "correct doc fix, would-approve but for author_trust" matched the merge). If it agreed, record a short "confirmed safe" — do not log a disagreement.
2. Code-concern reason (OPEN_GAP etc.) → apply the falsifiable frame: diff the interval commits; a merge with no fix means the human judged the gap immaterial → that IS a soft false-abstain worth a learning.

## Confirmed-safe shape (transferable)
Doc-only PRs that correct an enum's documented integer values to match a `$(...)`-spliced core-module enum (e.g. `hlsl.meta.slang` splicing `slang-type-system-shared.h` `kCoreModule_*` constants) are reliably verifiable from source at the pinned head and merge unchanged. Verify: (a) the doc block is hand-written, not an auto-generated artifact (no generator ref, no `docs/generated/` copy); (b) the corrected values equal the spliced C++ constants; (c) adjacent staleness in the same fenced block belongs to a *different* enum and is separately tracked → out of scope, does not undermine the PR's stated purpose (cf. slang#12344 docs-fix discipline).

## Fix
When joining an abstain, branch on reason family before scoring. A policy-family abstain that a human resolves by merging is agreement-with-the-policy, not disagreement-with-the-code; the code-calibration check for it is the informational challenger read vs the merge, not the abstain-vs-merge decision string.
