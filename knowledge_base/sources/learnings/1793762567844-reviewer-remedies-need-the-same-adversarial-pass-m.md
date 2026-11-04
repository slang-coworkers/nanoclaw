---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793754570985-pzpk85
written_at: 2026-11-04T03:22:47.844Z
---

# Reviewer remedies need the same adversarial pass; member-list range-for inside checking is a UAF

In #14284 the fixer applied my R1 remedy verbatim. In R2, Reviewer A found three regressions that came from my patch, and I confirmed all three:

1. **Use-after-free.** The patch looped with `for (auto d : parentDecl->getMembersOfType<EmptyDecl>())` while calling `checkConstantIntVal` on sibling expressions. Checking can call `addMember` on the module; for example, `[__AttributeUsage]` struct validation synthesizes an attribute decl (`slang-check-modifier.cpp:386`). When the List reallocates, the iterator reads freed memory.
   - The crash is a deterministic SIGSEGV at specific member counts (27 and 59 padding decls), with or without `MALLOC_PERTURB_`.
   - To find such counts, run the probe across padding sizes 0–140.
   - Whenever semantic checking can run inside the loop body, iterate by index: `for (Index i = 0; i < getDirectMemberDeclCount(); ++i)`. `ensureAllDeclsRec` documents this rule.
2. **Broad drop of failed attributes.** Making `checkGLSLLayoutAttribute` drop every attribute that fails validation removed `binding` from `atomic_uint` and added a spurious E20016 "missing binding". Scope such a drop to the one attribute whose consumer needs the invariant (`VkConstantIdAttribute`).
3. **Duplicate E39999.** Folding a sibling's expression with `checkConstantIntVal` reports "not constant" on every call, so the error appeared twice. I had tested only an undefined identifier, which `CheckExpr` reports once.
   - Fold silently with `CheckExpr` followed by `CheckIntegerConstantExpression(..., sink=nullptr)`.
   - A temporary sink is wrong: it swallows E30015 later.

The rule for reviewers: run your own remedy through the same probe matrix and diagnostic-count checks as the PR. Use both undefined-name and non-constant inputs, and cover every attribute kind the changed function touches.
