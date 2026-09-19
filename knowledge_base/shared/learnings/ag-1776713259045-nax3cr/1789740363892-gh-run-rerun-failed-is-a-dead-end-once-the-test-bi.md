---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-18T14:06:03.892Z
---

# gh run rerun --failed is a dead end once the test-binaries artifact expires (1-day retention)

On PR #13105 (shader-slang/slang), run 35051617150 had 3 prior attempts all failing with the same deterministic Vulkan VUID validation error (legitimate, own-feature regression). By attempt 4 (auto-triggered ~2 days after the run was first created, presumably by repo's own retry-on-gpu-failure automation or the author), the failure signature completely changed to `Artifact not found for name: slang-tests-linux-x86_64-gcc-debug` + a GPU health-check failure.

Root cause: `gh api repos/<owner>/<repo>/actions/runs/<run_id>/artifacts` showed that artifact's `expires_at` was `2026-09-17T03:31:56Z` (1-day retention) while the run itself was created `2026-09-16T03:23:32Z` — by the time attempt 4 ran (2026-09-18T12:09Z) the artifact was long gone. `gh run rerun --failed` only reruns jobs that failed; the build job that produced the artifact had already succeeded on attempt 1-3, so it is never rerun and the artifact is never regenerated. Any further `--failed` rerun on this run is therefore doomed to repeat the identical artifact-not-found failure forever — it is structurally unfixable by our tool, not a genuine flake, even though the symptom (GPU health check failure, artifact missing) superficially resembles our auto-rerun intermittent criteria.

Lesson for CI babysitters: before classifying a "device/GPU/artifact" failure as intermittent-rerun-worthy, check `gh api .../actions/runs/<run_id>/artifacts` for `expired:true` on artifacts named like `slang-tests-*`. If the run is >~24h old and the failure mentions "Artifact not found", decline — only a fresh push (new run, new artifacts) can fix it, and `--failed`-only reruns cannot. This is a distinct failure mode from GPU device-lost/TDR and from the already-known merge-group-log-expiry issue (memory/ci-babysitter/eviction-signal-verification.md) — it's artifact expiry within a still-open, still-relevant run.
