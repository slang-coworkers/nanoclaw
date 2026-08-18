---
title: "CORRECTION: formatting.sh type flags NARROW — --modified alone skips markdown, so pre-commit needs TWO commands"
type: learning
topic: review-process
source: learnings/1785939364103-correction-formatting-sh-type-flags-narrow-modifie.md
---

# CORRECTION: formatting.sh type flags NARROW — --modified alone skips markdown, so pre-commit needs TWO commands

**This corrects my earlier learning today** ("three different right flags for three preconditions"), which said `--modified` is *the* pre-commit form. That is incomplete in a way that silently skips files: **`--modified` alone never formats markdown.**

Two facts in `extras/formatting.sh` (verified at shader-slang/slang master, 2026-08-05):

1. **`:444` omits the `run_all ||` guard.** The dispatch block `:440-445` is six lines of `((run_all || run_X)) && X_formatting` — except `:444`, which is bare `((run_markdown)) && markdown_formatting`. A run with no type flag never dispatches markdown.
2. **Type flags narrow, they don't add.** `--md` sets `run_all=0` (`:83`; same for `--cpp` `:75`, etc.). So `--modified --md` formats markdown **INSTEAD of** C++ — not in addition.

Consequence: **no single invocation covers both.** The correct pre-commit sequence is two commands:

```
./extras/formatting.sh --modified        # C++, CMake, YAML/JSON, shell
./extras/formatting.sh --modified --md   # markdown
```

Measured with one malformed `.cpp` and one malformed `.md` both staged: `--modified` alone → `.md` untouched, exit 0. `--modified --md` → only `Formatting markdown files...` printed, `.cpp` left as `int  main( ){return 0;}`, exit 0. Both commands in sequence → both reformatted, and re-checking each with `--check-only` exits 0.

The **post-commit** variant `--source .` (CI-repair on an already-committed failure) has the **same** markdown gap — it also needs `--source . --md` as a second command.

**Do NOT "just add `run_all ||`" as a drive-by.** At current master, `--md --check-only` flags four tracked files (`CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `REVIEW.md`), so the one-word fix turns the formatting gate red on files you never touched. It needs its own PR with that reformat. Evidence the omission is a bug rather than a decision: `:204` already includes `run_markdown` in prettier's `require_bin` check, so the script installs a tool for a formatter a whole-tree run can't reach.

**Two measurement traps that cost me real time here:**
- **CI pins `prettier@3.3.3`** (`.github/actions/format-setup/action.yml:32`), not "3+". `CLAUDE.md` needed 4 blank-line hunks under my local 3.9.5 but **5** under the pin. Measure with the pinned version or your neutrality claim is about a different tool.
- **A missing formatter kills the run BEFORE dispatch.** `require_bin` (`:199-207`) exits 1, so a partial toolchain makes your experiment measure the tool check, not the flag you're testing — and it looks like a finding. Worse: `wget` of the shfmt release can write a **0-byte** file while `install` still returns 0, so `shfmt --version` prints empty and the gate fires. Use `curl -sSL --fail` + `[ -s file ]`; the repo's own CI action does exactly this `file`-based emptiness check.

Docs fixed in slang#12358 (draft) — `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785939364103-correction-formatting-sh-type-flags-narrow-modifie.md`_
