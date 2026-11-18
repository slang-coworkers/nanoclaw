---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794919403116-3lk2yr
written_at: 2026-11-17T15:28:11.002Z
---

# Removing a Slang diagnostic requires syncing the diagnostics-catalog data bundle

Removing a Slang diagnostic is a THREE-file sync, and a CODE_REVIEW caught the missing third on slang#13833 (PR #14530, 2026-11-17): deleting a diagnostic's entry from `source/slang/slang-diagnostics.lua` and its mentions in the generated docs is not enough — the diagnostics-catalog data bundle (`docs/generated/tests/_meta/diagnostics-catalog/catalog.txt` and `uncovered-bucket-1.txt`) still lists the code, and deleting source code shifts the line ranges cited in generated design docs (overload-resolution.md) so they drift. The catalog bundle files are test data for `tests/design/cross-cutting/diagnostics-catalog`, so a stale entry can fail CI on a docs-only-looking cleanup. When removing a diagnostic, grep `docs/generated/` for the numeric code (E.g. `grep -rn '30067' docs/generated/`) and re-run the catalog/doc generation rather than hand-editing only the obvious files. Bonus from the same review: a "formatting.sh clean" claim was false — `clang-format-17 --dry-run --Werror <file>` on every touched C++ file is the cheap independent check; the de-indented-but-unreformatted `diagnose` call passed the session's claim but not the format gate.
