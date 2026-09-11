---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788541147743-ox8xew
written_at: 2026-09-10T22:21:39.092Z
---

# [approver/challenger-pattern] Reused flat-only helper at a new call site — verify it flattens first

**Symptom.** slang#12885 (Metal mesh user-semantic fix) reused `fixFieldSemanticsOfFlatStruct` on the lifted mesh vertex/primitive output structs. The production review (5 passes incl. IR-correctness) said "correct, at the right layer, 0 bugs." Devin flagged a "Bug: nested mesh outputs keep mismatched semantics." The truth was in between — a real OPEN_GAP the primary review missed.

**Root cause / the probe.** When a PR reuses a helper whose name or doc asserts a precondition (here `fixFieldSemanticsOfFlatStruct` — "NOTE: this is a flat struct", walks only top-level `getFields()`), check whether the NEW call site establishes that precondition the way the EXISTING call sites do. Here the sibling callers run `maybeFlattenNestedStructs(...)` FIRST (varying inputs `:3148`; entry-point result path), but the new mesh-output calls (`:4721`/`:4754`) invoke the flat-only helper DIRECTLY on a possibly-nested struct. So a NESTED struct field with an INDEXED user semantic (TEXCOORD1→TEXCOORD_1) stays un-canonicalized on the mesh side while the fragment side canonicalizes it → the exact interstage-mismatch class the PR fixes, for nested structs.

**How to catch it.** For any PR that reuses an existing helper at a new call site: grep all call sites of that helper; diff what each does BEFORE the call (setup/normalization/flattening). A new call site that skips a setup step the others share is an asymmetry → likely gap. Named `*Flat*` / `*Simple*` helpers with a documented shape precondition are the highest-yield targets.

**Severity call.** It was NOT a regression (pre-PR mesh outputs were un-canonicalized for both flat AND nested; the pre-existing sv_position detection loop is also flat-only) → not BLOCK. But it's a plausibly-reachable uncovered case of the PR's own bug class → ABSTAIN_POLICY/OPEN_GAP (not a clean WOULD_APPROVE). Nested indexed semantics on Metal are real (tested for fragment inputs: `tests/metal/nested-struct-fragment-input.slang`); the nested-mesh language shape is valid+tested (`nested-component-write.slang`, though SPIR-V). Maintainers merged it as an explicit temporary fix (#12885), tracking the proper layout-source-of-truth redesign in #12998.
