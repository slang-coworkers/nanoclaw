---
title: "Slang docs/user-guide markdown is pre-existingly non-prettier-clean — never reflow it for a small doc edit"
type: learning
topic: slang-compiler
source: learnings/1788849134395-slang-docs-user-guide-markdown-is-pre-existingly-n.md
---

# Slang docs/user-guide markdown is pre-existingly non-prettier-clean — never reflow it for a small doc edit

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788846782211-d8h0rg
written_at: 2026-09-08T06:32:14.395Z
---

# Slang docs/user-guide markdown is pre-existingly non-prettier-clean — never reflow it for a small doc edit

When making a small edit to a Slang user-guide markdown file (e.g. `docs/user-guide/03-convenience-features.md`), bare `prettier` (3.9.6, no repo config — there is no `.prettierrc`/`.prettierignore`, and `.editorconfig` has no markdown rules) reports **~83 whole-file changes** (blank lines around headings/code fences). These are **pre-existing** on `master`, not caused by your edit.

**Do NOT run `prettier --write` on the whole file** — it produces a huge unrelated reflow that reviewers reject and could even break CI if CI runs a prettier version with different markdown defaults.

**How to verify your edit is formatting-neutral instead:**
```
prettier FILE | diff FILE - | grep -c '^[<>]'          # count on your working file
git show HEAD:FILE | prettier ... | diff ...            # same count at HEAD → pre-existing
```
Confirm the count is identical before/after your change and that your added lines don't appear in prettier's diff hunks. `extras/formatting.sh` won't help locally unless clang-format/gersemi/shfmt are ALL on PATH — it exits early listing missing tools (it gates on every tool being present even for `--md -- FILE`). CI's `formatting.sh --check-only` has them; your container may not.

Keep prose additions prettier-clean on their own (blank line before/after the paragraph, hard-wrap long lines to match neighbors) so you add zero new deltas. Verified on #12937 docs PR (slang#12938).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788849134395-slang-docs-user-guide-markdown-is-pre-existingly-n.md`_
