---
type: chain
title: slang#14036 — CUDA `precise` / `-fp-mode precise` leave no trace in emitted .cu (FMA contraction)
description: Human-filed (albertrodriguezclo) feature request 2026-10-29 17:10:20Z, cloth-sim batch. Triaged feature/medium/P2 (CUDA emit) by slang-triager. 11-06 tangent-vector @-mentioned the bot, calling approach A reasonable for the general -fp-mode precise case (per-value precise waits on their language proposal). Bot DRAFT PR #14396 @2f563aa (11-07 02:30Z, approach A only, 'Part of #14036'), with slang-reviewer; assignee jkwak-work (shepherd routing by jhelferty-nv 11-02).
tags: [cuda, precise, fp-mode, fma, feature-request, parked, r6]
resource: /workspace/inbox/a2a-1793294503154-lqb5sc/triage-14036.md
---

# slang#14036 — CUDA `precise` / `-fp-mode precise` → `_rn` intrinsics

**Ask.** On `-target cuda`, `precise` is dropped (warning E56005), and the `-fp-mode precise` `.cu` is byte-identical to the default.
So nvcc contracts `a*b+c` into an FMA, and a ported kernel is bit-exact only under a file-wide `--fmad=false`.
The reporter wants `precise` values, and the whole module under precise mode, emitted as `__fmul_rn`/`__fadd_rn`/`__fsub_rn`.
An explicit `fma()` stays `fmaf`.

**Triage (slang-triager, 10-29 17:21Z, master 9b3ac252d). These are the triager's findings; I did not reproduce them.**
- Reproduced: E56005 is emitted, and the md5 of the default and precise `.cu` files is the same. nvcc 12.6 sm_89 turns `a*b+c` into `fma.rn.f32`, and the `_rn` form stays as a separate mul and add.
- Ask 3 already works: `fma`/`mad` lower to `::fmaf`.
- nvcc ignores the `FP_CONTRACT` pragmas. So the only lever in the source is the `_rn` intrinsics.
- Slang's own `-target ptx -fp-mode precise` already passes NVRTC `--fmad=false` (PR #12801). That covers slang-rhi/SlangPy for the global mode.
- The gap: offline nvcc on the `.cu` text, and per-value `precise` on every CUDA path.
- Approaches:
  - **A (recommended):** under precise mode, the CUDA emitter writes `_rn` for scalar ops. The prelude vector/matrix ops get `_rn` behind `SLANG_CUDA_ENABLE_PRECISE_MATH`, which mirrors the fast-math define from PR #12872.
  - **B:** share `computePreciseInsts` out of the SPIR-V emitter. This collides with tangent-vector's #13324 refactor.
  - **C:** wait for an IR precise marker from #13324.
- Related issues: #12799/#12801 (closed), #13324, #13689 (Metal).

**GitHub state (verified 10-29).** Issue Type=Feature and the `reproduced` label were set by the bot. 0 comments: R6 holds a bot comment until 11-02 17:10:20Z.
No fixer has been dispatched.

**Side note.** Reporter PR #13943 (Metal `-fno-fast-math` for `-fp-mode precise`) was MERGED 10-28 22:10:33Z (verified). That merge is one of #13689's resume triggers. The triager recorded it, and nothing else was done.

**11-02 re-check (t-4a15ea, fired).** No human movement since 10-29, and #13324 has been silent since 10-19. The triager posted the parked 5-bullet, cmt 6583831492, at 17:32:23Z. I verified that it is by nv-slang-bot and is now the only comment. The code pointers still hold on master 8229f2742. The triager has no further re-check, so the timer is the `supervisor-state.json` register entry (`advisory:maintainer-decision`).

**Next (superseded, kept for history).** The triager's one-shot `t-4a15ea` runs 2026-11-02 17:30Z. It posts the parked 5-bullet unless a human has moved the issue on. If there is a reporter PR, it records the PR and does not compete.
If there is maintainer direction, the triager hands off to slang-fixer. Owner: slang-triager, thread `gh-issue-shader-slang/slang-14036`. Memo: see `resource`.

**11-02 18:34Z.** jhelferty-nv assigned the issue to jkwak-work. This is not a self-assign; events API shows `assigner=jhelferty-nv`.

**11-06 22:46Z: maintainer direction.** tangent-vector (MEMBER) mentioned the bot in comment 6697700464 (verified). Quoted verbatim:
> The recommended approach A seems reasonable to me for the general `-fp-mode precise` case.
> I am actively working on a language feature proposal to codify our language rules for `precise`, as a prerequisite to working through fixes to our implementation. For the immediate future users are probably best off using the "big hammer" of `-fp-mode precise` (on targets where that is effective), while we work toward a proper fix.

I forwarded it to slang-triager (owner session `sess-1793293919345-acyb6s`, thread `gh-issue-shader-slang/slang-14036`), with `<github-post-authorized />`.
I told the triager three things: A covers the global mode only, per-value `precise` stays out until the proposal lands, and jkwak-work (the assignee) has not commented yet.
Next: the triager's [Triage handoff] to slang-fixer, or a GitHub question if it reads the comment otherwise.

**11-07 00:18Z: handed to the fixer.** The triager read the comment the same way I did, so it asked no question. It counts jkwak-work's assignment as shepherd routing by jhelferty-nv, which is not a stand-down.
- The triager posted ack 6699439326 as a fresh delta at 00:17:41Z. I verified it: no @-mentions; it says a draft PR is coming and that the assignee may take it over or close it.
- The handoff went to slang-fixer, session `sess-1794010689277-2rqq4g` (verified running, thread `gh-issue-shader-slang/slang-14036`). Scope: approach A only. Out of scope: per-value `precise`, E56005 and SPIR-V NoContraction.
- The PR is a draft with a non-closing "Part of #14036".
- Dedup at the time of the post: 0 cross-referenced PRs.
- The triager has scheduled no re-check; webhooks deliver any change.

**Next.** slang-fixer sends a [Fix Report], and the triager verifies the PR and sends me a [Triage Resolution].
The ready-flip goes on the weekly list, not into a per-PR ask.

**11-07 02:30Z: draft PR #14396.** Title "CUDA: emit _rn arithmetic under -fp-mode precise". Facts I verified:
- Branch `fix/issue-14036`, head 2f563aacf, label `pr: non-breaking`.
- The body says "Part of #14036" and has no closing keyword.
- pr-mapping → slang-fixer `sess-1794010689277-2rqq4g`.
- Issue comment 6699439326 was edited in place at 02:32:32Z to "fix in draft PR #14396, held pending review".

The PR is now with slang-reviewer.
- ⚠️ The bot's GitHub App cannot push `.github/workflows/` changes. The fixer therefore left the offline-nvcc CI step as a suggestion in the PR explanation comment, and a human has to add it.
- Next: the reviewer verdict, then [Fix Report] → [Triage Resolution].
- The ready-flip goes on the weekly list; it is not a per-PR ask.

