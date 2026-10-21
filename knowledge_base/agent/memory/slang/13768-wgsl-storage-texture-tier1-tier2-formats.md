---
type: chain
title: slang#13768 — WGSL storage textures: tier1 formats fall back to rgba32float; E56106 rejects rgba16float read_write
description: Human-filed (albertrodriguezclo) WGSL texel-format mapping + E56106 access diagnostic; routed to slang-triager 2026-10-20
---

# slang#13768 — WGSL: tier1/tier2 storage-texture formats

- Filed 2026-10-20 12:49:03Z by albertrodriguezclo (external, same reporter as #13633, #13739 and others).
  1. `getWgslImageFormat` has no mapping for the WGSL `texture_formats_tier1` texel formats (r16float,
     rg16float, r8unorm, rg8unorm, r8uint, r16uint, rgb10a2unorm, rg11b10ufloat, rgba16unorm, ...). They
     fall back to `rgba32float` with E31105, and the pipeline then fails at run time.
  2. E56106 (#10926 for #7164) rejects `rgba16float` + `read_write`. WebGPU `texture-formats-tier2` now
     allows it, but `rgba32float` + `read_write` (same tier2 requirement) has no diagnostic. The
     reporter's ask: drop E56106, or make it a warning that covers every tier2-only pair.
  Related per reporter: #8768, #7022.
- 2026-10-20 ~12:52Z: live read clean (open, 0 comments, no labels/assignees, empty timeline,
  updated_at == created_at). Only session on the thread is my own webhook session (`sess-1792500545886-if4qee`).
  No reporter PR yet. Dispatched to slang-triager on `gh-issue-shader-slang/slang-13768`.
  Brief: check for a reporter PR first, and give claim 2 a maintainer-decision note (it removes or
  weakens a diagnostic that was added on purpose). No fixer until the triage memo is back.
- 2026-10-20 13:14Z `[Triage]` (slang-triager `sess-1792500721329-rrue90`): both parts reproduce on v2026.20 and on
  master 7251cc6. Public comment [6291692744](https://github.com/shader-slang/slang/issues/13768#issuecomment-6291692744)
  (verified: nv-slang-bot, only comment). `reproduced` label and Type=Bug set (verified). Memo:
  `/workspace/inbox/a2a-1792502096569-z43mge/triage-13768.md` (copy at `memory/issues/triage-13768.md` in the triager group).
  - **Part A, P2 bug:** `getWgslImageFormat` (`slang-emit-wgsl.cpp:393-485`) maps 17 of 43 formats. Fix A1
    adds the 23 tier1 cases, so only r64ui/r64i fall back with E31105. The test
    `image-format-unsupported-by-backend.slang` WGSL line moves rg8→r64ui. Dawn/L40S confirms the run-time bind failure.
  - **Part B, maintainer decision:** E56106 options B1 remove / B2 WebGPU-table warnings / B3 capability-gated / B4 keep.
    Asked @zangold-nv (author of #10926) / @expipiplus1. The comment at `:379-383` is wrong: rg32float, bgra8unorm and
    rg32sint with RW fail even with tier2, and `tests/wgsl/texture-storage.slang` checks those pairs.
  - Triager re-check `i13768-recheck-ce8b` 10-23 13:00Z covers the reporter PR and the part-B reply.
- 2026-10-20 ~13:17Z: no reporter PR (verified; the newest is #13769, unrelated). I told the triager to **route** A1 to
  slang-fixer: A1 only (no E56106 or comment change, no A3), a DRAFT PR, and stand down if the reporter opens a PR or
  says they will. Parked on: the fixer PR (part A) and the maintainer pick (part B).
- 2026-10-20 13:17Z: the triager sent the A1 handoff. slang-fixer session `sess-1792502182035-kcxr4o` is on the
  canonical thread (verified). Comment 6291692744 was edited in place at 13:16:47Z and is still the only comment
  (verified). Next: the fixer's [Fix Report], then the triager's [Triage Resolution].
- 2026-10-20 14:20:15Z: reporter comment [6293057241](https://github.com/shader-slang/slang/issues/13768#issuecomment-6293057241)
  (I re-read it live; not edited). Three points: no fix on their side for part 1, so go ahead with the automated PR;
  they agree `rg11b10ufloat` needs `WTexture2D`; for part 2, B1 or B2-as-warning both work for them, and the
  requirement is that rgba16float RW compiles under tier2. I relayed it verbatim to the triager (msg 31) for the
  fixer `kcxr4o` (13:18Z: claimed, build ETA ~20 min). Part B is still the maintainer's decision; the reporter's
  preference is input to it. No bot ack posted (that would be churn).
- 2026-10-20 14:21:02Z: slang-fixer `kcxr4o` opened **DRAFT PR #13778** ("WGSL: emit texture_formats_tier1 storage texel
  formats instead of rgba32float", branch `fix/issue-13768`, nv-slang-bot) (verified). The triager's go-ahead relay
  reached the fixer at seq 8 (14:21:24Z). PR webhooks already route to the fixer session. Next: the [Fix Report], then
  the triager's [Triage Resolution]. That comment will be a new delta comment, not an edit, because the reporter has commented.
- 2026-10-20 14:24Z: PR #13778 head `3fdbc7acec`, draft, body says `Part of #13768` (triager). I checked the files:
  `slang-emit-wgsl.cpp` +51/-0, `image-format-unsupported-by-backend.slang` +9/-3, new
  `tests/wgsl/storage-texture-tier1-formats.slang` (+91; `-warnings-as-errors 31105`, WTexture2D except r16f RW). No E56106 or
  `wgslFormatSupportsReadWrite` lines in the diff. The fixer's own claims (not verified by me or the triager):
  1889/1889 local tests, 23/23 formats bind on Dawn tier1/L40S. Waiting on the fixer's review, then the [Fix Report]
  and the Triage Resolution.
- 2026-10-20 16:49Z **R1 review of #13778 @3fdbc7acec: APPROVE_WITH_NITS (0/1/0)** (slang-reviewer; combined review at
  `/workspace/inbox/a2a-1792514988128-240exx/combined-review-13778-r1.md`; verdict sent to fixer `kcxr4o` at seq 20).
  - Reviewer's own checks: the revert drill fails on master and passes at head. An exhaustive scan finds that only
    r64ui/r64i still give E31105. On Dawn/L40S, 23/23 formats bind with tier1, 0/23 without it, and 0/23 on master.
    Suites 2011/2011.
  - **G1 (all 4 reviewers):** `read_write` on 17 tier1 formats (r8snorm, rg8*, r16unorm/snorm, rg16*, rgba16unorm/snorm,
    rgb10a2*, rg11b10ufloat) used to give E31105 + `rgba32float, read_write`, which Dawn accepts on tier2 when the app binds
    rgba32float. It now gives `<fmt>, read_write` with no diagnostic, which every device rejects at pipeline creation. Tier2 RW is only
    r8unorm/uint/sint and r16uint/sint/float (Dawn verified 6/6 accepted, 17/17 rejected).
  - The reviewer refuted Reviewer A's fix (add the 17 formats to the E56106 deny-list): it would turn code that compiles today into
    an error, and that choice belongs to part 2. Requested in this PR: fix the comments at :379-383 and :475-477 and the test comment
    at :32-34, and a PR **Risk line** saying RW on the 17 formats changes from "warning + rgba32float" to "silent,
    pipeline-invalid". An untested alternative for maintainers: keep the old fallback for RW on those 17 only.
  - N1: CI run 39438440080 proves nothing (wait-for-human-priority yielded; 44/48 jobs skipped). N2 (optional): retire
    the finding `wgsl-unsupported-int-image-format-falls-back-to-float` with `regenerate.py findings fixed`.
  - The reviewer posted nothing on GitHub (verified: the PR has 0 reviews; its only comments are coderabbit, the board notices and our explain-diff).
- 2026-10-20 17:11Z `[Triage Resolution]` (part 1): #13778 @9cfc373449, still draft, `Part of #13768`, no `Fixes`, +160/−8 (verified).
  The R1 nits are applied; the Risk line names the 17-format RW change (verified). The two later commits change comments only. The fixer rewrote the
  `:379-383` comment (outside my handoff scope). I read the new text and accepted it: it is accurate and points to #13768 (told the
  triager, msg 45). Issue comments: 6291692744 triage, 6293057241 reporter, 6293312018 marked Superseded, 6296554851 the fixer's
  final status (verified). The triager closed the part-1 chain and reopens it on a human comment, a ready flip/merge, or my ask.
- 17:12Z: I put the decision to the operator on the dashboard (msg 47): un-draft #13778 so real CI runs (run 39438440080 was
  bot-yielded), or keep holding it. **PARKED:** the operator decides the ready flip; zangold-nv/expipiplus1 decide part 2 B1–B4 (+ the 17-format
  RW input). Timer: triager `i13768-recheck-ce8b` 10-23 13:00Z.
