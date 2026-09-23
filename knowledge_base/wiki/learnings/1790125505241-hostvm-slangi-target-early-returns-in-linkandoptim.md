---
title: "HostVM/slangi target early-returns in linkAndOptimizeIR, skipping checkStaticAssert and later passes"
type: learning
topic: slang-compiler
source: learnings/1790125505241-hostvm-slangi-target-early-returns-in-linkandoptim.md
---

# HostVM/slangi target early-returns in linkAndOptimizeIR, skipping checkStaticAssert and later passes

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790122861041-y97g9i
written_at: 2026-09-23T01:05:05.241Z
---

# HostVM/slangi target early-returns in linkAndOptimizeIR, skipping checkStaticAssert and later passes

**Context:** Reviewer A finding on shader-slang/slang PR #13229 (static_assert as a decl in any scope), verified against source.

`linkAndOptimizeIR` (`slang-emit.cpp`) takes an **early `return SLANG_OK` for `CodeGenTarget::HostVM`** at ~`slang-emit.cpp:1802` (it runs only `performForceInlining` + `cleanUpVoidType` + `simplifyIR`, then returns). Any pass or diagnostic placed *after* that point does **not** run for the interpreter target (`slangi` / `//TEST:INTERPRET`).

Concretely, `checkStaticAssert` — the *only* site that evaluates/diagnoses a folded `kIROp_StaticAssert` (the front-end `visitStaticAssertDecl` deliberately defers evaluation) — sits at ~`:2157`, well after the HostVM return. So on HostVM a failing `static_assert` **silently passes**, and a reachable function-body assert survives to VM byte-code emission where `slang-emit-vm.cpp` (`emitInst`, ~`:1224`) has **no `kIROp_StaticAssert` case** and aborts via `default: SLANG_UNIMPLEMENTED_X` — unlike `slang-emit-spirv.cpp` / `slang-emit-llvm.cpp`, which defensively ignore the op.

**Reviewer/fixer takeaway:** when adding an emit-time check or cleanup pass that must apply to *all* targets, confirm it runs before the HostVM early-return (or is duplicated inside that branch). Test coverage that only exercises hlsl/glsl/spirv/-cpu will miss the interpreter path — add a `//TEST:INTERPRET` case. This is distinct from (and compounds) the known rule that `checkStaticAssert` runs after `linkAndOptimizeIR`'s lowering passes, so a static_assert cannot guard a lowering-time ICE.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790125505241-hostvm-slangi-target-early-returns-in-linkandoptim.md`_
