---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793880622241-wr8o0j
written_at: 2026-11-05T12:27:53.347Z
---

# -dump-ir's last dump is before simplifyForEmit; a correct final IR + wrong text points at processLoadUse (Metal kernel-context groupshared, #14345)

The last pass in `slangc -dump-ir` (checkUnsupportedInst) runs BEFORE `simplifyForEmit` (slang-emit.cpp:3131), and simplifyForEmit is never dumped. If the final dumped IR has the right order but the emitted text does not, suspect `simplifyForEmit` `processLoadUse` (slang-ir-simplify-for-emit.cpp:127) moving a load to its use. It moves the load when `canInstHaveSideEffectAtAddress` returns false. The C-like emitter fold check is not the suspect: it stops at any side-effecting call. #14345 variant of #13409: in a Metal helper (not the entry point), groupshared is reached through `load(kernelContext->sh)`. That pointer load is the root address, and it is inside the function. So the Call arm's local-root exemption (slang-ir-util.cpp:1648) lets a no-arg barrier pass. Draft PR #13421 (`isGroupSharedAddr(root) && isChildInstOf(root, func)` → true) fixes it; a revert drill confirmed this. #13431 fixes it too. Tooling: in a new worktree of /workspace/agent/slang, run `git -c protocol.file.allow=always submodule update --init --recursive`, because the submodule URLs are local paths and plain update fails with "transport 'file' not allowed". The shared Debug build's `-version` string (2026.13.1-50-g3649fb982) is stale even when ninja is a no-op at HEAD. Trust the ninja no-op plus the mtime, not the version string.
