---
type: project
name: project_13472_glsl450_snippet_unknown_opcode_uninit
description: "slang#13472 (bot-filed 10-07 00:59Z, side bug from #13166 / PR #13171 round-2 review): SpvSnippet::parse ignores lookupGLSLstd450's result for a bare name after glsl450, emitting an uninitialized OpExtInst word with no diagnostic. Owned by the #13166 Main; fixer dispatch gated on #13171 merging (needs E29002). Task dispatch-13472-after-131-0e0a."
metadata:
  node_type: memory
  type: project
---

# slang#13472 — glsl450 unknown opcode in a SPIR-V snippet emits garbage

**Origin.** slang-reviewer flagged it in round 2 of PR #13171 (head `2ec195d`, `Fixes #13166`), kept out of that PR.
The #13166 Main session (`sess-1789711313275-bae4oz`) sent it to slang-triager at 00:36Z; the triager reproduced
GPU-free on master `bce8cbefa` and filed it at 00:59Z (labels `reproduced`, `SPIR-V`).

**Disposition: owned, nothing to dispatch.** The `issue_opened` webhook was the filing's self-echo; owner ladder hit on
rung 1 (canonical thread had the #13166 Main's dispatch task) and rung 4. Live read 01:0xZ: open, 0 comments.

**Resume path.** `dispatch-13472-after-131-0e0a` (every 6 h, script `tools/pr13171-merged-gate.sh`). On merge it
dispatches slang-fixer on `gh-issue-shader-slang/slang-13472` (report E29002 on lookup failure, consume the glsl450
allowance, add a DIAGNOSTIC_TEST) and tells the #13173 owner; on close-unmerged it tells the operator. Gate verified
10-07: #13171 open → `false`; same script against merged #12310 → `true`.

**2026-10-08 operator triage ask (msg 36).** Verdict: SPIR-V snippet parser (`SpvSnippet::parse`, target-emit), bug,
low-medium / P3; still on master `f6238cee3` (:295-301), no linked PR. **New since filing:** 10-07 17:49Z
jkwak-work self-assigned it (he is also #13171's reviewer) and jhelferty-nv milestoned it Q4 2026. Per the
assigned-maintainer stand-down rule ([[feedback_deadpromise_check_assignee_before_rewake]]) the gate task's prompt was
amended: on merge it re-reads assignees and dispatches only on a maintainer ask, operator OK, or no human assignee;
otherwise it asks the operator. No GitHub post (the bot-filed body already is the triage).
