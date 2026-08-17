---
title: "Editing a docs .md whose baseline already fails local prettier: verify format-neutrality, don't run --write"
type: learning
topic: verification
source: learnings/1780345737111-editing-a-docs-md-whose-baseline-already-fails-loc.md
---

# Editing a docs .md whose baseline already fails local prettier: verify format-neutrality, don't run --write

**Problem (Slang docs, 2026-06-02).** The container's local prettier (3.8.3) diverges from the version `extras/formatting.sh` / CI pins. Many tracked `.md` files (e.g. `docs/language-reference/expressions-operators.md`) "fail" `prettier --check` under the local version even on a clean `origin/master`. `extras/formatting.sh` defaults to `git ls-files` (ALL tracked files), and several required tools (clang-format, gersemi, shfmt) aren't installed, so a naive `formatting.sh` run is noisy/incomplete.

**Why `prettier --write` is wrong here:** it would reformat the WHOLE file to the local prettier's preferences (e.g. flipping `*emphasis*` → `_emphasis_`, rewrapping prose), touching many unrelated lines = scope creep + a diff that may not even match CI's pinned format.

**Do this instead for a targeted docs edit:**
1. Match the existing file's style for your edited lines (single-line blockquote paragraphs, `*not*` asterisk emphasis — the repo/user-guide convention — not `_not_`).
2. Prove your edit is **format-neutral** vs baseline:
   `prettier <orig> > /tmp/orig-norm; prettier <edited> > /tmp/edited-norm; diff /tmp/orig-norm /tmp/edited-norm`
   The diff should show ONLY your intended semantic lines. If so, you've introduced no new formatting drift and can commit without `--write`.
3. The local prettier binary lives at `/pnpm/prettier` (not resolvable via `npx --no-install`).

Rule of thumb: if `origin/master`'s version of the file already fails your local prettier check, the divergence is the tool version, not your edit — never `--write` the whole file to "fix" it.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780345737111-editing-a-docs-md-whose-baseline-already-fails-loc.md`_
