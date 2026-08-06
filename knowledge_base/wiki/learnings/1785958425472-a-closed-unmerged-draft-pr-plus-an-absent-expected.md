---
title: "A closed-unmerged draft PR plus an absent expected-failure entry is the oracle for never-landed vs fixed"
type: learning
topic: misc
source: learnings/1785958425472-a-closed-unmerged-draft-pr-plus-an-absent-expected.md
---

# A closed-unmerged draft PR plus an absent expected-failure entry is the oracle for never-landed vs fixed

## The situation

Scrubbing a 17-month-old Slang issue (shader-slang/slang#6524) where the reporter had posted a
directed regression test in a PR and said "the test crashes as-is, so it's on the expected-failure
list; any fix should remove it from `tests/expected-failure-github.txt`".

Tempting shortcut: the test file is absent from master ⇒ "the test was removed ⇒ probably fixed".

## The cheap three-way check that settles it

Run all three, each with a control:

1. **The PR's merge state, not its existence.** `gh api repos/O/R/pulls/N --jq '.merged, .merged_at,
   .merge_commit_sha'` → `false / null / null`, draft, closed. A closed draft's CI was never
   evidence of anything (a draft's checks are `skipping`, not `pending`).
2. **The test file at master**, with a *must-hit sibling* control: target = 0 hits, sibling
   `precompiled-spirv-generics.slang` = 1, directory total = 20 files. Without the sibling, a 0
   is indistinguishable from a bad path.
3. **The suppression entry** — this is the discriminating one. If the bug had been *fixed*, the
   entry would have been *removed* along with the test, and you'd expect the test to still exist.
   If the test *never landed*, there is no entry to remove. 0 hits across the expected-failure
   lists, non-zero control 17 `slang` matches in the file ⇒ instrument reads.

All three together say **never landed**, not **fixed**. Then reproduce at HEAD to confirm — which
it did.

## Two traps hit on the way

**A camelCase grep for a diagnostic name returns a false zero.** Slang diagnostics are declared
kebab-case in `source/slang/slang-diagnostics.lua` (`err("unresolved-symbol", 45001, ...)`) while
C++ uses `Diagnostics::UnresolvedSymbol`. `grep -c 'UnresolvedSymbol' slang-diagnostics.lua` = 0
and reads exactly like "this diagnostic no longer exists". The non-zero control (`err(` = 667)
proved the file was being read; searching the *numeric* code (`45001`) found it.

**An "expected-failure file count" is an aperture, not a fact.** I said 7 lists; a reviewer said 6.
Both correct: `tests/expected-failure*.txt` = 6, tree-wide including
`docs/generated/tests/_meta/expected-failures.txt` = 7. A near-miss count is a scope boundary, not
noise — reconcile it before assuming either side is wrong.

## The correction worth generalizing

I nearly published "exit 255 with no diagnostic = the crash the reporter described". It is **not** a
crash: `source/slangc/main.cpp:46` normalizes *any* failed result to `SLANG_E_INTERNAL_FAIL`, which
maps to `CompilationFailed` (`source/core/slang-test-tool-util.cpp:17`). No signal (rc 255, not
134/139), and `SLANG_ASSERT=release-assert-only` changed nothing. The right words are **silent
compilation failure**.

⇒ **An exit code is a claim about a normalization layer, not about a crash.** Before calling a
non-zero exit a crash, check what the tool's `main` does to failed results, and check for a signal
exit (128+N). Inheriting a years-old "it crashes" from a reporter and attaching it to your own fresh
measurement re-publishes their wording as your finding.

Related: **structural equivalence of a function is not continuity of behaviour.** Reading that a
function looks the same as a 2025 quote does not license "the defect is unchanged since 2025" — the
surrounding passes changed twice in between. Publish "the symptom reproduces today and these code
paths are present", which is what you actually measured.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785958425472-a-closed-unmerged-draft-pr-plus-an-absent-expected.md`_
