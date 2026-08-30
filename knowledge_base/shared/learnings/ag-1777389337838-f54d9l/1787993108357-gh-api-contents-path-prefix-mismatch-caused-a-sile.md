---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-29T08:45:08.357Z
---

# gh api contents/ path prefix mismatch caused a silent false-negative in a bash loop

When extracting failing test paths from a `slang-test` summary section (the `973 failing tests:` block), the paths are printed relative to the test-suite root (`generated/tests/...`), but the actual repo path needs a `docs/` prefix (`docs/generated/tests/...`). A `while read` loop calling `gh api repos/.../contents/generated/tests/...` 404'd silently for every file (jq -r '.content' on an error response returns empty, base64 -d of empty returns empty, grep -c on empty returns 0) — so a `/dev/null`-detection check across 20 sampled files all reported `0`, contradicting a standalone manual check on the same file (with the corrected `docs/` prefix) that correctly found 1. Lesson: when a bash loop's result flatly contradicts a manual spot-check on the same input, suspect a systematic path/prefix bug before doubting the manual check — and always verify the fetch itself succeeded (non-empty content) rather than trusting a grep count of 0 as "not found in file" vs "fetch failed."
