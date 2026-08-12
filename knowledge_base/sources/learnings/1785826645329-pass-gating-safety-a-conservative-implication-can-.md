# Pass-gating safety: a conservative implication can fail STRUCTURALLY, not just via optimizer elimination

# Gating an IR pass on a scan flag: "co-emission at production" is NOT "co-presence at the governing scan"

Context: shader-slang/slang #11917 epic — gating backend passes on `RequiredLoweringPassSet` bools so
they're skipped when the IR has none of the opcodes they handle. Sibling slices #11920/#11961/#11987/#12088
all merged. This note is about the reasoning trap in batch-2, which cost two wrong mechanisms before the
right one.

## The setup

`lowerTagInsts` handles four opcodes: `GetTagOfElementInSet`, `GetTagForSuperSet`, `GetTagForSubSet`,
`GetTagForMappedSet`. A tempting simplification: gate it on the pre-existing `taggedUnion` flag, since
tagged-union lowering synthesizes tag insts anyway ("tagged-union opcode implies tag ops").

That simplification is a **miscompile**. Three wrong-or-insufficient arguments were offered before the
correct one, and they're each instructive:

1. **"Not synthesized by `lowerTaggedUnionTypes`"** — TRUE but INSUFFICIENT. It establishes the implication
   doesn't *create* them in-window; it says nothing about whether the implication *covers* them.
2. **"Co-emission: each tag inst is emitted on a path that also emits `GetTagFromTaggedUnion`"** — FALSE,
   and this is the interesting failure. It was checked at *emission* time.
3. **The correct one: an entire producer family never has an implier at all.** In
   `slang-ir-typeflow-specialize.cpp`, `getLoweredType` has `as<IRTaggedUnionType>(info)` (:5606) and
   `as<IRElementOfSetType>(info)` (:5611) as **sibling `if`s on the same `info`**. The element-of-set branch
   returns `makeTagType(...)` — a `SetTagType` with no tagged union in the chain. And
   `specializeLookupWitnessMethod` gates on `as<IRElementOfSetType>(info)` (:5774-5776), never tests for a
   tagged union, and emits `GetTagForMappedSet` (:5823). So the opcode is reachable with zero tagged-union
   opcodes present.

## The transferable lesson

**A gate reads at scan time; a producer runs at production time. Those are different instants.**
When you argue "opcode A implies opcode B, so gating on A covers B," ask *two* separate questions:

- **Contingent failure:** can something between production and the scan *eliminate* the implier while the
  consumer survives? (DCE/SCCP/simplification.) This is the question people naturally ask.
- **Structural failure:** is there a producer path where the implier is *never produced in the first place*?
  This is cheaper to check, easier to miss, and stronger evidence.

**Prefer the structural argument when both are available.** A contingent argument depends on optimizer
behavior — an optimizer change silently rots it. A structural one (a whole producer family with no implier)
cannot rot. Corollary: a *type* used as a **function parameter type** (here `makeTagType(tableSet)` in a
specialized dispatch signature, :6010) is co-present with **no producing instruction at all** — a second
structural way co-emission fails.

**Asymmetry of correction direction:** correcting *toward less* safety (weakening a gate) needs more
evidence than correcting *toward more*. A retraction of a safety claim deserves the same scrutiny as the
original claim — here the retraction's own load-bearing premise ("every SetTagType traces back to a
tagged-union opcode") was false.

## Two more gate-design rules this run confirmed

- **Gate-vs-handled-set exactness beats opcode-family reasoning.** `lowerUntaggedUnionTypes` looks like it
  handles exactly `UntaggedUnionType` — but `processModule` also calls
  `replaceNoneTypeElementWithVoidType()` unconditionally (slang-ir-lower-dynamic-dispatch-insts.cpp:736-743,
  called :755). Gating on `UntaggedUnionType` alone silently skips `NoneTypeElement` cleanup.
  **Always read the pass's whole `processModule`, not just its main `processInstsOfType` call** — a second
  unconditional job is invisible to opcode reasoning. `kIROp_NoneTypeElement` had to join the flag.
- **A flag with no arm setting it is a silent always-skip.** ⚠️**PROVENANCE CORRECTED TWICE 2026-08-04
  (author) — the original wording *"a prior session's draft declared `bool assumeAddress`"* is
  essentially RIGHT, and my first correction over-shot.** Final verified form: the dead flag was a
  **transient in-development state of the batch-2 draft (PR #12336), caught by its author before
  publication — it never reached `master` or any remote ref.** PR #12336's body: *"An **earlier draft**
  of this change added an `assumeAddress` flag… and never set it."* Positive control at `master`
  confirms the public-absence half: `RequiredLoweringPassSet` (`slang-code-gen.h:52-88`) has 34 flags,
  all with setters, none named `assumeAddress` (the 34 names enumerating is the non-zero control).
  ⭐**"It happened" and "it shipped" are different claims — and my over-correction to "no such draft
  exists" was the same error sign-flipped. A retraction owes evidence too.**
  It now has a shipped regression test: `tests/diagnostics/get-address-validation-gpu.slang` expects
  four `InvalidAddressOf` diagnostics and all four vanish if the gate fails to fire.
  The *check* remains correct and worth running: **grep that every new flag has both a setter and a
  reader.** Byte-identity testing of emitted output would not catch a dead flag — the loss is a
  diagnostic, not codegen (in-tree corroboration: `tests/hlsl/lower-lvalue-cast-skip.slang` states
  skip-vs-run *"is a compile-time-only property that is not observable in emitted output"*). Gate each
  diagnostic-bearing pass with its own diagnostic test. **Scope: new-flag-plus-new-gate only** — a
  widening-only change (new `case` labels broadening an existing flag false→true) is monotone and
  cannot create a dead flag.

## Scan-visibility gotcha (and a wrong rationale to avoid)

`calcRequiredLoweringPassSet` recurses via `getDecorationsAndChildren()` — **operands are NOT traversed**.
So an inst is only seen if it's parented in the module tree. Do *not* justify this with "all the opcodes are
`hoistable`": `GetTagForSuperSet`/`SubSet`/`MappedSet` are **not** hoistable (slang-ir-insts.lua:3167-3183).
The correct rationale is block-insertion reachability — `emitIntrinsicInst` → `addInst` inserts at the
builder's current location inside existing IR, which is reachable from the module inst.

## Process note

An `Explore` subagent audit of this window recommended collapsing all three gates onto `taggedUnion` — i.e.
the miscompile. Its own evidence contradicted its conclusion. **Don't trust subagent verdicts on
pass-gating safety; verify every producer claim in source yourself.** Conversely, an independent codex
critique caught the `NoneTypeElement` must-fix that neither the plan nor the triage trace had — the two
review channels catch different classes, so run both.
