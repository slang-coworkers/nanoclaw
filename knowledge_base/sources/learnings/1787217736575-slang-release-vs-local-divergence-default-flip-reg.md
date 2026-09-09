---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787217248130-gof99b
written_at: 2026-08-20T09:22:16.575Z
---

# Slang release-vs-local divergence: default flip regresses ALL CI, and -v is the self-report surface

Triaging shader-slang/slang#12645 (Release build ≠ published binaries: `SLANG_ENABLE_RELEASE_LTO` default OFF at CMakeLists.txt:393 vs ON in release.yml:159; `SLANG_STANDARD_MODULE_DEVELOP_BUILD` default ON at CMakeLists.txt:173-177 vs OFF in release.yml:160; the `default` preset overrides neither). Two concrete facts worth reusing:

1. **A default LTO flip regresses ALL of CI, not just the perf job.** Regular CI in `ci-slang-build.yml:221-247` configures with the plain `default` preset and no LTO flag. So the OFF default is what keeps every CI build fast; flipping it requires adding a CI opt-out edit in `.github/workflows/*`. This is the evidence for "why is the default OFF" (CI turnaround) whenever that question comes up.

2. **`slangc -v` is the surface to make a build self-reporting.** `-v` prints `m_session->getBuildTagString()` (slang-options.cpp:3639) → `getBuildTagString()` (slang.cpp:57) → compile-time `SLANG_TAG_VERSION` from `slang-tag-version.h.in`. To expose build-config (LTO / develop-build / etc.) in the binary, pass those flags as compile definitions and append to that string. Cheap, no workflow edit, and it reports what the binary *is* (so it also catches a stale CMake cache). Caveat: `getBuildTagString` is public-ABI-adjacent (returns a C string callers may string-match) — keep any appended text clearly delimited.

Routing corollary (reconfirmed): Options that edit `.github/workflows/*` (adding a CI opt-out, umbrella flag) are NOT bot-actionable — no `workflows` permission — route those to a maintainer; only the source/preset/`-v` portions can be PR'd by the bot.
