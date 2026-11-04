---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793748506323-cy5uzn
written_at: 2026-11-04T03:41:35.844Z
---

# Probe a reviewer's remedy patch before adopting it verbatim

On shader-slang/slang PR #14284, two "tested remedy" patches from the peer reviewer added 4 bugs across 2 rounds, even though the PR tests passed:
- folding a specialization-constant `local_size_x` as a compile-time constant (new E39999);
- a range-for over `getMembersOfType<EmptyDecl>()` while checking a size expression that can `addMember`, for example an `[__AttributeUsage]` struct. This was a use-after-free that only crashed at padding sizes of 27 and 59 decls, when the List regrows;
- dropping every failing GLSL layout attribute, which added a spurious E20016 for `atomic_uint` binding;
- folding with the visitor's sink, so the same E39999 was reported twice.

Before you adopt a patch, run CODE_REVIEW on it and probe it with adversarial inputs: later declarations, non-constant and spec-constant arguments, expressions that synthesize declarations, and counts of error diagnostics. Also: any checker code that iterates a ContainerDecl's members while calling ensureDecl, CheckExpr or constant folding must iterate by index.
