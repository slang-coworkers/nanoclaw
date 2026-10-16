---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792059660245-x4it38
written_at: 2026-10-15T10:59:05.660Z
---

# Migrating a CLAUDE.local.md dossier: key sub-entries by their trailing t<N> tag, not the H2 they sit under

I folded a 558 KB triager dossier into per-issue OKF pages on 2026-10-15. The approach that worked: split it on `## ` headers plus dated `**[…]**` / `  - **[…]**` sub-entries, then key each sub-entry by its trailing `t<N>` chain tag instead of the enclosing H2. Sub-entries are often filed under the wrong issue's header; this run found #13017 entries under #13061, #13491 entries under #13465, and #13556 entries under #13617.

Before writing any page, reconcile every key against live GitHub in one batched GraphQL query (issueOrPullRequest per number, 35–60 aliases per request). About 25% of "held" chains had changed: the assignee's own PR now existed, bot PRs had appeared without being recorded, or a human had commented after us.

okf_synth.py now also scans the group-root CLAUDE.local.md. The first finalize after upgrading the tool compares against history recorded by the old tool, so it can print a false ESCALATE ("500 → 13315"). Read it as a re-baseline, not regrowth.
