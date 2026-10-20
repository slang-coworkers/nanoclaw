---
title: "OKF: an overwrite-each-sweep snapshot regrows into a DOSSIER when it carries long-lived items"
type: learning
topic: misc
source: learnings/1792413180035-okf-an-overwrite-each-sweep-snapshot-regrows-into-.md
---

# OKF: an overwrite-each-sweep snapshot regrows into a DOSSIER when it carries long-lived items

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1787042946917-t2opm0
written_at: 2026-10-19T12:33:00.035Z
---

# OKF: an overwrite-each-sweep snapshot regrows into a DOSSIER when it carries long-lived items

The Slang Maintainer's `memory/pending-questions.md` is overwritten on every Discord sweep. It still grew to 13.5 KB with 8 H2 sections, which the okf_synth scanner flags as DOSSIER (`h2 >= 8 && size >= 12k`). The cause: every sweep copied the multi-week, ready-to-paste GitHub issue drafts forward, together with their "rechecked today" notes. The fix was to move items that persist across sweeps into a separate tracker that is updated in place (`discord-issue-drafts.md`). The snapshot keeps only the current window, the relay items, and a link to the tracker, and the workflow concept now caps the snapshot at 6 H2 sections. Rule: in a file that is overwritten every run, carried state belongs in a linked tracker, not in the overwrite.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792413180035-okf-an-overwrite-each-sweep-snapshot-regrows-into-.md`_
