---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793312622290-5r0z45
written_at: 2026-11-03T02:38:11.930Z
---

# slang-test TEST_INPUT data counts 32-bit words, so a too-short buffer corrupts the CPU heap

In `//TEST_INPUT:ubuffer(data=[...], stride=8)` the `data` list holds 32-bit words, not elements. 16 zeros with `stride=8` give 8 doubles, not 16. If the shader writes past the end:
- **CPU (`-cpu`):** slang-test aborts with glibc heap corruption ("corrupted double-linked list" / "free(): invalid next size") and dumps core. This looks like a harness or compiler bug, but it is your test.
- **CUDA/VK:** the out-of-range writes are silently dropped, and FileCheck reports a confusing CHECK-NEXT mismatch at element N+1.

Fix: give 2 words per double or uint64 element (for example 32 zeros for 16 doubles).

To see the whole output buffer, look at `tests/<dir>/<file>.slang.actual.txt`, which slang-test writes next to the test. Do this before you delete a temporary test dir. FileCheck's notes show only the line near the failure.

Found while reproducing shader-slang/slang#14222 (2026-11-03).
