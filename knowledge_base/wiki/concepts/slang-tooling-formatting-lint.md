---
title: "Formatting & Lint Tooling (clang-format, prettier, gersemi)"
type: concept
group: slang-tooling
tags: [clang-format, prettier, gersemi, formatting, lint, ci, draft-pr, check-formatting]
source_count: 14
---

# Formatting & Lint Tooling (clang-format, prettier, gersemi)

This page covers how Slang's `extras/formatting.sh` works, what CI pins for each tool, and the traps that cause wasted CI round-trips on formatting failures.

## formatting.sh: tool requirements and invocation

`extras/formatting.sh` runs clang-format (C++), gersemi (CMake), prettier (YAML/JSON/MD), and shfmt (shell). Key behaviors:

- **`--no-args` prints USAGE and exits** — always specify at minimum `--modified` (changed from HEAD) and the file-type scope flag (`--cpp`, `--md`, etc.).
- **ABORTS EARLY if any required tool is missing**, even in `--check-only` mode — so a bare `--modified` exits before reaching prettier if clang-format/gersemi/shfmt are absent, leaving markdown unchecked. Scope explicitly to the file types whose tools you actually have.
- Tool versions CI pins: clang-format **17.x** (`[17, 18)` range); gersemi `0.21-0.22`; prettier `3+`; shfmt `3+`.
- `.slang` files are NOT formatted by any tool in `formatting.sh` — only `.cpp/.h/.cmake/.sh/.md/.yaml/.json`.

This extends to `.meta.slang`: running `clang-format -i` on one is **destructive** — `.meta.slang` is Slang source, not C++, and `extras/formatting.sh` never runs clang-format on it, so `clang-format -i --style=file source/slang/hlsl.meta.slang` reformatted the entire 43k-line file (~22877 ins / ~21003 del, a massive spurious diff). Only ever point clang-format at `.cpp`/`.h`; hand-edit `.meta.slang` comment changes and recover a botched run with `git checkout HEAD -- <file>`. A companion pitfall: `extras/formatting.sh` needs clang-format literally on `$PATH` **inline in the SAME bash call**, since the shell env resets between separate Bash tool invocations — run `PATH="$HOME/.local/bin:$PATH" ./extras/formatting.sh --cpp -- <file>` rather than relying on an `export` from a prior call, and reinstall the pip wheel each fresh session (`pip install clang-format==17.0.6 --break-system-packages`; binary lands at `~/.local/lib/python3.11/site-packages/clang_format/data/bin/clang-format`) ([clang-format via pip wheel: never point it at .meta.slang; PATH must be inline in the same bash call](../learnings/1784332011128-clang-format-via-pip-wheel-never-point-it-at-meta-.md)).

([Slang formatting.sh requires clang-format 17.x exactly](../learnings/1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md), [Slang CI pins clang-format 17; never prettier-write docs/design/*.md](../learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md))

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

Fetch PR-head files via `gh api repos/<o>/<r>/contents/<path>?ref=<headRef> --jq .content | base64 -d` when `git fetch` of the PR ref is blocked. ([Slang formatting.sh requires clang-format 17.x exactly](../learnings/1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md), [Slang CI pins clang-format 17; never prettier-write docs/design/*.md](../learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md), [clang-format-17 via pip --target needs PYTHONPATH set to run](../learnings/1782156721731-clang-format-17-via-pip-target-needs-pythonpath-se.md))

## Running the CI-pinned binary when the build is disk-blocked

When the local Slang build is disk-blocked, pull the pinned clang-format binary directly from slang-binaries:

```bash
curl -fsSL "https://github.com/shader-slang/slang-binaries/raw/<SHA>/clang-format/x86_64-linux/bin/clang-format" -o /tmp/cf
chmod +x /tmp/cf
/tmp/cf --version        # confirm 17.0.6
/tmp/cf -i source/slang/<your-file>.cpp   # run from repo root to read .clang-format
git diff
```

Get the exact `<SHA>` from a failed `check-formatting` CI job log (it prints the download URL). As of 2026-06: SHA `306d22efc0f5f72c7230b0b6b7c99f03c46995bd`, version 17.0.6. ([Run CI-pinned clang-format locally when the build is disk-blocked](../learnings/1782507462588-run-ci-pinned-clang-format-locally-when-the-build-.md))

## --since HEAD is a false-pass for uncommitted changes

`./extras/formatting.sh --check-only --cpp --since HEAD` returns EXIT=0 when your edits are still **uncommitted** — `--since <rev>` only formats files changed in commits AFTER `<rev>`, so with no new commits it sees zero changed files. CI's `check-formatting` runs the full `./extras/formatting.sh --check-only` (no `--since`).

Rule: before any push, run `./extras/formatting.sh --check-only` (or at minimum `--check-only --cpp` WITHOUT `--since`) to validate uncommitted work. ([formatting.sh --since HEAD is a false-pass for uncommitted changes; run the full --check-only pre-push](../learnings/1782456154502-formatting-sh-since-head-is-a-false-pass-for-uncom.md))

## Draft PRs: ci.yml is workflow_dispatch-able, check-formatting is NOT

shader-slang/slang gates auto (`pull_request`) CI on `draft != true`, so a DRAFT PR shows every check as "skipping". However:

- **`ci.yml` (functional CI) CAN run on a draft** via `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` — `workflow_dispatch` is NOT subject to the `draft != true` filter. Verify with `gh run view <id> --json jobs`.
- **`check-formatting.yml` CANNOT run on a draft** — it is `pull_request`-only with `draft != true` and has NO `workflow_dispatch` trigger. Formatting must be verified locally against CI's pinned clang-format 17.

Local C++-only format check for drafts (independent of gersemi/shfmt absence):
```bash
clang-format --dry-run --Werror <changed_file.cpp>   # empty output + rc 0 = clean
```

Do not trust the script's overall exit code when gersemi/shfmt are absent — isolate with the per-file dry-run. ([Draft PRs: ci.yml IS workflow_dispatch-able, but check-formatting.yml is NOT — verify format locally with clang-format 17](../learnings/1782440063963-draft-prs-ci-yml-is-workflow-dispatch-able-but-che.md), [Draft PR CI on shader-slang/slang: workflow_dispatch bypasses the draft filter (but check-formatting can't)](../learnings/1782440084006-draft-pr-ci-on-shader-slang-slang-workflow-dispatc.md))

## prettier: never --write docs/design/*.md or any repo markdown

The committed design docs use **setext headings** (`Title\n=====`) and **`*emphasis*`** (asterisks). The project's pinned prettier PRESERVES that style. A locally-installed prettier (e.g. 3.8.3) defaults to converting setext→ATX (`# Title`) and `*x*`→`_x_`. Running `prettier --write` on any repo markdown introduces massive unrelated churn.

For targeted docs edits:
1. Match the existing file's style (check neighbors — use `*emphasis*` asterisks).
2. Prove **format-neutrality** vs baseline: `prettier <orig> > /tmp/orig-norm; prettier <edited> > /tmp/edited-norm; diff /tmp/orig-norm /tmp/edited-norm`. The diff should show ONLY your intended semantic lines.
3. The local prettier binary lives at `/pnpm/prettier` (not resolvable via `npx --no-install`).

If `origin/master`'s version of a file already fails your local prettier check, the divergence is the tool version, not your edit — never `--write` the whole file. ([Editing a docs .md whose baseline already fails local prettier: verify format-neutrality, don't run --write](../learnings/1780345737111-editing-a-docs-md-whose-baseline-already-fails-loc.md), [Slang CI pins clang-format 17; never prettier-write docs/design/*.md](../learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md))

## Public Headers Must Be ASCII-Only (MSVC C4819); Sweep prelude/ Too

Every file under `include/` must be pure ASCII: MSVC emits **warning C4819** ("character cannot be represented in the current code page") when a consumer compiles an ASCII TU that just `#include`s the header under a non-UTF-8 source charset (`/source-charset:.932`), and under `/WX` that becomes error C2220 — so non-ASCII bytes in doc comments silently break downstream `/WX` builds on CP932/Shift-JIS locales (#12016: 3 U+2014 em-dashes in `include/slang.h`, regressed twice including once via the bot's own PR). Detection without Windows: `grep -rP '[^\x00-\x7F]'` must return empty; C4819 itself needs Windows+MSVC+CP932 to observe, so don't label `reproduced` from Linux. Fix by replacing with the file's own ASCII convention (in slang.h, a spaced ` - ` hyphen). **Two extensions from the shipped #12016 fix:** (1) sweep `prelude/` too, not just `include/` — the shipped preludes install into `include/` and trigger the same C4819 (the fix ended up 3 files incl. `slang-cuda-prelude.h` with em-dashes AND U+2192 `→` arrows — watch for arrows and other Unicode punctuation, not only em-dashes; canonical sweep `grep -rP '[^\x00-\x7F]' include/ prelude/`); (2) scope-widen when the reporter asks to "review all public headers." The Approach-B CI/lint guard (reject non-ASCII in shipped headers) is scoped to `.github/workflows/**` and thus policy-rejected for coworker bots — flag it for maintainer ownership rather than building it ([slang public headers must be ASCII-only (MSVC C4819 under non-UTF-8 charset)](../learnings/1783579004581-slang-public-headers-must-be-ascii-only-msvc-c4819.md), [slang non-ASCII header sweep must include prelude/ and watch arrows — #12016 SHIPPED](../learnings/1783596951560-slang-non-ascii-header-sweep-must-include-prelude-.md)).

## clang -Wformat-security Rejects Argless printf(fmt) — Linux gcc Won't Catch It

A `printf`-family call with a **non-literal** format string and **zero** variadic args (e.g. `reportError("literal\n")` where `reportError(fmt,args...)` forwards to `printf`) is a hard error under clang `-Werror -Wformat-security` — but **gcc/Linux does NOT enforce it**, so a Linux-only local build is green while the macOS/clang CI build fails (Slang examples build `-Werror` on all platforms). Even a compile-time-constant literal passed through a variadic wrapper counts as non-literal at the `printf(fmt)` call site (the wrapper's `fmt` param is a runtime `const char*`). Fix: route through `"%s"` (`reportError("%s", "error: ...\n")`). Verify limitation: a Linux/gcc-only in-container build is structurally blind to clang-only `-Werror` flags (`-Wformat-security`, `-Wreturn-local-addr`), so grep the diff for argless wrapper-`printf` calls even when Linux CI is green — the macOS `build-macos-*-clang-aarch64` job is the real gate (#12009 lost a CI round-trip to exactly this) ([clang -Wformat-security rejects argless printf(fmt) — Linux gcc verify won't catch it](../learnings/1783560312328-clang-wformat-security-rejects-argless-printf-fmt-.md)).

## Contradictions / supersessions

None found. The two "draft PR CI" learnings are complementary (one adds the workflow_dispatch clarification; both are consistent).

## slang-rhi lint gates differ from the slang compiler

When editing **shader-slang/slang-rhi** (not the compiler), its pre-commit/CI gates differ from slang's: **clang-format v20** (not slang's version), an ASCII-only hook, and `-Werror`. Verify against these, not slang's toolchain ([1783022365578-slang-rhi-formatting-lint-gates-differ](../learnings/1783022365578-slang-rhi-formatting-lint-gates-differ-from-the-sl.md)).


## Recent operational learnings (incremental fold 2026-07-17)

**Never run prettier (formatting.sh --md) on the generated capability-atoms doc** — **Context:** slang#12097 — editing a capdef `///` doc comment regenerates `docs/user-guide/a4-02-reference-capability-atoms.md` via `slang-capability-generator`. [Never run prettier (formatting.sh --md) on the generated capability-atoms doc](../learnings/1784101129985-never-run-prettier-formatting-sh-md-on-the-generat.md)

---
**Source learnings (14):**
- [Slang formatting.sh requires clang-format 17.x exactly](../learnings/1778742529214-slang-formatting-sh-requires-clang-format-17-x-exa.md)
- [Editing a docs .md whose baseline already fails local prettier: verify format-neutrality, don't run --write](../learnings/1780345737111-editing-a-docs-md-whose-baseline-already-fails-loc.md)
- [Slang CI pins clang-format 17; never prettier-write docs/design/*.md](../learnings/1780938587077-slang-ci-pins-clang-format-17-never-prettier-write.md)
- [clang-format-17 via pip --target needs PYTHONPATH set to run](../learnings/1782156721731-clang-format-17-via-pip-target-needs-pythonpath-se.md)
- [Draft PRs: ci.yml IS workflow_dispatch-able, but check-formatting.yml is NOT](../learnings/1782440063963-draft-prs-ci-yml-is-workflow-dispatch-able-but-che.md)
- [Draft PR CI on shader-slang/slang: workflow_dispatch bypasses the draft filter (but check-formatting can't)](../learnings/1782440084006-draft-pr-ci-on-shader-slang-slang-workflow-dispatc.md)
- [formatting.sh --since HEAD is a false-pass for uncommitted changes; run the full --check-only pre-push](../learnings/1782456154502-formatting-sh-since-head-is-a-false-pass-for-uncom.md)
- [Run CI-pinned clang-format locally when the build is disk-blocked](../learnings/1782507462588-run-ci-pinned-clang-format-locally-when-the-build-.md)
- [slang-rhi formatting/lint gates differ from slang (clang-format v20, ASCII hook, -Werror)](../learnings/1783022365578-slang-rhi-formatting-lint-gates-differ-from-the-sl.md)
- [slang public headers must be ASCII-only (MSVC C4819 under non-UTF-8 charset)](../learnings/1783579004581-slang-public-headers-must-be-ascii-only-msvc-c4819.md)
- [slang non-ASCII header sweep must include prelude/ and watch arrows — #12016 SHIPPED](../learnings/1783596951560-slang-non-ascii-header-sweep-must-include-prelude-.md)
- [clang -Wformat-security rejects argless printf(fmt) — Linux gcc verify won't catch it](../learnings/1783560312328-clang-wformat-security-rejects-argless-printf-fmt-.md)
- [Never run prettier (formatting.sh --md) on the generated capability-atoms doc](../learnings/1784101129985-never-run-prettier-formatting-sh-md-on-the-generat.md)
- [clang-format via pip wheel: never point it at .meta.slang (destructive); PATH must be inline in the same bash call](../learnings/1784332011128-clang-format-via-pip-wheel-never-point-it-at-meta-.md)
_Catalog: [[wiki/index.md]]_
