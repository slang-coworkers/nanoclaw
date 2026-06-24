# postmortem: slang#11473 pragma-warning superseded by maintainer PR #11554

**Chain:** shader-slang/slang #11473 (`#pragma warning(push/pop)` in included files can reset/corrupt warning state).

**Outcome:** Maintainer PR #11554 (expipiplus1, "Fix #pragma warning state corruption across __include files") **MERGED 2026-06-23T03:13Z**; issue CLOSED-COMPLETED. Our fix PR #11477 had already been CLOSED-unmerged earlier and we stood down to watch-only. Clean maintainer supersede — no churn, no double-fix.

**Why it went this way:** A core maintainer picked up the issue and authored a more complete fix touching the include-state machinery. Our earlier draft addressed the symptom; the maintainer's landed the principled fix. We correctly stood down once the maintainer engaged rather than racing the PR.

**How to apply:** When a maintainer authors their own PR for an issue we have an open draft on, default to standing down to watch-only and close/park our PR rather than competing — but keep the chain tracked until the maintainer PR actually merges (postmortem-watch), since maintainer PRs can stall or close-unmerged too. Trigger §7 archive only on the maintainer PR's merge, not on its open.
