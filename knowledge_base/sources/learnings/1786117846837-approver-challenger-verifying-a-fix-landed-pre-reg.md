# [approver/challenger] Verifying a fix landed: pre-register the pass bar, count passes not badges, and control your nulls

# [approver/challenger] How to verify a prescribed fix actually landed

From clearing a BLOCK on slangpy#1090: I had blocked on a test crashing the pytest worker
on Vulkan across 4 CI legs; the next revision bumped a submodule gitlink to pull in the
upstream fix. Three techniques did the work, and they generalize to any "did the fix
work?" re-review.

## 1. Pre-register the pass bar before the evidence exists

Before CI finished I wrote into the artifact: *vulkan PASSED ×4, metal PASSED, cuda PASSED
via its not-implemented branch, `_invalid[cuda]` SKIPPED — anything else and I don't clear
the block.* Then I held to it when 2 of 4 legs were green and the mechanism already
matched, which is exactly the moment the bar wants renegotiating.

This converts a post-hoc reading into a test. Without it, "the fix looks right and CI is
mostly green" licenses waving through the supporting detail — and the specific rows you'd
skip (the cuda ones) are the ones that would reveal a test silently changing shape.
Include the boring rows in the pre-registration for that reason.

## 2. A rising pass count beats a green badge

Both legs went `1 failed, 4139 passed` → `4148 passed, 0 failed`: **+9 passes, +8
collected**. That distinguishes *"the test now passes"* from *"the test silently stopped
running"* — a green conclusion cannot. `0 failed` is compatible with the test being
skipped, deselected, or collected away; a pass count that *rose by the number of
parametrizations you expect to gain* is not.

(Watch the arithmetic: passes and collected differ when the earlier run had failures.
4139→4148 is +9 passes but 4140→4148 = +8 collected. I got this wrong first time.)

## 3. Control your nulls

I reported `crashed while running` = 0 on every leg — but a zero from a grep is equally
consistent with "no crashes" and "wrong pattern / empty fetch". So I ran a positive
control on the *same* fetch: `PASSED` returned 4151 / 4191 / 5692 / 5753 / 1775 lines.
Now the zero is a claim about the crashes rather than about my regex.

This exact error had already happened twice in the same review chain — someone grepped a
Windows-only crashpad string against a Linux log, got 0, and briefly read it as "no crash
on Linux". **A null from a platform- or format-specific pattern is a claim about the
pattern, not the platform.** Always pair a null with a non-zero control from the same
source.

## Also worth carrying

- **Read the fix at the pinned commit, not the PR that fixed it.** Fetch the submodule at
  the new sha and grep the changed function. Here `fixupBufferDesc` went 1→2 occurrences
  in `vk-buffer.cpp`, the second inside `createBufferFromNativeHandle`.
- **A gitlink `+1/−1` is not a one-line change.** Enumerate `git log old..new`: this one
  carried 3 commits / ~270 lines, including an unrelated `vk-pipeline.cpp` rewrite. That
  cuts both ways — the remedy direction hides payload just as the risk direction does.
- **Check whether the fix's commit message refines your own mechanism.** #813's message
  supplied a step I'd missed (`requireDefaultStates()` transitioning *back* to the default
  state, making `Undefined` the barrier *destination*). I verified it in source rather than
  accepting the narrative — right instinct even when the narrative turns out correct.
- **Re-verify a previously-recorded follow-up instead of assuming either way.** The
  separate uninitialized-`m_memory` defect was untouched by the fix; I confirmed
  `vk-buffer.h` was not in the diff rather than presuming it had or hadn't been fixed.
- **A stale bot signal on a gitlink-only revision is worse than usual**, because the
  gitlink *is* the entire delta — the one thing a stale analysis is blind to. Re-run the
  tool rather than reasoning around the gap.
