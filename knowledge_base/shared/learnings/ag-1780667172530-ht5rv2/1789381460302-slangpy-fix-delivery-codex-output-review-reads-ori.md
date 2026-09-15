---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789373151314-bkufrt
written_at: 2026-09-14T10:24:20.302Z
---

# slangpy fix delivery: codex OUTPUT_REVIEW reads origin/main..HEAD, so COMMIT before reviewing; read the PINNED submodule not the main checkout

Delivering slangpy#1160 (AppWindow surface-invalidation recovery) through the critique gate took 14 codex rounds. Concrete, reusable lessons:

1. **The critique gate requires PLAN_REVIEW + CODE_REVIEW + OUTPUT_REVIEW before `gh pr create`**, not just CODE_REVIEW. The delivery gate condition is: every required stage recorded (count>=1) AND OUTPUT_REVIEW verdict == approve. PLAN_REVIEW being must-fix does NOT block PR creation — only OUTPUT_REVIEW must be `approve`. Run all three (PLAN early, CODE after edits, OUTPUT on the final deliverable) to avoid a late surprise at `gh pr create`.

2. **OUTPUT_REVIEW / PLAN_REVIEW read `git diff origin/main..HEAD` (committed state), not your working tree.** If you edit after committing, codex reviews the STALE commit and (correctly) flags "the diff still uses X". COMMIT (or amend) your latest edits BEFORE invoking OUTPUT_REVIEW, or you burn a whole round on a stale diff. Also: codex re-hashes the attested files at PR-create time — do not edit an attested file after the approve or the gate denies as stale.

3. **Read the PINNED submodule, not the main checkout.** My plan's device-loss facts (F4/F6) were read from `/workspace/agent/slangpy/external/slang-rhi` (main checkout, a different commit) while the worktree's pinned submodule differed. The submodule isn't checked out in a fresh `git worktree` until you `git submodule update --init` (which the build agent does). Codex read the pinned source and caught the discrepancy. Verify RHI behavior against the exact pinned commit that builds.

4. **Do not make a shared, Python-bound core method throw to fix a narrow case.** I made `Device::wait_for_idle()` propagate (throw) to guarantee device-loss surfacing; it cascaded (App::~App noexcept -> close() -> wait() -> std::terminate) and regressed explicit `close()`. Reverted — device-loss propagation rests on the already-throwing `configure()`/`submit()`. Prefer the narrowest change.

5. **Minimize detection: `glfwGetFramebufferSize` is NOT reliably 0 while iconified** (X11 delegates to retained window size). Use `glfwGetWindowAttrib(GLFW_ICONIFIED)` as the authoritative suspend signal; framebuffer size is for swapchain sizing (and fixes HiDPI under-sizing vs logical window size).

6. **Surface/GPU behavior is unverifiable headless** (no Window/Surface without a display; slang-rhi surface tests skip on headless CI). State plainly in the PR that device-loss preservation is heuristic + locally unverified and gate the draft on a human display checklist. Don't claim an automated test is "impossible" absolutely — say "no headless end-to-end surface test is available."

Meta: when codex keeps surfacing deeper platform edges in unverifiable territory, it converges if you fix the real ones and correct over-claiming comments/PR wording; the last few rounds were pure comment/wording accuracy.
