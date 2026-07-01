---
title: "slang-test harness changes: .slang test rule N/A, but slang-unit-test is the right vehicle"
type: learning
topic: slang-compiler
source: learnings/1780320008141-slang-test-harness-changes-slang-test-rule-n-a-but.md
---

# slang-test harness changes: .slang test rule N/A, but slang-unit-test is the right vehicle

When reviewing/writing a PR that changes **slang-test harness behavior** (test selection, `-exclude-prefix`/`-skip-list` matching, subtest expansion — e.g. shader-slang/slang#11385 for #11384):

- The CLAUDE.md "every fix ships with a `.slang` test under tests/" rule **does not apply** — there is no `//TEST` directive that can assert on test-runner *scheduling* (which subtests run), only on compiler behavior. Don't ding a harness PR for lacking a `.slang` test; `-dry-run` (no GPU) is the acceptance check named in #11384 and is legitimate.
- A **`slang-unit-test` IS feasible** and is the correct regression vehicle. Direct precedent: `tools/slang-unit-test/unit-test-test-tool-util.cpp` unit-tests `TestToolUtil` because that logic lives in the `core` library the unit-test module links.
- **The blocker** is almost always that the helpers under test (`getSubtestIndex`, `insertSubtestIndex`, exclusion matchers) are file-local `static` in `tools/slang-test/slang-test-main.cpp`, compiled only into the `slang-test` executable. The fix path: extract the pure helpers into a shared `source/core/slang-test-tool-util.{h,cpp}`, then add a `unit-test-*.cpp` asserting the subtle rules (`.6`≠`.60` exact stem, `.0` printed-form vs bare-stem split, full-name equality, exclusion-precedence-over-positive-selection).

**Why:** Reviewer A correctly flagged "no automated regression guard" as a *Gap* (not a blocker) on #11385 while acknowledging the `.slang` rule was inapplicable — the actionable wasn't "add a .slang test" but "extract statics + add a unit test, or record the gap as an explicit out-of-scope decision." **How to apply:** On any slang-test harness PR, don't reflexively demand a `.slang` test; instead evaluate whether the changed logic is pure-enough to extract + unit-test, and recommend that path (or an explicit recorded decision) rather than treating `-dry-run`-only verification as a hard failure.

Side note (refines the Devin done-detector learning): Devin's `## AI Analysis` can render the FULL analysis (complete bug table + narrative) while a stale `Generating...` caption still sits at the top. Don't treat presence of "Generating..." as proof of incompleteness — re-scrape and trust `generating:false` + explicit Bugs/Flags **counts** (0/0) over the caption.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780320008141-slang-test-harness-changes-slang-test-rule-n-a-but.md`_
