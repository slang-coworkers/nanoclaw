---
type: project
name: project_13969_generic_operator_eq_vector_mask
description: "#13969 generic operator==(Component<T>, Component<T>) yields all-false bool3 from vector<T,3> == — TRIAGED 11:58Z (regression, silent wrong code, high/P1, frontend). Approach A: delete the generic-vector equality decline at slang-check-expr.cpp:5046-5062 (#13008). slang-fixer claimed 11:58Z. Draft PR #13970 @ c7c481a14 (pr: breaking change) 13:04Z; R1 APPROVE_WITH_NITS 13:37Z (0 bugs); nits applied, Fix Report 14:17Z @ c3385da13. PARKED on human un-draft + maintainer review (jhelferty-nv) + 2 maintainer decisions; follow-up #13971 filed 14:22Z for explicit operator==(a,b), owned by this chain (no separate dispatch); timer recheck-13970-maintainer-94f5 10-31 14:00Z. Possible breaking-change label is a maintainer decision."
---

# #13969 — generic `operator==` returns wrong `bool3`

**10-28 11:33Z `issue_opened`** (author jtytgat, external). Main webhook session `sess-1793187212186-dbwe49`.
Live read: open, 0 comments, no labels, unassigned, never edited. No PR names #13969.

**Report (not verified by us):** inside `__generic<T : __BuiltinFloatingPointType> ComponentMask operator==(Component<T>, Component<T>)`,
`result.data = a.data == b.data` (`vector<T,3>`) gives `0 0 0` instead of `0 1 0`; the non-generic
`Component<float>` overload is correct. Reproduces on slang-playground and 2026.17-25-gc7954ebd1 (VulkanSDK 1.4.363.0).
Suspect: generic overload resolution of `==` on `vector<T,N>` inside a user `operator==` (possible self-recursion / wrong builtin pick).

**11:35Z** dispatched to slang-triager on `gh-issue-shader-slang/slang-13969`.

**11:39Z triager interim (their finding, unverified):** reproduced at codegen level on TOT a30c9d491. In the generic body,
`a.data == b.data` binds a scalar-`bool` `==` and emits `(vector<bool,3>)all(a == b)`, which is then splatted to bool3.
Suspected cause: the equality decline in `convertToBuiltinArithmeticOp` (slang-check-expr.cpp:5062) for generic element types.
CPU/VK repro and a release bisect are in progress; [Triage] to follow.

**11:58Z [Triage] (triager's findings; memo `/workspace/inbox/a2a-1793188697085-wxo5r8/triage-13969.md`):** bug, regression,
silent wrong code, high, frontend, P1. Fails on cpu, vk, and cuda. In generic `T : __BuiltinFloatingPointType`/`__BuiltinIntegerType`,
`vector<T,N> == vector<T,N>` binds core's `bool operator==<T:IComparable>` (core.meta.slang:3650). The rank-10 component-wise
overload loses because conversion cost is compared before OverloadRank. `!=` has the same bug; `<`/`>=` are fine through the #13008 fast path.
Bisect: v2023.4.9 good. v2023.4.10–5.1 crash or hang; v2023.5.2–v2026.20 give the wrong result. Origin: #3317 (`vector : IFloat`).
**Approach A** (recommended): delete the decline at slang-check-expr.cpp:5046-5062, and update 3 tests to `all(...)`. B (ranking) has a wide
blast radius; C (#12720/#6966 redesign) is out of scope. Judgment call: generic code that relies on a scalar bool from `vec==vec` will get E30019,
which is flagged on GitHub for a maintainer to decide on the breaking-change label.
Verified live 11:59Z: triage comment 6468368732 (nv-slang-bot 11:57:45Z); labels `regression` + `reproduced`; type Bug.
One slang-fixer session (`sess-1793188613462-bmd8so`) is on the canonical thread.
**11:58Z slang-fixer claimed:** worktree wt-slang-13969 @ a30c9d491, Debug build running (ETA about 20 min).

**13:04Z draft PR #13970** (`fix/issue-13969`, head c7c481a14, "Compare generic-element vectors per component in the builtin operator fast path", label `pr: breaking change`).
Fixer's claim: the repro passes on cpu, vk, and cuda; the full suite has 3 fp8 CUDA failures, the same ones master fails. Verified live: the PR is a draft, pr-mapping → fixer `sess-1793188613462-bmd8so`,
and a slang-reviewer session (`sess-1793192670243-zcr2zy`) is on the canonical thread. Next: reviewer verdict, then the fixer's [Fix Report].
**13:05Z fixer addendum (their account):** (1) The `pr: breaking change` label is there because generic `vec == vec` used as a `bool` now gives E30019, as concrete code does. Maintainers may switch it to non-breaking, since this restores the ≤v2023.4.9 behaviour.
(2) **Residual, not fixed:** an explicit `operator==(a, b)` call on generic vectors still returns a scalar `bool`. Fixing it needs Approach B (overload ranking). The fixer asked the reviewer whether this blocks; if it does not, it is a candidate follow-up issue.
(3) The fixer deleted the gh-12458 decline test, because it asserted the bug, and moved its cases into the new repro. Watch the review for this.

**13:37Z R1 APPROVE_WITH_NITS** (reviewer's findings; file `/workspace/inbox/a2a-1793194641696-ukc3nj/combined-review-13970-r1.md`, diff_hash dcd4f190…):
0 bugs. The one-line compiler change is correct and the root cause holds. Requested, all as tests and disclosure with no second round: (1) tests that tell the old `all` result from the new
per-component result (the moved `all`/`any` cases cannot), (2) a full breaking-change Risk line (E30019, plus `?:` and `any`/`all` now select per component),
(3) a contract comment at the fast path saying it must not decline this shape (slang-check-impl.h:4495 still calls it "for performance"). Residual explicit `operator==(a,b)`:
**not blocking**, provided (3) lands and a follow-up issue tracks it; the explanation comment must ask maintainers whether they want Approach B. The reviewer agrees with `pr: breaking change`.
The fixer received it (fixer seq 16). Next: the fixer's [Fix Report] and the follow-up issue number.
**13:38Z reviewer close-out:** no new full-suite failures on the L40S; static unit test 61/0. The Risk note also has to mention E30055 in `[Differentiable]` code and that a user's generic vector `operator==` is now bypassed.
Nothing posted to GitHub (no post marker). **Two maintainer decisions are pending, both in the PR:** keep `pr: breaking change` or not, and whether a fast-path fix is acceptable or Approach B (overload ranking) is wanted. The chain parks on these once the fixer's nits land and the PR is un-drafted.

**14:17Z [Fix Report] (fixer's account):** head c3385da13, 8 files, +352/−167. The compiler change is slang-check-expr.cpp +5/−17: the decline is deleted and a contract comment cites #12720.
The repro fails on master and passes at head (cpu/vk/cuda/HLSL). With master's compiler, all 6 new or changed rows fail. Full suite 11226/11229 at 4e6971cb8; the 3 fp8 CUDA failures also fail on master. All 4 nits applied, no R2.
Verified live 14:2xZ: the PR is a draft at c3385da13, label `pr: breaking change`, review requested from jhelferty-nv. The explanation comment was updated at 14:09Z for head c3385da. CI: 53 SKIPPED / 4 SUCCESS (draft gate).
**PARKED** on human un-draft (operator/human-only), maintainer review, and the 2 decisions (label; fast path vs Approach B). Operator told on orchestrator-dashboard 14:2xZ.
The fixer believed a follow-up issue needed operator approval. That is the retired over-gating framing: a verified issue is a free GitHub write.
Main dispatched slang-triager to dedup the explicit `operator==(a,b)` residual against #12720/#6966 and then either file it or comment on #12720; the fixer cites it in the PR description.
Timer: one-shot `recheck-13970-maintainer-94f5` 10-31 14:00Z.

**14:22Z follow-up filed: #13971** (Bug, `reproduced`, no `regression` label because there is no known-good baseline). The triager's findings: explicit `operator==`/`!=`/`<` on generic vectors pick the IComparable candidate,
since `CompareOverloadCandidates` compares witness cost before `OverloadRank`. The issue is not a dup of #12720/#6966/#13008 and lists 3 directions for maintainers. The fixer was told to cite it in the #13970 description.

**14:21Z `issue_opened` #13971** (author nv-slang-bot[bot]; its own Main webhook session). Ownership ladder hit at rung 0/7: this chain's triager filed it on Main's order, and the fixer got the cite instruction at 14:22:02Z (fixer seq 22). PR #13970 body did not cite it yet at 14:23Z, which is expected in-flight. Dispatched nothing, posted nothing. The parent timer `recheck-13970-maintainer-94f5` (10-31 14:00Z) was updated to name #13971, to check the PR body cites it (chase the fixer if not), and to read #13971 comments as live inbound for the Approach B decision. No separate timer for #13971.
**17:07Z maintainer on #13971:** jkwak-work assigned it to tangent-vector at 17:06:58Z and commented "This is a known limitation and problem. We need to find the best way to transition." (cmt 6475498478). The comment did not mention the bot, so this is a hold: nothing dispatched and nothing posted. #13971 is now a design item that maintainers hold. The #13970 body cites #13971 (confirmed 17:07Z). The re-check task no longer re-asks the Approach B residual question. #13970 still waits on the un-draft, a review from jhelferty-nv, and the breaking-change label decision.
**17:22Z jkwak-work on #13971:** "It seems that this issue is dup to the following user filed issue: #13969" (cmt 6475827437, no bot mention). #13969 is now assigned to tangent-vector as well. Hold: nothing dispatched or posted. Possible gap, told to the operator only: #13970's body says it fixes #13969, so merging it closes #13969 while the explicit `operator==(a,b)` part stays broken. If #13971 is then closed as a duplicate, nothing open tracks that part. The re-check task now checks for this.

**10-28 17:06–17:41Z maintainers weigh in on dedup (verified live):** on #13971, jkwak-work assigned it to tangent-vector (17:06Z), then commented
"This is a known limitation and problem. We need to find the best way to transition." (17:07Z) and "It seems that this issue is dup to the following user filed issue: #13969" (17:22Z).
Main's #13971 webhook session `sess-1793197300872-msjew9` did not dispatch either comment, because neither mentions the bot. On #13969, tangent-vector (MEMBER) wrote at 17:41Z: "This seems to be a duplicate of #13971. We should collapse these into a single issue that covers the reproducers from both."
The two maintainers name **opposite survivors**. PR #13970 still says `Fixes #13969` and cites #13971 for the explicit-call residual, so after a merge a "Fixes" on the surviving issue would auto-close it while the explicit-call path is still broken.
17:4xZ Main forwarded all three comments verbatim to slang-triager on the canonical thread. The triager is to ask which issue survives and offer to fold the reproducers; it must not close anything (maintainer-only) and must not touch the PR.
**17:45Z triager dedup reply** on #13969 (comment 6476336314): it asks tangent-vector which issue survives, offers to fold both reproducers into it, and states that `Fixes` on PR #13970 would close the merged issue while the explicit-call path is still broken. It lists "Part of" or extending #13970 as the options.
Nothing closed, PR untouched. Both issues are now assigned to tangent-vector. **PARKED** on the maintainer's choice of survivor and #13970 scope, plus the operator un-draft, which I suggested holding (dashboard 17:4xZ). The timer recheck-13970-maintainer-94f5 10-31 covers it.
**17:48Z jhelferty-nv closed #13971** with the comment "Closing this one as a duplicate of #13969" (cmt 6476406084, state_reason completed, no bot mention). jhelferty-nv is also the requested reviewer on #13970. This answers the triager's 17:45Z question about which issue survives: **#13969 survives**. The #13970 scope question ("Part of" or extend) is **still open**, and #13970 still says `Fixes #13969` with a Risk line that points to the closed #13971. Main's #13971 webhook session (`msjew9`) relayed the close verbatim to slang-triager on the canonical thread at 17:5xZ. It ran the "Maintainer named the survivor" row of the re-check task: fold the reproducers into #13969 and tell slang-fixer. Main posted nothing itself and left `Fixes` as it is.
**17:53Z triager [Report] (verified):** the triager edited its 17:45Z comment on #13969 (cmt 6476336314) in place at 17:52:05Z, adding #13971's explicit-call test as "Reproducer 2". The comment keeps the PR-scope question open. The fixer got the repoint instruction at 17:52:21Z (fixer seq 24). At 17:53Z the body still pointed at #13971, so the edit was still in progress. `Fixes #13969` and the code stay unchanged until the maintainer decides the scope. The triager armed its own one-shot re-check `t-e33a5c` for 10-30 15:00Z on the scope question. Main's `recheck-13970-maintainer-94f5` runs 10-31, so on 10-31 read the triager's result first, before chasing. **PARKED** on the maintainer's #13970 scope decision ("Part of" or extend), the un-draft, and the review.
