---
type: chain
title: "slang#14745 — Conditional<Interface> struct-field ICE on dxil/spirv/ptx → draft PR #14746"
description: Chain state for #14745 (typeflow specialization drops IRConditionalType payload before conditional lowering)
tags: [slang, chain, conditional, typeflow, interface]
---

# #14745 → PR #14746 — Conditional&lt;Interface&gt; typeflow fix

- **Filed:** 11-27 by tdavidovicNV (human, detailed repro + patch gist). Bug/high/P2, IR subsystem:
  typeflow specialization + conditional lowering. Not a dup.
- **Root cause (triager, verified file:line):** `Conditional<Interface, true>` struct field — typeflow
  refines the stored interface *value* to a TaggedUnion but `IRConditionalType` has zero handling in
  slang-ir-typeflow-specialize.cpp beyond `isConcreteType` (:549-566); no analyze/specialize/upcastSet
  (Optional has all of it: :861, :3352+, :8180+; upcastSet slang-ir-typeflow-set.cpp:255-283). After
  lowerConditionalType rewrites the field to raw interface type, emit hits leftover Func/tuple insts →
  ICE on dxil (E99999), spirv (E99997 naming a `Func`), ptx (NVRTC invalid tuple-member access).
- **Fix:** Approach A — Conditional mirrors Optional end-to-end in typeflow (wrapper survives until
  lowerConditionalType). **Draft PR #14746 @ head `fc9ffa303`** (11 commits, 14 files, +1085/−7;
  label `pr: non-breaking`; explanation cmt 7224401264; CI run 46055199096). Also includes:
  late-reader refined-field fallbacks; ref-param rejection at BOTH levels (IR predicate + AST mirror
  in slang-check-decl.cpp) with flag-aware semantics; getTypeNameHint renders Optional/Conditional/Tuple;
  8 new test files (1 diagnostic) + 2 diagnostic-test updates. Repro 0/5→5/5 targets; dxil/spirv
  (SLANG_RUN_SPIRV_VALIDATION=1)/ptx clean; targeted 41/41; dynamic-dispatch 1085/1085, autodiff
  1745/1747 (2 pre-existing ToT tolerance failures, match reporter's baseline), language-feature
  4214/4214, bugs 1571/1571. Reviewer's spec check: R1 enabled-conditional dispatch / R2 false-flag
  omission / R3 wrapper-through-typeflow all met.
- **Round-3 delta (11-27 20:05Z):** round 3 found 1 real bug INTRODUCED by the round-2 assert
  application (makeInfoForConcreteType: deref-raw-`cast<>` aliased attributed Conditional params through
  IRConditionalType* in release builds — `as<>` unwraps attribute types in every build mode, `cast<>`
  only checks in debug; now asserts on the `as<>` result itself). Re-shipped at **head `033ab2a14`**
  (32c23f42a fix + 476fe5dbe tests + e1977be09/033ab2a14 polish): upcastSet flag guard release-active
  (SLANG_ASSERT is SLANG_ASSUME in release — it licensed the silent flag rewrite feeding
  lowerConditionalType's layout decision); getTypeNameHint skips IRTupleNameType sentinel, IntLit-spelled
  flags. 41/41 targeted; dynamic-dispatch 1085/1085. Devin's nested-Conditional card still UNVERIFIED
  after 3 rounds (human adjudication); AST-mirror conservative rejection adjudicated by-design.
  CI re-triggered run 46061206520; explanation comment refreshed to head 033ab2a14.
- **Unresolved / left to human adjudication at merge review:** (1) reviewer's concrete-impl test for
  makeInfoForConcreteType doesn't compile (front-end payload-invariance E30019) → RELEASE_ASSERT
  documents the IR-level contract instead; (2) invariant-consolidation clarity item declined; (3)
  late-reader distinguishing assertion — on-record limitation (CHECK values can't distinguish narrowing
  from re-widening; fallback unreachability disclosed); (4) Devin's nested-Conditional bug card —
  UNVERIFIED across 3 rounds, no reproducer, contradicted by passing nested-merge regression.
  (5) substituteSets Conditional cases remain undiscriminated by any test (revert drill 5/5 without) —
  kept with documented symmetry rationale (same KEEP pattern as field fallbacks).
- **Reporter's patch:** triage memo claimed `conditional_typeflow_fix.patch` unreachable — WRONG, the
  issue body links a public gist (verified: gist c0647ae7ca63bcff37f11dfb88f0bae1). Fixer reconstructed
  against it and credited their tests (SPDF headers kept). Triager retracted, self-corrected issue
  cmt 7222671894 in place. Do not re-ask for a repost.
- **State 11-27 20:06Z:** review chain CLOSED by slang-reviewer ("ship stands") — 3 rounds all applied
  and verified at head `033ab2a14`; all 4 fixer disclosures ACCEPTED by adjudication (the IFactory
  scenario gives Devin's "abort on associated Conditional results" card direct counter-evidence; the
  nested-Conditional card stays unverifiable, human adjudication). Chain RESTING on human maintainer
  review + merge of draft PR #14746 (stays draft per policy). Triager's [Triage Resolution] follows
  (final review state received). Ready-flip → weekly undraft list (no per-PR ask).
- **Repro:** `field.slang` in the issue body (IValue/A/B/Holder, `Conditional<IValue,true> wrapped` field);
  `slangc field.slang -entry main -target <spirv|dxil|ptx>`.
- Sessions: triager loibhq, fixer z0xpid, reviewer y4276n — all on `gh-issue-shader-slang/slang-14745`.
