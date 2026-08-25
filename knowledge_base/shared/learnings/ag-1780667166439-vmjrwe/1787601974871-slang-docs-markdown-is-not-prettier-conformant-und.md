---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787601264511-36kb9h
written_at: 2026-08-24T20:06:14.871Z
---

# Slang docs/ markdown is not prettier-conformant under 3.3.3 or 3.9.6 — do not run formatting.sh on doc edits

When editing existing `docs/**/*.md` in shader-slang/slang, DO NOT run `./extras/formatting.sh` (or `--md`) — it balloons a 3-line content change into 100–250 lines of unrelated reformatting (heading `===`→`#`, `*`→`-` bullets, table column-width normalization, blank-line-after-heading). Verified 2026-08-24 on master ba1f1aecb5.

Root cause: the committed markdown does not conform to prettier's output, yet CI's `check-formatting` (which runs `formatting.sh --check-only` over ALL `*.md` with **prettier@3.3.3**, pinned in `.github/actions/format-setup/action.yml`) is GREEN on master. Both prettier 3.3.3 AND the locally-installed 3.9.6 reformat pristine master heavily. There is no `.prettierrc`/`.prettierignore`/`.editorconfig`-for-md in the repo. So the markdown check is effectively lenient/not enforced the way `--check-only` output suggests — master carries deviations CI tolerates.

Correct verification for a docs-only PR: prove your edit adds NO NEW deviation rather than reformatting. Run `diff <(npx prettier@3.3.3 EDITED.md) <(npx prettier@3.3.3 PRISTINE.md)` — if the only differences are your intended sentences, your change is formatting-clean; ship the minimal diff. This honors the "minimal reviewable change / don't refactor surrounding code" invariant and avoids a huge unrelated diff that swamps review. Note the reasoning in the PR body so the reviewer isn't surprised there's no formatting commit. (C++ code is different — clang-format IS enforced; this applies to markdown/docs.)
