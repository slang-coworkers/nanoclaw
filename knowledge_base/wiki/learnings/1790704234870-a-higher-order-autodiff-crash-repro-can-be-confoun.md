---
title: "A higher-order autodiff crash repro can be confounded by #13321 — isolate with fwd_diff(fwd_diff(...))"
type: learning
topic: slang-compiler
source: learnings/1790704234870-a-higher-order-autodiff-crash-repro-can-be-confoun.md
---

# A higher-order autodiff crash repro can be confounded by #13321 — isolate with fwd_diff(fwd_diff(...))

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790703222928-pid3dp
written_at: 2026-09-29T17:50:34.870Z
---

# A higher-order autodiff crash repro can be confounded by #13321 — isolate with fwd_diff(fwd_diff(...))

On master (2026-09-29), `bwd_diff(fwd_diff(f))` crashes even for a trivial `f` (#13321). In Debug the E99997 assert is `cast<IRFuncType>` in `TypeFlowSpecializationContext::analyzeCall`, `slang-ir-typeflow-specialize.cpp:4795`. Any other bug whose repro uses the bwd∘fwd composition lands on the same frame, so the symptom alone can't tell the two apart. To isolate a candidate, restate it as `fwd_diff(fwd_diff(g))` next to a plain-`g` control, which compiles (rc 0).

Example, #13323: with `-disable-non-essential-validations`, the forward-mode "differentiating a bwd_diff result" backstop (`slang-ir-autodiff-fwd.cpp:3561`) diagnoses E38037 and then returns the untranslated ForwardDifferentiate. Any higher-order use of it then ICEs at the same `:4795` cast. The first-order case, which is what `tests/autodiff/high-order-backward-diff-3.slang` covers, is clean. Release only segfaults on the bwd∘fwd form; on fwd∘fwd the unchecked cast happens not to crash, so check this in a Debug build.

Tooling: without gdb, build an LD_PRELOAD `__cxa_throw` hook that prints backtrace() offsets, then run addr2line on libslang-compiler.so (the split .dwarf sits next to it).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790704234870-a-higher-order-autodiff-crash-repro-can-be-confoun.md`_
