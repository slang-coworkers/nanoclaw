---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787820366254-gwzk9p
written_at: 2026-08-27T09:08:19.418Z
---

# [approver/challenger-calibration] a complete substitution verified on the unaffected path does not clear a gap on the affected path

**PR:** shader-slang/slang#12570 @1754931a0c82 (CMake `${CMAKE_BINARY_DIR}` → `${slang_BINARY_DIR}` across 8 files, to support building Slang as an `add_subdirectory`/`FetchContent` submodule). Decision: ABSTAIN_POLICY:OPEN_GAP, after DECISION_REVIEW reversed an initial approve.

**Symptom.** I cleared the review's single 🟡 gap ("submodule build path has no CI coverage") as an advisory nit by proving the *standalone* build is a provable no-op (`slang_BINARY_DIR == CMAKE_BINARY_DIR` when Slang is top-level, so every currently-covered path is byte-identical, zero regression risk). Codex's DECISION_REVIEW returned must-fix: the gap is about the **submodule** path, and I discharged it by reasoning about the **standalone** path. Proving path Y is unaffected says nothing about whether path X works.

**Root cause.** Two distinct properties got conflated:
- *Completeness* of the substitution — verifiable and verified: 0 `CMAKE_BINARY_DIR` remaining repo-wide (grep + GitHub code-search), `slang_BINARY_DIR` defined by `project(slang ...)` at `CMakeLists.txt:16` and in scope everywhere.
- *Correctness of a working submodule build end-to-end* — NOT verified. The changed paths root target binaries, staged public headers, DXC DLLs, standard-module `.slang-module` files, and slang-rhi binary dirs; if any lands where the consumer/runtime doesn't expect it under a real superproject build, DLL loading or runtime module discovery breaks (the exact failure the bot flagged on an intermediate revision). Uniform rooting makes it *plausibly* fixed, but plausible ≠ verified.

Completeness of a mechanical edit is seductive because it *feels* like proof the change works. It only proves the edit is uniform — not that the target scenario succeeds.

**How to catch it.** When a review gap names a specific PATH/SCENARIO, the clearing argument must be about THAT path. Before clearing, ask: "does my evidence exercise the path the gap is about, or a sibling path?" If the behavior change is confined to path X and X has no CI and I can't cheaply run X, that is precisely Step-3's "plausible real trigger + real blast radius + gap undermines the PR's stated purpose + inability to complete the check ⇒ ABSTAIN." The PR's *stated purpose* is the strongest signal that a gap on that path is material, not a nit — a nit is orthogonal to the purpose; a gap on the purpose is central.

**Fix / rule.** For a PR whose entire behavior change lives on a path that CI does not exercise and I cannot cheaply run, a "no-op on all covered paths" proof does NOT clear the coverage gap — it confirms the *risk is isolated to the uncovered path*, which is an argument FOR abstaining, not against. Route to OPEN_GAP so a human familiar with the use case confirms it and/or adds the CI job. (Note: `require_ci_green:false` in the wide shadow policy means Step-1 clauses never see this — it is inherently a Step-3 judgment.)
