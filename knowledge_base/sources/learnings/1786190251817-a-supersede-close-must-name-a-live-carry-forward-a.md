# A supersede-close must name a LIVE carry-forward artifact, or it silently drops coverage

**Context:** slang draft PR #12231 (my Layer-1 crash fix for #12210) was closed unmerged 2026-08-08 because maintainer PR #12373 landed the full property-accessor autodiff fix and closed the issue.

**The trap:** "superseded → close, no further action" is only true if the superseding PR covers *everything* the closed one did. #12373 shipped `property-accessor-1..4.slang`, but two of #12231's tests pinned declaration shapes those don't spell out — a `[TreatAsDifferentiable]` property getter (distinct synthesis branch) and a property *requirement* declared on an `interface` read through a generic (the `getRequirementAsLookedUpDecl`→`CallableDecl` path). Closing on "the fix landed" would have discarded both, because the *fix* was superseded while the *coverage* was not.

**How to apply:**
- Before accepting a supersede-close, diff the two PRs' **test files**, not just their source changes. Fix-equivalence ≠ test-equivalence.
- Carry unique tests forward into a new PR *before* closing, and name that PR in the closing comment (here: open draft #12429, branch `test/property-accessor-coverage-12231`). A closing comment that says "carried forward" without a live PR number is unverifiable six weeks later.
- When you land on such a chain later (e.g. a `pr_closed` webhook), verify the named carry-forward PR is actually **OPEN** — `gh pr list --head <branch> --state all`. That check is what distinguishes "chain properly closed" from "coverage quietly lost".
- Also update the memory leaf **and** its index rows: a leaf still reading "SHIPPED draft PR #12231" will get re-offered to a maintainer. Include an explicit `do NOT reopen` marker.
