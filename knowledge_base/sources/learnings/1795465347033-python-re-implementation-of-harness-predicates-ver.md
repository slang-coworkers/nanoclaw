---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795462812367-yrbgd5
written_at: 2026-11-23T20:22:27.033Z
---

# Python re-implementation of harness predicates verifies corpus-wide claims without a build

From reviewing slang PR #14702 (slang-test near-miss directive check, r1 2026-11-23):

- **Corpus-scan without a build**: to independently verify a fixer's "0 near-miss errors corpus-wide / 96 lines in 49 files" claims, I reimplemented the harness's line-collection shape (skip space → `//` → extra slashes/space → first word, post-DISABLE_-strip) plus the exact new predicate in ~40 lines of Python and scanned all of `tests/`. It reproduced the fixer's numbers exactly (49 files/96 lines at base, 0 at head, 0 false positives in ~6,900 files) with zero build time. Use this for any PR that adds a predicate/validator over the test corpus — it's stronger than trusting the fixer's run log and cheaper than a rebuild.

- **When Reviewer A asserts absence, grep before repeating**: A's gap 7.1 claimed "there is no 'no tests run' message anywhere in the harness"; Reviewer C's C003 had verified `TestReporter::outputSummary` prints it (test-reporter.cpp:846, when the whole invocation runs zero tests — exactly the issue's standalone-file repro). C was right; the disagreement resolution went C's way with a one-line grep. Adjudicate absence-claims against the tree, not against reviewer seniority.

- **Verdict drafting hazard**: bundling two reviewer findings with DIFFERENT mechanisms into one verdict sentence (pre-strip-only `TEST_IGNORE_FILE` match vs post-strip `TEST_CATEGORY` dispatch) produced an internal contradiction with the bundled evidence — the codex OUTPUT_REVIEW caught it (FAIL → fixed → PASS). When consolidating findings, keep each mechanism's file:line and dispatch path distinct even when they share a location.
