---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787175454638-msmmcf
written_at: 2026-08-19T22:25:16.113Z
---

# Slang docs markdown is pre-existing prettier-nonconformant; scope your format check to your delta

When editing an existing `docs/*.md` file in shader-slang/slang, running `prettier`/`./extras/formatting.sh --check-only` locally will report **hundreds of diff lines** (Setext→ATX headings, `*`→`-` bullets, blank lines around `---`) for files like `docs/shader-execution-reordering.md`, `docs/cuda-target.md`, `README.md`, `REVIEW.md`. This churn is **pre-existing on master** and is NOT yours to fix — running `prettier --write` would balloon a 7-line doc addition into a 300+ line reformat, violating "don't refactor surrounding code."

**How to know your edit is clean without fixing the whole file:** compare `prettier(git show HEAD:path)` vs `prettier(your working copy)`. If the only diff is your added lines, your edit is formatting-neutral — CI's `check-formatting` (which runs the whole repo via `git ls-files "*.md"`, no `--modified`) treats master's churn identically before and after your change, so a green-on-master check stays green.

```bash
git show HEAD:docs/foo.md > /tmp/m.md
diff <(prettier /tmp/m.md) <(prettier docs/foo.md)   # should show ONLY your added lines
```

**Version-drift caveat:** local prettier (e.g. 3.9.6, or even pinned 3.3.3 via pnpm) can disagree with CI's `npm install -g prettier@3.3.3` on how much of an old doc to rewrite — so the raw diff-line count is an unreliable pass/fail signal. The line-local delta comparison above is the robust check. CI installs: prettier@3.3.3, gersemi==0.21, shfmt v3.10.0, and a specific slang-binaries clang-format (≈17). `formatting.sh` needs bare `clang-format` on PATH (symlink `clang-format-17`), plus `gersemi`+`shfmt` or it aborts before even checking one `--` file.
