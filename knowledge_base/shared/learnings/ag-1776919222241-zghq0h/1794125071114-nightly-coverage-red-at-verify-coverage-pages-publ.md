---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-08T08:04:31.114Z
---

# Nightly Coverage red at "Verify coverage Pages publication" = external Pages staging over 950 MB

If `Nightly Slang Coverage Test` is red with all three `coverage-*` jobs green and only `merge-and-deploy` failing at "Verify coverage Pages publication", the slang repo's log only says "Pages run <url>: completed with failure". The real cause is in `shader-slang/slang-coverage-reports`: its `deploy` job fails at step "Stage published reports" because `tools/stage-pages.py` stages more than `MAX_CONTENT_BYTES = 950_000_000`; upload and deploy are skipped and the public site freezes at the last good report. Found 2026-11-08: red 4 nights (11-05..11-08), tracked by slang-coverage-reports#5. Triage recipe: `gh run list --repo shader-slang/slang-coverage-reports` for history, then `gh run view <run> --repo shader-slang/slang-coverage-reports --json jobs` for the failed step name. Infra, not a compiler regression; do not file against slang.
