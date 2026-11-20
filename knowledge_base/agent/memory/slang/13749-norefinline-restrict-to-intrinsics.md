---
type: project
title: "slang#13749 — restrict [noRefInline] to intrinsic declarations (PR #14526)"
description: "Maintainer-filed (jhelferty-nv, self-assigned 10-19) __ref-on-[noRefInline] issue; hold struck per 11-17 operator correction; fix PR #14526 draft at 8da07a5, explanation verified 11-17 07:00Z."
---

**Issue #13749** — HLSL `__ref` parameter on a `[noRefInline]` function reaches emit as a lossy
`inout` (no aliasing, zero diagnostics). Filed + self-assigned by maintainer jhelferty-nv 10-19
15:47Z; follow-up to their #13406/#13728. Main wrongly HELD it as maintainer-led 10-20 (the exact
case the 11-17 operator correction struck); supervisor tick requeued 11-17 and the re-triage ran
under the stand-down rule. Maintainer's own fix direction is in the issue: *"we should be
restricting [noRefInline] to intrinsic declarations"*.

**2026-11-17 06:49Z — draft PR #14526** "Restrict [noRefInline] to intrinsic declarations"
(`fix/issue-13749`, head `8da07a5`, fixes #13749). Owner: slang-fixer session
`sess-1794892079568-x1cgc3` on canonical thread `gh-issue-shader-slang/slang-13749`;
pr-mapping row present (verified 07:0xZ).

**Fixer-reported summary** (from its explanation artifact, spot-verified against live PR state —
head, mapping, and comment all match; code claims not independently re-read):
- Check lives in `SemanticsDeclBodyVisitor::visitFunctionDeclBase` (`slang-check-decl.cpp`) after
  `maybeParseStmt`, because function bodies parse lazily (an earlier attempt in
  `validateAttribute` failed the core-module build on exactly that).
- `isIntrinsicFuncDecl`/`isIntrinsicFuncBodyStmt` accept `IntrinsicOpModifier`,
  `TargetIntrinsicModifier`, or a body made only of `__intrinsic_asm` / `return spirv_asm` /
  all-arms-qualifying `__target_switch` (the `DispatchMesh<P>` shape).
- Non-intrinsic + `NoRefInlineAttribute` → E31002 `attribute-not-applicable` + `removeModifier`,
  so no `IRNoRefInlineDecoration` lowers from source. `emitParamTypeImpl`'s `inout` fallback
  stays as a safety net (entry-point `__ref` #13728 + old-compiler modules).
- Tests: `no-ref-inline-not-intrinsic.slang` (E31002), `no-ref-inline-intrinsic.slang` (positive
  control), six existing tests reworked (groupshared diag keeps `export` case; Metal ref-mode keeps
  `__constref`/`inout` borrow modes; 4 vkray empty-payload tests carry payloads by value).

**Explanation artifact:** dated HTML received 07:00Z (inbox a2a-1794898806947-mliihk) and
`nv-slang-bot` explanation comment posted 06:59:04Z with marker head `8da07a59a078` — matches live
head. CI: all checks `skipping` (repo skips CI on drafts).

**Next:** ready-flip pending when review-complete — weekly undraft list only, never a per-PR ask
(fixer cannot `gh pr ready`). Not review-complete yet (no reviews at 07:0xZ). Resume on: review
webhooks (routed via pr-mapping), @-mention, maintainer comment on #13749/#14526.

**2026-11-17 07:21Z — R1 review round: REQUEST_CHANGES** (0 bugs / 5 gaps / 0 questions; diff
sha256 `9e1a758cc436…`; reviewers A+B+C complete). Fixer itself requested the review (its session
seq 19, 06:59) — reviewer dispatch carried no post-authorization, so the verdict exists ONLY as
`/workspace/agent/reports/combined-review-14526-r1.md`, never posted to GitHub. Gaps, all in the
new intrinsic classifier (`slang-check-decl.cpp`): (1) `__target_intrinsic` modifier branch ignores
the body — catch-all body re-enables the lossy `__ref` emit; (2) statement-form `spirv_asm {…};`
arms falsely rejected (Devin also: parenthesized returns at the same line); (3) bodyless/forward
decls hard-rejected, rule unstated/untested; (4)+(5) both new tests leave most classifier branches
unpinned (empty-body and mixed-`default:` shapes whose regression would silently re-expose
#13749). Plus 10 kept clarity/comment nits (incl. C002: stale `[noRefInline]` arm in
`slang-ir-hlsl-legalize.cpp:90-107`).

**07:24Z — dispatched the fixer** (owner session `sess-1794892079568-x1cgc3`, msgs 20+22, delivery
Main-verified) to address all kept findings, keep the 5 test scopes green, push, post a PR round-up
comment (the review's only GitHub visibility), refresh the explanation comment for the new head +
new dated HTML up-chain, 5-bullet report back. Post-authorized for the #13749/#14526 chain only.
Not ready-flip pending until an approving round. Also on the thread, no conflict:
triager backstop task `i13749-fixer-2nd-backsto-ae4b` (sess …-7q20qp) and triager session
`sess-1794891268525-v26dll`; reviewer session `sess-1794898805814-ituqm9` (reported R1 to Main).
Reviewer also delivered the [Review Verdict] in-reply to the fixer's own [Fix Review Request] (its
session seq 19→20), so the fixer holds the verdict directly. **Round protocol:** after pushing, the
FIXER re-sends a `[Fix Review Request]` to the reviewer chain (R2) — do not have Main re-dispatch
the review; the backstop task nudges if the fixer stalls.

**2026-11-17 08:22Z — R2 in flight.** Fixer pushed the R1 fixes at new head `49a0f7087f6b`
(`5718f3f28a` tighten intrinsic detection + pin classifier shapes, `49a0f7087f` wording fix);
explanation comment marker refreshed to the new head. Reviewer started round-2 (A+C ~20–40 min,
Devin double-fetch for stale r1 analysis). **Still owed when the fixer's turn ends:** (a) the R1
round-up comment on the PR (not on GitHub as of 08:2x — review had no GitHub visibility), (b) new
dated explanation HTML + 5-bullet report up-chain. Note: fixer hit critique-gate blocks mid-round
(07:51 PLAN_REVIEW missing; 08:19 OUTPUT_REVIEW stale — pr-body-13749.md changed) before sending
the round-2 request at 08:20; session still `running`. If its turn ends with items (a)/(b)
missing, nudge the owner session with exactly the unmet list.

**08:43Z — round-1 obligations met, verified by Main.** Fixer [Report] up-chain (its session seq
33): all 5 gaps + every kept clarity item applied at head `49a0f7087f6b` (commits `5718f3f28a` +
`49a0f7087f`), PR stays draft. Verified live: resolution-summary comment posted on the PR 08:43:34Z
("Round-1 review findings — resolution summary" — the review's only GitHub visibility),
explanation comment refreshed for the new head, new dated HTML received + archived to
`reports/pr-explanations/…-r2.html` (content reflects the tightened `__target_intrinsic` rule).
Code-claim verification is R2's job (in flight at the reviewer since 08:22). Minor loose end, not
worth a nudge: the PR body itself was never updated (critique gate blocked the edit at 08:30,
attempt 2 of 3, stale OUTPUT_REVIEW on pr-body-13749.md — fixer proceeded without the body edit);
the body stays the original 06:49 text, which is fine. Next: R2 verdict → if APPROVE-family, mark
ready-flip pending for the weekly list; if findings, fixer loop continues.

**08:43Z [Report] received** (fixer 5-bullet, Main-verified against live PR): G1-G5 + all kept
clarity items applied; tests green at new head (diagnostics 1084, vkray 200, metal 239, unit 687,
mesh 24, core module clean). **One finding declined: FG007** (pin E31002 in CHECK spans) — the
diagnostic harness matches span texts positionally and the code lives in the error-code field, not
a span; reasoning in the PR resolution comment. Two-round cap: R2 is the last review round; on a
second REQUEST_CHANGES the workflow ships the better diff with unresolved findings listed.
Awaiting: R2 verdict → fixer [Fix Report]. Note: "CI on the new head" is moot while the PR is a
draft (repo skips CI on drafts); CI comes after the ready-flip.

**09:00Z — R2 partial: APPROVE_WITH_NITS, reviewers_complete=false.** Devin head-fresh at
49a0f7087f6b: R1 paren bug Resolved, C002's legalizer-arm note applied, one open repo-rule item
("Undocumented attribute-placement diagnostic", slang-check-decl.cpp:14178). A + C infra-failed —
shared-IP NVIDIA API 429 wave (WAF CPE_RateLimit_IP), two attempts each, evidence appendix in
`reports/combined-review-14526-r2.md`; same wave killed #14532's review. Verdict rests on Devin +
the reviewer's light G1-G5 presence check only — NOT a completed correctness pass.
**09:0xZ Main actions (both delivery-verified):** (1) reviewer directed (its seq 10) to complete
round 2 — retry A then C sequentially after a cooldown probe at the FROZEN head (not round 3),
adjudicate G1/G2/G3 + Devin's 14178 item, consolidate a fresh combined verdict, report failure
rather than tight-loop; (2) fixer HELD (its seq 32) — no [Fix Report], no pushes, head frozen
until the completed verdict (prevents the partial verdict racing into the ship decision table).
Next expected inbound: completed R2 combined verdict → if APPROVE-family, fixer [Fix Report] +
ready-flip pending for the weekly list. **Fixer confirmed the hold** (09:03, Main msg 66): head
stays 49a0f7087f6b, no [Fix Report] cycle until the completed verdict. Devin's open item is
specifically a **diagnostic-documentation-rule nit** — the E31002 attribute-placement site
(slang-check-decl.cpp:14178) needs a diagnostics-docs entry or a reasoned decline in the report;
it is the single nit the fixer applies in its one pass with anything else that survives A/C.
(The reviewer's 09:00 "may proceed to your report after applying the nit" option predates Main's
09:02 retry directive and is superseded by it.)

**09:44Z — R2 COMPLETE: APPROVE_WITH_NITS, reviewers_complete=true, drift 0** (final report:
`reports/combined-review-14526-r2-final.md`; A retry2 0 bugs/2 gaps, B head-fresh, C retry2 11
kept). Adjudications: G1 fix shape CONFIRMED end-to-end (r1 bypass closed + pinned); G2 CONFIRMED
(Devin's paren bug Resolved; A raises only an extract-a-helper nit); **G3 (Devin's 14178 item)
REAL — user-facing explainability, not correctness**: E31002 renders the generic "not valid here"
with none of the intrinsic-only rule; disposition is an author decision (dedicated diagnostic/note,
or `@hidden` + doc at core.meta.slang:5113). FG007 decline ACCEPTED on the merits (technical claim
partially corrected: position-matching does check errorCode, but the two message annotations pin
the behavior). Two gaps from A: (1) retained legacy legalizer `[noRefInline]` arm lost its only
test — C++ unit test under tools/slang-unit-test OR explicit untested-arm acknowledgment in the PR
description; (2) no test pins the diagnose-then-remove side effect — suggested groupshared
rejection case pinning exactly one E31002 and no E30708. Plus A's 7 clarity + C's 11 kept items
(heavily overlapping: helper extraction for paren-unwrap, empty-shape guard case analysis,
invariant wording — spirv-asm bodies DO emit SPIR-V definitions; bodyless rejection is policy —
legalizer comment qualification, metal "non-aliasing" mislabel, two test-header overstatements,
`__requireCapability`/`__requirePrelude` enumeration note). C dropped C007 (inliner arm is LIVE
code — `DispatchMesh`'s `__ref` param reaches it), FG006 (local restatement is repo style).

**State: fixer is running the nit pass autonomously** — the reviewer delivered the completed
verdict + full report directly to the fixer (its seqs 34/36, 09:44, "apply the nits without
another review round, then your fix report"), which supersedes Main's hold. Expected flow: one
nit-pass push → re-verify the 5 test scopes → [Fix Report] + explanation refresh + dated HTML
up-chain → then mark **ready-flip pending** for the weekly undraft list. Watch on the next
fixer report: GitHub round-2 visibility (resolution-comment update), gap-1 disposition chosen,
G3 disposition chosen.

**10:12Z — [Fix Report]: FIXED. Two review rounds complete, chain review-complete.** All R2 nits
applied at head `c3c11ccce` (12 files, +353/−59): groupshared removal-pinning case (gap 2, the
`gsWrite` case), legacy legalizer arm acknowledged untested in the PR body (gap 1 remedy B), G3
addressed via attribute doc + `// @hidden:` at core.meta.slang syntax site (generic E31002 kept —
declined on the uniform-placement-precedent grounds; FG007 code-pinning decline already adjudicated
accepted), lockstep cross-reference comment, clarity nits. Declines recorded with reasons.
**Main-verified live at 10:1xZ:** head, draft, `pr: non-breaking` label, PR-body acknowledgment,
gsWrite case in the diff, explanation comment marker at c3c11ccce. Tests green per report
(diagnostics 1084, vkray 200, metal 239, mesh 24, unit 687, core module, repro PASS). **CI run
44062046269 triggered, WAITING — not green yet** (the full matrix runs on this draft despite the
draft-skip seen at r1; re-check before listing). Dated HTML for c3c11ccce was NOT sent — nudged
(fixer seq 38, 10:14). **State: ready-flip pending for the weekly undraft list** (today's 09:00Z
run predates completion; next run 11-24). Not a P0/P1/regression → no fast-flip ask. PR flags for
the maintainer that `__ref` aliasing across ordinary call boundaries (kaizhangNV #13256 vkray
scenario) is no longer expressible by design; awaiting maintainer review; PR stays a draft.

**10:14Z — review chain CLOSED by the reviewer** (its [Report]): every fixer claim verified in the
head diff — `@hidden` + doc at core.meta.slang, extracted `isSPIRVAsmExprIgnoringParens` helper,
groupshared rejection case (one E31002 / no E30708), invariant comment with the spirv-asm
carve-out, Risk-section untested-arm acknowledgment; fixer dispositions all reasonable; no further
review round owed. Second-source verification on top of Main's spot-checks. Remaining in flight:
the fixer's dated HTML for c3c11ccce (nudged 10:14) and CI run 44062046269 (waiting). Chain now
parks on maintainer review; surfaced via the 11-24 weekly undraft list.

**10:15Z — dated HTML received** (`…-r3.html`, head marker c3c11cc, CI-triggered-not-green caveat
included as asked) and archived to `reports/pr-explanations/`. **All bot-side obligations for this
chain are closed.** Final in-flight item: CI run 44062046269 (re-check before the 11-24 list).
Chain parks on maintainer review — resumes on: review webhooks (pr-mapping → fixer), @-mention,
maintainer comment on #13749/#14526, or the weekly undraft list run.

