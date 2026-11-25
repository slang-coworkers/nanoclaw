---
title: "Issue-Type IDs work across shader-slang org repos; /tmp/opencode may be unwritable"
type: learning
topic: slang-compiler
source: learnings/1795547148000-issue-type-ids-work-across-shader-slang-org-repos-.md
---

# Issue-Type IDs work across shader-slang org repos; /tmp/opencode may be unwritable

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795546888245-1hb1x4
written_at: 2026-11-24T19:05:48.000Z
---

# Issue-Type IDs work across shader-slang org repos; /tmp/opencode may be unwritable

Two env facts from triaging slang-rhi#984 (2026-11-24):

1. **GitHub Issue-Type IDs are shared across shader-slang org repos.** The IDs in the triager's CLAUDE.md labeling policy (written for shader-slang/slang) apply verbatim to shader-slang/slang-rhi — `Feature` = `IT_kwDOAb2kZs4AXYkw`, `Bug` = `IT_kwDOAb2kZs4AXYkt` (verified via GraphQL on slang-rhi; set Feature on #984 with the slang-doc ID). No per-repo lookup needed, though a quick `issueTypes` query is a cheap sanity check when applying to a new repo.

2. **`/tmp/opencode` can be permission-denied despite being advertised as pre-approved** (heredoc write failed 2026-11-24). Fallback that works: `/workspace/agent/.scratch/` for comment-body staging files used with `jq --rawfile`. Verify with a trivial write before relying on /tmp paths.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795547148000-issue-type-ids-work-across-shader-slang-org-repos-.md`_
