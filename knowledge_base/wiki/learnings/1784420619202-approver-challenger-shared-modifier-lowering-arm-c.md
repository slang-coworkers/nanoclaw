---
title: "[approver/challenger] shared-modifier-lowering-arm-change-has-blast-radius-beyond-explicit-syntax"
type: learning
topic: review-approval
source: learnings/1784420619202-approver-challenger-shared-modifier-lowering-arm-c.md
---

# [approver/challenger] shared-modifier-lowering-arm-change-has-blast-radius-beyond-explicit-syntax

## Symptom
PR shader-slang/slang#12156 "Root `__extern_cpp` symbols as host-callable exports (#9401)" looked like a clean, precisely-scoped 2-line producer-side fix that exactly matched the Step-0-recalled prediction (add `HLSLExportDecoration`+`KeepAliveDecoration` to the `ExternCppModifier` arm of `addLinkageDecoration`, matching the export/DLL/CUDA/Torch arms). A COLLABORATOR (jkwak-work) had already APPROVED it at the exact head. It was a nv-slang-bot fixer branch. Every surface signal said "safe, predicted, approve." It in fact BROKE a pre-existing test on 3 platforms.

## Root cause
The `else if (as<ExternCppModifier>(modifier))` arm in `addLinkageDecoration` (slang-lower-to-ir.cpp) is NOT reached only by the explicit source syntax the PR title/description names (`public __extern_cpp` functions). The SAME AST modifier is:
- synthetically stamped onto **ALL global variables** when the `-no-mangle` option is set (`CompilerOptionName::NoMangle`; CLI `-no-mangle`, API `SLANG_COMPILE_FLAG_NO_MANGLING`) — slang-check-decl.cpp:2905-2910 (gated by `isGlobalDecl` = namespace/file scope);
- synthetically stamped onto buffer / parameter-group members under `-no-mangle` — slang-parser.cpp:4132-4140;
- attached to `__extern_cpp` **struct types and struct fields**, which flow through the same `addLinkageDecoration` (struct-type decl linkage + field-key linkage) — not just functions.
So adding two decorations to that one arm silently changed emission for every global/buffer-member under `-no-mangle` and every `__extern_cpp` struct/field. The manifestation: pre-existing committed test `tests/headers/generate-cuh-header.slang` (which uses `__extern_cpp struct Struct{...}` + `__extern_cpp groupshared`) regressed — the `.cuh` `struct Struct {...}` body stopped being emitted (only a forward-decl remained), failing FileCheck on 3 platforms.

## How to catch it
When a diff adds behavior to a **per-modifier / per-attribute dispatch arm** (a `switch`/`else-if` chain keyed on an AST modifier, IR decoration, or attribute), do NOT assume the arm's only trigger is the explicit source keyword. Grep for every site that **adds that modifier synthetically** — compiler options (`-no-mangle`, obfuscation, GLSL-compat), desugaring, and implicit stamping in the parser/checker. Here: `grep -rn "create<ExternCppModifier>\|addModifier.*ExternCpp"` found the two synthetic producers instantly. A shared arm's blast radius = union of ALL producers of that modifier, not the syntax in the PR title.

Corollary that clinched it fast: the PR did NOT modify the failing test, and it is a **pre-existing committed** test — so a 3-platform failure at the pinned head is a regression signal even without a base-green baseline run (which I couldn't fetch due to OneCLI flap; codex agreed baseline was a soft-gap, not a must-fix, because the diff decorates exactly the decls the untouched test exercises).

## Fix
BLOCK (RED_BUG). Devin's structured 🔴 named the exact mechanism ("Name-preservation compile option now forces every global variable and struct field to be kept and exported" @ :1446); the challenger's job was to VERIFY it against source (it did) and reproduce the harm (3-platform CI test-slang failure of generate-cuh-header.slang). A narrow-looking fix in a shared lowering arm needs a "who else produces this modifier?" grep before WOULD_APPROVE. Predicted-fix-shape match (Step-0 recall) confirms INTENT alignment but says nothing about unintended-collateral scope — do not let a recall match short-circuit the blast-radius check.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784420619202-approver-challenger-shared-modifier-lowering-arm-c.md`_
