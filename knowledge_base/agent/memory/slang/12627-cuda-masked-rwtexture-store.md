---
type: chain
title: slang#12627 — CUDA/PTX component-masked RWTexture2D store emits a subscript on CUsurfObject
description: Fix is in draft PR #13363 (surface read-modify-write + warning, codes E56020-E56022), head 6c110229f7 since 10-21. PARKED on jkwak-work's (a)/(b) + warning-scope answer (re-asked 10-21 in issuecomment-6311568042); no more scheduled re-chases, the supervisor tick watches it. Follow-ups #13361/#13362/#13364/#13365.
tags: [slang, cuda, ptx, rwtexture, legalize-image-subscript, parked, awaiting-maintainer]
---

# slang#12627 — CUDA masked RWTexture store (draft PR #13363, parked on jkwak-work)

Assignee and PR shepherd: jkwak-work. Fixer session `sess-1787171888548-4gv6cq` (thread `gh-issue-shader-slang/slang-12627`).
Reviewer session `sess-1790828246458-ehy88h`. My origin session is `sess-1787170935547-1z63sa`.

## 2026-10-24 re-chase (`rechase-12627-post-merge-a776`): verified, PARKED on jkwak-work

Checked live 08:0xZ. #13363 head `6c110229f7` (parent `cebafb34a5`, a two-parent merge of `6f4e01b249` + master `25fc396601`): a fast-forward, no force-push. Still a draft, MERGEABLE/BEHIND (ahead 12, behind 34), 0 reviews. The #12627 comment [6311568042](https://github.com/shader-slang/slang/issues/12627#issuecomment-6311568042) matches the brief: it reports the update and the L40S results, says the vk test never ran on a GPU and only its check changed, re-asks (a)/(b) and the warning scope, and has no @-mention. Fixer rows 81 and 85 are its last; it waits on the webhook. No human comment on #12627, #13363 or #13361/#13362/#13364/#13365 since 10-21 08:00Z, and no operator note on the dashboard (rows 506566–507812). **Parked on jkwak-work only.** I don't re-ping them on GitHub before 10-28 08:28Z. No more re-chases are scheduled: I recorded the parked disposition in `supervisor-state.json` and replaced tick 302's stale "slang-12627 undraft/reconcile 13363" operator decision. `gh pr ready` waits for jkwak-work's answer, and it is operator-gated then.

## 2026-10-21 re-chase (`rechase-12627-plain-merg-44de`): hold lifted, no operator gate

The operator never answered the 6th ask (dashboard rows 505798–506566). **The ask was over-gating.** A plain merge pushed to our own `fix/issue-12627` and a verified comment are not gated; only `gh pr ready`, `gh pr merge`, and closing issues or other people's PRs are ([feedback leaf](../imported/feedback_github_writes_operator_authorized.md); dashboard msg 506145, 10-20). The 10-20 sweep that withdrew five asks of this kind missed this one. Checked live at 08:0xZ: #13363 @`6f4e01b249`, ahead 10 / behind 35, no human activity anywhere. #13537 hasn't re-landed, and #13717 is still open with no shared files. `git merge-tree` is clean (tree `7ee6e7d56b`). 5 files overlap and auto-merge: `hlsl.meta.slang`, `slang-diagnostics.lua`, `slang-emit-c-like.{cpp,h}`, `slang-emit.cpp`. E56020–E56022 are unique; master's highest code is 56109. I sent the fixer a pinned go (my msg id 19): merge with no force-push, rebuild, L40S tests, push, refresh the explanation, no CI dispatch, no `gh pr ready`. Then one #12627 comment through OUTPUT_REVIEW that re-asks (a)/(b) and the scope question, with no @-mention. **Fixer row 79 (08:09Z):** merged locally as `cebafb34a5`, clean, build running, and it pushes only after the tests pass.

## 2026-10-18 re-chase (`rechase-12627-13537-conf-14f1`)

Checked live 08:0xZ. The operator hasn't answered the 10-15 ask (dashboard rows 502186–505796). No human activity on #12627, #13363 or the follow-ups. #13363 @`6f4e01b249` is `MERGEABLE`/`BEHIND` (ahead 10, behind 14). Master has 0 `_tryGetImageFormat` hits, and #13537 hasn't re-landed. kaizhangNV's open #13717 (generic texture payload identity, `DIRTY`) shares no files with #13363. I told the fixer (pinned, its row 77 ack) to drop the `_tryGetImageFormat` reroute from its plan, and it updated `memory/fix-12627.md`. **6th operator ask** (dashboard 10-18 08:0xZ, narrowed): (1) a plain merge of master, rebuild, tests and push, with no #13537 API; (2) one #12627 comment that asks (a)/(b) and the scope question again.

## 2026-10-17 note (Main, verified live)

#13537 was fully reverted by #13712 (kaizhangNV, merged 2026-10-16 21:01:48Z, `8c81b8bdaf`). `_tryGetImageFormat` is gone from master; `slang-intrinsic-expand.cpp` is back to `_findImageFormatDecoration` (4 sites). #13363 @`6f4e01b249` is now `MERGEABLE`/`BEHIND` (diverged: ahead 10, behind 13). So operator ask (1) shrinks to a plain merge of master, with no reroute. The prompt of `rechase-12627-13537-conf-14f1` carries this context.

## State (checked live 2026-10-15 08:05Z, re-checked 10-18, 10-21 and 10-24 08:0xZ; no human reply on #12627/#13363 since 10-01. Hold lifted 10-21; PARKED on jkwak-work from 10-24, see above)

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
- **Re-chase:** none scheduled. Parked on jkwak-work since 10-24; the `/supervise-issues` tick watches it via `supervisor-state.json` (`disposition`, `noGitHubRepingBefore` 10-28 08:28Z). A jkwak-work reply arrives as a webhook to the fixer. Previous: `rechase-12627-post-merge-a776` (10-24, verified, parked), `rechase-12627-plain-merg-44de` (10-21, hold lifted), `rechase-12627-13537-conf-14f1` (10-18, 6th ask sent). Operator asks were sent 10-07, 10-09, 10-12 and 10-15 02:1xZ; none
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

- **2026-10-18 update:** #13537 was reverted on master (`8c81b8bdaf`, #13712, merged 10-16 21:01Z), and `_tryGetImageFormat` is
  gone from master. #13363 at `6f4e01b249` is no longer CONFLICTING; it is **MERGEABLE / BEHIND** (checked 10-18 08:0xZ). The
  fixer's planned `getCUDASurfaceAccessInfo` re-route is moot. The next reconcile is a plain `git merge origin/master`, still
  held on the operator's go (the decisions asked 10-15: reconcile + one combined #12627 comment re-asking (a)/(b)).

- **2026-10-21 update:** the hold was lifted by the 08:00Z re-chase (a plain merge to our own branch plus one verified comment is
  not operator-gated). The fixer merged master (`cebafb34a5`, clean, no #13537 API) and fixed this PR's own vk test check
  (`6c110229f7`). That test had never run on a GPU, and its `// BUF: 2` matched inside `uint32_t`. Pushed as a fast-forward:
  head **`6c110229f7`**, still a draft, MERGEABLE (verified). L40S: cuda 144/144, hlsl-intrinsic 670/670, compute 660/661 → 6/6
  after the check fix. One #12627 comment re-asks (a)/(b) and the warning scope:
  [6311568042](https://github.com/shader-slang/slang/issues/12627#issuecomment-6311568042) (bot, no @-mentions, 08:28Z).
  Waiting on jkwak-work.

## Follow-ups (bot-filed, not dispatched, `doNotNudge` in supervisor-state.json)

On 2026-10-05, maintainers triaged all four (re-checked 10-09, 10-12 and 10-15 08:05Z: no comments, unchanged): they assigned owners and set milestones. A follow-up that a human now owns is not
dispatched unless that assignee or the operator asks.

- #13361 WGSL, same root cause. Owned by jkwak-work, Q4 2026.
- #13362 `+=`/`++`/`inout` on a texel. jhelferty-nv assigned it to **jvepsalainen-nv** (no milestone).
- #13364 unify the CUDA surface spellings. jkwak-work self-assigned, Q1 2027. Waits for #13363 to merge.
- #13365 C++/CPU `*(tex[coord]).w` compile failure. jkwak-work self-assigned, Q4 2026.

## Lessons

- **When a gating belief is corrected, sweep every parked ask, and search for the chain-specific wording.** The 10-20 sweep withdrew five "close our draft / post a verified comment" asks, but #12627 was phrased as "may the fixer merge and post", so the sweep missed it. It stayed parked 3 more days. Parked asks that include "may X push/post" are the same class.

- **Reconciling with one sibling merge doesn't keep a draft clean.** Within 3h of the #13563 reconcile, #13537 touched the same
  helpers. When a draft parks for weeks, a re-chase should check `mergeable_state` and diff overlap against new master commits,
  not just the one PR it was told to watch.

- **"Round N started, ETA 30–40 min" followed by silence is a stall, not progress.** A reviewer session that restarts
  mid-run loses the merge step, and nothing re-fires it. A re-chase should check that the reviewer actually sent its
  verdict, not just that GitHub is unchanged.
- From a task session, `send_message` with `target_session_id` + canonical `thread_id` (with no `in_reply_to`, since the
  task session has no inbound) landed in the pinned fixer session on the first try (row 52, 2026-10-04 02:12Z).
