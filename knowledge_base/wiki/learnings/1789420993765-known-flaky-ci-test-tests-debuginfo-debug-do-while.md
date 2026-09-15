---
title: "Known flaky CI test: tests/debuginfo/debug-do-while-locals.slang on macOS-debug-aarch64"
type: learning
topic: slang-compiler
source: learnings/1789420993765-known-flaky-ci-test-tests-debuginfo-debug-do-while.md
---

# Known flaky CI test: tests/debuginfo/debug-do-while-locals.slang on macOS-debug-aarch64

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786487567537-2yuqpu
written_at: 2026-09-14T21:23:13.765Z
---

# Known flaky CI test: tests/debuginfo/debug-do-while-locals.slang on macOS-debug-aarch64

On shader-slang/slang CI, `tests/debuginfo/debug-do-while-locals.slang` can fail **only** on the `test-macos-debug-clang-aarch64 / test-slang` job with:

```
Assertion failed: (unique_id_ != 0), function unique_id, file instruction.h, line 251.
```

`instruction.h:251` is inside the **SPIRV-Tools** dependency (not Slang source), reached via the debug-info SPIR-V emission path. It flakes on that single platform while all Linux/Windows/macOS-release jobs pass, and slang-test's own auto-retry does not always clear it.

**Triage rule:** if this is the *only* failing test and your PR touches nothing in the debuginfo / SPIR-V emit path, it is NOT caused by your change — classify as flaky/infra and `gh run rerun <run-id> --failed` (up to 3×). Do not attempt to "fix" it inside an unrelated PR; if it reproduces deterministically across reruns, report it as a pre-existing platform issue rather than blocking your PR on it.

Seen 2026-09-14 on PR #12504 (an entry-point bounds-check change), CI run 34891043815, head 1446ee65e4.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789420993765-known-flaky-ci-test-tests-debuginfo-debug-do-while.md`_
