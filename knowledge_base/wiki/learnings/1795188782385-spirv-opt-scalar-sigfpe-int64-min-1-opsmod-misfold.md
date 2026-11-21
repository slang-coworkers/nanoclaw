---
title: "spirv-opt scalar SIGFPE INT64_MIN/-1 + OpSMod misfold; gateway repo-path gotcha (#13994)"
type: learning
topic: slang-compiler
source: learnings/1795188782385-spirv-opt-scalar-sigfpe-int64-min-1-opsmod-misfold.md
---

# spirv-opt scalar SIGFPE INT64_MIN/-1 + OpSMod misfold; gateway repo-path gotcha (#13994)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795188111528-dey4bf
written_at: 2026-11-20T15:33:02.385Z
---

# spirv-opt scalar SIGFPE INT64_MIN/-1 + OpSMod misfold; gateway repo-path gotcha (#13994)

# spirv-opt const folding: scalar INT64_MIN/-1 SIGFPE + OpSMod zero-remainder misfold (shader-slang/slang#13994)

While answering maintainer skiminki-nv's ask on shader-slang/slang#13994 (comment 7043508138, 2026-11-20), reproduced and posted two upstream SPIRV-Tools bugs — useful for anyone touching Slang's `-O1+` SPIR-V path or the pinned `external/spirv-tools` @ b8c3b64b:

1. **SIGFPE:** scalar i64 `OpSDiv`/`OpSRem`/`OpSMod` with `INT64_MIN`/`-1` crashes spirv-opt `--ccp`/`-O` (exit 136, x86-64 idiv overflow trap). `const_folding_rules.cpp` folds via raw C++ `int64_t` `/`/`%` with only a `b==0` guard. i32 `INT32_MIN/-1` does NOT crash (fold computed in int64 via sign-extension, truncated back); unsigned ops fold correctly at all extremes.
2. **Misfold (new find):** `OpSMod(100,-1)` folds to `-1`; spec-correct is `0`. The sign-adjust `if ((signed_b < 0) != (result < 0)) result += signed_b;` lacks a `result != 0` guard — wrong whenever the remainder is 0 and the divisor is negative. Upstream fold_test.cpp has no exact-multiple test.
- Spec: OpSDiv/OpSRem/OpSMod explicitly declare min-value/`-1` UB; the right upstream fix is refusing to fold that corner (precedent: SPIRV-Tools #4600). Both bugs still in upstream main (2026-11-20), no existing report found.
- **Gotchas:** (a) spirv-opt requires `OpEntryPoint` to list StorageBuffer variables in its interface (SPIR-V 1.4+) — assemble repros with `--target-env spv1.6`; (b) the OneCLI gateway credential path is per-repo: `gh api repos/shader-slang/slang` works but `repos/KhronosGroup/SPIRV-Tools` returns app_not_connected — filing upstream needs that path connected first; (c) SPIRV-Tools builds standalone in ~2 min: point `-DSPIRV-Headers_SOURCE_DIR` at slang's `external/spirv-headers` (the nested submodule is unpopulated).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795188782385-spirv-opt-scalar-sigfpe-int64-min-1-opsmod-misfold.md`_
