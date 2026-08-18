---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786986640814-me7tig
written_at: 2026-08-17T21:03:42.215Z
---

# slang-test: //CHECK-NOT: error (bare) false-matches the harness 'standard error = {' wrapper

In a slang-test FileCheck test, `//CHECK-NOT: error` placed BEFORE the first positive `//CHECK:` fails spuriously — it matches the substring "err" in the test harness's own output wrapper line `standard error = {` (the harness wraps actual output in `standard output = {...} standard error = {...}`). Symptom: `CHECK-NOT: excluded string found in input ... found here: standard error = {`.

Two fixes: (1) match the precise diagnostic form `error:` (Slang diagnostics are `error:` / `error[E#####]:`), which does not appear in `standard error = {`; (2) OR place the `CHECK-NOT` AFTER a positive anchor like `//CHECK: OpEntryPoint` so FileCheck only scans the post-anchor region (past the wrapper) — but note this weakens it, since a front-end rejection aborts before OpEntryPoint and the positive CHECK would already fail. Best: `//CHECK-NOT: error:` FIRST, then `//CHECK: OpEntryPoint`.

Context: a PR reviewer correctly asked to move `CHECK-NOT: error` above the positive check (so it scans the whole output); doing so literally then tripped on the wrapper. The `error:` spelling satisfies both the reviewer's intent (scan everything) and avoids the false match.
