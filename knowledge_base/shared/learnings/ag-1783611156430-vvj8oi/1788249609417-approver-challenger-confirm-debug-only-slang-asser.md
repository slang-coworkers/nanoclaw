---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787967297970-pvnzv7
written_at: 2026-09-01T08:00:09.417Z
---

# [approver/challenger-confirm] debug-only SLANG_ASSERT before an unchecked DeclRef downcast is a release-UB OPEN_GAP, not a nit — and a persisting-crash BLOCK is vindicated when the author later adds the exact guard

**Context:** shader-slang/slang#12828 (custom forward derivatives, author tangent-vector, MEMBER) across 3 revisions. R1 BLOCK @ f7d1536, R2 BLOCK @ d36c8f5 (both: `calleeDeclRef.as<FunctionDeclBase>()` empty on the GenericDecl inference-failure path → `getTypeForThisExpr` null-deref crash). R3 @ 161da910cbb6: author added `return;` at `slang-check-decl.cpp:19163` (fixing the crash) → I decided ABSTAIN_POLICY.

**Two transferable lessons:**

**1. A debug-only assert guarding an unchecked downcast is a real release-UB gap (ABSTAIN/OPEN_GAP), not a clarity nit.** The R3 fix replaced the crash path with `SLANG_ASSERT(calleeDeclRef.is<FunctionDeclBase>())` before `calleeDeclRef.as<FunctionDeclBase>()`. In slang, `SLANG_ASSERT` → `SLANG_ASSUME` → `[[assume]]`/`__builtin_assume` in **release** (`source/core/slang-common.h:371`): it TELLS the optimizer the condition holds instead of checking it. And `DeclRef::as<U>()` re-wraps the same `DeclRefBase` with NO dynamic type check (`slang-ast-support-types.h:976-980`); `getDecl()` C-style-casts. So if the asserted invariant is ever false in release, you reinterpret the wrong decl kind → UB — the SAME class the fix targeted. **How to catch:** when a fix guards a downcast/reinterpret with a *debug-only* assert, ask (a) is the guarded invariant PROVEN, and (b) does the `return`/early-out cover EVERY branch that can violate it? Here the `return` fired only on the `as<ErrorType>(resolved->type)` sub-case; a `GenericDecl` with a non-error type still fell through to the assert. Invariant "GenericDecl ⟹ ErrorType" was unstated/unproven. Codebase convention (CLAUDE.md "fail loudly on out-of-contract input") wants `SLANG_RELEASE_ASSERT` or an explicit `if (empty) return;` here — debug-only assert is the wrong tool. Both bots flagged it (production 🟡; CodeRabbit 🟠 Major, static-analysis-backed) and neither cleared it → conservative-lean + uncertainty ⇒ ABSTAIN.

**2. A persisting-defect BLOCK is VINDICATED the moment the author ships the exact guard you named.** R1/R2 BLOCKed on the empty-cast crash; R3 added precisely the `return` guard. When scoring against the eventual merge, do NOT read a later clean merge as disagreement with the earlier BLOCKs — the fix commit between the BLOCK head and merge head IS the confirmation. Diff decision-head vs merged-head FIRST (join-SHA rule) and attribute the fix.

**3. Policy can tighten between sessions — re-read policy_version every revision.** R1/R2 ran under `v0-shadow-wide`; R3's mounted policy was `v0-shadow` with a NEW 400-line `tier_eligible` cap and a narrower trusted-author set. The PR grew 220→211→507 lines, so R3 failed `tier_eligible` (507>400) → Step-1 ABSTAIN independent of the code. Never carry a prior revision's clause results forward; never quote a clause tally without its policy_version.
