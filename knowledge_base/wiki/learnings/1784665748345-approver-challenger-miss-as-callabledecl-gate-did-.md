---
title: "[approver/challenger-miss] as-CallableDecl-gate-did-not-exclude-imported-bodyless-fn-E45001"
type: learning
topic: review-approval
source: learnings/1784665748345-approver-challenger-miss-as-callabledecl-gate-did-.md
---

# [approver/challenger-miss] as-CallableDecl-gate-did-not-exclude-imported-bodyless-fn-E45001

## Symptom
PR shader-slang/slang#12156 R2 (@81d88d5704) narrowed the R1 over-rooting fix by gating the `HLSLExport`+`KeepAlive` adds on `if (as<CallableDecl>(decl))`. Devin's head-current R2 run raised an "Investigate" flag: "Imported `__extern_cpp` decls now also get HLSLExport/KeepAlive." I CLEARED it — reasoned (with deepwiki concurrence) that the linker's `maybeCloneValue` dedups symbols-with-linkage and `KeepAlive` on an imported fn is "generally harmless." A contributor (pdeayton-nv) then found it was a REAL regression: a bodyless `[__extern] __extern_cpp` function hit `error E45001 unresolved external symbol` (exit 255) — because the `as<CallableDecl>(decl)` gate did NOT exclude imported/extern decls, so a bodyless imported function got `Import`+`UserExtern` AND `HLSLExport`+`KeepAlive` = a retained export root demanding a symbol with no local definition. R3 fixed it: gate is now `as<CallableDecl>(decl) && !isImported`.

## Root cause of the miss
I treated an "Investigate" flag about imported-decl rooting as an abstract dedup question and cleared it on a plausibility argument (+ deepwiki, which described dedup mechanics but did NOT model the bodyless-no-definition case). I did NOT construct the concrete failing input: a *bodyless* `[__extern] __extern_cpp` function is imported (no definition here) yet was being marked a KEEP-ALIVE EXPORT ROOT — the linker must then resolve a symbol that doesn't exist. "Rooting an imported symbol" is not harmless when the symbol has no definition in this module: KeepAlive forbids DCE from dropping it, and HLSLExport makes it a root the linker must satisfy → E45001.

## How to catch it
When a change adds `HLSLExport`+`KeepAlive` (or any "retain + must-link" decoration) in a code path that ALSO runs for IMPORTED/extern/bodyless decls, do not clear it on dedup/plausibility. Construct the concrete adversarial input: an imported OR bodyless declaration of that shape, and ask "does this now demand a definition/symbol that does not exist here?" A linking-root decoration on a definition-less decl is an E45001 waiting to happen. The correct gate excludes imported decls: `isImportedDecl(...)` returns true for `[__extern]`/`ExternModifier`/non-main-module (slang-lower-to-ir.cpp:730). Also: prefer building/repro over deepwiki plausibility when the flag concerns a *linking/DCE* outcome — deepwiki models mechanics, not the specific unresolved-symbol case.

## Fix
The gate must be `as<CallableDecl>(decl) && !isImported`, not `as<CallableDecl>(decl)` alone. Lesson for the challenger: an "Investigate" flag about a new decoration reaching imported decls is a build-break candidate (E45001), not a benign dedup — verify by constructing the bodyless/imported instance, ideally empirically, before clearing.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784665748345-approver-challenger-miss-as-callabledecl-gate-did-.md`_
