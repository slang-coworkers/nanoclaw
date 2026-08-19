---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787044079919-89sted
written_at: 2026-08-18T10:10:12.181Z
---

# [approver/challenger-miss] Exhaustive diag-test + exact-column matcher: green CI refutes a bot's static caret-column concern

**Symptom:** On a test-only PR adding `DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` files (slang#12595), CodeRabbit posted an actionable "the caret is pinned to column 14 but the reported span is at column 9, so the test may fail or enforce a wrong span — fix before merge." The primary bot (github-actions[bot]) said the opposite ("caret alignments check out"). A naive approver might abstain on the cross-bot disagreement or treat CodeRabbit's flag as an OPEN_GAP.

**Root cause / resolution:** The disagreement is decidable from the harness contract, not judgment. `tools/slang-test/diagnostic-annotation-util.cpp:579-582` matches a caret annotation to a diagnostic with an EXACT column compare (`diag.beginCol == annotation.columnStart && diag.endCol == annotation.columnEnd`, plus a point-diagnostic single-caret tolerance: `beginCol==endCol && beginCol==columnStart && columnEnd==columnStart+1`). `SIMPLE` runs EXHAUSTIVE by default — any diagnostic without a matching annotation fails, and any annotation matching nothing fails. So a caret at the wrong column would BOTH fail to match AND leave the real diagnostic unannotated → the test reddens. CI on the head was 49 success / 4 skipped / 0 failure (verify via `commits/<sha>/check-runs?per_page=100`, listed==total, NOT bare --paginate) including the linux front-end `test-slang` jobs that execute DIAGNOSTIC_TEST. Codex independently confirmed E30025 emits at cols 14–15 by direct compilation. → CodeRabbit's static column read is simply wrong; the col-14 caret is correct by the harness's own contract.

**How to catch it (transferable):** For a caret-based diagnostic-test PR, the "could this observation have come out otherwise?" test resolves the caret-column question mechanically: (1) confirm the matcher is exact-column and the test is exhaustive (both true in slang's SIMPLE harness); (2) confirm the front-end/CPU `test-slang` jobs are green at the pinned head. If both hold, green CI carries real bits and any bot's static "wrong column" comment is refuted — do not abstain on it, and do not score it as a gap. Conversely, if the test were `non-exhaustive` or used substring (no-caret) matching, green would NOT refute a column claim.

**Redundancy 🟡 vs OPEN_GAP:** the primary bot's sole finding was "5–6 of 11 files overlap existing tests/diagnostics/* / nightly conformance." Test *redundancy* is the opposite of *missing coverage* — it clears on the conservative-lean bar (overlap, intentional per the issue #12594 to promote nightly-only codes into the PR gate, zero correctness blast radius). Don't reflexively map a bot's "🟡 gap" label to OPEN_GAP; read what the gap IS.

Decided WOULD_APPROVE (shadow mode). Row: memory/pr-12595-decided.md.
