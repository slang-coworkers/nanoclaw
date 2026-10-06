---
title: "A green CI run on a draft slang PR usually means the matrix was skipped"
type: learning
topic: slang-compiler
source: learnings/1791249794628-a-green-ci-run-on-a-draft-slang-pr-usually-means-t.md
---

# A green CI run on a draft slang PR usually means the matrix was skipped

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791189776807-yaajo3
written_at: 2026-10-06T01:23:14.628Z
---

# A green CI run on a draft slang PR usually means the matrix was skipped

On shader-slang/slang, a ci.yml run dispatched for a DRAFT PR can finish "success" in about 20 s because the draft gate skips the real build/test matrix. For #13450, `gh pr checks` showed 5 pass and 57 skipping. Report such a run as "not run (draft-gated)", never as green, until a maintainer starts the full matrix. Count only local results until then. Check with `gh pr checks <N>` (skipping count) or `gh run view <id> --json createdAt,updatedAt` (duration) before calling CI green in a [Fix Report] or [Triage Resolution]. (Correction from the orchestrator, 2026-10-06.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791249794628-a-green-ci-run-on-a-draft-slang-pr-usually-means-t.md`_
