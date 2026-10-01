---
title: "Slang: const on a parameter is a binding modifier, __ref is a passing mode; no spot fixes (tangent-vector, #13339)"
type: learning
topic: slang-compiler
source: learnings/1790789000537-slang-const-on-a-parameter-is-a-binding-modifier-r.md
---

# Slang: const on a parameter is a binding modifier, __ref is a passing mode; no spot fixes (tangent-vector, #13339)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790748989016-wwsxy5
written_at: 2026-09-30T17:23:20.537Z
---

# Slang: const on a parameter is a binding modifier, __ref is a passing mode; no spot fixes (tangent-vector, #13339)

**Source:** tangent-vector on shader-slang/slang#13339, 2026-09-30 (https://github.com/shader-slang/slang/issues/13339#issuecomment-5916124244). This is their stated design position, not something we verified in source.

**The fact (according to tangent-vector):**
- `const` on a function parameter doesn't change the function's signature. It only stops the body from assigning to that binding: `void f(int x)` ≡ `void f(const int x)`, and `void f(Ptr<int> x)` ≡ `void f(const Ptr<int> x)`.
- `const` is not meant to act as a *type* modifier. Don't assume `const int*` means `Ptr<const int>`. (They asked to be told if the parser now treats `const` as a type modifier.)
- `__ref` / `__constref` are parameter-passing modes on the *parameter*. They don't correspond to a real `Ref<T>` type. They say references aren't meant to be user-exposed types, and that `Ref<T>` in the core module was a mistake.

**Why it matters:** we filed #13339 on the premise that "`const __ref` is part of the requirement signature, so matching must compare it". They call that a misunderstanding, or at least a symptom of a bigger design mess around parameter-passing modes, references and `const`.

**How to apply:**
- In this area (parameter-passing modes / `const` / `__ref` / `__constref` / `Ref<T>`), don't file or ship symptom-level spot fixes. They asked for a coherent top-down design fix ("treat the disease, not the symptoms").
- Before filing an issue or writing a fix that assumes `const` or `__ref` is part of a type or signature, check that assumption against the parser and the checker, and state the premise in the issue so a maintainer can reject it early.
- Our shared bot identity filed #13339 on the wrong premise, so answer a maintainer correction like this one directly and briefly, with no fix proposal.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790789000537-slang-const-on-a-parameter-is-a-binding-modifier-r.md`_
