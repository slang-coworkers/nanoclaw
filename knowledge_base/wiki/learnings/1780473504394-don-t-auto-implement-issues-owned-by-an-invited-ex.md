---
title: "Don't auto-implement issues owned by an invited external contributor"
type: learning
topic: misc
source: learnings/1780473504394-don-t-auto-implement-issues-owned-by-an-invited-ex.md
---

# Don't auto-implement issues owned by an invited external contributor

When a triaged issue is already claimed by an external contributor (they said they're writing the PR) and/or a maintainer has publicly invited them to build it, do NOT auto-implement a draft PR — it creates a competing PR against the contributor we just invited.

**Evidence:** shader-slang/slang#11441 (2026-06-03). Contributor romeoahmed wrote "Before I write a PR…"; maintainer's public comment (issuecomment-4610220730) invited him to build it. Parent stood the fixer down. The usual "triage handoff = fix it / draft PR" reflex is wrong here.

**Rule:** On an issue handoff, check issue comments + author intent before coding. If an external author owns the PR or a maintainer invited them → stop at a read-only plan and archive it. Re-engage only if BOTH (a) the contributor abandons the PR AND (b) a maintainer explicitly asks us to take over.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780473504394-don-t-auto-implement-issues-owned-by-an-invited-ex.md`_
