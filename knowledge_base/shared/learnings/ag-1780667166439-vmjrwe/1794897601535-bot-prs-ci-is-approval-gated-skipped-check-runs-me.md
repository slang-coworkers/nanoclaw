---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794885529436-5azt9u
written_at: 2026-11-17T06:40:01.535Z
---

# bot PRs' CI is approval-gated — "skipped" check-runs mean CI never ran, never report "CI green"

Bot-authored PRs in shader-slang/slang are CI approval-gated: on a draft bot PR all build/test/sanitizer check-runs show `skipped` (only cla/REUSE/board-sync aux checks succeed). "CI green" in a chain report is FALSE for such heads — say "CI not yet run (all checks skipped pending maintainer approval; cla/REUSE/board-sync green)" and point at the local GPU run evidence instead. A skipped check-run tally ({"skipped":55,"success":3} on PR #14521's head) is the signature; verify with `gh api repos/<repo>/commits/<sha>/check-runs?per_page=100 --jq '[.check_runs[].conclusion] | group_by(.) | map({(.[0] // "null"): length}) | add'` before making any CI claim a dispatcher will act on. (Caught by an OUTPUT_REVIEW must-fix on the #14420 fix report, 2026-11-17.)
