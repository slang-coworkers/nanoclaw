---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787342965000-b1i5gw
written_at: 2026-08-24T14:08:39.409Z
---

# Reviewer heuristic: a PR that lifts a subclass override into a shared base changes EVERY inheriting subclass

**Context:** shader-slang/slang#12688 folded nested `static const` arrays by moving a WGSL-local `shouldFoldInstIntoUseSites` override into the shared `CLikeSourceEmitter` base. This silently changed emit for every C-like subclass that inherits the base predicate — HLSL, GLSL, **Metal**. Metal was a real regression: it spells arrays as the struct-wrapper `metal::array<T,N>` (same shape as CUDA/C++ `FixedArray<T,N>`), so it hit the exact single-brace mis-binding the PR was fixing for `FixedArray`, but Metal did NOT get the double-brace fix (it doesn't inherit `CPPSourceEmitter`).

**Reviewer heuristic (how to CATCH this, not just how to avoid writing it):** When a diff moves logic from a subclass override *up* into a shared base method (or changes a base method's return in a way that was previously `false`/no-op), enumerate **every** subclass that inherits that method and ask "does this subclass's other emit paths stay valid under the new base behavior?" Concretely for Slang emitters:
- `grep` for subclasses: which override the changed method (they may or may not delegate to `Super`), which don't (they get the new base behavior verbatim).
- For each affected subclass, check whether the *downstream* emit (here: how it spells the aggregate type and its initializer) is compatible with the newly-enabled path. A struct-wrapper representation (`FixedArray`, `metal::array<T,N>`) needs different bracing than a native array (HLSL `int[2][3]`, GLSL/WGSL constructor syntax).
- Flag "silently changes N shipping backends with zero new test coverage" as a gap even when you can't run the toolchain — the mechanism is verifiable from source (does it override the fold? does it override the emit? how does it spell the type?) even when the outcome (does the compiler accept it) needs CI.

**Why it matters:** the author-angle lesson is "don't lift a per-target predicate into a base without enumerating inheritors." The reviewer-angle lesson is that this class of change is *mechanically auditable at the source level* — you don't need the Metal/GLSL toolchain to identify the at-risk subclasses, only to confirm the final verdict. Separate the confirmed mechanism (source-verifiable) from the unconfirmed outcome (needs CI) in the finding, so the fixer knows exactly what to test. In #12688 this framing turned a "correctness risk, unverifiable here" round-1 finding into a confirmed regression + symmetric fix across all three struct-wrapper targets (CUDA/CPP/Metal) in one round.
