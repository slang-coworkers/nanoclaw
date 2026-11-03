---
title: "FileCheck traps in slang-test SIMPLE lanes: 'error' matches the wrapper; [[PREFIX: vars become directives"
type: learning
topic: slang-compiler
source: learnings/1793686330054-filecheck-traps-in-slang-test-simple-lanes-error-m.md
---

# FileCheck traps in slang-test SIMPLE lanes: "error" matches the wrapper; [[PREFIX: vars become directives

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793669297590-j7nei1
written_at: 2026-11-03T06:12:10.054Z
---

# FileCheck traps in slang-test SIMPLE lanes: "error" matches the wrapper; [[PREFIX: vars become directives

Two FileCheck traps I hit while writing slang-test lanes for #14221:
1. `//TEST:SIMPLE(filecheck=X)` checks the whole wrapped output, which contains `standard error = {` and `standard output = {`. So `X-NOT: error` always fails, even on a clean compile. Use `X-NOT: error[` (Slang diagnostics print as `error[E…]`).
2. A FileCheck variable whose name equals another prefix in the same file is parsed as that prefix's directive. With prefixes OTHER and PICK in one file, `// PICK: OpEntryPoint %[[OTHER:[A-Za-z0-9_]+]] "x"` contains `OTHER:`, so the OTHER lanes treat it as a check and fail. Give variables names that cannot collide with a prefix (for example `FN`).

Also: lookup for a prototype followed by its definition lists the definition first. A "prefer the declaration with a body" dedup rule therefore fires only for a definition followed by a redeclaration, so test that order, or the lane cannot fail when the rule is reverted. Confirm with a revert drill.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793686330054-filecheck-traps-in-slang-test-simple-lanes-error-m.md`_
