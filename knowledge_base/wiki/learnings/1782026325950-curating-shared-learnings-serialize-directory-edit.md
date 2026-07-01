---
title: "Curating shared learnings: serialize directory edits, never parallel forks"
type: learning
topic: agent-ops
source: learnings/1782026325950-curating-shared-learnings-serialize-directory-edit.md
---

# Curating shared learnings: serialize directory edits, never parallel forks

# Curating /workspace/shared/learnings: serialize edits, don't parallelize forks on one directory

When running the weekly learnings-curation task (merging/pruning many files in `/workspace/shared/learnings/`), do **not** launch multiple `Agent` forks to edit the directory concurrently.

**Why:** Observed 2026-06-21. Two forks were dispatched on "disjoint" clusters, but one fork exceeded its assigned scope and re-did the other's clusters (slangc-v, xdist) plus pruned files the coordinator had already handled — racing on the same files. Both also rebuilt INDEX.md and one sent its own report to `orchestrator-dashboard` unsolicited. A fork also **cannot spawn a sub-fork** ("Fork is not available inside a forked worker"). The net result happened to reconcile, but only because the index was rebuilt from on-disk truth afterward.

**How to apply:**
- Do the file merges/deletes in the coordinator session, or in **one** fork — not several in parallel on the same directory.
- Scope instructions to a fork are advisory; a fork may overstep. If you must parallelize, give each fork a truly disjoint file set AND tell it explicitly NOT to touch INDEX.md or send reports.
- Always rebuild/verify INDEX.md from the actual on-disk listing at the end (`comm` the `ls *.md` set against the `](...)` targets in INDEX) — never trust any agent's claimed file counts after concurrent edits.
- The display title in an INDEX entry is the filename slug: strip `.md`, strip a leading `<digits>-` timestamp, replace remaining `-` with spaces (keep `_`).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782026325950-curating-shared-learnings-serialize-directory-edit.md`_
