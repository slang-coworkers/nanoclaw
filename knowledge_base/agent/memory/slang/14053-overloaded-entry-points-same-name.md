---
type: chain
title: slang#14053 — overloaded same-name `[shader("compute")]` entry points emit invalid CUDA/Metal/SPIR-V with no diagnostic
description: Human-filed (albertrodriguezclo) bug 2026-10-29 21:51:27Z, cloth-sim batch. Triaged bug/medium/P2, reproduced, fixer-ready (approach C, link-time target-aware name check). Fixer HELD until R6 (#14033 precedent); triager one-shot i14053-r6-post-b43c 2026-11-02 22:00Z posts + hands off.
tags: [entry-points, diagnostics, cuda, metal, spirv, bug, r6]
---

# slang#14053 — overloaded entry points with the same name

**Ask.** Two `[shader("compute")]` overloads of `Count` (different params) compile with exit 0 on
cuda/metal/spirv (reporter: master 43ac12323). Each target's output is invalid: duplicate `extern "C"`
kernels (nvcc), duplicate mangled name (metal), two `OpEntryPoint ... "Count"` (spirv-val).
Reporter wants a front-end diagnostic (or deterministic renaming that reflection reports).
**Secondary ask:** a default value on an entry-point param (`uniform int* flag = nullptr`) is silently
dropped; they want a warning. This is a separate concern and may warrant a split (maintainer call).

**GitHub state (10-29 21:5xZ).** 0 comments, no labels, no assignee. No `bot-ok`, no crash word → **R6
applies: no bot comment before 2026-11-02 21:51:27Z.** Not a follow-up of any existing chain
(`grep 14053 memory/` had no hits; the only session on the thread was my own webhook session).

**Triage (slang-triager, 10-29 22:14Z; memo `/workspace/inbox/a2a-1793312045725-4wby3h/triage-14053.md`).
These are the triager's findings; I verified only the GitHub state.** Reproduced on v2026.20-77 (L40S). Not a regression
(2026.13.1 behaves the same). The bug is wider than overloads: `A::K`/`B::K` in two namespaces collide too, and DXIL/WGSL
collide as well. Nothing checks uniqueness (discovery slang-module.cpp:337, lowering slang-lower-to-ir.cpp:15328).
`-entry Count` with overloads gives a misleading E38000 (`findFunctionDeclByName` drops the `OverloadedExpr`,
slang-check-shader.cpp:933). A vs+fs `Main` overload is valid SPIR-V, so the rule must be target-aware.
Options: A front-end error (breaks API users compiling one overload); B rename (no, #13264); **C (rec.)**
a link-time error in `checkEntryPointDecorations` (slang-ir-entry-point-decorations.cpp:25): SPIR-V = name + execution model,
other targets = name. Plus an `-entry` ambiguity error. Related: #13882 (tangent-vector's entry-point identity redesign),
#12392/#12721, #7473, #13264. Default-value warning: independent; split is a maintainer call, nothing filed.

**GitHub (verified by Main 10-29 22:1xZ).** Type=Bug, label `reproduced`, 0 comments, no assignee.
The reporter has ≥10 open self-PRs (#13930–#14022).

**Main decision (10-29 22:1xZ): hold the fixer until R6 elapses (#14033 precedent).** Reason: the reporter often self-PRs, and a
bot PR would cross-reference the issue during the hold. The triager's one-shot **i14053-r6-post-b43c (2026-11-02 22:00Z)**
does three things. (1) If a reporter or human PR exists, it stands down and reports. (2) If a maintainer replied, it posts a
delta and follows their direction. (3) Otherwise it posts the 5-bullet (C recommended, A/B noted, default-value split offered)
and sends the [Triage handoff] for C to slang-fixer; the PR must cite #13882. Triager confirmed 22:16Z that the order is in the task prompt verbatim (check order 4→1→2→3). Owner: slang-triager, thread `gh-issue-shader-slang/slang-14053`. Next touch: the one-shot report on 11-02 at 22:00Z.

## 11-02 22:06Z: re-check fired; comment posted, Approach C handed to slang-fixer

- These are the triager's checks: no newcomer label, no PR referencing #14053, no comments. jkwak-work was assigned by jhelferty-nv at 18:39:46Z.
  That is a shepherd assignment, and under the sibling Main rule (recorded in [14055](14055-parser-multiply-deref-pointer.md), 11-02 ~21:5xZ) it is not a stand-down.
- Verified by Main: bot comment [6589648302](https://github.com/shader-slang/slang/issues/14053#issuecomment-6589648302)
  (22:05:56Z, the only comment, no @-mentions). It offers the draft PR ("the assignee may take it over or close it") and the default-value split for maintainers.
  slang-fixer session `sess-1793657193763-f9uw61` is on the canonical thread (created 22:06Z).
- **Overlap:** reporter PR #14147 (fixes #14137, not this issue) restructures `findFunctionDeclByName`: E38000 moves to
  `findAndValidateEntryPoint` and the lookup runs on a temp sink. Our `-entry` ambiguity error touches the same hunks.
  The fixer bases on master and notes the overlap; whichever merges second rebases.
- **Default-value warning:** NOT filed. It is a reporter scope/diagnostic ask, not a verified bug, so the 10-31 filing rule's
  "ask" branch applies. The comment leaves it to maintainers; file only on maintainer request.
- Next: the fixer's draft PR → triager [Triage Resolution].

## 11-03 01:29Z: draft PR #14221

Bot DRAFT PR #14221 "Report entry points that share a name in one output, and ambiguous -entry names". Head `fix/issue-14053` @5c7e82507, label `pr: non-breaking`.
The pr-mapping goes to fixer `sess-1793657193763-f9uw61` (verified). The fixer reports 8 new tests and a full suite run on Debug; I have not re-run them.
The [Fix Review Request] went to slang-reviewer, and the fixer sends its [Fix Report] after the review. Un-draft needs operator sign-off (as with the other bot drafts).

## 11-03 03:2xZ: review round 1, and the default-value ask is reversed to "file"

- These are the fixer's figures. Round 1 was REQUEST_CHANGES: a false E38016 on HostVM and 4 test gaps. The fix is applied; head 76f7f27. Tests: 30/30 PR, 3366/3366 subset, 663/663 unit. Round 2 review is pending.
- **Reversal.** `Fixes #14053` would close the issue and leave the default-value ask untracked. The fixer saw this, but its 03:16Z relay to the triager
  was addressed to the CLOSED task session `sess-1793312005412-mnoqvo` (`i14053-r6-post-b43c`) and never reached a live triager session.
  Main now authorizes filing under the 10-31 rule: reproduced, deduped, a silent no-op of the same class as #14053.
  Sent to triager thread session `sess-1793310892824-ykqeww` (msg 63, in_reply_to=16): file it "Split from #14053", edit comment 6589648302 in place, report the #. No fixer.
  Sent to fixer (msg 61): once the # exists, add a "tracked separately in #N" line to the #14221 description.
- ⚠️ Lesson: a peer reply that is threaded to a one-shot task's session dies with that session. Re-dispatch it to the canonical thread session.

## 11-03 03:30Z: side-ask filed as #14228 (filed-only, no fixer)

- Bot-filed #14228, "A default value on an entry-point parameter is accepted with no diagnostic, but the generated kernel ignores it".
  It was filed 03:29:22Z with `reproduced`. I verified it says "Split from #14053" and has no @-mentions.
  Comment 6589648302 was edited at 03:29:42Z and now says "tracked in #14228" (verified).
- **The #14228 `issue_opened` webhook belongs to THIS chain; do not dispatch it.**
- No fixer; it stays filed-only. It is low severity, and it has a design question: `getDefaultValueBlob` does report the default, so a host could apply it.
  Warn or document is the maintainers' call. Dedupe neighbours: #11106 (closed), #12356 (default-value reflection getters).
- The fixer has been sent #14228 so it can add the "tracked separately" line to the #14221 description.
- 03:31Z: the #14228 `issue_opened` webhook arrived; not dispatched (as planned). Verified: OPEN, `reproduced`, 0 comments, no assignee.
  The fixer got the #14228 note at 03:30:31Z (seq 26); the #14221 description has no #14228 line yet. Check it at the next touch.

## 11-03 04:2xZ: review round 2, and two side finds sent to the triager

- These are the fixer's figures. Round 2 was REQUEST_CHANGES (small): a false E38016 for non-compute LLVM entry points, plus test lanes. The fix is applied; head ea91ceb (no force push). 34/34 PR tests, 3386/3386 subset. Round 3 (the last) is pending with slang-reviewer.
  The #14221 description carries "tracked separately in #14228" (verified).
- Side finds were sent to triager `ykqeww` (msg 75): file if reproduced on master and deduped, no fixer.
  **S1:** C-like `_generateUniqueName` does not reserve verbatim entry-point names (`helper` + entry `helper_0` → two `void helper_0(` on cuda; `main`/`main_0`; related #13264).
  **S2:** `[shader]`/`[numthreads]` on a prototype are not merged into the definition, silently (`LocalSize 1 1 1`).
  Their issue_opened webhooks will belong to this chain.

## 11-03 04:32Z: side finds filed as #14229 and #14230 (filed-only)

- **#14229 (S1):** generated `<name>_<N>` collides with a verbatim entry-point name. Two functions with one name on CUDA, HLSL, WGSL and Metal; `main` + `main_0` also collide on C++.
  Cause, per the triager: slang-emit-c-like.cpp writes entry names verbatim (:1145), and `_generateUniqueName` (:1151) never reserves them. Related: #13264.
- **#14230 (S2):** `[numthreads]`/`[ForceInline]` on a prototype have no effect. Reflection reports `[4,1,1]` but SPIR-V has `LocalSize 1 1 1`; DXC honours the prototype.
  `[numthreads]` on the prototype plus `[shader]` on the definition makes reflection list two `F`s. Close neighbours: #12515, #14200.
- Verified by Main: both are bot-filed, labelled `reproduced`, say "Found while working on #14221", and have no @-mentions.
- **Fan-out (Main 11-03): none, both filed-only.** #14230 has a merge-vs-diagnose design question for maintainers.
  #14229 is the follow-up candidate for slang-fixer once #14221 leaves review, so its edits don't run concurrently with the same chain's fixer.
  Their issue_opened webhooks belong to this chain.
- 11-03 (Main): the #14229 `issue_opened` webhook arrived; not dispatched, as planned. Verified: OPEN, `reproduced`, 0 comments, no assignee.
  The #14230 webhook is still due and gets the same treatment.
- 11-03: the #14230 `issue_opened` webhook arrived; not dispatched (as planned). Verified: OPEN, `reproduced`, 0 comments, no assignee, created 04:31:25Z.

## 11-03 06:23Z: Fix Report; PARKED on operator un-draft sign-off

- These are the fixer's figures. 17 files, +802/−99, 11 commits on 7f506f4c9.
  - The link-time check `checkEntryPointNamesAreUnique` adds **E38016**: SPIR-V checks per execution model, CUDA includes the OptiX prefix; GLSL, the Slang VM, non-compute LLVM and a renamed `main` are exempt.
  - `findFunctionDeclsByName` adds **E38017**, `-entry` ambiguity with candidate notes. An overloaded `[patchconstantfunc]` gives E39999.
  - Tests: 9 new tests, 38/38 lanes. Diagnostics 1050/1050; subset 3386/3386. The reviewer's full suite: 11225/11228, and the 3 failures (fp8-cuda) also fail on master on this L40S.
  - Review: R1/R2 REQUEST_CHANGES, both fixed. R3 APPROVE_WITH_NITS, nits applied.
- Verified by Main: PR #14221 is a DRAFT, head e8677fd84, mergeState BEHIND by 1 (#14150, no conflict).
  CI run 41589002700 is held at `wait-for-human-priority`. The fixer's explanation comment is 6592904573.
- **Main decision:** park on operator un-draft sign-off (a human clicks Ready; fixers can't).
  #14229 waits until #14221 **merges**, because it builds on the `main`-rename rule that #14221 shares with the emitters.
  The operator was asked on orchestrator-dashboard 11-03 ~06:3xZ.
- **Timer:** one-shot `rechase-slang-14053-r1-2e4f` 2026-11-05 16:30Z (decision table in its prompt; cap 3 re-chases).
