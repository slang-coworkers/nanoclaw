---
name: project_11944_sv_target_location_order
description: "#11944 SV_Target<N> out-of-order location — PR #11945 NON-DRAFT, CI FULLY GREEN (44/0/5) at 306c974356, and a MEASURED silent miscompile is still in the branch (aggregate+scalar SV_Target). CI structurally cannot catch it. DO NOT report green as readiness; merge operator-gated, awaiting jkwak."
metadata: 
  node_type: memory
  type: project
  originSessionId: 1b2f560d-c859-4acd-b7b3-857415a4f43c
---

shader-slang/slang #11944: fragment-output struct with `SV_TargetN` declared out of numeric order → GLSL/SPIR-V assign `layout(location)` by DECLARATION ORDER not by the semantic index N. HLSL correct. Root: `slang-parameter-binding.cpp` auto-allocates fragment-output locations in decl order (in-code TODO at :2264 acknowledged it). Draft **PR #11945** (branch `fix/issue-11944`, head `4eb30b7035` = bare Approach A; refinements UNPUSHED/held in fixer tree). `report_pr_created` mapping live → webhooks route to fixer session.

**Fix evolution (all in fixer's local tree, unpushed):** Approach A (preset VaryingOutput location = SV_Target index, Khronos-gated) → introduced E39023 mixing-error regression on mixed SV+user-semantic structs → Option-A exemption → introduced reverse-order compiler-created collision → landed on **Option 3** (preset only for PURE-SV_Target fragment structs; mixed structs stay byte-identical to master, a pre-existing limitation; Option 1 two-pass reserve-then-fill offered to maintainer in PR body).

**SCOPE SETTLED (07-17 22:50Z):** after a multi-round PR thread, maintainer **jkwak-work** landed on **SV-scoped minimal** (r3606685257): *"minimal condition... 'sv_' check and nothing else; unless stronger reasons than you described."* This is NOT (c) → within my pre-auth, no scope-up needed. Earlier he'd pushed GENERIC (uninformed — posted 20:42:50Z, 39s BEFORE triager's empirical verdict issuecomment-5007314224). Triager PROVED (built slangc+spirv-dis @ 3649fb982): bug is **SV_Target-specific**; SV_Target is the ONLY varying that consumes a location AND carries an absolute HW-slot suffix; other SVs are location-less builtins (`SV_Depth`→FragDepth, no VaryingOutput → self-filtered by inner guard :2094); user `TEXCOORD0/COLOR0` suffixes are NAME-MATCHING keys not locations. Generic→regresses user semantics; jkwak's own follow-ups converged away from (c).

**ONLY OPEN QUESTION — mixed-struct handling (minimal vs pre-scan):** jkwak's "no special case" targets the Option-3 mixed-struct pre-scan (`disallowFragmentSvTargetLocationPreset`). BUT literal-minimal (bare sv_ preset, no pre-scan) REINTRODUCES the **E39023 hard compile error** on mixed structs master currently compiles (e.g. `{COLOR0 c; SV_Target0 t}`) — plausibly the "stronger reason" jkwak invited but hasn't seen. Steer given to fixer: **option (a)** — reply to jkwak with the COMPILED-VERIFIED E39023 fact (master compiles it / bare-minimal errors it — must be compiled baseline not reasoned), present minimal-vs-pre-scan NEUTRALLY (fail-loud-simple vs master-behavior-one-special-case), let him pick.

**Resume gate:** jkwak picks minimal or pre-scan (both SV-scoped, PRE-AUTHORIZED — fixer builds his pick directly, redo reaped byte-identity proof, no new gate from me). Only an explicit pivot to **(c) "make user-semantic digits locations"** → BACK TO ME (breaking change to inter-stage matching). Webhook → fixer session.

**⚠️ 10-DAY STALL — jkwak's steer went UNANSWERED; operator caught it (07-27 22:49, dashboard msg 69644; Main-verified).** jkwak posted r3606685257 (07-17 22:44:52Z): *"go with the minimal condition as much as possible... 'sv_' check and nothing else; unless there are stronger reasons than you described."* → **ZERO bot reply/commit since.** Confirmed: no PR/issue comment after 22:44Z; fixer's last #11944 session 07-17 23:00Z (idle 10d); head unchanged `4eb30b7035` (bare Approach A, Option-3 refinements still unpushed). The active fixer↔jkwak conversation (replies 20:12–21:35Z) went quiet right after jkwak's final 22:44 steer and the webhook never re-woke it → **dropped inbound**, ball sat in our court 10 days. This is the class the operator's nudge exists to catch.
- **The owed action (my memory's option-(a) steer, never executed):** jkwak DID pick (minimal `sv_`-only), but literal-minimal (bare sv_ preset, no pre-scan) **REINTRODUCES the E39023 hard compile error on mixed structs master currently compiles** (`{COLOR0 c; SV_Target0 t}`) — that's the "stronger reason than you described" jkwak explicitly INVITED but hasn't seen compiled. Fixer owes: reply presenting the **compiled-verified** tradeoff (minimal → E39023-errors mixed structs vs Option-3 pre-scan → master-behavior + one special case), NEUTRALLY, let jkwak make the final call WITH that fact. Both picks SV-scoped + pre-authorized → fixer builds directly on his answer.
- **RE-DISPATCHED to slang-fixer 07-27** on canonical thread `gh-issue-shader-slang/slang-11944`, `<github-post-authorized />` — execute the option-(a) reply now, verify the E39023 fact against a fresh compiled baseline (not reasoned — the SM-tier lesson), then build jkwak's resulting pick. Do NOT relay a decision; present tradeoff → jkwak picks. Merge OPERATOR-gated.

Precision lesson applied ([[feedback_verify_regression_claims_at_precision]]): a symmetric VS-out/FS-in receipt proves today's decl-order is self-consistent but NOT that suffix→location desyncs matching (symmetric pair matches under either scheme; desync only in ASYMMETRIC producer/consumer). Both triager comment + fixer reply hedged accordingly. DeepWiki falsely claimed user-varyings derive location from suffix — refuted by compiled binary; do not cite.

## ⛔⛔⭐⭐⭐ 2026-08-07 03:23Z — **DO NOT MERGE. CI IS FULLY GREEN AND A MEASURED SILENT MISCOMPILE IS IN THE BRANCH.**

**MINE-VERIFIED at head `306c9743562c9700f3994dc1414d8acf6ffa12ae` (PR #11945):**
```
conclusions {success: 44, skipped: 5}   0 non-success, no PENDING bucket
test-falcor / Test (Falcor)       completed/success   attempt 2, started 03:01:16Z
test-falcor / Test (Falcor Perf)  completed/success
skipped set = retry-on-gpu-failure · Claude Code Assistant ×2 · bridge · review   (bot/bridge legs, NOT builds)
non-skipped build/test check-runs = 30
isDraft=false · mergeStateStatus=BLOCKED · reviewDecision=REVIEW_REQUIRED · reviews=20 · comments=0
```
⚠️Fixer reported **39** non-skipped build/test check-runs; **I measure 30** on the same head with
`^(build|test)` — an attempt-set / prefix-definition difference, not a contradiction. **Either way the skipped
set contains no build or test leg, so "44 success" is NOT a skip-wall.** Falcor flake attribution confirmed:
**attempt 2 green on an unchanged tree** is what #12145 looks like.

⛔⭐⭐⭐**THE HAZARD IS THE GREEN ITSELF. Every automated signal now reads ready** — CI green,
`behind=0`, non-draft, `pr: non-breaking`, 4 of 5 threads resolved *by jkwak himself* — **while the aggregate +
scalar `SV_Target` defect is still in the branch** (silent wrong `location = 2` where master gives `1`, or
E39023; Khronos-only; verified against clean master). `BLOCKED` is **only** `REVIEW_REQUIRED`; **nothing
mechanical is holding this PR.** The fixer's "please don't merge" comment is the sole flag.

⇒ ⛔**CI STRUCTURALLY CANNOT CATCH IT: no Khronos test exercises shape 6** (aggregate `SV_Target` beside a
scalar) — confirmed with the *controlled* detector, after an uncontrolled one had falsely **exonerated** it
(see [[feedback_optimized_lane_can_be_inert_for_the_fix]]). **The green tally is exactly as blind as the
earlier 569/569 was.**
⇒ ⭐⭐⭐**BLOCKED INFERENCE for any supervisor tick reading this chain: "CI green + behind=0 +
non-draft" MUST NOT be reported as readiness here.** The CI reading is *correct* and *irrelevant* to the open
defect — a green dashboard invites exactly the wrong conclusion, and this row exists to stop it. Cf.
[[feedback_a_field_named_like_a_state_is_not_a_test_for_that_state]].

**RESUME:** jkwak's direction on the aggregate-`SV_Target` fix approach. Fixer is not self-resolving and is
pushing nothing further. **Merge stays OPERATOR-gated — do not authorize a draft→ready flip or a merge on
the strength of CI.**
