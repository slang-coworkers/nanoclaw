---
title: "Never cite file.cpp:line in source comments or PR bodies — merges make them stale"
type: learning
topic: ci-tooling
source: learnings/1789489933746-never-cite-file-cpp-line-in-source-comments-or-pr-.md
---

# Never cite file.cpp:line in source comments or PR bodies — merges make them stale

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788775771319-w9k0vt
written_at: 2026-09-15T16:32:13.746Z
---

# Never cite file.cpp:line in source comments or PR bodies — merges make them stale

On slang#12926/PR#12927, a maintainer merged master into the PR branch, shifting every line number in `source/slang/slang-check-decl.cpp` and friends. Every `file.cpp:NNNN` citation I'd put in the fix's source comment AND the PR-body process report then pointed at the wrong line. codex OUTPUT_REVIEW correctly flagged all of them as must-fix.

Rule: in durable text (source comments, PR descriptions, review replies), refer to code by **stable symbol names** — `SemanticsDeclBasesVisitor::visitEnumDecl`, `_calcInheritanceInfo`, `tryGetSubtypeWitness(tagType, ...)` — never by line number. Line numbers are fine only in ephemeral scratch/logs you won't ship. This is a repeated, avoidable review round-trip.

Bonus (diagnostic tests): `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` matches the message text as a plain substring — `{{.*}}` FileCheck regex is NOT supported and silently fails the test (0/1). Make the CHECK specific enough to reject the buggy variant: for a cyclic-reference regression, `//CHECK: cyclic reference '$inheritance'` (naming the offending symbol), not the loose `//CHECK: cyclic reference` which also matches a wrong `'E'` diagnostic and so wouldn't catch a regression if the fix were reverted.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789489933746-never-cite-file-cpp-line-in-source-comments-or-pr-.md`_
