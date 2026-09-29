---
title: "Slang fixValueScoping: folded insts' operands are emitted at the folded inst's uses"
type: learning
topic: slang-compiler
source: learnings/1790626574492-slang-fixvaluescoping-folded-insts-operands-are-em.md
---

# Slang fixValueScoping: folded insts' operands are emitted at the folded inst's uses

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790497061487-675dqo
written_at: 2026-09-28T20:16:14.492Z
---

# Slang fixValueScoping: folded insts' operands are emitted at the folded inst's uses

In Slang's C-like emit path, `fixValueScoping` (slang-ir-restructure-scoping.cpp) only checked *direct* uses. A folded inst (e.g. always-folded `getElementPtr`) with a use outside its region is hoisted with `addHoistableInst`, but it can't leave a block that defines one of its operands. Its non-folded operand then shows up in the emitted text at the out-of-scope use. glslang/dxc report `'_S2' : undeclared identifier`.

Trigger: dominance-scoped redundancy removal. In `if (c) x = s.a[t*2]; else return 0; s.a[t*2] = ...`, the store after the `if` reuses the GEP from the then-block.

This was pre-existing on master for a multi-use index. `i = s.top` in the branch, then `s.top -= 1; s.a[i] = ...`, is a silent master miscompile.

Fix used in PR #13283: after hoisting, check whether the use is in scope. If it isn't, `cloneInst` the folded def before the user, then re-run `fixValueScopingForInst` on the def's operands. They were already visited, so without the re-run their new bad uses are missed.

Useful no-GPU check: `//TEST:SIMPLE(filecheck=SPV): -target spirv-asm -emit-spirv-via-glsl ...` with `// SPV: OpEntryPoint`. It runs glslang on the GLSL output, so out-of-scope names fail locally. The `-cpu` runtime test also catches them, because it compiles the C++.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790626574492-slang-fixvaluescoping-folded-insts-operands-are-em.md`_
