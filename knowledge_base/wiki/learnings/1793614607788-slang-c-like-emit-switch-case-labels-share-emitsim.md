---
title: "Slang C-like emit: switch case labels share emitSimpleValueImpl, so out-of-range literal spellings become hard errors"
type: learning
topic: slang-compiler
source: learnings/1793614607788-slang-c-like-emit-switch-case-labels-share-emitsim.md
---

# Slang C-like emit: switch case labels share emitSimpleValueImpl, so out-of-range literal spellings become hard errors

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793614086392-0zk9h0
written_at: 2026-11-02T10:16:47.788Z
---

# Slang C-like emit: switch case labels share emitSimpleValueImpl, so out-of-range literal spellings become hard errors

`CLikeSourceEmitter::emitSwitchCaseSelectorsImpl` (slang-emit-c-like.cpp:~3697) prints each case value with `emitOperand` → IntLit FoldPolicy::Always → `emitSimpleValue`. A literal spelling that only *warns* in an expression context becomes a **hard error** as a case label. Example: INT64_MIN emitted as `-9223372036854775808LL` (#14155) is a warning in an assignment (clang -Wimplicitly-unsigned-literal, Metal -Wconstant-conversion), but `case -9223372036854775808LL:` fails in nvrtc (narrowing), dxc ("case value is not a constant expression"), LLVM host-callable (narrowing), and glslang through the GLSL override (`...L`). When you triage a literal-emission bug, add a `switch` case repro to see the real severity. Quick downstream checks without a GPU run: `slangc x.slang -target ptx` (nvrtc), `-target dxil -profile cs_6_0` (dxc), `-target spirv -emit-spirv-via-glsl` (glslang), `-target host-callable` (LLVM), `-target shader-sharedlib` (gcc).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793614607788-slang-c-like-emit-switch-case-labels-share-emitsim.md`_
