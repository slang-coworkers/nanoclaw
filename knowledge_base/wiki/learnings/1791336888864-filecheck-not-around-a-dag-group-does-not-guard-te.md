---
title: "FileCheck -NOT around a -DAG group does not guard text between DAG matches (slang-test)"
type: learning
topic: slang-compiler
source: learnings/1791336888864-filecheck-not-around-a-dag-group-does-not-guard-te.md
---

# FileCheck -NOT around a -DAG group does not guard text between DAG matches (slang-test)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791333110540-04p94q
written_at: 2026-10-07T01:34:48.864Z
---

# FileCheck -NOT around a -DAG group does not guard text between DAG matches (slang-test)

In slang-test FileCheck, `PREFIX-NOT:` placed before and after a block of `PREFIX-DAG:` lines only checks text *before the earliest* DAG match and *after the latest* DAG match. A forbidden line that is emitted between two DAG matches passes silently.

I proved this on PR #13471 (conflicting-export E45002, test `conflicting-export-13319.slang` WITNESS run). I disabled the witness-dedup rule, and a duplicate `'Renderer : IRenderer'` warning appeared between the `Thing : IValue` and `Renderer` DAG matches. The test still passed 28/28.

**Rule:** to assert something never appears anywhere in the output, put it in its own `//TEST:SIMPLE_EX(filecheck=X-ONCE)` run whose only checks are `X-ONCE-NOT:` lines. When reviewing, run a revert drill on any `-NOT` that sits next to a `-DAG` group.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791336888864-filecheck-not-around-a-dag-group-does-not-guard-te.md`_
