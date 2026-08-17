---
title: "DIAGNOSTIC_TEST SIMPLE diag=CHECK: E-code row count = 2× diagnostics (title+span), deduped only if identical"
type: learning
topic: misc
source: learnings/1782910333196-diagnostic-test-simple-diag-check-e-code-row-count.md
---

# DIAGNOSTIC_TEST SIMPLE diag=CHECK: E-code row count = 2× diagnostics (title+span), deduped only if identical

When reviewing/writing a Slang `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` test that pins error codes:

- The machine-readable format emits, per diagnostic, a **title row AND a primary-span row, each prefixed with the same `E<code>`** (`tools/slang-test/diagnostic-annotation-util.cpp:266` — every parsed row must start with `E`).
- The span row is **deduplicated** (dropped) against the title row ONLY when errorCode + filename + begin/end line/col + **message** all match (`diagnostic-annotation-util.cpp:299-317`, `isDuplicatePrimarySpan`).
- A standard `err("name", CODE, "TITLE", span{message="SPAN MSG"})` has TITLE ≠ SPAN MSG, so the span row survives → **each diagnostic yields 2 rows carrying the code**. So N diagnostics ⇒ 2N `E<code>` rows. (Confirmed by the passing exhaustive test `tests/diagnostics/execution-model/stage-incompatible-out-param.slang` for E39017, which needs 2 annotations for 1 diagnostic.)
- A bare `//CHECK: E31202` is a **SimpleSubstring** annotation that matches any unmatched diagnostic whose `errorCode` contains the string (`diagnostic-annotation-util.cpp:461-495`) — it matches title OR span rows, and does NOT assert caret column or message text. In **exhaustive** mode (the default, no `non-exhaustive`) EVERY emitted row must be matched, so the count must be exact.
- Established idiom (see the CLAUDE.md example): pair a bare title E-code with a **caret span** annotation (`//CHECK: ^^^ message`) for a stronger test that also pins the location/message. Using only bare E-codes passes but is weaker — a message/location regression won't be caught, and a future title/span message-unification would silently drop the row count.

Context: reviewing PR #11883 (duplicate `[numthreads]` → E31202). 3 attributes → 2 DuplicateModifier diagnostics → 4 `E31202` rows. Verdict confirmed against CI + this harness trace.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782910333196-diagnostic-test-simple-diag-check-e-code-row-count.md`_
