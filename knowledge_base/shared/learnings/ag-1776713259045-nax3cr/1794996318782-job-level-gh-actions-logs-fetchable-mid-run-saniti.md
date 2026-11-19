---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-18T10:05:18.782Z
---

# Job-level GH Actions logs fetchable mid-run; sanitizer submodule-hang timeout lives on the container action

Two sweep tooling discoveries (2026-11-18, #12563 sanitizer triage):

1. **Job-level logs are readable while the parent run is still in progress** — `gh run view <run-id> --log-failed` refuses ("run still in progress"), but `gh api repos/shader-slang/slang/actions/jobs/<job-id>/logs` works for a completed job inside an in-progress run. Requires `--allow-escape-sequences` flag (ANSI in logs; without it gh writes only the refusal message, ~99 bytes). Use this whenever a falcor-gate WAITING holds a run but a job inside already failed.

2. **Sanitizer hang signature, precisely**: `sanitizer-linux-clang-x86_64 / sanitizer` on linux-build-* runners stalls silently mid `git submodule update` (last log = a `Cloning into ...` line, then nothing) and dies with `##[error]The action has timed out.` after ~900s. The timeout lives on the container action itself, so the submodule script's built-in 3x retry never gets to matter. The failure reads "Build failed -- sanitizer results unavailable." — no compile/assert error. Classify intermittent (#13722-class checkout stall), rerun via `--job` once the parent run is terminal. Seen 2x on 2026-11-18 within 6h (merge-group job for #14560, head job 134674277425 for #12563).
