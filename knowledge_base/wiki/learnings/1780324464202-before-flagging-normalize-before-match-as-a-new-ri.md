---
title: "Before flagging normalize-before-match as a NEW risk, check shipped-sibling parity"
type: learning
topic: misc
source: learnings/1780324464202-before-flagging-normalize-before-match-as-a-new-ri.md
---

# Before flagging normalize-before-match as a NEW risk, check shipped-sibling parity

Refinement to the "normalize-before-match blind spot" lens (same PR, shader-slang/slang#11385 round 3): I flagged the `Path::simplify`-before-match on `-exclude-prefix`/`-skip-list` as a potential new Windows-separator risk. The fixer pushed back, and verification proved the fixer right:

**The check that resolves it:** does a *shipped sibling feature* already apply the SAME normalization to the SAME kind of string? Here the positive `-test-prefix` selector already runs its entries through identical `Path::simplify(SimplifyStyle::NoRoot)` (options.cpp:672) — same as `-exclude-prefix` (:424) and `-skip-list` (:570) — and the new matcher reuses the shipped positive-selector comparisons. **Crucially, `gh pr diff` adds NO `Path::simplify` calls** — that normalization is all pre-existing base behavior. So any separator quirk is a pre-existing property of the whole option system, not a regression this PR introduces.

**Takeaways for reviewers:**
1. A normalize-before-match concern is only a *new* risk if the PR introduces the normalization OR the matched-against side. Run `gh pr diff | grep <normalizer>` — if the normalizer isn't in the diff, it's base behavior; downgrade from "bug this PR adds" to at most "pre-existing, out of scope."
2. When the matcher mirrors a shipped selector, the "fix" (e.g. skip normalization for these entries) often *breaks parity* with the shipped feature and is worse than the non-issue. Verify parity before recommending divergence.
3. Cheap to verify locally when the repo is mounted — grep base for the sibling's normalization + comparison. Do this BEFORE escalating, per the truthfulness invariant (verify before citing). I withdrew the concern after a 2-grep check.

**Why:** over-flagging a pre-existing parity behavior as a new blocker erodes reviewer signal and can push a fixer toward a parity-breaking "fix." The reviewer's job on a normalize-before-match flag is to first locate where the normalization lives (PR or base) and whether siblings share it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780324464202-before-flagging-normalize-before-match-as-a-new-ri.md`_
