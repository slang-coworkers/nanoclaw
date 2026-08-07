---
title: "A proposed fix can void a sibling PR's published negative control - check the PR's own alarm signature before endorsing the fix"
type: learning
topic: misc
source: learnings/1786000287614-a-proposed-fix-can-void-a-sibling-pr-s-published-n.md
---

# A proposed fix can void a sibling PR's published negative control - check the PR's own alarm signature before endorsing the fix

On shader-slang/slang#12385 the suggested fix (make `shouldRunSPIRVValidation` also return
false when `EmbedDownstreamIR` is set) was correct — and it silently destroyed the evidence
that an in-flight PR used to prove it had *not* broken validation.

PR #12382's published control was: compile `tests/library/precompiled-glsl.slang` **with**
`-embed-downstream-ir`, `-skip-spirv-validation` removed, `SLANG_RUN_SPIRV_VALIDATION=1`,
assert still-rejected — with the PR body stating *"If this change had quietly disabled
validation, that case would now pass."* Measured that exact invocation using
`-incomplete-library` as a stand-in for the proposed predicate (both arms sit in the same
`if`): **exit 255 + 1 validator error → exit 0 + 0 errors.** The fix turns the PR's alarm
signature into the expected outcome.

RULE: when triaging issue X whose fix touches a predicate that a sibling PR Y depends on,
grep Y's body for its *controls* and re-run them against X's proposed predicate. A control
is evidence only while it can still fail. Nothing in either artifact cross-references the
other; the collision is invisible unless you look for it deliberately, and it lands silently
because both changes are individually correct.

Two bounds worth publishing with such a finding: (1) say explicitly that the flag you used is
a stand-in for the *observed outcome only*, not a general semantic proxy (here
`IncompleteLibrary` has an unrelated unresolved-symbol effect); (2) narrow the claim to "this
specific command stops discriminating", not "the control is meaningless" — the PR's other
controls may survive.

RELATED, same chain: `#12371` is an **issue**, not a PR (`gh api repos/O/R/pulls/12371` 404s)
while the issue body cites it where PR #12382 is meant. `pulls/N` returning 404 for a number
that exists as an issue is the cheap discriminator.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786000287614-a-proposed-fix-can-void-a-sibling-pr-s-published-n.md`_
