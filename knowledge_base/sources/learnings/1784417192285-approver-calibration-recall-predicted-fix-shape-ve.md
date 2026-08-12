# [approver/calibration] recall-predicted-fix-shape-verify-diff-matches-prediction

## Symptom
PR #12152 (shader-slang/slang) "Fix #9403: emit compute entry-point wrappers as prototypes in -target hpp", nv-slang-bot fixer PR, was decided WOULD_APPROVE (CLEAN) on the Devin-only fallback tier with high confidence because Step-0 recall had already triaged issue #9403 and **predicted the exact principled fix shape**.

## Root cause / context
When the fix issue was triaged earlier, a learning recorded the two-gap root cause AND the correct fix: guard the compute-wrapper loop in `CPPSourceEmitter::emitModuleImpl` (source/slang/slang-emit-cpp.cpp) on `shouldEmitOnlyHeader()` and emit the three wrappers (name, name_Group, name_Thread) as **prototypes** (`;`-terminated), with NO `_example` forward-declaration (dead code once bodies are gone). It also flagged three challenger axes: (1) any wrapper BODY left in header mode = ODR/link BLOCK; (2) the regression test MUST use `__extern_cpp`/`export` or it doesn't reproduce (plain compute entry point is DCE'd and emits nothing in hpp); (3) a dead `_example` forward-decl = nit, not blocker.

## How to catch it / apply
When Step-0 recall surfaces a prior triage of the SAME issue the PR fixes, the recalled fix prediction becomes a concrete diff checklist. Verify the actual diff matches the prediction axis-by-axis against source at the pinned head (git show FETCH_HEAD). Here the diff matched exactly: guard emits 3 prototypes + `continue` (cpp.cpp:2405-2420), `shouldEmitOnlyHeader()` override = `m_target==CodeGenTarget::CPPHeader` (cpp.h:47, hpp-only, cpp/CUDA untouched), test uses `[shader("compute")] __extern_cpp void example(){}` with `//CHECK-NOT: _example`, and no forward-decl added. A shared `_emitEntryPointSignature` extraction kept the definition path byte-identical.

## Fix / takeaway
A recalled fix-shape prediction is the strongest prior a challenger can have — but it is a checklist to VERIFY against source, never a substitute for reading the diff. The match here (plus 6/6 clauses, Devin 0-bug head-current, CI 46✓/0-fail with the CPU test-slang legs green) is what justified WOULD_APPROVE on a Devin-only tier. If the diff had DEVIATED from the prediction (e.g. left a body, or added the dead forward-decl), that deviation is exactly the signal the recall exists to surface.
