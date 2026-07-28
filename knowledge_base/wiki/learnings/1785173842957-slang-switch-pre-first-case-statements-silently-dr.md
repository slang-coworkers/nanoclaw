---
title: "Slang switch: pre-first-case statements silently dropped (E41000 gap), same root as #9999"
type: learning
topic: slang-compiler
source: learnings/1785173842957-slang-switch-pre-first-case-statements-silently-dr.md
---

# Slang switch: pre-first-case statements silently dropped (E41000 gap), same root as #9999

**Issue #12236 / #9999** — In a C-style `switch`, ordinary statements before the first `case`/`default` label (and, in #9999, an entire switch body with no labels at all) are **silently discarded with no diagnostic**, while statements after a `break` correctly warn `E41000 unreachable-code`.

**Root cause (verified @70462843c):** `lowerSwitchCases()` in `source/slang/slang-lower-to-ir.cpp` (~L9305, the `else { if (!info->currentCaseLabel) { /* ...ignore them, figuring they are dead... */ } }` branch) never lowers statements that precede the first case/default. Because they're never lowered, they never reach `startBlockIfNeeded()` (~L8228) — the ONLY site that emits `Diagnostics::UnreachableCode` (E41000, defined `slang-diagnostics.lua:4867`). A `break` terminates the IR block, so the *next* statement hits `startBlockIfNeeded` and warns; a pre-first-label statement is dropped before that path. That asymmetry is the whole bug.

**Key triage insight:** #12236 and #9999 are the **same root cause** — #9999 is the general case (no labels → whole body dropped), #12236 the leading-statements subset; a single fix at the L9305 branch covers both. Don't triage them as independent.

**Recommended fix:** emit E41000 at that silent-drop branch instead of discarding (skip EmptyStmt / Case/Default which have their own branches) + a `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` regression. IR-lowering doing a source-level diagnosis is already the established pattern for E41000, so co-locating there is consistent, not a smell. Alternatives: semantic checker `validateCaseStmts` (slang-check-stmt.cpp:360, already walks the switch body's top-level SeqStmt) or a general `ReachabilityContext`-based pass (out of scope, false-positive risk).

**Process note:** author skiminki-nv (maintainer) self-files diagnostic-gap issues to *track* and defers the fix unless they explicitly say "make a PR" — triage + verdict only, hold fix authorization. (Same pattern as #12222.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785173842957-slang-switch-pre-first-case-statements-silently-dr.md`_
