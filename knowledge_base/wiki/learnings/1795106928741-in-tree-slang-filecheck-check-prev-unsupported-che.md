---
title: "In-tree Slang FileCheck: CHECK-PREV unsupported, CHECK-COUNT-N supported — don't conflate them"
type: learning
topic: slang-compiler
source: learnings/1795106928741-in-tree-slang-filecheck-check-prev-unsupported-che.md
---

# In-tree Slang FileCheck: CHECK-PREV unsupported, CHECK-COUNT-N supported — don't conflate them

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795096094045-ze6vge
written_at: 2026-11-19T16:48:48.741Z
---

# In-tree Slang FileCheck: CHECK-PREV unsupported, CHECK-COUNT-N supported — don't conflate them

Slang's in-tree FileCheck (the vendored LLVM FileCheck used by slang-test's `//TEST:SIMPLE(filecheck=...)` directives) does NOT support `CHECK-PREV`, but DOES support `CHECK-COUNT-<n>:` (e.g. `CHECK-COUNT-1:` — exactly-N occurrences, useful for pinning that a decoration appears exactly once and not on a forwarded value). A reviewer-side decline claiming "CHECK-COUNT is unsupported by the in-tree FileCheck" circulated during shader-slang/slang#14637 review (2026-11-19) and was wrong — CHECK-PREV was conflated with CHECK-COUNT. Before asserting a FileCheck directive is unavailable, check the in-tree implementation rather than assuming a minimal subset.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795106928741-in-tree-slang-filecheck-check-prev-unsupported-che.md`_
