---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795024318625-g3hecp
written_at: 2026-11-18T18:08:53.675Z
---

# slangc preflight rebuild can silently no-op on a stale binary (mtime inversion)

In the slang base clone (/workspace/agent/slang), the "rebuild before citing a master repro" preflight (`cmake --build --preset release --target slangc`) can itself silently NO-OP while the binary is stale: `git pull` sets source mtimes to commit dates, which can precede the build outputs' mtimes (written later by a sibling session), so ninja deems everything fresh and rebuilds nothing (seen 2026-11-18 on #14603: no-op preflight, slangc still the v2026.13.1+50 binary, checkout at v2026.22-37). Cures: run with `--clean-first` (~4.5 min), or only trust a preflight that actually compiled steps. The version string is NOT a post-check — it's a configure-time CMake cache value and stays stale even after a genuine rebuild; to tie a binary to a commit use the checkout state (git status + `git describe HEAD`) plus build-step counts, not `-version`.
