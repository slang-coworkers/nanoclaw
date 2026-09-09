---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477327664-spdydc
written_at: 2026-08-11T20:00:37.471Z
---

# [approver/challenger-miss] CI-coverage PRs: check the NEW jobs are green via check-runs, not folded /status

**Symptom:** slang-rhi#831 ("CI with lavapipe", @skallweitNV, MEMBER) adds a `lavapipe` matrix CI job + composite action `setup-lavapipe/action.yml` + two benign test tweaks (SKIP AS-validation when !RayTracing; accept `BGRX8Unorm`). Under `v0-shadow-wide` all 6 Step-1 clauses PASS (`.github/**` no longer protected; `require_ci_green:false`). The diff's own logic is clean → nothing in Steps 1–2 blocks it. The combined `repos/.../commits/<sha>/status` reads **`state:success`** — but that folds over only `{license/cla, CodeRabbit}`.

**Root cause / the miss to avoid:** the PR's *entire purpose* is green lavapipe CI, and **2 of its 4 newly-added lavapipe jobs are RED** — visible only in `check-runs`, never in the folded `/status` (the CLA+CodeRabbit statuses never redden). `lavapipe (linux x86_64 gcc Release)`: 2 test cases FAILED (`cmd-copy-buffer-to-texture-full.vulkan`, `cmd-copy-texture-to-buffer-rowalignment.vulkan`) at `texture-test.cpp:334` `CHECK_EQ` round-trip mismatch — a file the PR does NOT touch. `lavapipe (linux aarch64 clang Release)`: SIGSEGV exit 139 in `acceleration-structure-creation-with-validation.vulkan` — the very test this PR added a `SKIP` guard to; the guard didn't prevent the crash on that config.

**How to catch it (the class):** For any PR whose stated purpose is *"add CI coverage for X"* (new workflow job / matrix entry / test-enablement / new runner or driver): the decision-relevant question is not "did the diff compile" but **"is the coverage it introduces actually green?"** Enumerate `repos/<r>/commits/<head>/check-runs` and read the conclusions of the jobs the PR ADDS by name — never trust the folded combined `/status` (it can be green over zero-or-red compiled jobs; see the "NEVER FOLD A COMBINED /status" memory row). Failures in untouched code that the new coverage merely EXPOSES are still an `OPEN_GAP`: the change doesn't achieve its purpose as-is, even though it's not a 🔴 bug *in the diff* (→ not BLOCK). Note `require_ci_green:false` means Step-1 `ci_green_on_sha` won't catch this — it's a Step-3 challenger probe, not a clause.

**Fix / decision:** `ABSTAIN_POLICY:OPEN_GAP` (human must look), not WOULD_APPROVE. Also weigh unaddressed bot findings on the same surface — here 3 CodeRabbit 🟠 Major (unpinned Mesa driver, job token/permissions, third-party actions pinned by mutable `@v1`/`@latest` tag vs immutable SHA — a supply-chain surface on `.github/**` that the WIDE policy stops protecting but that a maintainer still cares about).
