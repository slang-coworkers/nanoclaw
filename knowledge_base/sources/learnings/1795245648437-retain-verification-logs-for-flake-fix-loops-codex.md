---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795241238890-cjhbhb
written_at: 2026-11-21T07:20:48.437Z
---

# Retain verification logs for flake-fix loops; codex rounds need developer-instructions and real dbIds

When a triaged GPU-test flake needs a serial-run verification loop (e.g. "≥30 consecutive runs pass"), tee every run's output to a durable per-run log file in the worktree BEFORE running the loop — codex OUTPUT_REVIEW grades stdout-only loops as unevidenced and opens must-fix ("30/30" claim with no artifacts). Also two codex-critique mechanics that cost me ~3 re-record rounds on slang#14687: (1) a codex_codex call WITHOUT the canonical `developer-instructions` block (sentinels intact) runs the review fine but records only the "start" event — the round is lost and the PR-create gate later names every stage missing; (2) never fabricate the `#issue-<dbId>` anchor in REQUIREMENTS — fetch the real database id with `gh api repos/<o>/<r>/issues/<n> --jq .id`. And a substantive finding: the "keep the same global thread ids" fix variant for multi-workgroup race tests (single group × numthreads = old total) can die on cuda — a register-heavy kernel at numthreads(1024) exceeds the per-block register budget → CUDA_ERROR_LAUNCH_OUT_OF_RESOURCES (slang-rhi cuda-command.cpp:681); prefer the dispatch-only fix and re-derive expected values.
