---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787044079919-89sted
written_at: 2026-08-24T16:00:57.219Z
---

# [approver/clause-gap] Pinning an error code in an EXISTING diagnostic test is a slot-replacement, not an addition — verify the swap kept every diagnostic annotated

**Context:** slang#12595 R2 (synchronize). The author responded to a "test redundancy" gap by DELETING 6 redundant new `DIAGNOSTIC_TEST:SIMPLE` files and instead MODIFYING 6 pre-existing `tests/diagnostics/` tests to pin `error E#####` (code+severity), which those tests previously asserted only by message text. This is a common and *good* PR shape — but modifying an existing passing test is a newly-in-scope risk the approver must actually open the files to clear.

**The mechanism (verified in-tree + confirmed by Devin & codex):** `tools/slang-test/diagnostic-annotation-util.cpp` marks each emitted diagnostic consumed by the FIRST annotation that binds to it (`diagnosticMatched[diagIdx]=true`), and an annotation binds if its substring matches message OR severity OR errorCode OR "severity errorCode" — NEVER a conjunction. So under exhaustive mode you cannot simply ADD an `^ error E#####` line next to the existing message annotations: there'd be one more annotation than diagnostic rows and the test fails. The correct edit is to REPLACE a redundant annotation slot (e.g. a human-readable "summary" line) with the code line, keeping the detailed-message line. Net: same annotation count, but code+severity now asserted.

**What to check when a PR pins codes in existing tests (transferable):**
1. Open each modified test at the PR head. Confirm each diagnostic still has an annotation that binds it (message, severity, or code) — i.e. the swap didn't leave a diagnostic unannotated (would fail) or an annotation with no diagnostic (would fail). Green CI is the backstop, but read it: coverage should be strictly ≥ before, never weakened to vacuous.
2. Code-only annotations (no message line) are legitimate and sometimes REQUIRED: when a diagnostic's primary + span messages render identically, the matcher dedupes to one row, so a second message annotation would have no second row to consume. Don't flag code-only as a gap on that ground.
3. `error E#####` IS the valid diag-test form (matcher keys on machine-readable severity+errorCode). This is NOT the inert `warning NNNNN` legacy-filecheck form the vacuous-CHECK learning warns about — different harness. Don't conflate them.

**Bonus (recall confirmed by the author):** the author's own PR-body claim "3 codes asserted nowhere" was an overclaim caught because grepping `.slang` for `E#####` literals misses tests that assert diagnostics by MESSAGE TEXT only (no code in the file). Two of three "novel" codes were already covered that way. This is the recurring "grep-for-code-literal undercounts message-only coverage" trap — a novelty/coverage claim about diagnostics must grep message text too, not just the code literal.

Decided WOULD_APPROVE at both R1 (966939e9) and R2 (e480d28fad90), shadow mode. Row: memory/pr-12595-decided.md.
