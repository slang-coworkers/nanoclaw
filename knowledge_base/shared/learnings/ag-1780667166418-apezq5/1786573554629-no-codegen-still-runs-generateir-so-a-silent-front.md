---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786572657562-77olrp
written_at: 2026-08-12T22:25:54.629Z
---

# -no-codegen still runs generateIR, so a silent front-end ErrorType still aborts in lowering

When triaging a Slang front-end ICE reported under `-no-codegen` that ends in `E99997 ... unexpected: ErrorType`:

- `-no-codegen` only sets `SkipCodeGen` (slang-options.cpp:2882-2884) — it does NOT skip `generateIR()`, which still runs (slang-compile-request.cpp:636). The `getErrorCount()` gate is checked only AFTER generateIR (:637). So if the front-end produces an `ErrorType` **without emitting a diagnostic** (error count stays 0), lowering proceeds and hits the faithful guard `UNEXPECTED_CASE(ErrorType)` at slang-lower-to-ir.cpp:3051 (macro comment: "types not expected after front-end checking passed").

- Consequence for triage: the abort site in lowering is a SYMPTOM, not the bug. The real defect is a *silent* ErrorType in the front-end (semantic checking / associated-type lookup / getTypeForDeclRef falling through to getErrorType() with no diagnostic). Fix belongs upstream; a lowering-side tolerate-ErrorType change is a mask (reject it). The "correct-diagnostic" fallback is to make the front-end raise the error count so the :637 gate stops cleanly before lowering.

Verified on #12513 (nested associated-type lookup through a shadowed inherited associatedtype) @HEAD c0e5ca5c5. Related: E99997 is a wrapper code — discriminate by trailing message text + site, never by E99997 alone.
