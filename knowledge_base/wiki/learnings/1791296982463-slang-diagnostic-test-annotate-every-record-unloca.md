---
title: "Slang DIAGNOSTIC_TEST: annotate every record; unlocated internal errors cannot be caret-anchored"
type: learning
topic: slang-compiler
source: learnings/1791296982463-slang-diagnostic-test-annotate-every-record-unloca.md
---

# Slang DIAGNOSTIC_TEST: annotate every record; unlocated internal errors cannot be caret-anchored

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787077343416-vc5576
written_at: 2026-10-06T14:29:42.463Z
---

# Slang DIAGNOSTIC_TEST: annotate every record; unlocated internal errors cannot be caret-anchored

From shader-slang/slang#12875 (2026-10-06).

1. **`E99997` (internal `SLANG_UNEXPECTED` abort) is unlocated.** Its machine-readable location is `0:0`, so no `DIAGNOSTIC_TEST` caret can anchor it. If a maintainer wants a test to pin *where* an error lands and the error is E99997, the compiler must emit a real located diagnostic first. That is a scope question for the maintainer: ask before building it.
2. **Diag mode is exhaustive per record, and a located error emits two records:** an `error` row (code + title) and a `span` row (the message). Annotate both at the same caret, e.g. `//CHECK: ^ E41202` and `//CHECK: ^ <message substring>`. With only one of them, the test fails "Found 1 diagnostic(s) without annotations".
3. **Diag-mode matching is a literal substring against a single field** (message, severity, code, or severity+code). FileCheck `{{.*}}` is not interpreted, and code and message are never concatenated. So `CHECK: E99997{{.*}}non-simple operand` fails, while `CHECK: E99997` alone passes.
4. **Prove the anchor is load-bearing.** Move the caret one column, then move the annotation to another line; both must fail. Also do a compiler revert drill (`false &&` the new branch) and confirm the test fails.
5. **A user `bit_cast<Word>(Empty{})` never reached `lowerBitCast`'s located E41202**, because empty-type legalization removes `Empty` first. We report the same `NotEqualBitCastSize` from `legalizeBitCast`. `sourceLoc.isValid()` is NOT evidence that a cast was user-authored: lower-to-ir and inlining give compiler casts locations too. The provenance argument has to come from enumerating the `BitCast` producers.
6. **Build gotcha:** if ninja errors with `/usr/lib/x86_64-linux-gnu/libcuda.so ... missing`, the container's GPU driver is gone. Reconfigure with `-DCUDA_cuda_driver_LIBRARY=/usr/local/cuda/targets/x86_64-linux/lib/stubs/libcuda.so`. That is enough for CPU / `-target cpp` tests.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791296982463-slang-diagnostic-test-annotate-every-record-unloca.md`_
