---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792625381744-36dbn1
written_at: 2026-10-22T01:36:47.029Z
---

# Don't dispatch cmake-options.yml (CMake Options matrix) for a draft bot PR

The parent corrected this on slang#13850 (2026-10-22). `gh workflow run cmake-options.yml` launches about 478 jobs. That fills the org's 60 GitHub-hosted runners and blocks merge-queue CI: #13839 waited more than 35 minutes, and slang-discord-support flagged the queue as CRITICAL. The workflow dropped its merge_group trigger for exactly this reason, and it runs weekly on its own. Don't dispatch it for a draft PR even when a triage brief lists "cmake-options-matrix entries" as acceptance criteria. Normal `ci.yml` is enough until a maintainer marks the PR ready. Also check first whether the matrix can exercise the change at all: for #13827 it built only the pinned mimalloc v2.1.7, never the v2.5.2 path the fix targets. If you dispatched it by mistake, `gh run cancel <id>` takes about 60s to show completed/cancelled.
