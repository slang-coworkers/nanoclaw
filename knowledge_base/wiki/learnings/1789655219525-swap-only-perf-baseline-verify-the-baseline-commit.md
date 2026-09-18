---
title: "Swap-only perf baseline: verify the baseline commit is actually fix-free (merge-commit trap)"
type: learning
topic: verification
source: learnings/1789655219525-swap-only-perf-baseline-verify-the-baseline-commit.md
---

# Swap-only perf baseline: verify the baseline commit is actually fix-free (merge-commit trap)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787062508793-ddyvx6
written_at: 2026-09-17T14:26:59.525Z
---

# Swap-only perf baseline: verify the baseline commit is actually fix-free (merge-commit trap)

When measuring a Slang IR-pass change with the "swap only the one .cpp, rebuild, compare" method, the baseline you swap in **must be the pre-change source** — and on a branch that has merged `master`, the obvious-looking commit is often wrong.

**The trap (real, from PR #12608 / issue #12604):** I used `git show 0fd3b1cece:source/slang/slang-ir-specialize.cpp` as the "master baseline." But `0fd3b1cece` was a **merge commit** ("Merge branch 'master' into fix/issue-12604") whose tree *already contained the branch's fix*. So my swap compared fix-vs-fix and the delta was meaningless. codex caught it.

**How to verify before trusting any swap perf/byte-identical result:**
- The true merge-base is `git merge-base HEAD origin/master`. For a branch that merged master via a merge commit `M`, that base is `M^2` (the master parent), **not** `M`.
- Confirm the baseline is fix-free by grepping for a marker your change introduces, e.g. `git show <base>:path/file.cpp | grep -c <new-symbol>` — it should be **0** on the baseline and non-zero on HEAD. (Here: `expandUseClosure` count 0 on `d3a113484c`, 6+ on the merge commit and head.)
- Also check master hasn't touched the file since the base: `git diff <base>..origin/master -- path/file.cpp` should be empty (else "vs master" ≠ "vs base").

**Interleaving beats sequential for shared-host perf.** Measuring all-head-then-all-base lets slow host-load drift bias the medians — the *same* Release binary swung ~1633↔1946 ms run-to-run here. Instead, prebuild both `.so`s, save them, and alternate head/base per sample (swap only the in-place `.so`, 8 back-to-back pairs); drift is shared between each pair and cancels out of the delta. This turned a spurious "17% slower" into the true "flat/no regression."

Bonus: a maintainer may explicitly want perf re-measured on the *final* head when the change added a loop *after* the original issue's numbers — measure vs the fix-free merge-base so the delta captures that loop.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789655219525-swap-only-perf-baseline-verify-the-baseline-commit.md`_
