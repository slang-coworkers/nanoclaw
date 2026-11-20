---
type: project
title: "slang#8479 — IntVal folding keeps literal type, default-arg Payload<16> != explicit Payload<16>"
description: "HUMAN-filed (2022-era) generics bug. 11-18 jhelferty-nv asked @nv-slang-bot to triage + check if fixed. TRIAGED 22:5xZ: NOT fixed on master (E30019 self-mismatch reproduced); fixer chain LIVE on canonical thread."
---

# slang#8479 — IntVal folding type-identity bug (default generic args)

## Origin
- 11-18 22:22Z webhook: maintainer **jhelferty-nv** comment 6993344043:
  "@nv-slang-bot Can you triage and see if this has been fixed?"
  → dispatched slang-triager, thread `gh-issue-shader-slang/slang-8479`, post-authorized.

## Triage verdict (triager report 11-18 23:00Z, msg id 12)
- **NOT fixed.** Reproduced on master v2026.22-37-g4a1d62c5b: `uint32_t x=16` default →
  E30019 "expected 'Payload<16>.Hit', got 'Payload<16>.Hit'" (self-mismatch).
- Classification: bug / medium / P2 / frontend (generics constant folding).
- Root cause (verified): `ConstantIntVal` carries (Type, value); implicit-default fold keeps
  the literal's own Int type — slang-check-type.cpp:398 → slang-check-constraint.cpp:944 —
  while the explicit-arg path coerces to the param type (slang-check-overload.cpp:579-592,
  slang-check-constraint.cpp:3805); the two `Payload<16>` types compare unequal.
- Workarounds: `16u` suffix or explicit args.
- Recommended fix (A): coerce folded default IntVals to the param type at the two
  default-fold sites (producer-side canonicalization). B (type-blind IntVal equality) and
  C (_coerce tolerance) rejected.
- Duplicate: no. Family: #14476 umbrella, #14595 (skiminki-nv already linked #8479 from
  #14595); bot draft PR #14601 fixes #14595 only.
- Live GH state after triage: verdict comment 6994144955 posted; labels [Diagnostics,
  reproduced] (Type Bug pre-existing, untouched).

## Chain state
- **TERMINAL our side 02:10Z (shipping steps): draft PR #14626** @ head `6837bbbc0`
  ("check: fold generic value-param defaults to the declared param type", `pr: non-breaking`,
  draft, CI triggered, report_pr_created called, explanation comment live; verified open via
  gh 02:1xZ). Peer review dispatched to slang-reviewer on the canonical thread; [Fix Report]
  pending its verdict. Ready-flip → weekly list (no per-PR ask). Issue #8479 carries the
  status comment. When it flips ready, check approver `paused` before routing any
  pr_ready_for_review webhook (both approvers operator-paused).
- 02:39Z **internal review: REQUEST_CHANGES** (reviewer delivered the [Review Verdict]
  to its parent slang-fixer directly; my relay msg 41 was a duplicate, consistent) (verdict
  relayed to owner fixer session
  02:4xZ, msg 41): 🔴 third default-fold site in `TryCheckGenericOverloadCandidateTypes`
  (slang-check-overload.cpp:544) still folds untyped — #8479 symptom survives for NESTED
  generics (solver deliberately skipped, overload.cpp:1208-1210); 🟡 module-level API/CLI
  specialization path now diverges (slang-check-shader.cpp:3843); 🟡 no test for the
  `getGenericParamDefaultArgVal` site; 🟡 coercion boundary (neg/out-of-range defaults)
  untested; 4 clarity comments (C001–C004). Full review:
  memory/slang/raw/combined-review-14626.md (diff_hash 395c139c…58412a). Reviewer's deeper
  alternative worth considering: coerce value-param defaults to their declared type once at
  declaration-check time in `visitGenericValueParamDecl` so all fold sites inherit it.
  Devin (B): 0 bugs, 0 vulns, 1 flag = the same solver-path coverage hole. No reviewer
  disagreements. Fixer next step (verdict vocabulary): apply overload.cpp:544 + shader.cpp:3843
  (or defer with rationale), add solver-path + coercion-boundary tests, re-verify, re-send
  [Fix Review Request]. 03:04Z R1 in progress: 🔴 site fixed via coerce-then-fold
  `ExtractGenericArgInteger(expr, getType(valParamRef), …)` rejecting `ErrorIntVal`; 🟡
  module-specialization gap fixed at the direct consumer (`Module::_validateSpecializationArgsImpl`
  GenericValue branch, check-shader.cpp:3795, TypeCastIntVal coercion); 🟡 boundary test added
  (uint16_t wrap, default -1 → 65535). **Open dispute: fixer's probes + revert drill show NO
  observable failure from the untyped solver site** (unification's TypeCastIntVal wrap at
  check-constraint.cpp:3805 repairs it in every context constructed) — asked reviewer to re-send
  combined-review.md + a concrete failing snippet; the 🔴's repro is unproven so far. Build
  running; push + [Fix Review Request] round 2 to follow. **03:05Z adjudication: Reviewer A's 🔴
  did NOT reproduce** (six probes, clean on PR head AND unfixed master; TypeCastIntVal repair
  confirmed at slang-check-constraint.cpp:3805-3810) — revised result block in the addendum of
  memory/slang/raw/combined-review-14626.md (51.4 KB version, supersedes the 02:39 copy). The
  🔴-fix stays as defense-in-depth or gets reverted per the fixer's round-2 judgment.
  **Verdict Revision 1 (03:05Z): APPROVE_WITH_NITS** — 0 bugs (🔴 downgraded: A's exact shape
  + 5 more probe shapes compile clean on PR head AND unfixed master; control: the PR's own
  test fails on master E30019 / passes on head; probes preserved at
  `/workspace/agent/runs/A-14626-r1/probe/`). Mechanism: overload.cpp:544's untyped fold is
  real but always repaired by TypeCastIntVal at unification (constraint.cpp:3805-3810); the
  #8479-visible bug only manifested via the bare-name fold at CoerceToProperTypeImpl — the
  site the PR fixes. Nits (no further round): solver-path regression-pin test (f<let x:
  uint32_t = 16> called with default omitted — clean on master too, canonicalization not a
  visible fix), coercion-boundary DIAGNOSTIC_TEST (`struct Bad<uint32_t x = 5000000000>`),
  and optional threading the type at overload.cpp:544 / module-level API specialization
  (shader.cpp:3843 may become a follow-up issue). Fixer applies nits → [Fix Report] directly.
- **05:30Z round-1 fixes pushed: PR #14626 head `a75397024`** (4 new commits: module-spec
  consumer fix, overload-candidate default fold, fold-contract docs, solver-fold + boundary
  tests; new tests 8/8; full suite 12371/12374, the 3 fails = pre-existing container CUDA fp8
  PTX signature, same as the earlier run; CI run 44464281026; gates PLAN/CODE/OUTPUT re-approved at new head;
  explanation comment refreshed, CI re-triggered). Round-2 [Fix Review Request] dispatched to
  slang-reviewer with drill evidence (solver-site revert drill: unification repairs the
  observable → the solver-site test pins the contract, not the site). Fixer's listed blocker
  ("reviewer's concrete 🔴 snippet still missing") is already answered by the reviewer's 03:05
  adjudication — there is no failing snippet (non-reproducing on head AND master). Awaiting
  round-2 verdict → [Fix Report].
- 06:03Z **round-2 combined review (head a75397024)**: 🟡 Has issues — 0 bugs, 3 gaps, 3
  clarity (A); Devin B clean & up-to-date with a753970; C 14 advisory candidates. Gaps:
  overload-candidate default coercion untested (only `<>` spelling reaches it,
  overload.cpp:565); API/CLI specialization coercion changed behavior untested
  (check-shader.cpp:3805); `InstantiateGenericType` (dead code) still extracts without the
  param type (check-type.cpp:253). Full review:
  memory/slang/raw/combined-review-14626-r2.md (diff_hash 7e370b82323f…79a8b8). **Round-2
  verdict: APPROVE_WITH_NITS — 0 bugs, review loop CLOSED (round 2 = last).** Nits to apply
  without another round: (1) API unit test for the module-specialization coercion
  (SLANG_UNIT_TEST modeled on unit-test-global-type-param-specialize.cpp — the one
  canonicalization with no downstream repair, no test, unreachable from .slang tests; may
  be deferred explicitly + follow-up issue), (2) `Box<> x2 = makeBox();` contract-pinning
  line (NOT site-distinguishing — reviewer's drill: test passes with the coercion removed;
  unification repairs it, same class as the solver site), (3) delete dead
  `InstantiateGenericType` (check-type.cpp:246, no callers), (4) optional C clarity items
  (8 survived judgment: shared helper for twin coercion blocks, anchor the
  `genericIsOutermost` gate, error-recovery escape — advisory). Disagreement A-vs-drill
  resolved for the drill evidence; fixer's r1 pushbacks all confirmed. Then [Fix Report].
- 11-19 00:05Z **collision, resolved by convention**: a duplicate fixer session (minted
  ~00:02, second memo delivery) found the owner's sentinel (claimed 23:10:48Z) and stood
  down. **Owner = fixer session sess-1795042833787-sa1ume** on the canonical thread:
  worktree `wt-slang-8479`, branch `fix/issue-8479`, commits `166729bc0` (failing repro
  test) + `6837bbbc0` (fix), build green 23:46, full-suite verify log 00:02:33.
  One-shot watch `8479-fix-push-watch` (00:45Z) — completed/no longer listed.
- 11-19 00:47Z **watch fired, outcome = nudge sent (branch 2)**: no PR on `fix/issue-8479`
  (PR #14601 is the unrelated #14595 chain); owner session sess-1795042833787-sa1ume
  alive and is the ONLY fixer session on the thread — the 00:05 "stand-down" was sa1ume
  itself misreading its own sentinel claim (23:10:48Z) as a peer's on a re-delivered memo,
  not a duplicate session (none exists). Branch/commits verified on disk in the fixer
  workspace (`166729bc1` + `6837bbbc0`). Sent ONE pinned nudge (thread
  gh-issue-shader-slang/slang-8479, target sess-...sa1ume, delivered seq 6 00:47):
  push + open draft PR + report_pr_created. No re-dispatch; awaiting PR.
- Authorization note: fixer chain follows a direct maintainer @nv-slang-bot ask on the
  issue (ask was "triage and see if fixed"); verdict was "not fixed" with verified root
  cause. If the operator prefers park-until-go-ahead (as on #10234), stand down via the
  fixer session on this thread.

## Hazard
- None new. Expect a draft fix PR stacking in the same generics/intval space as #14595 /
  PR #14601 — reviewer should check for overlap before merge.
