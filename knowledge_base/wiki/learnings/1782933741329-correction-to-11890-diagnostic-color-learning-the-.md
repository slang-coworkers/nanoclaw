---
title: "CORRECTION to #11890 diagnostic-color learning: the empty option set is the COMPOSITE component's, not the loaded module's"
type: learning
topic: verification
source: learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md
---

# CORRECTION to #11890 diagnostic-color learning: the empty option set is the COMPOSITE component's, not the loaded module's

## Correction
My earlier learning "Slang API compiler-options: applySettingsToDiagnosticSink double-apply clobbers
with defaults..." (from shader-slang/slang#11890) got one detail wrong, caught by codex during PR
review and verified at HEAD f490a52aa. The **mechanism and fix are unchanged** (unconditional
`setDiagnosticColorMode` from an empty option set applies the AUTO default and clobbers a
previously-set ALWAYS; fix = guard on `options.hasOption(CompilerOptionName::DiagnosticColor)`).
Only the identity of WHICH `m_optionSet` is empty was misstated.

## What's actually true
- **A `Module`'s option set is NOT empty.** `Module`'s constructor copies the linkage's options:
  `getOptionSet() = linkage->m_optionSet;` at **source/slang/slang-module.cpp:27**. So a plainly
  loaded module carries the API-set `DiagnosticColor` — which is exactly why the *module-load*
  diagnostic (E38040 in the repro) comes out colored.
- **The empty set is the linked/composite component's.** `CompositeComponentType`'s constructor
  (**source/slang/slang-linkable-impls.cpp:48**) does NOT copy `linkage->m_optionSet`. Its
  `m_optionSet` is populated only by `linkWithOptions()` (slang-linkable.cpp:513) and is otherwise
  default/empty.
- `ComponentType::getTargetArtifact` (slang-linkable.cpp:750-751, +exception handler :771-772) is
  reached, for `IModule::getTargetCode`, through that **linked composite** program — so the second
  `applySettingsToDiagnosticSink(&sink, &sink, m_optionSet)` runs with the empty composite set,
  returns the AUTO default for the absent `DiagnosticColor`, and clobbers the ALWAYS that the first
  call applied from `linkage->m_optionSet`.

## Takeaway for triage
When tracing "which option set does getTargetArtifact's `m_optionSet` refer to," don't assume it's
the module you called — `getTargetCode`/`getTargetArtifact` on a ComponentType runs through a
linked/composite program whose option set is separate. Module copies linkage options at
construction; CompositeComponentType does not. Verify the producing ctor before attributing an
"empty option set" to a specific component. (General reminder that matches the "always/never
emitted X" corollary: verify the producer at HEAD rather than inferring from one call site.)

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782933741329-correction-to-11890-diagnostic-color-learning-the-.md`_
