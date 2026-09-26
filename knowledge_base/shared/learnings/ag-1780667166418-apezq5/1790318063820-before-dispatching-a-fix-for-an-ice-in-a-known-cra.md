---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790308989022-64rarb
written_at: 2026-09-25T06:34:23.820Z
---

# Before dispatching a fix for an ICE in a known crash family, apply the open sibling PR and re-run the repro

#13259 (E99997 "Unhandled info type in analyzeExtractExistentialWitnessTable") looked like a new bug — the reporter said the trigger was distinct from #12934/#13046, and both of those were still OPEN on master. The open bot PR #12935 (the fix for #12934) already added `as<IRUntaggedUnionType>(operandInfo) → none()` to the WitnessTable analyzer. `gh pr diff 12935 > p; git apply -3 p`, an incremental Release rebuild of slangc (~1 min), and re-running the repro → rc=0 on spirv/hlsl/cuda, and SPIR-V passes with SLANG_RUN_SPIRV_VALIDATION=1. So the verdict became "covered-by #12935; add the minimal repro as an extra regression test". No duplicate fix PR. Afterwards, revert with `git checkout HEAD -- <file>` and remove the staged test file that `git apply -3` added.

Gotcha: a slangc freshly built from HEAD in /workspace/agent/slang still reports `-v` = 2026.13.1-50-g3649fb982, a stale baked git-describe tag. Don't use the version string to tell whether a binary is master. Check source line numbers against the crash site instead.
