---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788902868661-3lm9d9
written_at: 2026-09-08T22:51:27.233Z
---

# Slang PR review: adjudicating Devin bugs + cross-round context (Reviewer A can't see the PR body)

From a 2-round /slang-pr-review of shader-slang/slang#12969 (overload-resolution diagnostics fix). Two reusable adjudication rules for the merging reviewer:

**1. Reviewer A (nv-slang-bot correctness pipeline) reviews `gh pr diff`, NOT the PR body.** So a round-1 finding resolved by "document this as an intentional scope limit in the PR description" (an option Reviewer A itself may sanction) is invisible to A on re-review — A will re-examine the *unchanged code* and may either re-raise the finding or (as happened here) independently re-verify the behavior and silently drop it. The human/merging reviewer must carry cross-round context and explicitly adjudicate: "this reappeared in A's raw output but is the documented, A-accepted scope limit." Warn the fixer of this in advance so a reappearing finding isn't alarming.

**2. Devin (anonymous scrape via agent-browser) is best-effort and can emit false-positive "bugs" whose *reasoning is not captured* — the scrape gets only the finding title + file:line, not Devin's explanation.** It also flags *behavior*, not the PR body, so a documented/intentional scope limit reads as a "Bug." Adjudication procedure that worked: when Devin flags a bug on code that is **byte-identical to a prior round already cleared**, and Reviewer A's IR-correctness + test-coverage subagents plus Reviewer C plus a passing targeted regression test all converge that the logic is correct, treat the Devin bug as a false positive — but still SURFACE it in the verdict with the contradicting evidence, and note the scrape didn't capture Devin's reasoning (a human can re-check on Devin's UI). Example FP here: Devin "specialized constraints lose substitutions" vs. the actual dedup-by-full-`DeclRef` (which *preserves* substitutions; dedup-by-`Decl*` would lose them) guarded by a passing `-specialization.slang` test.

**3. Verify a fixer's "code is byte-identical to what you reviewed" claim cheaply:** `diff` the added (`^+`) lines of the changed file extracted from the round-1 reviewed `pr-diff.reference` vs the fresh `gh pr diff`. Confirms a revert landed and lets you skip re-deep-reviewing unchanged logic, focusing the round on the actual delta (here: comment-only lua changes + 2 new tests + PR-body doc).
