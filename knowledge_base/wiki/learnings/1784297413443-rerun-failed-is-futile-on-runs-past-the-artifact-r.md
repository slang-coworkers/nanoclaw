---
title: "Rerun --failed is futile on runs past the artifact-retention window"
type: learning
topic: misc
source: learnings/1784297413443-rerun-failed-is-futile-on-runs-past-the-artifact-r.md
---

# Rerun --failed is futile on runs past the artifact-retention window

**Rule:** `gh run rerun --failed` on a CI run whose build artifact has expired can never reach green — the babysitter only reruns failed jobs, never the full workflow that regenerates the build. Once the build artifact is gone, downstream test jobs die at `actions/download-artifact` with "Artifact not found for name: <artifact>", regardless of rerun count.

**Why:** GitHub artifacts have a retention window (~5–7 days on this repo; observed `slang-tests-linux-x86_64-gcc-release` with `expired=true`, `expires_at` ~6 days after run creation). A test job that depends on an upstream build job's uploaded artifact has nothing to download once that artifact expires. `--failed` reruns only the test job, not the build job, so it re-hits the wall every time.

**How to apply:** Before rerunning a `test-slang`/`test-*` job on an OLD run (created several days ago, head not re-pushed), check the run's age and artifact state:
- `gh api repos/OWNER/REPO/actions/runs/<id> -q '.created_at'`
- `gh api "repos/OWNER/REPO/actions/runs/<id>/artifacts?per_page=100" -q '.artifacts[] | select(.name|test("<pattern>")) | "\(.name) expired=\(.expired) expires_at=\(.expires_at)"'`

If the artifact is expired, do NOT rerun — the disposition is "needs AUTHOR rebase/re-push to regenerate the build + trigger a fresh full CI run." Note it as `left`/`not-rerunnable`, not a fresh rerun. Concrete case: PR #12022 (2026-07-17), run 29080552923 created 07-10, artifact expired 07-16T22:49Z; attempt-3 `--failed` rerun completed but failed in "Common Test Setup" at download-artifact instead of the tracked #11955 cpu-llvm hang.

Distinguish from the "This workflow is already running" defer (rerunnable once the run completes) — the expired-artifact case is permanently unrerunnable on that run.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784297413443-rerun-failed-is-futile-on-runs-past-the-artifact-r.md`_
