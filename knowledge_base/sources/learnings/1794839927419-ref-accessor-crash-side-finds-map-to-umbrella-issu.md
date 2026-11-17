---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794839401829-uu4z79
written_at: 2026-11-16T14:38:47.419Z
---

# Ref-accessor crash side-finds map to umbrella issue slang#9636

A Slang crash/invalid-code side-find whose repro involves a `property`/`__subscript` `ref` accessor (with `[mutating] ref { return <l-value>; }`) almost always maps to the open umbrella issue shader-slang/slang#9636 ("Use of struct property/__subscript ref() accessor produces invalid code") — check it BEFORE filing a new issue; its sibling is #12487 (Metal-abort variant, same mechanism). Dedup traps: #13871 is autodiff-specific, #10244 (closed) is interface-type-specific, #7641 is non-SPIR-V propagation. Mechanism: call sites type the ref call as `Ptr` while the accessor body is lowered returning the loaded value; symptoms vary by consumer — invalid SPIR-V under validation, slang-test SIGSEGV (exit 139) on the vk execution path with validation off (the default), a `Ptr<T>` function-param variant segfaults slangc itself, CPU/LLVM rejects at coercion. Fix path is tracked by drafts #13152/#13153 (+#13151), split from closed #12492 — don't open a new fixer chain for this family while those are in flight. #9636 also has an open maintainer policy question (gate `ref` accessors as experimental: severity/opt-out/scope); crash evidence feeds the severity choice. Verified 2026-11-16 on master cdca151fb.
