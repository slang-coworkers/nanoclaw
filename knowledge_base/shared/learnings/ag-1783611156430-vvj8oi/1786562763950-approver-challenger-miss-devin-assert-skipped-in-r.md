---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786561274698-crqwhd
written_at: 2026-08-12T19:26:03.950Z
---

# [approver/challenger-miss] Devin "assert-skipped-in-release = UB" needs the value-path check, not just the assert-macro fact

**Symptom:** Devin flagged a 🔴 Bug on slang PR #12501 @ b0745aa8afa9: `SLANG_ASSERT(lowerType(w->getSup()) == superType)` at slang-lower-to-ir.cpp:7262 is "a safety check silently skipped in shipping builds → UB", because in release `SLANG_ASSERT` → `SLANG_ASSUME` (slang-common.h:371) and a violated assume is `__builtin_unreachable()`.

**Root cause of the false positive:** The model stopped at "SLANG_ASSERT compiles to an assume in release." Two facts refute the bug and require *reading the code around the assert*:
1. **The asserted quantity is not on the value path.** The recursion passes `superType` (the caller's parameter) down unchanged — NOT the asserted `w->getSup()`. So even a false assume changes no computed value; there is no null-deref / wrong-field consequence. An assert that guards nothing the code then *uses* cannot be the UB source.
2. **The invariant holds by construction.** Producer `slang-check-inheritance.cpp:2205/2219` builds the witness as `getFirst/LastSubtypeWitness(type, patternWitness->getSup(), patternWitness)` — operand-1 super IS the pattern's sup. substitute/resolve (slang-ast-val.cpp:531-538,556-566) re-substitute both together, preserving equality. `getOrCreate` is the only ctor. So the assume is sound on valid input.

Also: it's the codebase's *universal* idiom — every `SLANG_ASSERT` becomes `SLANG_ASSUME` in release (slang-common.h:359-361), and the neighboring transitive arm passes `superType` through with no assert at all. A rule that made this a bug would condemn thousands of existing asserts.

**How to catch it:** For any "assert/check disabled in release ⇒ UB" claim, run TWO probes before believing it: (a) **Is the asserted value on the value path?** Trace what the code actually *uses* after the assert; if the used value is a different variable (here `superType`, not `getSup()`), removing the assert changes nothing. (b) **Does the invariant hold by construction?** Find the producer(s) and the substitute/resolve paths; if they set the two sides equal, `SLANG_ASSUME` is sound. Only if BOTH the value depends on the assert AND the invariant is reachably violable is it a real `SLANG_RELEASE_ASSERT`-worthy defect. This is the "dead-code-is-a-universal" and "read what the pass consumes, not the whole shape" pattern applied to assert-macro reasoning.

**Fix (decision):** ABSTAIN_POLICY:CHALLENGER_CONCERN — disproved the 🔴 (so no BLOCK), but the procedure bars upgrading a doc-🔴 to WOULD_APPROVE via investigation, and this was a Devin-only fallback tier, bot-authored, human-unreviewed IR-lowering change; handed to a human to confirm the release-safety reasoning.
