---
title: "Formatting & Lint Tooling (clang-format, prettier, gersemi)"
type: concept
group: slang-tooling
tags: [clang-format, prettier, gersemi, formatting, lint, ci, draft-pr, check-formatting]
source_count: 8
---

# Formatting & Lint Tooling (clang-format, prettier, gersemi)

This page covers how Slang's `extras/formatting.sh` works, what CI pins for each tool, and the traps that cause wasted CI round-trips on formatting failures.

## formatting.sh: tool requirements and invocation

`extras/formatting.sh` runs clang-format (C++), gersemi (CMake), prettier (YAML/JSON/MD), and shfmt (shell). Key behaviors:

- **`--no-args` prints USAGE and exits** — always specify at minimum `--modified` (changed from HEAD) and the file-type scope flag (`--cpp`, `--md`, etc.).
- **ABORTS EARLY if any required tool is missing**, even in `--check-only` mode — so a bare `--modified` exits before reaching prettier if clang-format/gersemi/shfmt are absent, leaving markdown unchecked. Scope explicitly to the file types whose tools you actually have.
- Tool versions CI pins: clang-format **17.x** (`[17, 18)` range); gersemi `0.21-0.22`; prettier `3+`; shfmt `3+`.
- `.slang` files are NOT formatted by any tool in `formatting.sh` — only `.cpp/.h/.cmake/.sh/.md/.yaml/.json`.

([[wiki/learnings/1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md]], [[wiki/learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md]])

## clang-format 17: installation, PATH, and PYTHONPATH

CI pins clang-format version **17.0.6** (range `[17,18)`). clang-format 18 makes different line-wrapping decisions on borderline (~99-char) lines, and the apt-installed version on Debian 12 is too old.

Install via pip:
```bash
pip install --user --break-system-packages clang-format==17.0.6
# or, to an isolated target dir:
pip install --quiet --target ~/.cf17 clang-format==17.0.6
```

After a `--user` install, the binary lands in `~/.local/bin` — NOT on PATH by default. Export before running formatting.sh:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

When installed with `--target DIR`, the `bin/clang-format` shim is a Python launcher that requires `PYTHONPATH=DIR` — without it, every invocation throws a Traceback:
```bash
PYTHONPATH=~/.cf17 ~/.cf17/bin/clang-format --version   # → 17.0.6
```

To verify a file is clean against the repo `.clang-format`:
```bash
diff -q <file> <(clang-format --style=file <file>)
# or idempotency check:
PYTHONPATH=~/.cf17 ~/.cf17/bin/clang-format --style=file <file> | diff <file> -
```

Fetch PR-head files via `gh api repos/<o>/<r>/contents/<path>?ref=<headRef> --jq .content | base64 -d` when `git fetch` of the PR ref is blocked. ([[wiki/learnings/1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md]], [[wiki/learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md]], [[wiki/learnings/1782156721731-clang-format-17-via-pip-target-needs-pythonpath-se.md]])

## Running the CI-pinned binary when the build is disk-blocked

When the local Slang build is disk-blocked, pull the pinned clang-format binary directly from slang-binaries:

```bash
curl -fsSL "https://github.com/shader-slang/slang-binaries/raw/<SHA>/clang-format/x86_64-linux/bin/clang-format" -o /tmp/cf
chmod +x /tmp/cf
/tmp/cf --version        # confirm 17.0.6
/tmp/cf -i source/slang/<your-file>.cpp   # run from repo root to read .clang-format
git diff
```

Get the exact `<SHA>` from a failed `check-formatting` CI job log (it prints the download URL). As of 2026-06: SHA `306d22efc0f5f72c7230b0b6b7c99f03c46995bd`, version 17.0.6. ([[wiki/learnings/1782507462588-run-ci-pinned-clang-format-locally-when-the-build-.md]])

## --since HEAD is a false-pass for uncommitted changes

`./extras/formatting.sh --check-only --cpp --since HEAD` returns EXIT=0 when your edits are still **uncommitted** — `--since <rev>` only formats files changed in commits AFTER `<rev>`, so with no new commits it sees zero changed files. CI's `check-formatting` runs the full `./extras/formatting.sh --check-only` (no `--since`).

Rule: before any push, run `./extras/formatting.sh --check-only` (or at minimum `--check-only --cpp` WITHOUT `--since`) to validate uncommitted work. ([[wiki/learnings/1782456154502-formatting-sh-since-head-is-a-false-pass-for-uncom.md]])

## Draft PRs: ci.yml is workflow_dispatch-able, check-formatting is NOT

shader-slang/slang gates auto (`pull_request`) CI on `draft != true`, so a DRAFT PR shows every check as "skipping". However:

- **`ci.yml` (functional CI) CAN run on a draft** via `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` — `workflow_dispatch` is NOT subject to the `draft != true` filter. Verify with `gh run view <id> --json jobs`.
- **`check-formatting.yml` CANNOT run on a draft** — it is `pull_request`-only with `draft != true` and has NO `workflow_dispatch` trigger. Formatting must be verified locally against CI's pinned clang-format 17.

Local C++-only format check for drafts (independent of gersemi/shfmt absence):
```bash
clang-format --dry-run --Werror <changed_file.cpp>   # empty output + rc 0 = clean
```

Do not trust the script's overall exit code when gersemi/shfmt are absent — isolate with the per-file dry-run. ([[wiki/learnings/1782440063963-draft-prs-ci-yml-is-workflow-dispatch-able-but-che.md]], [[wiki/learnings/1782440084006-draft-pr-ci-on-shader-slang-slang-workflow-dispatc.md]])

## prettier: never --write docs/design/*.md or any repo markdown

The committed design docs use **setext headings** (`Title\n=====`) and **`*emphasis*`** (asterisks). The project's pinned prettier PRESERVES that style. A locally-installed prettier (e.g. 3.8.3) defaults to converting setext→ATX (`# Title`) and `*x*`→`_x_`. Running `prettier --write` on any repo markdown introduces massive unrelated churn.

For targeted docs edits:
1. Match the existing file's style (check neighbors — use `*emphasis*` asterisks).
2. Prove **format-neutrality** vs baseline: `prettier <orig> > /tmp/orig-norm; prettier <edited> > /tmp/edited-norm; diff /tmp/orig-norm /tmp/edited-norm`. The diff should show ONLY your intended semantic lines.
3. The local prettier binary lives at `/pnpm/prettier` (not resolvable via `npx --no-install`).

If `origin/master`'s version of a file already fails your local prettier check, the divergence is the tool version, not your edit — never `--write` the whole file. ([[wiki/learnings/1780345737111-editing-a-docs-md-whose-baseline-already-fails-loc.md]], [[wiki/learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md]])

## Contradictions / supersessions

None found. The two "draft PR CI" learnings are complementary (one adds the workflow_dispatch clarification; both are consistent).

---
**Source learnings (8):**
- [[wiki/learnings/1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md]] — Slang formatting.sh requires clang-format 17.x exactly
- [[wiki/learnings/1780345737111-editing-a-docs-md-whose-baseline-already-fails-loc.md]] — Editing a docs .md whose baseline already fails local prettier: verify format-neutrality, don't run --write
- [[wiki/learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md]] — Slang CI pins clang-format 17; never prettier-write docs/design/*.md
- [[wiki/learnings/1782156721731-clang-format-17-via-pip-target-needs-pythonpath-se.md]] — clang-format-17 via pip --target needs PYTHONPATH set to run
- [[wiki/learnings/1782440063963-draft-prs-ci-yml-is-workflow-dispatch-able-but-che.md]] — Draft PRs: ci.yml IS workflow_dispatch-able, but check-formatting.yml is NOT
- [[wiki/learnings/1782440084006-draft-pr-ci-on-shader-slang-slang-workflow-dispatc.md]] — Draft PR CI on shader-slang/slang: workflow_dispatch bypasses the draft filter (but check-formatting can't)
- [[wiki/learnings/1782456154502-formatting-sh-since-head-is-a-false-pass-for-uncom.md]] — formatting.sh --since HEAD is a false-pass for uncommitted changes; run the full --check-only pre-push
- [[wiki/learnings/1782507462588-run-ci-pinned-clang-format-locally-when-the-build-.md]] — Run CI-pinned clang-format locally when the build is disk-blocked
_Catalog: [[wiki/index.md]]_
