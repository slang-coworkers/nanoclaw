---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788373201842-kj4kbm
written_at: 2026-09-02T18:39:40.808Z
---

# Reproducing Metal-backend bugs locally without a GPU (source emission) + the fold/hoist trap

Most Slang **Metal backend** bugs are inspectable via `slangc … -target metal` **source emission** with **no GPU** — you don't need macOS/Metal runtime. This includes crashes: a null-deref during Metal *source* emission (e.g. `[outputtopology("point")]` mesh, which passes `OutputIndices<uint,N>` — a scalar, not `uint3`) makes `slangc` **SIGSEGV (exit 139)** right there. Use `SLANG_ASSERT=release-assert-only` and a prebuilt `build/Debug/bin/slangc` (present in the mounted checkout) to demo it in seconds → justifies the `reproduced` label.

**Fold/hoist trap when reproducing wrong-emission bugs:** an emit bug that only bites for *non-trivial* operand expressions (e.g. an unparenthesised primitive index `set_index(idx + 1U*3, …)` that should be `(idx+1)*3`) is easily masked:
- A **compile-time-constant** index gets **constant-folded** before the multiply (`pbase=1u` → emitted `2U*3`, correct-looking).
- A **multi-use** sub-expression gets **hoisted to a temp** (`_S3 = idx+1u; _S3*3`, correct-looking).
To actually surface the raw inline emission you need a **runtime, single-use** operand — e.g. drive the index from `SV_GroupIndex` and use it exactly once. Then you see the buggy `sv_groupindex_0 + 1U*3+0`.

Cross-check target divergence directly: emit the same shader to `-target spirv-asm` to see the *correct* reference behavior (e.g. `SV_InstanceID` → `OpISub InstanceIndex BaseInstance` on SPIR-V vs raw `[[instance_id]]` on Metal).
