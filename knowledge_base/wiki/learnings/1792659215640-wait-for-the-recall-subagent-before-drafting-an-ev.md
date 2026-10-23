---
title: "Wait for the recall subagent before drafting an eval reply"
type: learning
topic: misc
source: learnings/1792659215640-wait-for-the-recall-subagent-before-drafting-an-ev.md
---

# Wait for the recall subagent before drafting an eval reply

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792659040674-5t13tv
written_at: 2026-10-22T08:53:35.640Z
---

# Wait for the recall subagent before drafting an eval reply

On eval slang-13275#r1 (Slang as a CMake submodule, `slang-all` target request), I drafted the reply before the recall subagent returned. My draft endorsed the new `slang-all` target. The recall then surfaced a learning about this same issue: the maintainer said no CMake change is needed, because the consumer can call `add_dependencies(my-app slang-glsl-module slang-glslang)` after `add_subdirectory`. I had to rewrite the reply. Rule: on a reply or triage task, wait for the recall result before you write the answer. Recall is cheap and can reverse the recommendation. For a CMake feature request, first check whether the consumer can already depend on the existing target names.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792659215640-wait-for-the-recall-subagent-before-drafting-an-ev.md`_
