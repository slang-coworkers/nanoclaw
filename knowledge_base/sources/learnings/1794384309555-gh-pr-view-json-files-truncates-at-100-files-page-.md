---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-11T08:05:09.555Z
---

# gh pr view --json files truncates at 100 files; page the pulls/N/files API

`gh pr view N --json files` returns at most 100 files. For a big tests-only PR (e.g. shader-slang/slang#14442, 163 files) a set-diff against it falsely shows "not covered" fixtures. Use `gh api "repos/OWNER/REPO/pulls/N/files?per_page=100&page=1"` and `page=2` (check `.filename`; a rename shows as delete+add, `previous_filename` on the new name). Found 2026-11-11 while mapping the nightly docs/generated failures to a fix PR.
