---
type: chain
title: slang#14386 — `FloatToHalf` narrows every NaN to the signaling NaN 0x7C01/0xFC01
description: Bot-filed 2026-11-06 16:14Z by slang-triager, side-find S4 from review of draft PR #14385 (#14259 chain). Bug + `reproduced`. Parent umbrella #14481 (skiminki-nv, 11-13). Held for maintainer jkwak-work's self-assignment (11-16), then dispatched; fixer chain recovered 11-17 after two 429 auto-fails — FIXED (Fix Report 11-17 10:00Z, R1 APPROVE_WITH_NITS applied, head 7abc89e18); draft PR #14532 PARKED on maintainer review, ready-flip pending, webhook-only.
tags: [half, nan, constant-folding, spirv-emit, core-math, side-find, filed-only]
---

# slang#14386 — half NaN constants become a signaling NaN

**Bug.** `FloatToHalf` (`source/core/slang-math.h:222-227`) returns `sign | 0x7c00 | (fraction != 0)` for any NaN, so
a quiet NaN narrows to `0x7C01`/`0xFC01` (quiet bit clear, payload 1), a signaling NaN. Callers: SPIR-V constant emit
(`slang-emit-spirv.cpp:1134`, `:1259`) and half constant folding (`slang-check-expr.cpp:7450`, `:7481`). On VK/L40S,
`half(0.0 / 0.0)` reads `FC01`, while the `float`/`double` constants are quiet. Expected: keep sign, quiet bit and top
payload (`sign | 0x7C00 | (fraction >> 13)`), forcing a non-zero payload only if the shift leaves 0. Not a regression.

**Origin.** Found in review of [#14259](14259-hlsl-byte-address-store-double-untyped.md)'s third PR #14385 (HLSL typed
half / NaN / ±Inf literals). The triager owner session sess-1793741880740-mvymkh filed it and did not route it. Separate
from #13909 / #14161 (text-emitter NaN).

**GitHub (11-06 16:14Z).** Open, label `reproduced`, Type=Bug, 0 comments, no assignee. The issue body is the resumable
artifact; no bot comment posted.

**Decision (11-06 16:18Z, Main session sess-1793981657033-exfjo9, the issue_opened owner): no dispatch, FILED-ONLY.**
- Low severity: the value is still a NaN; only the quiet bit differs, and GPUs do not trap on signaling NaNs.
- The NaN arm's comment ("does not preserve the NaN payload or distinguish quiet NaNs from signaling NaNs") was written
  on purpose by maintainer skallweitNV in #13485 (merged 10-09), so changing it is a design change to that author's code.
- Human PR #13927 (albertrodriguezclo, BEHIND, not draft) adds NaN-bit helpers to `slang-math.h` right above
  `FloatToHalf`; it does not change the NaN arm. The same contributor owns the related #13857 / #13909 NaN work.
- No collision with #14385 (`slang-emit-hlsl.cpp` only) or #14276.
- slang-fixer had 4 running sessions, so load was not the reason.

**Timer.** One-shot `recheck-14386-floattohal-2ff9` (11-13 12:00Z). Its table: relay a human comment to the triager;
hold if a human is assigned or has a PR; otherwise dispatch slang-fixer on `gh-issue-shader-slang/slang-14386` (draft,
`Fixes #14386`, SPIR-V filecheck + VK test, leave #13927's helpers alone) and tell the dashboard; re-arm once if the
fixer is loaded. **Resumes earlier on:** a human comment, a maintainer `bot-ok`/assignment, or an operator go-ahead.

**Re-check 11-16 04:45Z (recheck-14386-floattohal-2ff9, fired ~3 days late): rule (b), record only, no dispatch.**
- `gh` and slang-mcp both failed with 401 `Bad credentials`. This is the fleet-wide GitHub-auth outage that was already
  alerted on the dashboard at 04:41Z and 04:42Z (rows 512357/512364), so I posted no new alert. I read the state from
  the public HTML pages (github.com / WebFetch), not the API.
- **#14386:** open, `reproduced`, Type=Bug, **assigned to jkwak-work (maintainer, self-assigned 11-06)**, 0 comments.
  On 11-13, skiminki-nv made it a sub-issue of umbrella **#14481** "[Constant folding] Floating-point constants umbrella".
  No linked PR or branch. The 11-06 record said "no assignee" only because the self-assignment came after the 16:14Z read.
- **#13927** (albertrodriguezclo): open, not draft, last commits 11-12. It does not mention #14386 or FloatToHalf.
  **#14385:** state not read (the API was down). It does not affect a rule-(b) hold.
- **Not verified:** I could not read `issues/<N>/events` through the API, so the HTML timeline is the only source for
  "self-assigned". Re-check it with `gh api .../events` (the `assigner` field) when auth is back, if it matters.
- **Now:** held under the maintainer's ownership (rung 4). No timer, because webhooks deliver comments, unassignment and
  close. **Resumes on:** a maintainer comment or `bot-ok`, an unassignment, or work on umbrella #14481 that delegates this
  sub-issue.

**Recovered 11-17 (recheck-14386-fixer-down-83c1).** The hold was lifted at some point and the triager handed the chain to
slang-fixer (owner session sess-1794888683674-y6lori on `gh-issue-shader-slang/slang-14386`, created 11-17 04:11Z). Two 429
auto-failures stopped the fixer at 05:15Z/05:53Z ("Sorry, something went wrong" notices); recheck task
`recheck-14386-fixer-down-83c1` was armed for that. Re-nudge 07:18Z → fixer resumed 07:19Z with the full red→green series
already landed locally (worktree `wt-slang-14386`, branch `fix/issue-14386`: 779090324 red repro → efd744e92 FloatToHalf
quiet-NaN fix + unit quiet-bit pin → 0db9e0f… gh-14259 test tightening; all verification green incl. vk on the L40S).
Verified from session rows, not just the triager's report. Only the codex critique bridge had been rate-limited; CODE_REVIEW
re-runs, then draft PR (issue comment 6938043324 tracks it). Escalation stood down — no operator action.

**Draft PR #14532 opened 11-17 ~08:10Z (fixer report, verified live with `gh pr view`).** "Quiet the half NaN produced by
FloatToHalf narrowing" — OPEN, **draft**, branch `fix/issue-14386`, head `02b46235e`, label `pr: non-breaking`, base
master, body carries `Fixes #14386` + the new test `tests/bugs/gh-14386-half-nan-quiet.slang`. Explanation comment posted
(issuecomment-6942436071); HTML explanation filed to
`/workspace/inbox/a2a-1794903005729-mb4kat/2026-11-17-shader-slang-pr14532-half-nan-quiet.html`. The fixer dispatched peer
review to slang-reviewer itself (its workflow sends the `[Fix Review Request]` on the canonical thread — no
orchestrator-side parallel dispatch); `[Fix Report]` follows the verdict. **[Fix Report] received 11-17 10:00Z — FIXED.** 5 files +97/−12, head **7abc89e18** (nits re-push; verified live: OPEN draft,
head matches, CI at the draft skip-gate). `FloatToHalf` NaN arm (`slang-math.h:234-236`) now returns
`sign|0x7c00|0x0200|(fraction>>13)` — always quiet, sign + top payload kept, Inf encoding unchanged; prelude
`f32tof16` untouched (its sNaN-preservation pinned by half-runtime-special-values.slang). Tests: new
`gh-14386-half-nan-quiet.slang` (spirv-asm OpConstant + vk + cpu lanes) + `gh-14386-half-nan-quiet-vm.slang` (INTERPRET/VM
lane), gh-14259 half-NaN check pinned to `{{7|F}}E00`, unit test pins exact encodings (0x7E00/0x7F09/0x7E09/0x7FFF, both
signs). All green: repro 5/5 (vk on L40S, red-first), units 686/686, gh-14259 4/4, tests/bugs 1055/1055, reflection 57/57,
6-target sweep clean. Peer review R1 **APPROVE_WITH_NITS** (0 bugs, 2 gaps, 2 questions) — all nits applied and re-pushed;
reviewer's 0x7E08 arithmetic note corrected to 0x7E09 (0x412345>>13=0x209); optional reflection-surface test advisory
declined (not in acceptance criteria, producer pinned exhaustively).

**PARKED on maintainer review — webhook-only, no timer.** Draft PR #14532 @ 7abc89e18, CI run 44053760335 at the draft
skip-gate (approval gate comes after ready-flip), explanation comment + description current. CI/review/close webhooks route
to the fixer session on `gh-issue-shader-slang/slang-14386` (worktree `wt-slang-14386` + sentinel stay until close). Register:
`supervisor-state.json` disposition → "maintainer-driving — fix complete … ready-flip pending on the weekly list" (11-17
10:05Z). **Ready-flip pending** — weekly operator list; no per-PR ask.

**12:27Z re-send (post-restart).** The formal `[Fix Report]` marker re-send is gated on re-recording critique stages, and the
codex bridge is 429-rate-limited (2 fails/10 min) — marker temporarily blocked; **substance accepted as the report of
record** (reply sent on the fixer's edge: nothing upstream blocked on the marker, send it only if its workflow still
requires it once the bridge clears). New details: reviewer verified the applied nits at head 7abc89e18 — verdict stands,
no further round (they accepted the 0x7E09 correction and fixed their stored learning); repro lanes = spirv-asm / vk (L40S) /
cpu / cuda-syn / INTERPRET VM. The 429 storm is the same fleet-wide one already on the dashboard (tick 352 notes) — no new
infra alert.

**Formal marker received 11-18 07:30Z** (codex bridge cleared): identical to the accepted substance — report of record
confirmed, chain reporting complete. Verified live at receipt: PR #14532 still OPEN draft @ 7abc89e18, not merged. The
fixer's reporting duty on this chain is discharged; watch rests on webhooks + the supervise tick.
