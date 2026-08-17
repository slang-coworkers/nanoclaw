---
title: "A guard's comment is not its predicate — read the filter expression"
type: learning
topic: misc
source: learnings/1785961564124-a-guard-s-comment-is-not-its-predicate-read-the-fi.md
---

# A guard's comment is not its predicate — read the filter expression

Found scrubbing shader-slang/slangpy#274 (bool is 1 byte on CUDA/Metal, 4 elsewhere).

`test_buffer_cursor.py:245` reads: `# Filter out all bool tests for CUDA/Metal backend`. The code beneath it is `tests = [x for x in TESTS if "bool1" not in x[0]]` — a substring test matching **`f_bool1` and nothing else**. The TESTS table holds seven bool entries (`f_bool`, `f_bool1`, `f_bool2/3/4`, `f_bool_array`, `f_bool2_array`); **six still run on CUDA/Metal and pass.** So the issue's live blast radius was six-sevenths narrower than its own guard advertised, and my first published verdict inherited the comment's framing before I evaluated the expression.

Three transferable points:

**1. A comment claiming wider coverage than its code delivers is the same failure class as a scan that can't see what it's looking for** — it reads as protecting more than it does, and reviewers quote it instead of the predicate. When a guard is your evidence for "bug is live", evaluate the predicate against the actual data table. For a substring filter, enumerate what it matches: `[n for n in names if "bool1" in n]`.

**2. Distinguish a coverage *filter* from a *detector*.** This one doesn't skip the affected backends — it silently narrows the generated struct so the field is never emitted. Result: tests run, pass, and test one field fewer. **Nothing in CI can go red when the bug regresses *or* when it's fixed**, and "all green on Metal" reads as bool being covered there. A fix should replace the filter with an assertion that can actually fail. (Related trap: the real runtime check at `cursor_utils.h:594-601` only catches *oversized* writes; a 1-byte bool into a 4-byte slot is a *smaller* write and passes it. The hazard is even annotated in-source at `:459-461` yet unguarded on the default path.)

**3. "Only case excluded" ≠ "only case broken."** Whether `bool1` is genuinely the sole failure or merely the one someone got around to excluding decides whether the fix is a one-line vector bug or a general layout bug. Not answerable from source — leave it as the owner's first experiment (drop the filter, run on CUDA/Metal) rather than picking.

**Also: shared vocabulary is not shared cause.** #274 and #899 both say "bool" with the same assignee, but are independent: #899 is a *missing dtype mapping* (clean `ValueError`), #274 is a *size/layout mismatch* (silent corruption). Neither blocks the other, though fixing #899 admits bool into the layout machinery #274 governs — a sequencing risk, not a dependency. Check before asserting either.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785961564124-a-guard-s-comment-is-not-its-predicate-read-the-fi.md`_
