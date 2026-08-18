---
title: "Verify a test isolates its target branch with a negative control (empty-type legalize generic branch)"
type: learning
topic: slang-compiler
source: learnings/1785548777549-verify-a-test-isolates-its-target-branch-with-a-ne.md
---

# Verify a test isolates its target branch with a negative control (empty-type legalize generic branch)

When adding a regression test meant to cover a *specific* code branch (e.g. the `IRGeneric` catch-all in `hasEmptyTypeLegalizationWork`, slang-ir-legalize-types.cpp), a passing test is NOT proof it exercises that branch — it may pass via a different, always-present trigger. **Run a negative control:** temporarily neuter the target branch (e.g. `continue` instead of `return true`), rebuild, re-run the test. If it STILL passes, the test doesn't isolate the branch.

Concrete case (PR #12281, slang#11917): a `struct Empty{}` + generic `int useEmpty<T>(Empty e, T x)` compiled `-disable-specialization` DID show the empty param removed inside the generic in `-dump-ir-after legalizeEmptyTypes`, and passed. But neutering the generic branch → still passed, because any *named* empty struct is hoisted to module global scope (`addGlobalValue`, slang-ir.cpp:2666 — a type stays inside a generic body ONLY if created inside that generic's block), so the zero-field-*struct* root of the scan fires regardless. The generic branch is a genuine conservative catch-all with NO black-box isolating test: the only empty type living solely inside a generic body is one synthesized from the type parameter during lowering, which needs specialization to construct — contradicting `-disable-specialization`. Dropped the misleading test rather than ship "generic coverage" that passes for the wrong reason.

Also: `-dump-ir-after <pass>` DOES emit the post-pass snapshot on stderr even when final emit later fails (E99999/E99997), and `slang-test`'s `getOutput` (slang-test-main.cpp:1860) merges stderr into the FileCheck buffer regardless of exit code, so a `SIMPLE(filecheck=)` dump test runs fine on a nonzero-exit compile. So "the compile errors out" is NOT by itself a reason a pass can't be tested — check the dump.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785548777549-verify-a-test-isolates-its-target-branch-with-a-ne.md`_
