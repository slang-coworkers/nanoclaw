---
type: chain
title: slang#13409 — Metal groupshared load forwarded/moved across barrier; sibling #13412
description: canInstHaveSideEffectAtAddress exempts in-function roots from "call may write"; drafts #13421 (groupshared, Metal/CPU) + #13431 (pointer roots, #13412) both internally approved, awaiting CI release + human review
---

# slang#13409 (human-filed, girivs82, 2026-10-02) + sibling #13412

**Root (triager, I checked the source at master `00febe288c`):** in the `kIROp_Call` arm of `canInstHaveSideEffectAtAddress`,
the "callee may write anything" check is skipped whenever `isChildInstOf(getRootAddr(addr), func)`.
On Metal and CPU, `groupshared` becomes a function-local `var` with `AddressSpace::GroupShared`
(`introduceExplicitGlobalContext`). Because of that exemption, barriers and `[noinline]` calls are treated
as unable to touch it, so `tryRemoveRedundantLoad`, `processLoadUse` (simplifyForEmit) and DSE
miscompile the code. This has been broken since at least 2025.6.1.

## Decisions (mine)
- 10-02 ~19:05Z: GO on Approach A, through the triager. "No emitter change."
- 10-02 23:10Z: **scope widened to (b)**. One draft PR, two commits: (1) strict A, where any call, even a
  `[noSideEffect]` one, may read or write a GroupShared root; (2) a C-like emitter guard in `emitVar`+`emitStore`
  so a store is never folded into a `threadgroup` declaration, which MSL rejects. Why: A keeps the var alive in
  mesh/object shaders, and the fold would then turn a wrong value into a compile error.
- The fold already happens on master. **I verified it at `6ba151dcfc`:** `s = tid.x; barrier; InterlockedAdd(s,1,old);` with
  no other globals emits `threadgroup uint s_0 = tid_0.x;`. Adding a buffer global, or dropping the atomic, makes it
  disappear: my 4 shapes plus a buffer-carrying atomic shape all came out bare. ⇒ A repro claim that depends on the
  shape needs that exact shape run before anyone disputes it.
- MSL evidence: the spec has no sentence stating the rule. Cite SPIRV-Cross `spirv_msl.cpp:3868` instead, and
  have the fixer add a `-target metallib` test.

## PR #13421 (draft, opened 10-03, head `6ad57af497`, 2 commits as decided)
Both commits are authored by **User `286953280`** (the unsigned-CLA identity), so `license/cla` is pending. Not a merge block on slang.
The triager asked for a re-author force-push. **I did not authorize it** (history rewrite, not durably
authorized), and on 10-03 05:35Z bundled it with the operator's still-unanswered CLA decision from 10-02.
Signing the CLA (a) makes the push unnecessary. Re-chase `rechase-cla-bot-identity-4012`. New commits on the branch
use the App identity.

## Sibling #13412 (bot-filed by triager 10-02 19:20Z, `reproduced`)
Pointer roots (loaded/computed/param) get the same exemption, on **all targets incl. direct SPIR-V**.
Finding 3 (a `RWStructuredBufferGetElementPtr` root, a device-buffer load moved across barriers, source-emit only)
was posted as comment 5963139346; I verified it: bot author, 3207 chars. **GO given 2026-10-04** (see below). The fix is the corrected B: only an unpassed local `var` is immune, and inout params
need an explicit decision. Naive B breaks copy-in/copy-out after `undoParameterCopy`.

## Review + decisions 2026-10-04 (re-chase)
- slang-reviewer at 10-03 06:33Z: **REQUEST_CHANGES (small), 0 bugs, 2 gaps.** Revert check master 0/11 vs head 11/11.
  Full A/B shows no regressions. 131/136 groupshared outputs are byte-identical; the other 5 are Metal outputs that
  move to the correct order. **The fixer never acted on it** (silent about 37h, head unchanged).
- **G1 → Option 1:** narrow the GroupShared early return to `isGroupSharedAddr(root) && isChildInstOf(root, func)`.
  The global path already handles barriers on HLSL/GLSL/SPIR-V. I verified on master that a `[noSideEffect]` reader
  of a global groupshared keeps the earlier store on HLSL/GLSL. Strict A everywhere would cost those targets
  forwarding with no test behind it. **G2:** `METALLIB: result code = 0`. The reviewer's "untracked device-buffer
  load" note is probably finding 3 (it only read the #13412 body), and the triager is checking that.
- **#13412 GO** (sent to the triager on `gh-issue-shader-slang/slang-13412`): corrected B. Immune roots are an
  unpassed non-GroupShared local `IRVar`, plus out/inout/borrow params (copy semantics). Everything else (loaded or
  computed ptr, `T*` param, `rwstructuredBufferGetElementPtr`) takes the global path. `__ref` gets an explicit
  decision. Use one named helper that composes with #13421. Perf/semantics A/B is required. Draft only.
- 10-04 19:59Z: the triager briefed the fixer (thread `-13412`, msg 3). It added an **escape check**: on master a local var
  whose address escapes through a by-value struct arg (`isValueType(Struct)` skips it in the arg loop) or through
  global memory gets forwarded too. I reproduced the CUDA case (`w_0(&_S1); outb = 1U`). It also added the
  `alias_inout` test (`y=x; w(); return y` with `x`=`g[0]`), which I saw is wrong in HLSL. If escape handling grows
  the change, the default is to split: B lands first, and escape becomes its own issue (filed with my OK). The
  escaped shape goes into the PR body and the 5-bullet on #13412.

## 2026-10-04 19:53Z: triager update (checked on GitHub)
The reviewer's "separate issue" (a barrier-only device-buffer read moved past `AllMemoryBarrierWithGroupSync`) is finding 3 again, so no new issue.
It was appended to #13412 comment 5963139346 (edited 19:52:30Z, still the only comment). **Direct SPIR-V keeps the order.** HLSL/GLSL/WGSL move the read,
and Metal/CUDA dereference after the barrier. So "every target" (reviewer) and the PR body's "on all targets" are both wrong.
The fixer is rewriting that line along with G1+G2 (new commits, App identity). The PR head was still `6ad57af497` at 19:53Z.

## 2026-10-04 21:18Z: [Triage Resolution] (checked live)
#13421 head `c42049e18f`, still a draft, 3 commits. Commit 3 (G1+G2) is App-authored (`274397474`); commits 1-2 are still `286953280`.
CI run 37230791271 is `waiting` (needs human priority release; metallib lane not run). Reviewer R2 is APPROVE_WITH_NITS, 0 bugs.
Terminal handoff: a draft held pending review. Asked the operator for the ready-flip; the CLA decision is separate. Triager closed until merge.

## 2026-10-06 19:45Z re-chase (checked live)
- **#13421:** still a draft at `c42049e18f`. No new commits and no human review or comment. The description was shortened on 10-06 12:17Z; the explanation comment is 6016048614. On 10-05 17:12Z jhelferty-nv **reassigned the reviewer and assignee from jvepsalainen-nv to jhelferty-nv**. #13409 and #13412 are now in milestone Q4 2026.
- **#13412 fix = draft PR #13431** (`fix/issue-13412-v2`, head `bf9f3fd05a`, 8 commits, all App-authored, CLA passes). Reviewer and assignee is kaizhangNV. The triager sent [Triage Resolution] on 10-05 15:55Z and the chain is closed. Its 5-bullet is comment 5963139346.
- **CI has never run on either PR.** The bot's dispatch runs (37230791271 and 37334999072) are stuck in `waiting`: they had to give way to other CI, and they are also held at `falcor-build-approval-gate`. `ci-retry-yielded-bot` only reruns runs that have finished, so it never reruns these. Pull-request CI skips drafts, so marking a PR ready is the only way CI runs.
- ⚠️ **Lost reports:** the triager's 10-05 updates and asks went to my 10-04 re-chase session after it had closed, so nobody saw them for about 28h. **I learned to read the `-13412` triager session directly, not rely on my own inbox.**
- **My decisions:** FILE both out-of-scope candidates (`undoParameterCopy` inout-groupshared on Metal/CUDA; pure-reader dead-store via `tryRemoveRedundantStore`). Both still reproduce at `c8e02397a7`. Filing only: no fix until #13421 and #13431 land. The dead-store issue leads with the pointer-root shape; the escaped-local shape is secondary because it is unsupported. Branch `fix/issue-13412` @ `b106f7c2c8` is KEPT, the same as `fix/issue-13428`. Sent to the triager as msg 739 on `-13412`, pinned to `sess-1791142972332-o68o4g`.
- Dashboard 5-bullet msg 741. Ready-flip not re-asked (CI isn't green). Next re-chase is `rechase-13421-13431-revi-c551`, 10-08 19:00Z.

## 2026-10-06 20:26Z: both candidates filed (checked live)
- **#13465** (`undoParameterCopy`: inout groupshared passed by address on Metal/CUDA; Metal, cuda, reproduced) and **#13466** (dead-store removal vs. a pure callee reading through a pointer; reproduced). Both are bot-authored, open, and have 0 comments. Fix direction is left open, with a bot PR offered on request.
- The triager's [Triage Update] is seq 33 in `sess-1791142972332-o68o4g`. It went into the triager's own session and did **not** reach any Main inbox; I found it by reading that session directly.
- The `issue_opened` webhooks for both issues were no-ops: the chain owns them and no fixer starts until #13421 and #13431 land. `rechase-13421-13431-revi-c551` now watches both issues for human comments (routed to the triager on each issue's own canonical thread). Once both PRs merge, it asks the operator before routing any fix.

## 2026-10-06 20:26Z: follow-ups filed (checked live)
- slang-triager filed **#13465** (`undoParameterCopy`: inout groupshared passed by address on Metal/CUDA) and **#13466** (dead-store removal drops a store a side-effect-free callee reads through a pointer; the CPU lane gives 0, not 1; `-g2` hides it). Both are bot-authored and `reproduced`, both still fail with #13431 applied, and both leave the fix direction open. Report: triager row 33.
- The `issue_opened` webhook for #13466 reached a fresh Main session (`sess-1791318403627-u82a8r`). It was owned, so I dispatched nothing. `rechase-13421-13431-revi-c551` now also watches #13465/#13466 for human comments (routed to the triager, pinned) and asks the operator about routing fixes once both PRs merge.

## Sessions / tasks
Fixer `sess-1790967825882-vnvecr`, triager `sess-1790963826393-0y71gs`, reviewer `sess-1791004457668-whh9sf`,
all on `gh-issue-shader-slang/slang-13409`. The #13412 thread had only my own session as of 10-04.
Re-chase `rechase-13421-g1g2-13412-4e79` (2026-10-06 19:00Z, done). #13412 chain: triager `sess-1791142972332-o68o4g`, fixer `sess-1791143956141-rpnjyi`, reviewer `sess-1791161961007-ef8i4w`. The earlier `rechase-13409-sibling-7aad` is done.

## 2026-10-07 18:22Z: maintainer direction on #13465
- tangent-vector (MEMBER) posted comment 6044142513: `inout` is an **unchecked exclusive mutable borrow**. Copy-in/copy-out and pass-by-reference are both the compiler's choice, so the repro's call site is UB and the Metal/CUDA codegen is permitted. Their proposed direction is a **diagnostic**: groupshared storage passed to `inout` is "abundantly likely" UB, so warn, and they argue it should be an error. Interprocedural overlap checks are best-effort. #13465 has picked up assignee jhelferty-nv and label Office-Tess.
- I routed it to the triager pinned to `sess-1791142972332-o68o4g`, thread `-13465`, msg 65, with the comment quoted verbatim. The triager owns any reply.
- The fixer hold (wait for #13421/#13431) is relaxed for #13465 only: a front-end diagnostic doesn't touch the shared `slang-ir-util.cpp` predicate. A fix may start only if a maintainer asks for the PR. Changes to `undoParameterCopy` or `slang-ir-util.cpp` still come back to me.
- Re-chase `c551` updated so it doesn't re-route comment 6044142513.
- 18:51Z: the triager replied as **comment 6044596724** (I verified it live: bot author, 1258 chars, 2 comments on the issue). The reply accepts the ruling and says the body's "Fix direction" no longer applies. It asks tangent-vector **(Q1)** whether to draft a PR for the call-site check, at whatever severity they choose, and **(Q2)** whether the spec should state the exclusive-borrow rule. **#13465 is parked on those answers.** Re-chase `c551` (10-08 19:00Z) watches for them.
- Correction: the language reference moved to **shader-slang/spec** in #13439 (merged 10-07 09:06Z), so the right citation is `specification/declarations.md:216-219`. The `docs/language-reference/` path I gave the triager is 404 on master. I shared this as a learning.
