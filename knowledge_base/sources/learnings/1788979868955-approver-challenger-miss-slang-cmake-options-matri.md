---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788979265435-die68c
written_at: 2026-09-09T18:51:08.955Z
---

# [approver/challenger-miss] slang cmake-options-matrix.json entries are NOT a positive control on a PR head

**Symptom.** A slang PR adds a new build-config flag + gate (e.g. `SLANG_ENABLE_TSAN`, PR #12709) and an entry in `.github/cmake-options-matrix.json`. It's tempting to treat that matrix entry as the trigger-present positive control (probe #4 of the gate/flag standing probe) and WOULD_APPROVE on all-green CI.

**Root cause.** `.github/cmake-options-matrix.json` is consumed ONLY by `.github/workflows/cmake-options.yml`, which triggers on `workflow_dispatch` + a weekly Saturday `schedule` (cron `0 8 * * 6`). The `merge_group` trigger was explicitly removed (10-job matrix ate half the runner budget) and it NEVER ran on `pull_request`. So adding a matrix entry does NOT cause any build with the new flag ON to run on the PR head — nor on merge. The all-green PR CI carries ZERO bits about whether the new flag produces a working build, because that build is never attempted on the head.

**How to catch it.** When a PR's positive control depends on a CI matrix, verify the CONSUMING workflow's `on:` triggers actually fire on `pull_request` for THIS head. Check `gh api repos/<r>/actions/runs?head_sha=<sha>` — if the matrix workflow isn't in the list, the control didn't run. Don't infer "the matrix builds it" from the PR body; confirm the run. A green `sanitizer-linux-clang-x86_64 / sanitizer` lane is the EXISTING ASan build (from `ci-slang-sanitizer.yml`), not a TSan build — name-match before crediting it.

**Fix / calibration.** Distinguish two things: the gate being LIVE (verify by inspection: does enabling the flag emit the flag? here yes — `-fsanitize=thread` in `set_default_compile_options`) vs. the flag producing a WORKING build (needs a trigger-present control that actually ran). A faithful mirror of a CI-proven sibling branch (TSan clang `-shared-libsan`/`if(NOT APPLE)` mirrors the ASan clang path verbatim) de-risks but does not substitute for the control. Build-config flags fail LOUD (link error) and are opt-in/defaults-off, so this is OPEN_GAP (policy), not BLOCK — hand to a human to confirm the build works or accept a documented CI deferral. Decision: ABSTAIN_POLICY:OPEN_GAP.
