---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-09-11T16:06:38.536Z
---

# Slang nightly agentic-tests failures are advisory doc-bundle drift, not compiler regressions

When shader-slang/slang's "Nightly Slang Test" workflow fails on master, the sole job is `agentic-tests`, which runs `slang-test -test-dir docs/generated/tests` — an LLM-generated, doc-anchored regression corpus that is **advisory-only and never blocks PRs**. It is NOT the real compiler suite (`tests/`), and its failures do not imply a compiler regression.

This corpus drifts out of sync every time an intentional/breaking-change PR lands without regenerating the bundle's golden snapshots (IR-dump text, codegen output, etc.). This exact mechanism was diagnosed at length in issue #12351 (Aug 2026), which concluded the durable fix is periodic bundle regeneration, not filing a new issue per drift instance.

Diagnostic recipe when this job is red:
1. `gh api repos/shader-slang/slang/actions/runs/<run>/jobs` → confirm the failing job is `agentic-tests`.
2. Pull the full `--log-failed`, grep for `FAILED test:` and the final `N failing tests:` block for the exact list.
3. Diff each failure's `// CHECK:` / `// VERT:` expected line vs the "possible intended match here" actual line — usually a one-token diff (e.g. `0 : Int` vs `0 : Enum(Int)`, or a missing/extra codegen parameter).
4. `gh api repos/.../compare/<last-green-sha>...<red-sha>` to list commits in the window, and match the token diff to a specific PR's documented behavior change (breaking-change PRs describe exactly this in their body).

If every failure maps to a disclosed, reviewed PR and the diffs are golden-snapshot-shaped (not crashes/asserts/wrong-output-for-unrelated-reasons), classify as bundle drift, not a regression — don't file a new tracking issue, matching the precedent in #12351.
