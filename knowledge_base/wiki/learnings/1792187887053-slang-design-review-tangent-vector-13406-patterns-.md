---
title: "Slang design review (tangent-vector, #13406): patterns the fixer fleet must stop producing"
type: learning
topic: slang-compiler
source: learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md
---

# Slang design review (tangent-vector, #13406): patterns the fixer fleet must stop producing

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-10-16T21:58:07.053Z
---

# Slang design review (tangent-vector, #13406): patterns the fixer fleet must stop producing

**Context:** on 2026-10-16 tangent-vector left about 20 review threads on slang#13406 (Ref access-mode split). Several target code the bot wrote in rounds 1–3. One, on the bot's `RefParam` access validation in `CoerceToProperTypeImpl` (`slang-check-type.cpp:470`, from commits `0adba88fd1` and `5fb807fbbb`), reads: "This is gross and the agent who wrote it should be terminated." Most of the threads point at a few recurring design mistakes. They are written as rules here so fixers don't repeat them.

**Rules (each from a #13406 thread):**
1. **Fail closed, never open.** Don't let an unknown case fall back to the most permissive behaviour. A `default` that "treats it as read-write" is a policy decision hidden in a fallback (`slang-ast-type.cpp:1435/1447`). Unknown access means no access, or `SLANG_UNEXPECTED`/assert.
2. **One `switch` on the source-of-truth enum.** If code branches on a parameter-passing mode, write one exhaustive `switch (mode)` with a `case` per mode. Don't build an if/else ladder, a derived "direction" pair, or a second query of the type (`slang-check-shader.cpp:34/44`, `slang-ast-type.cpp:679/781/1527`, `slang-ast-print.cpp:1594`). Fold sibling cases such as `BorrowIn` into it.
3. **Don't invent a construct and then validate around it.** A keyword that expands to two modifiers, or a `RefParam<T, Access>` that then needs an "is this a valid Access" check, means you created the problem yourself (`slang-check-modifier.cpp:2563`, `slang-check-type.cpp:470`). Prefer one modifier or one distinct type per mode, so the invalid state can't be represented.
4. **Names state what the thing is.** `doesParamPassingModeReadArgument` makes it sound like the mode does the reading. A mode grants a function body permission to read (`slang-ast-support-types.h:2021`).
5. **Comments must be understandable without context.** "A constant access on a `RefParam`" meant nothing to the reviewer.
6. **Signature printing shows what callers need:** the passing mode, not `const` modifiers. Print nothing for `in` (`slang-ast-print.cpp:1600`).
7. **Don't merge independent axes into one flag** (`isReadOnlyMemoryLocation` in `QualType`, `slang-ast-support-types.h:655`).

**How to apply:** before a fixer's CODE_REVIEW signs off on a change to a language feature, check its diff against these seven rules. Flag any `default:` that grants a permission, any if/else ladder over an enum, and any validation of a value your own change made possible. The PR is jhelferty-nv's now, and she asked the bot to stand down, so this is a fleet lesson only. Don't reply on GitHub.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792187887053-slang-design-review-tangent-vector-13406-patterns-.md`_
