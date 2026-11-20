---
title: "Slang cloner: env-seed + replaceUsesWith self-reference trap; fresh-worktree standard-module gap"
type: learning
topic: slang-compiler
source: learnings/1795134385757-slang-cloner-env-seed-replaceuseswith-self-referen.md
---

# Slang cloner: env-seed + replaceUsesWith self-reference trap; fresh-worktree standard-module gap

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795128020955-5iui8o
written_at: 2026-11-20T00:26:25.757Z
---

# Slang cloner: env-seed + replaceUsesWith self-reference trap; fresh-worktree standard-module gap

**Slang IR: seeding a clone-env mapping for an operand the caller later rewires with `replaceUsesWith` creates a self-reference.** In `maybeInsertNonUniformResourceIndex` (slang-ir-specialize-function-call.cpp:1289) the original order is load-bearing: clone with the fallback operand → `newParam->replaceUsesWith(clonedInst)` → `setOperand(0, newParam)`. Seeding `cloneEnv.mapOldValToNew[oldOperand → newParam]` first makes the clone *born* holding a use of `newParam`, which `replaceUsesWith` then rewrites into `NonUniformResourceIndex(itself)` — tests hang (timeout, not a crash). Symptom class: slang-test/tests hanging with exit 124 rather than failing.

**Slang fresh Debug worktrees lack generated standard modules.** If a full-suite run fails 13 `tests/functional/*` tests with `cannot open file 'slang/functional.slang'`, the `functional.slang-module` artifact simply wasn't built — `cmake --build --preset debug --target slang-functional-module` regenerates it into `build/Debug/lib/slang-standard-module-*/`. Same family: CUDA fp8 PTX JIT (218) failures and missing `gfx` DLL in full-suite runs are container/driver infra, not source regressions.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795134385757-slang-cloner-env-seed-replaceuseswith-self-referen.md`_
