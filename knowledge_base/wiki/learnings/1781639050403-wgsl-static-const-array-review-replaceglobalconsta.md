---
title: "WGSL static-const-array review: replaceGlobalConstants false-positive + value-indexability rule"
type: learning
topic: slang-compiler
source: learnings/1781639050403-wgsl-static-const-array-review-replaceglobalconsta.md
---

# WGSL static-const-array review: replaceGlobalConstants false-positive + value-indexability rule

Context: reviewing shader-slang/slang PRs that change WGSL emission of module-scope `static const` arrays (e.g. #11628, "emit runtime-indexable static const arrays as var<private>", fixes #6747).

**Recurring reviewer false positive — verify before forwarding.** Subagents (and Devin) repeatedly flag a 🔴 bug like *"the converted `var<private>` is initialized from another `var<private>` / emits `var` without `<private>` → invalid WGSL."* This is a FALSE POSITIVE when they reason from the master tree without accounting for `replaceGlobalConstants` (`source/slang/slang-ir-link.cpp:~2613-2614`): it does `globalConstant->replaceUsesWith(val)`, removes the `IRGlobalConstant`, and transfers the name hint to the inner `MakeArray`. So **no `GlobalConstant` survives to emit** — the `MakeArray` itself becomes the named module-scope declaration, emitted with an inline `array<…>(…)` constructor initializer. The address-space chain also emits `<private>` in lockstep via `else if (varDecl->getOp() == kIROp_GlobalVar || emitModuleScopeArrayConstAsPrivateVar)`. The suggested "narrow the predicate to `kIROp_GlobalConstant`" fix would BREAK the PR. Always confirm the mechanism against the actual post-link IR before keeping such a 🔴.

**WGSL value-indexability rule (the crux of #6747).** In WGSL a *value* (not a memory reference) of **array** type may only be indexed by a const-expression, but a *value* of **vector or matrix** type IS runtime-indexable. Hence the principled fix converts only `kIROp_ArrayType` module-scope `static const` globals to `var<private>` (addressable → runtime-indexable) and correctly leaves scalar/vector/matrix as `const`. A `static const` struct with an array field, runtime-indexed via `g.arr[i]`, is a *distinct* unhandled shape (struct lowers through `Foo_init(...).arr[i]`, an array-value runtime index = same rejection) — a legit follow-up, not the same bug.

**Real residual (documented, not a regression).** An inner named `static const` array that is BOTH a nested constituent of another static const array AND independently runtime-indexed (CSE-shared) can emit `var<private>` referencing another `var<private>` = invalid WGSL. It is not constructible from typical anonymous nested literals and was a tint-rejected runtime-indexed `const` pre-fix too. Treat as a documented known-limitation; the only open point is maintainer-policy (emit a `diagnoseOnce` vs. invalid output), not bot-merge-blocking.

**Devin on drafts:** commit-status `"unknown"` + empty Bugs+Flags = INCONCLUSIVE, not a clean bill. Label it so; don't count as a pass.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781639050403-wgsl-static-const-array-review-replaceglobalconsta.md`_
