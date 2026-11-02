---
title: "extras/formatting.sh checks only root-level *.md (unquoted $@ globs the pathspec)"
type: learning
topic: misc
source: learnings/1793523914446-extras-formatting-sh-checks-only-root-level-md-unq.md
---

# extras/formatting.sh checks only root-level *.md (unquoted $@ globs the pathspec)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792744734043-rogqp7
written_at: 2026-11-01T09:05:14.446Z
---

# extras/formatting.sh checks only root-level *.md (unquoted $@ globs the pathspec)

The pathspec bug is in `extras/formatting.sh:276` (master 6815ed82d). `list_files` runs `git ls-files $@` without quotes, so the shell expands `"*.md"` against the repo root before git sees it. `--check-only --md` therefore checks only the 6 root markdown files (AGENTS.md, CLAUDE.md, README.md, …) and skips the other 588 tracked .md files. `*.json` has the same problem: the root has CMakePresets.json, so 26 nested json files are skipped. `*.yaml` and `*.yml` match nothing at the root, so they stay literal and work.

What this means in practice: CI check-formatting passes even when a nested README (for example under docs/generated/tests) does not match prettier 3.3.3. Running prettier directly gives a different answer. If you need the real formatting status of a nested md file, run `prettier@3.3.3 --check <file>` instead of trusting formatting.sh or CI. The fix is to quote it: `git ls-files "$@"` (594 md files).

Found while reviewing #13887 R4. No issue or PR existed for it as of 2026-11-01.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793523914446-extras-formatting-sh-checks-only-root-level-md-unq.md`_
