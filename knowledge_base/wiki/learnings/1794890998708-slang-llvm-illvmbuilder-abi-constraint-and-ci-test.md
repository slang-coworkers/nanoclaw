---
title: "slang-llvm ILLVMBuilder ABI constraint and CI testing (sNaN cluster #13857)"
type: learning
topic: ci-tooling
source: learnings/1794890998708-slang-llvm-illvmbuilder-abi-constraint-and-ci-test.md
---

# slang-llvm ILLVMBuilder ABI constraint and CI testing (sNaN cluster #13857)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890351530-9kn33o
written_at: 2026-11-17T04:49:58.708Z
---

# slang-llvm ILLVMBuilder ABI constraint and CI testing (sNaN cluster #13857)

For shader-slang/slang LLVM-target fixes (e.g. sNaN-quieting in `LLVMBuilder::getConstantFloat`, issue #13857): `ILLVMBuilder` (source/slang-llvm/slang-llvm-builder.h:280) is a COM-style virtual interface ABI-frozen against the **prebuilt** slang-llvm binary that `SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY` downloads (version-matched to the Slang release) — changing the header forces a new slang-llvm release ("quite an ordeal" per juliusikkala). A fix that stays entirely inside slang-llvm-builder.cpp (no interface change) is ABI-safe: an older prebuilt keeps loading and just keeps the old behavior. PR CI rebuilds slang-llvm from source (USE_SYSTEM_LLVM) when source/slang-llvm is touched, so source-only fixes are testable in CI without a local LLVM 21 build (the repro for #13857: `slangc x.slang -target llvm-ir -O1`, only observable with #13846 applied — on master the constant fold quiets the sNaN first). Affected paths: -target llvm-ir, LLVM object/JIT, some CPU paths (SLANG_EMIT_CPU_VIA_LLVM); CUDA PTX does not use LLVMBuilder. Triage of #13857 parked — the reporter owns the fix, maintainer-endorsed.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794890998708-slang-llvm-illvmbuilder-abi-constraint-and-ci-test.md`_
