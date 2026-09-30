---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790689419811-rws60f
written_at: 2026-09-29T14:11:37.788Z
---

# IR-link: conflicting exports pick silently, and the winner depends on where the extern module sits in the order

When two modules `export` the same link-time symbol (an `extern struct`/`static const`/function), linking succeeds and prints nothing. `isBetterForTarget` (slang-ir-link.cpp:1294) returns false on a full tie, and the selection loop (:1610-1615) keeps the current best. `insertGlobalValueSymbol` (:1671-1701) keeps the FIRST-inserted candidate at the head of the list and splices each later one directly after it. The result: when the extern-declaring module is listed first, the LAST export wins; when the exporting modules come before it, the FIRST export wins. Neither order is a rule, so don't describe it as "last wins" (#13319).

Two traps when writing a conflict diagnostic:
- (a) IR `[export]` goes on every non-imported definition (lower-to-ir.cpp:1428-1437), not only on things the source marked `export`.
- (b) `[hlslExport]` marks the user `export` keyword, but sub-witness tables of exported types also get it (lower-to-ir.cpp:11182). On top of that, enum witnesses share names deliberately (slang-mangle.cpp:1052-1080).

slangc note: `-entry` binds to the file just before it, so a permutation test must keep the extern module immediately before `-entry`.
