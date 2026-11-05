---
type: chain
title: slang#14231 — differentiable generic-extension method via interface param → E33180 in 2025+ (legacy passes)
description: Human-filed (tdavidovicNV) 2026-11-03 04:54Z; blocks slangpy#1256 (draft). Three distinct signatures. Routed to slang-triager on gh-issue-shader-slang/slang-14231, no hold.
tags: [autodiff, typeflow, existential, visibility, slangpy, language-2026]
---

# slang#14231 — Tensor interface calls work in legacy, fail in 2026 (E33180)

**Report.** SlangPy's legacy→2026 test migration (slangpy#1256, now draft) hits three separate
failures on 2026.20, Windows:
1. `[Differentiable][BackwardDerivative]` method in `extension<T : IValue> T`, called through an
   `IValue` param → E33180 in `-std 2025/2026/202c`; legacy passes. Forward call only.
3. Custom `[BackwardDerivative]` called through an interface param loses its contribution (`[0,3]`
   vs `[2,3]`), in all language modes.
4. E30604 less-visible-`T` on generated derivatives of a public generic interface default method.

**Routing (11-03 04:5xZ).** `grep 14231` over memory found nothing, and there was no triager
session. The only related session was a sibling Main session `sess-1793651860274-7c1w2p`, which had
queued slangpy#1256 into the approver-pause queue. Dispatched slang-triager with no hold.

**Triager findings (11-03, msgs 20–26; the triager's own findings — I have not seen the receipts):**
- §1 reproduces on master 76a45e10c (Linux). Root cause: the typeflow `substituteLeafSet` unwraps
  the `no_diff` AttributedType, so the specialize is never deduped. That makes it a bug, not an
  intended restriction.
- §3 is **fixed on master by #13742 (653bfdeef, merged 10-22, closes #13301)**. Bisect: parent
  00849649c gives [0,3] on 13/13, 653bfdeef gives 26/26 [2,3]. The 2026.20 release (10-17) still
  gives [0,3]. The fix ships in the first release after v2026.20 (none tagged as of 11-03).
  Orchestrator nudges: test the 2026.20 binary vs master (this split the result), and confirm with
  a bisect before claiming "fixed by" in the post.
- §4 reproduces on master and on 2026.20. Root cause: `getDeclVisibility` unwraps only one
  GenericDecl. The triager is filing a follow-up issue.

**§4 follow-up filed: slang#14232** (nv-slang-bot, 11-03, label `reproduced`; E30604 on generated
derivatives of a public `[Differentiable]` generic method nested in ≥2 generic containers;
workaround `public module`). Its `issue_opened` webhook reached Main; **no dispatch** — the #14231
triager chain filed it and owns it. A fixer for #14232 is a new fixer chain → operator decision.

**Triage closed (11-03 05:27Z, msgs 28/30/36; memo at `/workspace/inbox/a2a-1793683633552-0c32gg/triage-14231.md`).**
Verified on GitHub: an nv-slang-bot comment at
https://github.com/shader-slang/slang/issues/14231#issuecomment-6596182703 (05:25Z), and `reproduced` set on both issues.
- §1: P2, typeflow. Recommended fix A is NoUnwrap in `substituteLeafSet` (typeflow-specialize.cpp ~3858-3900).
  Minimal non-autodiff repro `read<T:IValue>(no_diff T t)`. A maintainer should confirm that this is not an intended restriction.
- §4 = #14232. Recommended fix: `if`→`while` at slang-check-decl.cpp ~23228.
- E31152/E30852 are restrictions. #5921 is unrelated.

**Fan-out (triager → slang-fixer directly, 05:25Z):** fixer `sess-1793683522163-m3bzqw` on
`gh-issue-shader-slang/slang-14231` and `sess-1793683554622-w04obg` on `gh-issue-shader-slang/slang-14232`.
The #14232 fixer chain had already started when I saw it. It was not held: medium severity, on the reporter's
workaround path. I reported it to the operator on orchestrator-dashboard, offering a hold. This supersedes the
"operator decision" line above unless the operator asks for a hold.

**Reporter follow-up (comment 6596803621).** On v2026.20, a generic caller `evaluate<V : ITensor>` also gives
[0,3], both with inferred specialization and with explicit `bwd_diff(evaluate<Tensor>)`. The reporter has not rerun it on master and
asks that both variants be included "when confirming the fix/regression coverage". Routed to slang-triager on the
canonical thread: rerun on 2026.20, 00849649c, 653bfdeef and master, then reply on the issue. If master still fails, treat it as a new defect.

**Generic-caller result (06:15Z, msg 46; reply https://github.com/shader-slang/slang/issues/14231#issuecomment-6596858161):**
both variants give 0/9 on v2026.20 and 00849649c, and 9/9 [2,3] on 653bfdeef and master. Fixed by #13742; not a new defect.
Coverage gap: #13742 tests only the explicit `viaGeneric<View>` form (CPU + CUDA), with no inferred generic caller and no vk run. The triager
kept it out of the §1 PR (off-scope) and noted the gap on GitHub. A test-only PR is offered to the operator as a new chain; it is not dispatched.

**Triager [Triage Resolution] 07:24Z (msg 48). Verified on GitHub at 07:2xZ:**
- #14232 → **draft PR #14233** (`fix/issue-14232`, head 93fc4d197, `pr: non-breaking`). slang-reviewer R1 gave
  APPROVE_WITH_NITS; the nits are applied. The full suite fails only 3 fp8-cuda `CUDA_ERROR_INVALID_PTX` tests, and those fail on master on this host too.
  Shepherd jhelferty-nv. **Needs a human "Ready for review" click** (fixers can't `gh pr ready`).
- #14231 §1 → **draft PR #14234** (`fix/issue-14231`, head fc123ea85). Peer review is in progress; the [Fix Report] is pending.
- **#14237 filed** (bot, 07:23Z, `reproduced`): a custom `[ForwardDerivative]` on a generic, called through a single-conformer
  existential, gives E33180 "specializing 'read_fwd'" in 2025+. It reproduces on v2026.20, master and the #14234 head. **Not routed to a fixer.** A fixer
  chain needs the operator's go. **Its issue_opened needs no dispatch**; this chain owns it.
- Not filed: the `makeInfoForConcreteType`/`unionPropagationInfo` case-order hazard (no repro) and the fixer's
  `bwd_diff(obj.method)` E99997 side-finding (does not reproduce).

**§1 resolved (08:01Z, msg 52; verified):** draft PR #14234 has head aa7fb7dfd, `pr: non-breaking`. R1 gave APPROVE_WITH_NITS (nits
applied); the 3864-compile differential is byte-identical. The issue 5-bullet was refreshed in place (comment 6597585327). The SlangPy fixtures compile but were not GPU-run through SlangPy.

**More fan-out filed by the triager (bot, 08:01Z, `reproduced`; none routed; the issue_opened webhooks for all of them need no dispatch):**
- #14239: specializeModule segfault, `bwd_diff` through a `[Differentiable]` generic with a two-conformer existential (legacy and 2026).
- #14240: E99997 at autodiff-fwd.cpp:1382, a differentiable variadic `load<each I>` extension reached through an existential. This is the shape of SlangPy's
  `tensor_indices_each.slang`, the most SlangPy-relevant of the three.

**Parked on the operator (asked on the dashboard 08:0xZ):** a fixer for #14237/#14239/#14240, the test-only coverage PR, and a human Ready click on
#14233/#14234. Timer: one-shot `ncl tasks` "recheck 14231 fanout operator", 2026-11-04T09:00Z.

**#14234 [Fix Report] + final [Triage Resolution] (08:01Z, triager msg 45).** #14234 head aa7fb7dfd, R1
APPROVE_WITH_NITS applied, full suite 11436/11439 (3 fp8-cuda PTX, also on master). The reviewer's side finds S1/S2 were filed
by the triager, all `reproduced`, none routed to a fixer:
- **#14239** (S1): segfault in `specializeModule`, `bwd_diff` through a `[Differentiable]` generic with a two-conformer existential (legacy + 2026).
- **#14240** (S2): E99997 at autodiff-fwd.cpp:1382, differentiable variadic `load<each I>` extension via an existential. The triager calls it
  the most SlangPy-relevant (`tensor_indices_each.slang` shape).
The triager asked "which of #14237/#14239/#14240 to route to slang-fixer"; that question landed in sibling Main session
`sess-1793681648046-dnmoma`, which owns the operator ask. **The issue_opened webhooks for #14239/#14240 need no dispatch** (#14239's
reached Main session `sess-1793692866940-i0kveu`, 08:01Z; no dispatch, no operator row from it to avoid a duplicate). #14240's reached Main session `sess-1793692867311-htt8mq` (08:01Z); same handling, no dispatch.

**Re-check 11-04 09:0xZ (one-shot task `recheck-14231-fanout-ope-cf00`; verified on GitHub):**
- #14237, #14239, #14240: OPEN, `reproduced`, 0 comments, unassigned. #14231 and #14232 have had no comments since 11-03 08:00Z.
- #14233 (head 93fc4d197) and #14234 (head aa7fb7dfd): still draft, `pr: non-breaking`, no human reviews or comments.
  Both are **ready-flip pending** for the weekly list ([policy](../orchestrator/undraft-asks-replaced-by-weekly-list.md)). Not P0/P1 and not
  regression fixes, so no per-PR ask.
- Dashboard (rows 510382–510732, 11-03 06:16Z → 11-04 09:00Z): **no operator go/no-go** on any fan-out item.
- **v2026.21 is tagged and contains #13742** (compare 653bfdeef...v2026.21 = ahead 76/behind 0), so §3 now ships in a release.
- Action: one combined reminder posted on orchestrator-dashboard (msg id 7), covering #14237/#14239/#14240 and the test-only coverage PR. It
  states that silence means filed-only and that I won't ask again. **No timer.** All four stay filed-only until the operator says go. If the go
  comes, dispatch slang-fixer on `gh-issue-shader-slang/slang-<n>` (for the coverage test, `…-14231`; the fixer session `sess-1793683522163-m3bzqw`
  owns it), after checking `ncl sessions list` for an existing owner.

**11-04 18:05Z: jkwak-work comment 6638197702** cc'd @skiminki-nv: "this reveals some of problems with the transition from legacy
syntax to the more recent Slang language versions". This is not a bot mention and asks nothing of the bot. The issue now has
`RTR` and assignee kaizhangNV (set by humans). Routed to the triager (session `sess-1793681782161-37fhas`): post one short delta
saying §3 now ships in **v2026.21** (released 11-04 00:14Z; contains 653bfdeef, verified), with links to #14234/#14233 and the
fan-out list, and no @-mentions. No reply to the CC itself.

**11-04 18:10Z delta posted** (verified): https://github.com/shader-slang/slang/issues/14231#issuecomment-6638287939. The v2026.21 lib gives
31/31 [2,3] for §3 on the L40S (slang-test, not SlangPy).
**jkwak-work self-assigned #14237, #14239 and #14240 on 11-04 17:24–17:25Z** (verified from the issue events). They are now human-owned:
**no fixer chain unless the operator or jkwak-work asks for one.** That supersedes the pending operator go/no-go. The test-only coverage PR
is the only bot-side option still open.

**Note.** A sibling Main session rewrote this file around 05:3xZ and dropped my triage-closed section. Re-read the file before every edit.
