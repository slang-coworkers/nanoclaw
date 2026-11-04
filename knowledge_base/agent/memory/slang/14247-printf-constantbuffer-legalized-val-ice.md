---
type: chain
title: slang#14247 — `printf` with a `ConstantBuffer<uint>` argument → ICE "Unknown legalized val flavor for printf operand"
description: Human-filed (jkwak-work) ICE 2026-11-03, found while fixing the dead PASS case of tests/bugs/gh-4700.slang. TRIAGED P2 11-03; draft PR #14253 closed by the maintainer as overkill, issue marked unplanned (use an explicit cast). CLOSED on our side.
tags: [printf, constant-buffer, legalization, ice, gh-4700, r6]
---

# slang#14247 — printf(ConstantBuffer<uint>) ICE

**Ask (reporter's claims, not reproduced by me).** `printf("value: %u\n", cb)` with
`ConstantBuffer<uint> cb` aborts with `E99997 ... InternalError unimplemented: Unknown legalized val
flavor for printf operand` on spirv/hlsl/glsl/metal (cuda: no error; wgsl: E36107 earlier). Copying
into a local first compiles. Expected: load the value, or a normal diagnostic, never an ICE. Seen on
`2026.20-100-g8229f2742`. Reporter wants the compiler fixed, not the test changed.

**Context.** Hit after fixing `tests/bugs/gh-4700.slang` (`-DPASS1` vs `#ifdef PASS`), at
`printf("\nfrom gpu: %u", addresses);` — that test fix is the reporter's own work; don't duplicate it.

## Timeline

- 11-03 webhook `issue_opened`; memory grep for 14247 → no hits (4700 hits were timestamp false positives);
  no prior session in any group. Dispatched to slang-triager on `gh-issue-shader-slang/slang-14247`.
- 11-03 18:41Z triager ack: no duplicate found; slangc rebuilt on master 7f4efc7ce; reproducing across targets/variants.
- 11-03 18:42Z triager: REPRODUCED on master (spirv/hlsl/glsl/metal ICE; cuda/cpp compile). Wider than reported (triager finding): ParameterBlock<uint>, ConstantBuffer<struct>, StructuredBuffer, RWStructuredBuffer, Texture2D args hit the same ICE. Picking layer (legalizePrintf vs sibling abort validator).
- 11-03 18:47Z triager root cause (its finding, not verified by me): printf arg pack lowers to a struct holding a ConstantBuffer field; resource legalization turns it into a `tuple` val, and legalizePrintf has no case for that flavor. Its `pair` case silently drops resource args → SILENT WRONG CODE: with mixed args `cb` is dropped on hlsl/glsl/metal/spirv, and cuda passes the `uint*` for `%u`. Next: frontend hook, then memo + handoff.
- 11-03 18:51Z triager: research done, dedup clean (timeline + assignee PRs). Next: memo, handoff to slang-fixer, issue post. This is the standard pipeline for a human-filed primary issue, so no operator go is needed.
- 11-03 18:52Z **TRIAGED** bug/medium/frontend/P2, not a regression, dedup clean (memo `/workspace/inbox/a2a-1793731955574-ztqd6w/triage-14247.md`). Recommended fix (A), at the frontend producer: tag printf/abort as KnownBuiltin and deref ConstantBuffer/ParameterBlock args before pack inference (`slang-check-overload.cpp:3501`), and diagnose opaque args in `maybeCheckKnownBuiltinInvocation` (`slang-check-expr.cpp:8375`). Rejected: (B) an IR diagnostic like legalizeAbort's E55211, and (C) a load inside legalizePrintf. Handed to slang-fixer (session `sess-1793731969572-elwwcb`, 18:52Z). Reporter jkwak-work self-assigned; triager says its comment invites them to take over the draft.
- 11-03 ~18:55Z Gap closed. The triage comment **6612713053** (nv-slang-bot, 18:53:36Z) was still pending when I checked, because the triager sent its report before posting. Verified via the API: the comment is up, the `reproduced` label is applied, and Type=Bug. Lesson: a triager [Triage] report can arrive before its post lands, so re-check once before calling it a gap.
- 11-03 18:54Z slang-fixer: building `fix/issue-14247`, ETA 20 min. The triager will forward the [Triage Resolution] after the [Fix Report].
- 11-03 20:39Z slang-fixer (its claims): fix committed on `fix/issue-14247` (6 commits), Codex PLAN_REVIEW and CODE_REVIEW approved. ConstantBuffer/ParameterBlock printf args are dereferenced on all 6 targets, and resource args get a normal diagnostic. A real CUDA run on the L40S prints `cb=42 mixed: 7 42 9` (master prints garbage). Full slang-test running; the draft PR and review request come next.
- 11-03 20:53Z **DRAFT PR #14253** (head 21abb5c74, `fix/issue-14247`, label `pr: non-breaking`). The pr-mapping goes to slang-fixer `sess-1793731969572-elwwcb`. Verified via the API. Fixer status comment on the issue: 6615361422 (21:03Z). PR body (its claims): E30903 for a direct call, E55219 via a generic. 4 new tests, all fail on master. Full suite 11434/11437; the 3 `fp8-cuda*` failures also fail on master. gh-4700.slang untouched.
- Open point: the PR's own Risk bullet says CUDA/CPU code that printed a resource handle now fails to compile, but the label is `non-breaking`. I asked the fixer to justify that in the PR or flip the label. Ready-flip pending, so it goes on the weekly list (P2, no per-PR ask).
- 11-03 21:09Z Label question closed. The fixer kept `pr: non-breaking` and added the rationale to Risk ("as #10923: that code passed a handle where printf expects a value, and other targets hit an ICE"). Verified in the PR body. The [Fix Review Request] went to slang-reviewer (session `sess-1793740024957-sndnvi`, 21:07Z, on the canonical thread). Next: the reviewer verdict, then the [Fix Report].
- 11-03 21:11:31Z **jkwak-work (reporter + PR shepherd) CLOSED PR #14253** unmerged. Comment 6615536930: "Closing the PR for now. This seems like an overkill for the rarely used functionality. An explicit casting should be used as a workaround until we have a better approach to the solution." Then on the issue at 21:12:06Z, comment 6615548634: "I am marking this as unplanned. An explicit type casting should be used as a workaround until we have a proper solution." The issue was still `open` at check time; closing it is the maintainer's action, not ours. PR size: 15 files, +334/−1, 6 commits.
- I told the chain to stand down. The triager posts the single closing ack on the issue. The fixer stops its in-flight slang-reviewer review, does not reopen or push, and posts nothing on the PR. **Chain CLOSED** on our side. A new human comment is a closed-chain live inbound for the triager.
- 11-03 21:15Z Triager closing ack **6615602966** posted; verified via the API. Both workarounds compile on spirv/hlsl/glsl/metal/cuda and load the value (its finding): `(uint)cb` and `uint v = cb;`. The triager chain is closed. Waiting on the fixer stand-down report (reviewer stop).
- 11-03 21:16Z Fixer stand-down report. The reviewer was stopped (fixer msg 21, reviewer confirmed msg 24: worktrees and builds killed, nothing posted). Worktree `wt-slang-14247` and the sentinel are removed. Branch `fix/issue-14247` is left on origin. Before the stand-down arrived, the fixer had edited its status comment 6615361422 in place (~21:12Z) to say the PR was closed and to give the cast workaround. **ALL THREE CHAINS CLOSED** (triager, fixer, reviewer). #14253 is off the ready-flip list. Three overlapping learnings now exist (mine, the triager's, the fixer's); fold them on the next learnings-wiki pass.
