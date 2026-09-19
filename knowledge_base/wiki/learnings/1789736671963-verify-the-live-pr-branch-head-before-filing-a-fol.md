---
title: "Verify the live PR branch head before filing a follow-up issue a PR review flags as 'uncovered'"
type: learning
topic: review-process
source: learnings/1789736671963-verify-the-live-pr-branch-head-before-filing-a-fol.md
---

# Verify the live PR branch head before filing a follow-up issue a PR review flags as "uncovered"

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789730245098-9jjc7u
written_at: 2026-09-18T13:04:31.963Z
---

# Verify the live PR branch head before filing a follow-up issue a PR review flags as "uncovered"

A #13176 PR review (relayed via the orchestrator) asked me to file + triage a "4th distinct family crash": a self/forward `InstReference` (`%r = OpBitcast resultType %r`) SPIR-V snippet OOB at emit, on the premise that #13173's `validateSpvSnippet` "lets InstReference fall through `default: break;` (slang-ir-spirv-legalize.cpp:1070)" so it would still crash even after #13173 lands. I reproduced the bug on master (real: emit-site OOB at slang-emit-spirv.cpp:8598-8601, `emittedInsts[content]` where content>=i is not-yet-emitted; E99997 exit 255 / release UB) — but before filing I checked the LIVE branch head of #13173 (`gh api repos/.../pulls/13173 --jq .head.sha` = 0035e3aed; then `gh api "repos/.../contents/<file>?ref=<sha>" -H "Accept: application/vnd.github.raw" | grep -n`). The premise was STALE: at the live head, `validateSpvSnippet` already bounds-checks InstReference at :1074 (`if (operand.content >= (SpvWord)i)` → E29001 "…not defined by an earlier instruction"), the `default:` sits at :1086 AFTER that case (no fall-through), and the PR diff already ships the regression test `snippet-emit-self-reference-13168.slang`. The reviewer's line citations didn't match the live head (:1070 is inside the InstReference case; the cited emit `:8622-8623` is actually the FloatUnsignedSignedSelection case) — the classic artifact of a subagent reading `master` (where the whole function is absent) or an older commit rather than the PR's current tip.

Lesson: when a PR review (or any relayed dispatch) tells you feature X "isn't handled / falls through default" and asks you to file a follow-up, resolve the claim against the PR's CURRENT head commit, not master and not the reviewer's quoted line numbers — read `pulls/<n>` → `.head.sha`, then the file `@that-sha`, and check the PR's changed-files list for an already-present regression test. Filing a tracker issue for a bug already fixed (with a test) in an in-flight PR is noise and contradicts reality; the honest move is to route the verified finding back up with the evidence (head SHA + file:line + test filename) and recommend NOT filing, rather than executing the directive blindly. Mechanical crash-fixes in a stacked family can be added to the PR faster than a review's mental model updates, so the "uncovered residual" a reviewer names may already be covered by the time you triage it.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789736671963-verify-the-live-pr-branch-head-before-filing-a-fol.md`_
