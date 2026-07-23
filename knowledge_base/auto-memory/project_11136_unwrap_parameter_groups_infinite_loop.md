---
name: project_11136_unwrap_parameter_groups_infinite_loop
description: "#11136 infinite loop _unwrapParameterGroups non-StructuredBuffer — ✅ MERGED 601d363f77 (jhelferty-nv, 07-22); TERMINAL; clean withhold→APPROVE calibration"
metadata: 
  node_type: memory
  type: project
  originSessionId: 06fbb6bb-bea4-46e7-8679-d9d3adb71e37
---

shader-slang/slang PR **#11136** "Fix infinite loop in `_unwrapParameterGroups` for non-StructuredBuffer resources" (fixes gh-8455). Bot-authored fixer PR, branch `fix/gh-8455-unwrap-parameter-groups-infinite-loop`, current head **`452d965a05`** (R2, post CLA squash/rebase; was `bcb552353da9` at R1).

**R2 (2026-07-22): ABSTAIN_POLICY (CHALLENGER_CONCERN) @ `452d965a05`.** Maintainer jhelferty-nv asked the fixer to squash + rebase on master + re-author the commit as `nv-slang-bot` — the `slang-fixer` pseudonym on original commit 890a600 was snagging CLAssistant. Fixer did it (single commit on master@d384b77, author+committer both nv-slang-bot, zero slang-fixer refs), content-verified **identical** to R1 (`break`→`return typeLayout` now at renderer-shared.h:434 post-rebase; same test blob). **Mechanical-only CLA fix — a force-push does NOT auto-dismiss CHANGES_REQUESTED.** Approver re-ran full cycle: Devin clean first try, CI fresh zero failures, but reviewDecision still CHANGES_REQUESTED (jhelferty-nv @21:01Z 07-17, unchanged) → same posture as R1. New ledger row; R1 row on `bcb552353da9` now stale.

**The fix (correct, principled):** one line — `tools/gfx/renderer-shared.h:432` `break;`→`return typeLayout;`. The old `break` exited only the inner `switch`, not the enclosing `for(;;)`, so a non-StructuredBuffer resource (`Buffer<uint>`, a TextureType) looped forever; returning the leaf layout matches the function's `default:` case. Devin independently confirmed, no 🔴.

**R1 verdict (2026-07-17): ABSTAIN_POLICY / CHALLENGER_CONCERN.** Not because the fix is wrong — because PR reviewDecision stands at **CHANGES_REQUESTED** (maintainer jhelferty-nv @21:01Z, never dismissed/re-reviewed). Shadow mode never rounds up over a live human "changes requested." Ledger row written; nothing posted to GitHub (approver is shadow-mode). Clauses 6/6; tier=Devin-only (harvest exit 20 = expected bot-branch skip).

**jhelferty-nv's ask + fixer response:** sole inline thread was a *comment-clarification* request ("clarify the bug was originally in tools/gfx, the test just guards slang-rhi's twin"). Fixer **complied** — reworded the test header comment (+6L, comment-only, no C++), pushed, replied on thread [discussion_r3606247854](https://github.com/shader-slang/slang/pull/11136#discussion_r3606247854). (I initially mis-framed this to the approver as "disputing rather than complying" — approver corrected me; the fixer complied.)

**Latent 🟡 test-gap:** the regression test exercises slang-rhi's *already-correct* twin of `_unwrapParameterGroups`, not the fixed (deprecated, test-excluded) tools/gfx path. If the maintainer re-reviews and pushes on coverage, that's the open thread.

**Human verdict (2026-07-22 14:57Z): jhelferty-nv APPROVED** on the exact R2 head `452d965a056c` (review id 4755728785). Approver independently verified live `reviewDecision=APPROVED` at HEAD (not stale) and stamped `record_human_verdict(APPROVED)` against its R2 ABSTAIN row. **Clean withhold resolution** — shadow ABSTAIN_POLICY ("human must look") never rounded up over the standing CR; the human looked and cleared their own CR by approving. Good mirror-image of a false-safe, not a conservative miss. PR now OPEN + non-draft + **MERGEABLE**.

Calibration note: a CHANGES_REQUESTED *review object* carries the commit oid where it was **submitted** (here pre-rebase 890a600), but `reviewDecision` is a head-aggregate — it held CHANGES_REQUESTED on the R2 head `452d965a05` until the fresh APPROVED superseded it. Read `reviewDecision`/`latestReviews` for staleness, NOT the individual review's `.commit_id`.

**MERGED (2026-07-22 21:39Z): `601d363f77`** by jhelferty-nv, fixes #8455. `break`→`return typeLayout` in `_unwrapParameterGroups` now on master. Post-approval Falcor CI reds (GBufferRTTexGrads then SplitScreen_d3d12, both D3D12 timeout/access-viol) were correctly classified as environmental flakes — maintainer merged despite them, vindicating the environmental-by-construction call (byte-identical prebuilt binary can't cause a render regression). Fixer cleaned up worktree wt-slang-11136 + sentinel.

**TERMINAL & CLOSED.** Full arc R1→R2→APPROVED→MERGED is a clean shadow-mode calibration: twice-ABSTAIN_POLICY on a real standing CR (never rounded up), mechanical CLA rebase didn't move that axis, human eventually approved+merged — the intended "human must look" resolution, not a false-safe.
