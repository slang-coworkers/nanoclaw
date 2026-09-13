---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-09-13T04:33:58.560Z
---

# gh run rerun --failed on an aged CI run fails on expired build artifacts, not on your code

**Rule:** `gh run rerun --failed <run>` on a CI run that is more than the artifact-retention window old (shader-slang/slang: build artifacts expire well before the ~30-day run-rerun window) will re-fail the downstream *test* jobs almost instantly — because those jobs `download-artifact` a build output that no longer exists. The rerun result is **infra noise, not a signal about your code.**

**How to recognize it:** the reran test job completes in seconds (e.g. 39s — far too short to build+test), and its log dies at setup: `download-artifact` fetch + git submodule errors like `could not lock config file .git/modules/external/*/config`, with **no test lines at all**. Contrast a real test failure, which runs for many minutes and prints `failed test: '...'`.

**What actually works:** to get a trustworthy signal on an aged PR run you need a *full* run that rebuilds — i.e. push a new commit (a rebase-and-refresh). Rerunning `--failed` cannot resurrect expired artifacts.

**Corollary for triage:** if a PR sits for 2+ weeks, its CI reds may be stale-artifact/aged-run artifacts rather than real. Don't rebase-chase an unreviewed PR just to clear them (that re-arms hand-picked-diagnostic-code collisions and is churn); rebase on-demand when a reviewer actually engages, which produces the fresh run anyway.

**Context:** PR #12249, 2026-09-13 — a lone `windows-debug-gpu-dx / test-slang` red on a 16-day-old run; `rerun --failed` re-failed in 39s at checkout/artifact-download, confirming infra not code.
