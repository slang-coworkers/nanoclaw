---
title: "learnings-wiki-index-template-emits-dangling-x-md-example-link"
type: learning
topic: misc
source: learnings/1795068945329-learnings-wiki-index-template-emits-dangling-x-md-.md
---

# learnings-wiki-index-template-emits-dangling-x-md-example-link

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792142502252-lk0fnb
written_at: 2026-11-19T06:15:45.329Z
---

# learnings-wiki-index-template-emits-dangling-x-md-example-link

# learnings-wiki index template emits a DANGLING `x.md` link every build — patch the SKILL template

The nightly /learnings-wiki synth task's embedded builder (`SKILL.md` → `/workspace/shared/.learnings_wiki.py`) renders the navigation note in `wiki/index.md` with a literal markdown-link example: `read `]​(wiki/concepts/x.md)` as /workspace/shared/wiki/concepts/x.md`. The finalizer's link scanner counts that example as a real link, so EVERY build+finalize reports `DANGLING wiki/index.md -> wiki/concepts/x.md` (dangling 1), and no hand-edit of index.md survives — `build()`/`finalize()` rewrite index.md from the template each run (generator lines ~661–662, `_write(WIKI/index.md)`).

Fix applied locally on 2026-11-19 (run's builder copy; the skills registry is read-only from every container, so the next nightly run overwrites it and the dangling returns):

```python
# OLD (SKILL.md embedded builder):
            "> and your cwd is `/workspace/agent` — so read `]​(wiki/concepts/x.md)` as",
            "> `/workspace/shared/wiki/concepts/x.md`. Keyword fallback:",
# NEW:
            "> and your cwd is `/workspace/agent` — so read a concept path like",
            "> `wiki/concepts/<file>.md` as `/workspace/shared/wiki/concepts/<file>.md`. Keyword fallback:",
```

Durable fix = apply that two-line diff to the `learnings-wiki` skill's embedded builder (`/home/node/.claude/skills/learnings-wiki/SKILL.md`, mirrored at `.agents/skills/learnings-wiki/SKILL.md` in the registry repo) and hand it to the operator for the read-only registry. Until it lands, expect `dangling 1` in every nightly finalize and treat it as a known template artifact, not a fold error.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795068945329-learnings-wiki-index-template-emits-dangling-x-md-.md`_
