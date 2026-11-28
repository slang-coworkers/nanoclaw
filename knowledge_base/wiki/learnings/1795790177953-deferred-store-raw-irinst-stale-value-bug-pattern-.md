---
title: "Deferred store + raw IRInst* = stale-value bug pattern; 10-min empirical verify recipe (Slang SPIR-V legalization)"
type: learning
topic: slang-compiler
source: learnings/1795790177953-deferred-store-raw-irinst-stale-value-bug-pattern-.md
---

# Deferred store + raw IRInst* = stale-value bug pattern; 10-min empirical verify recipe (Slang SPIR-V legalization)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795788461443-lm48pp
written_at: 2026-11-27T14:36:17.953Z
---

# Deferred store + raw IRInst* = stale-value bug pattern; 10-min empirical verify recipe (Slang SPIR-V legalization)

# Review heuristic: deferred stores holding raw IRInst* break replaceUsesWith propagation (slang #14741 r1)

A Slang IR pass that **defers** an operation (stores emitted at the end of `processModule`) while
recording the operand as a **raw `IRInst*` in a side list** silently escapes the use-def chain:
later worklist steps that rewrite that inst via `replaceUsesWith(newInst)` can no longer see the
deferred use, so the deferred op resurrects the stale/un-normalized instruction. In
slang-ir-spirv-legalize.cpp (PR #14741), a module-scope general-form `MakeVector`
(`float4(1.0, float2(2.0,3.0), 4.0)`) read with a dynamic index got cached by `processGetElement`,
whose removal of the getElement dropped the value's last use; `processConstructor` then normalized
the MakeVector via `replaceUsesWith(newMakeVector)` with zero remaining uses to redirect, and the
deferred entry-point store emitted the pre-normalization MakeVector → `OpConstantComposite %v4float
%float_1 %12 %float_4` (3 constituents, 4 elements) — **invalid SPIR-V that spirv-val rejects**.
The green 1248/1248 tests/spirv suite could not catch it (no test compiles a mixed-operand
module-scope vector constructor with a dynamic index).

How to verify such a finding in ~10 min on a fresh verify worktree at the PR head:
- Build with `cmake --build --preset release --target slangc slang-glslang spirv-dis spirv-val`
  (DXIL off); without the extra targets, `-target spirv-asm` dies with E00100/E99996. Put
  `build/external/spirv-tools/tools/Release` on PATH for spirv-val.
- Repro template: `static const float4 kVec = float4(1.0, float2(2.0, 3.0), 4.0);` +
  `kVec[id.x % 4]`, `-O0 -target spirv-asm -emit-spirv-directly`; grep for `OpConstantComposite`
  constituent count, then confirm with spirv-val.
- Fix direction that restores the invariant: keep the value in the use-def chain (initializer
  child or operand-bearing decoration on the shared global) so `replaceUsesWith` updates it.

Also from the same round (cheap empirical adjudication of Devin title-only cards): a **mutable**
`static` array read with a dynamic index does NOT take the shared-global path (one global, direct
stores, mid-shader mutation lands in the same variable) — so "module-scope ⇒ immutable" premises of
such fixes can be probed with a 10-line .slang + grep instead of hand-waving.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795790177953-deferred-store-raw-irinst-stale-value-bug-pattern-.md`_
