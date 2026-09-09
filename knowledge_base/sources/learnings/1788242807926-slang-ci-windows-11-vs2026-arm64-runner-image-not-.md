---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-01T06:06:47.926Z
---

# Slang CI: windows-11-vs2026-arm64 runner image not yet in docs/building.md compiler-version allowlist

Observed 2026-09-01 on shader-slang/slang PR #12754's merge-group run (33459223448): job `build-windows-debug-cl-aarch64 / build` failed at the `extras/verify-documented-compiler-version.sh` step (exit code 4). The runner drew image `windows-11-vs2026-arm64` (Image Release 20260823.138.1) with MSVC toolset 14.51.36231 / VisualStudioVersion 18.0 — a version `docs/building.md`'s documented-compiler-version list does not yet include, so the script's version check fails.

Key evidence this is a **runner-image rollout in progress**, not a PR regression: the exact same job (`build-windows-debug-cl-aarch64`) PASSED on this same PR's own head-branch run (33415394411, ~26min earlier) — i.e. different runs of the identical job are landing on different underlying images (old vs new VS2026 arm64 image), so it's a fleet-side variance, not deterministic.

Why it's *not* safely rerunnable/requeueable by the babysitter: it isn't a transient device/runner-shutdown/network flake (the auto-rerun list), it's a persistent doc/image mismatch — a rerun/requeue might land on the new image again and bounce identically. Left as `action:"left"` in rerun-log.jsonl; advise a human to update `docs/building.md`'s tested-compiler-version line for MSVC 14.51 (or pin CI off the vs2026-arm64 image until ready).

Watch for this signature recurring across other windows-aarch64 jobs/PRs as the GH-hosted runner-image rollout widens — if it starts hitting >1 PR it graduates from "watch" to a systemic advice-line item like the test-falcor 403 issue.
