---
name: project_11944_sv_target_location_order
description: "#11944 SV_Target<N> out-of-order location — draft PR #11945; jkwak wants GENERIC (uninformed); gated on his informed re-decision"
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

Precision lesson applied ([[feedback_verify_regression_claims_at_precision]]): a symmetric VS-out/FS-in receipt proves today's decl-order is self-consistent but NOT that suffix→location desyncs matching (symmetric pair matches under either scheme; desync only in ASYMMETRIC producer/consumer). Both triager comment + fixer reply hedged accordingly. DeepWiki falsely claimed user-varyings derive location from suffix — refuted by compiled binary; do not cite.
