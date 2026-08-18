---
title: "Multi-round PR review converges; scope down to targeted verify when delta is comment-only"
type: learning
topic: review-process
source: learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md
---

# Multi-round PR review converges; scope down to targeted verify when delta is comment-only

**Chain:** /slang-pr-review on shader-slang/slang#11499 (partial crash-fix for SPIR-V emit SIGSEGV on noinline DescriptorHandle Texture2D sample) — four review rounds with the same three-reviewer panel (A correctness / B Devin / C clarity).

**Trajectory (use as a template for "is the PR converging?"):**
- v1 `be59dae`: A = 4🟡 gaps; C = 6 clarity kept (1 High); 1 material A/C disagreement.
- v2 `1a2f6f0`: A = 2🟡 (one NEW); C = 5 kept (1 High); same A/C disagreement persists.
- v3 `b4ac5e2`: A = 1🟡; C = 3 kept (1 High); **0 disagreements** — A and C converge on one advisory item.
- v4 `8d99ee8`: sign-off; 0 nits remaining.
Monotonic decrease in finding count + disappearance of disagreements = genuine convergence. If finding count plateaus or disagreements recur across rounds, that's the signal to escalate to a human rather than keep cycling.

**Key scope-down decision (the reusable lesson):** v4 was a `1 file changed, 9 insertions(+)` comment-only insert implementing *exactly* the convergent advisory nit both A and C had already asked for. I did NOT re-run the full reviewer pipeline (~$25 + 30 min each for A and C). Instead I did targeted verification: `git diff` to confirm scope (pure additive comment, zero code change), confirmed placement + content (#11503 cross-ref, latent-today rationale, sibling cross-refs), and signed off. **Rule: when the delta since the last full review is comment-only / docs-only and implements an item the reviewers already explicitly requested, a full pipeline re-run produces no new signal — A and C would only confirm what they asked for. Verify the diff is actually that narrow, then green-light.** Burning the full budget on that is waste.

**A/C disagreement adjudication (cross-links the sibling learning):** the v1→v2 disagreement was C's FG004 "match canonical precedent" (getIntType→getUIntType) vs A's "the precedent is itself schema-drifted" (hlsl.meta.slang:832 declares `let format:int`; IRBuilder::getIntValue keys constants on type operand; IRTextureType hoistable → uint 0 ≠ int 0 → un-deduped types). Fixer verified A's three load-bearing claims directly and adjudicated for A. Confirms the meta-bias: "C says X, A says ¬X and shows code" almost always means A.

**Posting note:** this was a reviewer chain with no `<github-post-authorized />` marker, so I returned the combined review via send_file to the fixer (closest-to-the-state, owns the PR) + parent — never posted a GitHub review. Correct per the "post only when authorized" rule; the GitHub-observability obligation for the PR is the fixer's (PR description), not the reviewer's.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1780769199724-multi-round-pr-review-converges-scope-down-to-targ.md`_
