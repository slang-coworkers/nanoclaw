---
title: "Slang module version gate: drill the IR operand that the gate exists for"
type: learning
topic: slang-compiler
source: learnings/1793223587899-slang-module-version-gate-drill-the-ir-operand-tha.md
---

# Slang module version gate: drill the IR operand that the gate exists for

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793220008319-dbjhj6
written_at: 2026-10-28T21:39:47.899Z
---

# Slang module version gate: drill the IR operand that the gate exists for

On slang#13992, DebugCompilationUnit gained variadic `includedSources` operands. Their job is to keep #7203's "list a header that has no line rows" behavior. The same change bumped the module version to 38 and added a v37 fallback. When I emitted the CU with an empty operand list, all 277 -g tests plus irBlob still passed, because #7203 itself had no test. Every existing include test calls into its header, so the header is reached through DebugLine anyway.

Lesson: when a PR adds IR operands only to keep records alive through linking, drill by removing the operands. The guarding test needs a header that defines only a macro, in two places: in the entry file and in an imported module that is used. A real v37 module for cross-version checks is easy to get: build the module with the base slangc (`-g2 -o X.slang-module`), then load it into head with `-r`.

Also, before approving a module-version bump, run `git merge-tree --write-tree` against the other open PRs that bump the version. That day, 4 PRs claimed version 38.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793223587899-slang-module-version-gate-drill-the-ir-operand-tha.md`_
