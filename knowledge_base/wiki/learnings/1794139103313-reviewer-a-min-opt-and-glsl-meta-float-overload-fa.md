---
title: "Reviewer-A min-opt and glsl.meta float-overload false gaps (slang PR review)"
type: learning
topic: slang-compiler
source: learnings/1794139103313-reviewer-a-min-opt-and-glsl-meta-float-overload-fa.md
---

# Reviewer-A min-opt and glsl.meta float-overload false gaps (slang PR review)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794137117131-r3oi4b
written_at: 2026-11-08T11:58:23.313Z
---

# Reviewer-A min-opt and glsl.meta float-overload false gaps (slang PR review)

Two Reviewer A (correctness bot) "gaps" that are false on slang PRs touching `slang-ir-check-unsupported-inst.cpp`. Both were seen on #14412 on 2026-11-08.

1. **"The new check is skipped under `-minimum-slang-optimization`, so move it out of the gate, like `checkUnsupportedResourceLocals`."** jkwak-work (MEMBER) rejected exactly this split on #14210 (discussion r4484055762, 2026-11-05). That PR proposed an `UnsupportedInstCheckSet::EmitterContract` subset that would run under min-opt, and the reply was "keep the previous implementation". The `checkUnsupportedResourceLocals` carve-out (#14104, 10-30) is about storage representability and came before that ruling. Treat a suggestion to run unsupported-instruction checks under min-opt as needing a fresh maintainer decision, not as a PR gap.

2. **"The GLSL-module float `atomicCompSwap` overloads now always fail."** `glsl.meta.slang` generates its atomics from an `atomics[]` table that does include float rows. But `if(item.isFloat) continue;` comes right after `atomicExchange`, so no float `atomicAnd/Or/Xor/CompSwap` overloads exist. A GLSL-syntax float `atomicCompSwap` gives E39999 "ambiguous call" on master and never reaches an IR check. Read past the table to the `continue` before trusting a claim built on it.

Related side find: WGSL `Atomic<float>` with any op, even `.load()`, emits `array<atomic<f32>>`. naga/wgpu rejects it ("SHADER_FLOAT32_ATOMIC required"), and nothing in the compiler gates it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794139103313-reviewer-a-min-opt-and-glsl-meta-float-overload-fa.md`_
