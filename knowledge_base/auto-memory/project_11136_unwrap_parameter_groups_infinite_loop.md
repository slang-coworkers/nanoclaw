---
name: project_11136_unwrap_parameter_groups_infinite_loop
description: "#11136 infinite loop _unwrapParameterGroups non-StructuredBuffer — R1 ABSTAIN_POLICY; parked on maintainer re-review"
metadata: 
  node_type: memory
  type: project
  originSessionId: 06fbb6bb-bea4-46e7-8679-d9d3adb71e37
---

shader-slang/slang PR **#11136** "Fix infinite loop in `_unwrapParameterGroups` for non-StructuredBuffer resources" (fixes gh-8455). Bot-authored fixer PR, branch `fix/gh-8455-unwrap-parameter-groups-infinite-loop`, head `bcb552353da9`.

**The fix (correct, principled):** one line — `tools/gfx/renderer-shared.h:432` `break;`→`return typeLayout;`. The old `break` exited only the inner `switch`, not the enclosing `for(;;)`, so a non-StructuredBuffer resource (`Buffer<uint>`, a TextureType) looped forever; returning the leaf layout matches the function's `default:` case. Devin independently confirmed, no 🔴.

**R1 verdict (2026-07-17): ABSTAIN_POLICY / CHALLENGER_CONCERN.** Not because the fix is wrong — because PR reviewDecision stands at **CHANGES_REQUESTED** (maintainer jhelferty-nv @21:01Z, never dismissed/re-reviewed). Shadow mode never rounds up over a live human "changes requested." Ledger row written; nothing posted to GitHub (approver is shadow-mode). Clauses 6/6; tier=Devin-only (harvest exit 20 = expected bot-branch skip).

**jhelferty-nv's ask + fixer response:** sole inline thread was a *comment-clarification* request ("clarify the bug was originally in tools/gfx, the test just guards slang-rhi's twin"). Fixer **complied** — reworded the test header comment (+6L, comment-only, no C++), pushed, replied on thread [discussion_r3606247854](https://github.com/shader-slang/slang/pull/11136#discussion_r3606247854). (I initially mis-framed this to the approver as "disputing rather than complying" — approver corrected me; the fixer complied.)

**Latent 🟡 test-gap:** the regression test exercises slang-rhi's *already-correct* twin of `_unwrapParameterGroups`, not the fixed (deprecated, test-excluded) tools/gfx path. If the maintainer re-reviews and pushes on coverage, that's the open thread.

**Next:** parked awaiting maintainer re-review / clear of the CHANGES_REQUESTED, or fixer to satisfy it. Approver will stamp the human verdict on the next pr_review/merge/close join. A substantive human comment re-opens the chain via [[feedback_changes_requested_read_body]].
