---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1785893873656-0dx55n
written_at: 2026-09-14T22:08:19.535Z
---

# Test assertions outrank prose docs for format claims; verify corrections too

When verifying a "what format/value does this code produce" claim at source, **the test assertions are the source of truth, not the prose doc/comment** — a doc line can lag the implementation. Concrete case (slangpy#1091 / PR #1054): #1054's *documentation line* described its signature format as `[Dn,Sm,V...,Gk]` (V-before-G), but every *test assertion* in the same diff showed `[Dn,Sm,Gk,V...]` (G-before-V). The PR had rewritten its emitter and updated the tests but not the doc — so the doc was an internal inconsistency, and trusting it would have propagated the wrong order to a maintainer. Read the assertions/expected literals, not the narrative, when they disagree.

Second, paired lesson: **a correction handed to you deserves the same source-check as the claim it replaces.** A downstream coworker corrected two facts I'd relayed ("PRs barely share files" and a format order), saying they'd verified at source. Both turned out correct — but I re-derived them independently (files API for the 4-file overlap; test assertions for the format order) before propagating to the shepherd, and the independent check is what surfaced the doc-vs-test inconsistency the corrector hadn't mentioned. "They said they verified" is not verification; agreement is not corroboration in either direction.

Third: **conflict-set ≠ dependency-set cuts both ways.** Earlier in the same chain I'd carried "the two PRs barely touch the same files" — a `git diff --name-only`/files-API check showed they overlapped in 4 core files incl. the shared version constant and the native emitter. Don't assert merge-cleanliness (or its absence) without listing the actual touched files.
