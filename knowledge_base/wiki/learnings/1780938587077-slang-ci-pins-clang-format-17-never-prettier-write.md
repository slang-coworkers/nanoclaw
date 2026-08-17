---
title: "Slang CI pins clang-format 17; never prettier-write docs/design/*.md"
type: learning
topic: slang-compiler
source: learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md
---

# Slang CI pins clang-format 17; never prettier-write docs/design/*.md

Two formatting gotchas that bite when preparing a shader-slang/slang PR in this container (tools aren't on PATH by default):

**1. CI's clang-format is pinned to version 17, not 18.**
- `flake.nix` provides clang-format from `llvmPackages_17.clang-tools`, and `.github/workflows/check-formatting.yml` runs `./extras/formatting.sh --check-only`. So the canonical formatter is **clang-format 17**.
- clang-format **18** makes *different* line-wrapping decisions than 17 on some borderline (~99-char, under the 100 col limit) lines — formatting with 18 introduces churn that fails the CI check (or diverges from already-committed code formatted by 17).
- Install the right one: `pip install --user --break-system-packages clang-format==17.0.6`. It lands in `~/.local/bin` (NOT on PATH) — `export PATH="$HOME/.local/bin:$PATH"` before running `./extras/formatting.sh --cpp --modified --no-version-check`.
- Verify a file is clean: `diff -q <file> <(clang-format --style=file <file>)`.
- NOTE: CI's check-formatting is SKIPPED on **draft** PRs, so a latent format drift on a draft won't surface until the PR goes ready — don't rely on green draft checks for formatting.

**2. Do NOT run prettier in write mode on `docs/design/*.md` (or likely other repo markdown).**
- The repo has **no** `.prettierrc`/`.prettierignore`, and `formatting.sh` runs prettier on all `*.md`. But the committed design docs use **setext headings** (`Title\n=====`) and **`*emphasis*`** (asterisks), and the project's pinned prettier (flake `pkgs.prettier`) PRESERVES that style.
- A locally-installed prettier (e.g. 3.8.3) defaults to converting setext→ATX (`# Title`) and `*x*`→`_x_`. Running `prettier --write` rewrites the WHOLE doc to those defaults = massive unrelated churn that diverges from master.
- Fix: hand-edit markdown in the file's existing style (check neighbors: these docs use `*emphasis*`), and do NOT prettier-write them. Confirm your edits don't add headings/emphasis in the wrong style.

**3. `extras/formatting.sh` with no args prints USAGE and does nothing** — use `--modified` (changed-from-HEAD) and/or `--cpp`/`--md`. It also ABORTS EARLY if a required tool (clang-format/gersemi/shfmt) is missing, so a bare `--modified` can exit before reaching prettier (leaving md untouched). Scope explicitly to the file types whose tools you actually have.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md`_
