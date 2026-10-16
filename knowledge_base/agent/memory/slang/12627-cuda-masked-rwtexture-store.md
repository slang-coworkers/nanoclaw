---
type: chain
title: slang#12627 — CUDA/PTX component-masked RWTexture2D store emits a subscript on CUsurfObject
description: Fix is in draft PR #13363 (surface read-modify-write + warning, now E56020-E56022). It was reconciled with #13563 at 6f4e01b249 on 10-15, then made dirty again by #13537. Held on jkwak-work's answer to the CUDA coherency question. Follow-ups #13361/#13362/#13364/#13365.
tags: [slang, cuda, ptx, rwtexture, legalize-image-subscript, held, awaiting-maintainer]
---

# slang#12627 — CUDA masked RWTexture store (draft PR #13363, held on jkwak-work)

Assignee and PR shepherd: jkwak-work. Fixer session `sess-1787171888548-4gv6cq` (thread `gh-issue-shader-slang/slang-12627`).
Reviewer session `sess-1790828246458-ehy88h`. My origin session is `sess-1787170935547-1z63sa`.

## State (checked live 2026-10-15 08:05Z; still no human reply on #12627/#13363 since 10-01)

- **2026-10-15 update:** #13563 merged at 02:16Z (`788be3144e`). On the dashboard Main's 02:12Z go-ahead, the fixer reconciled #13363
  (merge `0baf65e696` + reconcile `6f4e01b249`, pushed 02:33Z, no force-push). #13116 had taken E56006–E56019, so this PR's codes are now
  **E56020/E56021/E56022**. Tests passed locally and codex CODE_REVIEW approved. The explanation comment and description were refreshed.
  CI run 38671344314 stopped at `wait-for-human-priority`: bot CI yielded to human/merge CI (throttling, not a code failure).
  **Then #13537 (`a5a87a1236`, merged 05:48Z by kaizhangNV) made #13363 `dirty` again.** It changed the `_findImageFormatDecoration` sites in
  `slang-intrinsic-expand.cpp` to `_tryGetImageFormat` (the texture type is the source of truth and `[format]` is the fallback). My inference,
  not built: #13363's `getCUDASurfaceAccessInfo` would miss typed-format textures such as `RWTexture2D<RGBA8Unorm>`. The fixer is holding at
  `6f4e01b249` (its row 75, mirrored to the dashboard as msg 502188, 08:07Z) and recorded the plan in its `memory/fix-12627.md`.
  Its next reconcile waits on the operator's go. The ci-babysitter flagged #13363 `gate-wedged` (a yield-noop `check-ci` on a draft, a known phantom).

- **PR [#13363](https://github.com/shader-slang/slang/pull/13363):** draft, `fix/issue-12627`, head `6f4e01b249` since 10-15 (previously `b79ae81e23`,
  which had merged master `6ba151dcfc`, no force-push), 22 files +913/−155, no human reviews. On 10-09 it showed `BEHIND` master, which is
  fine for a draft. The only event since 10-01 is jkwak-work removing the `Dev Opened` label on 10-08 01:17Z, part of a
  bulk label sweep (same minute as #13324). It isn't an answer. CI on the draft: 4 pass / 1 pending /
  56 skipping (gated CI doesn't run on drafts). `license/cla` is pending: bot-identity problem, not a required check.
- **Peer review is done: both rounds used.** R1 REQUEST_CHANGES with 0 bugs, fixed at `899bbbe624`. R2 REQUEST_CHANGES with
  0 bugs (2 gaps, 2 nits), fixed at `b79ae81e23`. The `[Fix Report]` arrived 10-04 03:22Z. Caveats: both Reviewer A runs were
  budget-capped and incomplete, and Devin timed out; the coordinator verified A's findings by hand. G4 (duplicate warning per
  specialization) was declined, with the reason in the PR. Clarity items C007 and FG001 are deferred.
- **New diagnostics:** E56006 warning (CUDA-only, provisional), E56007 (conversion unavailable) and E56008 (unspelled shape)
  errors. Both errors cover cases that already failed in nvrtc, so they don't break working code.
- **Open with jkwak-work, unanswered since 10-01 03:10Z.** One reply settles both:
  [coherency Q](https://github.com/shader-slang/slang/issues/12627#issuecomment-5923952063): (a) keep the RMW with a warning,
  or (b) make it a compile-time error on CUDA. The warning-scope question
  ([5923147529](https://github.com/shader-slang/slang/issues/12627#issuecomment-5923147529)) asks CUDA-only or all RMW targets.
  Secondary: [5925676317](https://github.com/shader-slang/slang/issues/12627#issuecomment-5925676317) asks whether to fold #13364 in.
- **Re-chase:** `rechase-12627-13537-conf-14f1` (2026-10-18 08:00Z). Operator asks were sent 10-07, 10-09, 10-12 and 10-15 02:1xZ; none
  answered. The 02:1xZ reconcile half went ahead on the dashboard Main's own go-ahead. The **5th ask (10-15 08:1xZ)**: may the fixer (1) merge
  master again for #13537 and (2) post one comment on #12627 that reports the update and re-asks (a)/(b) and the scope question? I don't post it myself.
- **Interacts with #13563 (new 10-10).** minco3 filed #13554: a formatted `RWTexture2DArray` store is silently dropped on CUDA.
  Bot draft PR [#13563](https://github.com/shader-slang/slang/pull/13563) (`e2eaf72e2a`, assigned jkwak-work) implements the
  layered `_convert` writes with inline `sust.p.a1d`/`a2d`. That makes #13363's write rule `isConversionAvailable = !isLayered`
  (E56007 on a layered converting write) stale. The two PRs share **no files**, so the clash is semantic, not textual.
  **2026-10-15:** jkwak-work readied #13563 (10-14 15:35Z), approved it (review 5520520698, asking about `a1d` compatibility,
  which the bot answered: CUDA 11.7–13.4, sm_50–120 OK, GPU CI passed) and queued it at 10-15 01:07Z (pos 1, `AWAITING_CHECKS`),
  so #13363 is the one that reconciles. At 02:10Z I told the fixer (pinned send, its row 65 acked at 02:06Z) to do a read-only
  impact check, with no push, master merge or post until #13563 merges and I confirm. **Fixer's answer (row 67, 02:11Z):**
  #13554's `t[i] = v` lowers via the `set` accessor and never reaches `isConversionAvailable`, so it isn't broken (inferred
  from code, not re-run). What goes stale is swizzle-spelled whole-texel layered converting writes (`a2[i].xyzw = v`), which
  would raise a false E56007. The planned reconcile is ~1 commit and 4 files: writes become `isConversionAvailable = true`, the
  E56007 text says "no converting read for arrays", one test moves out of UNSUPPORTED, and a positive
  `surf2DLayeredwrite_convert` CHECK is added. Done as a `git merge origin/master`. `image-swizzle-write.slang` is NOT affected
  (that was my mistake). I corrected it to the operator in dashboard msg 145.

## Follow-ups (bot-filed, not dispatched, `doNotNudge` in supervisor-state.json)

On 2026-10-05, maintainers triaged all four (re-checked 10-09, 10-12 and 10-15 08:05Z: no comments, unchanged): they assigned owners and set milestones. A follow-up that a human now owns is not
dispatched unless that assignee or the operator asks.

- #13361 WGSL, same root cause. Owned by jkwak-work, Q4 2026.
- #13362 `+=`/`++`/`inout` on a texel. jhelferty-nv assigned it to **jvepsalainen-nv** (no milestone).
- #13364 unify the CUDA surface spellings. jkwak-work self-assigned, Q1 2027. Waits for #13363 to merge.
- #13365 C++/CPU `*(tex[coord]).w` compile failure. jkwak-work self-assigned, Q4 2026.

## Lessons

- **Reconciling with one sibling merge doesn't keep a draft clean.** Within 3h of the #13563 reconcile, #13537 touched the same
  helpers. When a draft parks for weeks, a re-chase should check `mergeable_state` and diff overlap against new master commits,
  not just the one PR it was told to watch.

- **"Round N started, ETA 30–40 min" followed by silence is a stall, not progress.** A reviewer session that restarts
  mid-run loses the merge step, and nothing re-fires it. A re-chase should check that the reviewer actually sent its
  verdict, not just that GitHub is unchanged.
- From a task session, `send_message` with `target_session_id` + canonical `thread_id` (with no `in_reply_to`, since the
  task session has no inbound) landed in the pinned fixer session on the first try (row 52, 2026-10-04 02:12Z).
