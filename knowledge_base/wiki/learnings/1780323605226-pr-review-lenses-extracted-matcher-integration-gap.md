---
title: "PR-review lenses: extracted-matcher integration gap + normalize-before-match blind spot"
type: learning
topic: review-process
source: learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md
---

# PR-review lenses: extracted-matcher integration gap + normalize-before-match blind spot

Two reviewer lenses that surfaced on shader-slang/slang#11385 round 2 (refactor that extracted a string matcher into a shared util + added matcher unit tests):

**1. A pure-matcher unit test is NOT integration coverage.** When a PR extracts a matching/predicate function into a testable util and unit-tests it in isolation, the unit tests prove the *matcher* is correct but say nothing about the *wiring*: that the matcher is actually called at the right point in the loop, that it `continue`s/skips correctly, and that it has the claimed *precedence* over sibling logic (here: exclusion must win over a positive `-test-prefix` selecting the same subtest). A perfectly-correct matcher wired in after the wrong branch would still pass every unit test. Reviewer lens: when you see "added unit tests for the extracted helper," check separately whether the call-site wiring + ordering/precedence is covered. For slang-test specifically, a `slang-test -dry-run -exclude-prefix "…slang.N" <file>` black-box check (asserting the subtest is absent from dry-run stdout, and a second asserting exclude-beats-positive-select) DOES exercise the real scheduling path — so "you can't test runner scheduling" is only half-true (dry-run prints scheduled names without running them). This refines the earlier "slang-test harness test vehicle" learning: unit-test the pure helper AND `-dry-run`-test the wiring.

**2. Normalize-before-match blind spot (cross-platform).** When CLI entries are canonicalized before comparison — e.g. slang-test runs `-exclude-prefix`/`-skip-list` entries through `Path::simplify(…, NoRoot)` in options.cpp before storing — but the matcher compares by *exact string* against an assembled display name, the normalization round-trip is a silent gap. Unit tests that feed the matcher *raw* strings never exercise it. The concrete cross-platform risk: on Windows `kPathDelimiter` is `\`, so a `-dry-run` name copied verbatim (built with `/` from the source filePath) can be rejoined by `Path::simplify` with a different separator than the `testName` it's compared against → the feature silently fails to match on Windows even though Linux `-dry-run` testing (where simplify is a no-op for these names) passes. Reviewer lens: any "match a user-supplied string against an internal string" feature — check whether one side is normalized and the other isn't, and whether the author only tested on the platform where the normalization is a no-op.

**Bonus (Reviewer A self-correction worth trusting):** Reviewer A's subagents twice produced alarming false-positives ("compile error at line X", "the feature/help-text doesn't exist") by reasoning off the local *base* checkout instead of the diff; the editorial-filter stage caught and dropped both. When a subagent claims a hunk doesn't exist or a call site is broken, verify against `gh pr diff` before escalating — base-tree-vs-diff confusion is a recurring Reviewer-A failure mode.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md`_
