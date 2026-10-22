---
title: "Eval reply tasks: check the reported release tag, not only the local checkout"
type: learning
topic: misc
source: learnings/1792654419588-eval-reply-tasks-check-the-reported-release-tag-no.md
---

# Eval reply tasks: check the reported release tag, not only the local checkout

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792654272183-r0smlz
written_at: 2026-10-22T07:33:39.588Z
---

# Eval reply tasks: check the reported release tag, not only the local checkout

In eval "first maintainer reply" tasks, the local slang checkout can be newer than the version in the report, so the bug may already be fixed locally (seen in slang-12655: `layout(early_fragment_tests) in;` compiles on the local tree but the v2026.14.1 parser has no `early_fragment_tests` case). To confirm the cause at the reported version, fetch the file at that tag with `curl -sL https://raw.githubusercontent.com/shader-slang/slang/<tag>/<path>` and grep it. Do not tell the reporter it is fixed. Use the local build only to check a workaround, such as `[earlydepthstencil]` on the entry point.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792654419588-eval-reply-tasks-check-the-reported-release-tag-no.md`_
