# A negative control must differ by exactly one variable — an older binary as baseline certifies any test as discriminating

**Observed 2026-08-04, slang#12150.** A fixer added a regression test and, correctly, tried to prove it *discriminates* (fails without the fix) rather than merely passes. Its first control attempt compared against a conveniently-available older binary at `/workspace/agent/slang`, which emitted **zero `DebugCompilationUnit` records at all**.

⛔ **CORRECTION (same day, by the fixer, while negative-controlling a gate built from this very rule): the "stale/pre-#12148 binary" cause stated here was WRONG.** That Jul-27 binary emits CUs and 6-operand `DebugFunction` records correctly. The zero-CU reading came from the `-a`/`-b` module **fixtures not existing yet** (they landed in `9ac6647730`) — a **missing-input** failure mis-attributed to a **stale-instrument** cause, then reused as evidence in two later arguments. I recorded the wrong mechanism here as fact; I could not re-test it myself (no build dir in my container), so this rests on the fixer's measurement.

**The conclusion survives and strengthens: a zero result from a control has more ways to be an instrument failure than a finding — and one of those ways was the diagnosis itself.** Four distinct causes of a zero-CU false control were seen in one day: absent inputs · wrong comparator (branch-vs-branch) · incomplete target set (missing `slang-glslang`, so `-target spirv-asm` cannot disassemble) · and the mis-attribution above. All four exit `rc=0` or look like a strong pass.

Against a baseline that emits nothing, every CU assertion fails. So that control would have "validated" **any** test — including one that watches nothing, or asserts something unrelated. It is a control that **fails toward *my test works***, i.e. toward shipping a non-discriminating test, which is the direction that later manufactures a false green when the real fix lands.

The valid control was **its own branch minus one commit** (the occurrence fix stashed, rebuilt, re-run): pre-fix the shared-header copy lands on the entry CU, post-fix on the correct module's CU. One variable changed.

**Rule: a negative control must differ from the treatment by EXACTLY ONE variable — the fix.** A baseline that differs by N commits is a different experiment wearing the control's clothes. Practical forms:
- ✅ stash/revert *only* the fix on the current tree, rebuild, re-run
- ✅ sabotage the specific mechanism the test targets, confirm THIS test goes red
- ❌ an older checkout, a release binary, a sibling worktree, "the version I had lying around"

⚠️ **REFINEMENT (same day, after this rule failed to prevent a repeat): "one variable" is necessary but NOT sufficient — you must also name WHICH comparator the claim is about.** The same fixer, having adopted the rule above, then A/B'd a severity claim as *its own branch vs. its branch minus one commit*. That is a clean one-variable experiment — and still the wrong one, because the claim being made was **"no worse than master"** (a ship decision). Branch-minus-one-commit still contained an earlier fix from the same PR, so master's behavior was never measured; the experiment could establish "the last commit didn't regress this" and nothing about the shipping comparator.

So the rule has two parts, and the second is the one that gets skipped:
1. **Differ by exactly one variable** — else you measure a setup difference.
2. **Differ from the comparator the CLAIM names** — "no worse than master" ⇒ baseline is pristine master; "this commit didn't regress" ⇒ baseline is HEAD~1; "the test discriminates" ⇒ baseline is this-tree-minus-the-fix.

A one-variable control against the wrong comparator is *more* dangerous than a sloppy one, because its methodological tidiness is itself reassuring. **Read the claim's wording and let it pick the baseline** — the words "no worse than master" name master, out loud, and the experiment simply didn't use it.

**The tell that saved it:** the control's output was *anomalously* strong — zero CUs rather than wrong CUs. A control that fails far more broadly than your hypothesis predicts is reporting a setup difference, not your effect. So when a control fails, check that it fails **for the reason your test targets**; a control that fails everywhere proves nothing, exactly as a grep returning 0 proves nothing without a positive case.

**Corollary — "it failed, therefore my test is good" is the same error class as "it passed, therefore my fix works."** Both read a single-color signal without asking whether the signal could have come out differently for an unrelated reason. Controls need their own controls: verify the baseline binary is the thing you think it is (here, one `grep -c DebugCompilationUnit` on the baseline output would have exposed it instantly — zero is not "the old behavior", it's "a different build configuration").

**Related, same session:** a second-round automated CODE_REVIEW returning clean is **not** evidence that round-1 findings were addressed — a later pass may examine different things and is not guaranteed to re-derive prior findings. Verify each prior must-fix individually against the diff; treat "clean" as *absence of new findings* only. Same shape: a null result does not name its own cause.
