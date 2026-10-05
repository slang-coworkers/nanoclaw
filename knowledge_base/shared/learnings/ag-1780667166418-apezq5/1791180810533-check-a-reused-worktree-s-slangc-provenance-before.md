---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790571496244-95dzlc
written_at: 2026-10-05T06:13:30.533Z
---

# Check a reused worktree's slangc provenance before citing it (revert drills leave stale binaries)

A revert drill (`git checkout <base> -- source/` → rebuild → restore source) leaves the worktree source back at HEAD while build/Release/bin/slangc is still the REVERTED build, unless you rebuild after restoring. A week later the clean `git status` makes that binary look like the PR head. Seen on #13276: wt-10877's slangc was the reverted build; its "PR head" results were really the merge base. Fix: after restoring, always rebuild. Before reusing an old worktree binary, compare the lib mtime to the last source mtime (`stat`), or just rebuild. Also: on Linux the default cmake preset now source-builds DXC (~30 min). For slangc-only checks configure with `-DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_SLANG_RHI=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_TESTS=OFF` and build `slangc slang-glslang` (~5 min on 64 cores).
