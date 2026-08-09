---
title: "Formatting & Lint Tooling (clang-format, prettier, gersemi)"
type: concept
group: slang-tooling
tags: [clang-format, prettier, gersemi, formatting, lint, ci, draft-pr, check-formatting]
source_count: 20
---

# Formatting & Lint Tooling (clang-format, prettier, gersemi)

This page covers how Slang's `extras/formatting.sh` works, what CI pins for each tool, and the traps that cause wasted CI round-trips on formatting failures.

## TL;DR

- **Verify a tool version against the script that gates it, never against the tool's own `--version` or a README range.** `extras/formatting.sh:203` calls `require_bin "clang-format" "17" "18"` — that is `[17, 18)`, **exclusive** upper bound, so **18.x is REJECTED as too new**. The repo's own prose ("clang-format 17-18") reads inclusive and is looser than the check.
- **Pin clang-format 17.0.6.** The PyPI default is 18.1.8, which the script rejects. gersemi `0.21-0.22`, prettier `3+`, shfmt `3+`.
- **`formatting.sh` with no args prints USAGE and exits** — always pass at minimum `--modified` plus the file-type scope flag (`--cpp`, `--md`, …).
- **A bare `--modified` ABORTS EARLY if any required tool is missing, even under `--check-only`** — it never reaches prettier when clang-format/gersemi/shfmt are absent, leaving markdown unchecked. Scope explicitly to the file types whose tools you have.
- **Type flags NARROW the run, not just its output:** `--modified --cpp` skips the gersemi/shfmt *requirement* checks, so a C++-only change formats cleanly with those tools absent. Never conclude "formatting is impossible here" from an unrelated missing tool.
- **`--cpp` with clang-format absent from `$PATH` prints "Formatting cpp files..." and exits 0 without formatting anything** — a silent false-clean, distinct from the early abort. Confirm the binary exists (`which clang-format`) before trusting a pass, especially after a container restart drops an ephemeral pip install.
- **`--since HEAD` is a false-pass for uncommitted work** — `--since <rev>` only formats files changed in commits AFTER `<rev>`, so with no new commits it sees zero files and exits 0. Run the full `./extras/formatting.sh --check-only` (no `--since`) before any push; CI runs it without `--since`.
- **`--modified` covers only git-TRACKED files** — a brand-new untracked source file is silently skipped at exit 0. Run `clang-format -i <newfile>` directly, or `git add -N` first. Likewise `--modified` finds nothing once you have committed; format a committed file by pointing clang-format at it.
- **Never point clang-format at a `.meta.slang` file — it is destructive.** `.meta.slang` is Slang source, not C++, and `formatting.sh` never formats it; one `clang-format -i` reformatted the whole 43k-line `hlsl.meta.slang` (~22877 ins / ~21003 del). Hand-edit those comments; recover with `git checkout HEAD -- <file>`.
- **`.slang` files are not formatted by any tool in `formatting.sh`** — only `.cpp/.h/.cmake/.sh/.md/.yaml/.json`.
- **`export PATH=` does not survive between separate Bash tool calls** — prefix inline in the SAME call: `PATH="$HOME/.local/bin:$PATH" ./extras/formatting.sh --cpp -- <file>`.
- **"clang-format is missing here, so the author must run formatting.sh" is an unnecessary punt.** The PyPI wheel ships a real prebuilt native binary under `clang_format/data/bin/`, so EXTRACTING the wheel is enough — no `pip install` (which can hit `externally-managed-environment`), no apt, no admin approval, ~10 seconds: `pip download clang-format==17.0.6 -d /tmp/cf17 --no-deps`, then `python3 -m zipfile -e`, `chmod +x`, prepend to `PATH`.
- **A `pip install --user` binary lands in `~/.local/bin`, off PATH by default; a `pip install --target DIR` shim is a Python launcher that needs `PYTHONPATH=DIR`** or every invocation throws a Traceback.
- **If your change touches `.cpp`/`.h`, run the formatter yourself** rather than delegating it in the PR body.
- **Only C++ clang-format is truly enforced; markdown conformance is effectively unenforced.** `check-formatting.yml` runs on the whole tree yet stays green on master for docs that fail local prettier — proven by merged PRs that added to them.
- **Never `prettier --write` repo markdown.** The design docs and user-guide docs use setext headings (`Title\n=====`), `*` bullets, and `*emphasis*`; a local prettier (3.8.x/3.9.x) rewrites all three to ATX `#`, `-`, and `_emphasis_` — 50-130 lines of churn per file. Even the CI-pinned prettier@3.3.3 flags them.
- **If `origin/master`'s version of a file already fails your local prettier, the divergence is the tool version, not your edit.** Match the file's existing conventions by eye and trust merged-PR precedent over any local checker.
- **Prove format-neutrality instead of rewriting:** `prettier <orig> > /tmp/a; prettier <edited> > /tmp/b; diff /tmp/a /tmp/b` should show only your intended semantic lines. The local prettier binary lives at `/pnpm/prettier` (not resolvable via `npx --no-install`).
- **Never run prettier / `formatting.sh --md` on the generated capability-atoms doc** — it is regenerated by `slang-capability-generator` from a capdef `///` comment.
- **A DRAFT PR can run functional CI but not the format check.** `workflow_dispatch` is not subject to the `draft != true` filter, so `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` works; `check-formatting.yml` is `pull_request`-only with no `workflow_dispatch`, so formatting must be verified locally. Isolate with `clang-format --dry-run --Werror <file.cpp>` (empty output + rc 0 = clean) rather than trusting the script's overall exit code.
- **Every file under `include/` AND `prelude/` must be pure ASCII.** MSVC emits C4819 when a consumer compiles under a non-UTF-8 source charset, and `/WX` turns that into error C2220 — so a doc-comment em-dash breaks downstream CP932 builds. Sweep with `grep -rP '[^\x00-\x7F]' include/ prelude/`; watch arrows (U+2192) and other Unicode punctuation, not just em-dashes. C4819 needs Windows+MSVC+CP932 to observe, so do not label it `reproduced` from Linux.
- **`reuse lint` does not recurse into git submodules**, so statically-linked deps under `external/` (cmark BSD-2, lz4 BSD-2, glslang BSD-3) fall outside Slang's annotation and their binary-redistribution notices reach neither `LICENSES/` nor the shipped artifact.
- **Dropping bare `LICENSES/BSD-*.txt` into a REUSE repo turns `reuse lint` RED** — spec 3.3 forbids a license text no *tracked* file references, and the CI checkout uses no `submodules:` key so a submodule's own SPDX tag cannot be that reference. Correct pattern: install each dep's OWN notice file via the CMake install `metadata` component; only add SPDX text to `LICENSES/` if you also annotate a real tracked carrier.
- **clang `-Werror -Wformat-security` rejects an argless `printf(fmt)` and gcc/Linux does NOT** — so a Linux-only local build is green while the macOS/clang CI build fails. Even a compile-time literal forwarded through a variadic wrapper counts as non-literal at the call site; route through `"%s"`. Grep the diff for argless wrapper-`printf` calls even when Linux CI is green.
- **shader-slang/slang-rhi's gates are NOT slang's:** clang-format **v20**, an ASCII-only hook, and `-Werror`. Verify against the repo you are editing.

## formatting.sh: tool requirements and invocation

`extras/formatting.sh` runs clang-format (C++), gersemi (CMake), prettier (YAML/JSON/MD), and shfmt (shell). Key behaviors:

- **`--no-args` prints USAGE and exits** — always specify at minimum `--modified` (changed from HEAD) and the file-type scope flag (`--cpp`, `--md`, etc.).
- **ABORTS EARLY if any required tool is missing**, even in `--check-only` mode — so a bare `--modified` exits before reaching prettier if clang-format/gersemi/shfmt are absent, leaving markdown unchecked. Scope explicitly to the file types whose tools you actually have.
- Tool versions CI pins: clang-format **17.x** — `extras/formatting.sh:203` calls `require_bin "clang-format" "17" "18"`, and that range is **`[17, 18)`, exclusive upper bound**, so **18.x is REJECTED as too new**, not accepted as in-window. gersemi `0.21-0.22`; prettier `3+`; shfmt `3+`.
- **The repo's own prose is looser than the check.** `.github/copilot-instructions.md` says "clang-format 17-18", which reads as inclusive; `require_bin`'s bound is not. With 18.1.8 on PATH the script fails with `found clang-format 18.1.8, required [17, 18)` / `version 18.1.8 is too new. Version less than 18 is required.` and `FMT_EXIT=1`. ⇒ **Verify a tool version against the script that gates it, never against the tool's own `--version` or a README range** — run the real consumer once and read its exit code ([CORRECTION: formatting.sh needs 17.x; 18.x is rejected as too new](../learnings/1785992812883-correction-slang-formatting-sh-needs-clang-format-.md)).
- **`--modified` only covers git-TRACKED files.** A brand-new untracked source file is silently skipped — no error, exit 0, which reads as "formatted." Run `clang-format -i <newfile>` directly, or `git add -N` first.
- **Type flags NARROW the run**, they don't just filter output: `--modified --cpp` skips the gersemi/shfmt *requirement* checks for tools you don't need, so a C++-only change formats cleanly with gersemi and shfmt absent. Never conclude "formatting is impossible here" from an unrelated missing tool.
- `.slang` files are NOT formatted by any tool in `formatting.sh` — only `.cpp/.h/.cmake/.sh/.md/.yaml/.json`.

This extends to `.meta.slang`: running `clang-format -i` on one is **destructive** — `.meta.slang` is Slang source, not C++, and `extras/formatting.sh` never runs clang-format on it, so `clang-format -i --style=file source/slang/hlsl.meta.slang` reformatted the entire 43k-line file (~22877 ins / ~21003 del, a massive spurious diff). Only ever point clang-format at `.cpp`/`.h`; hand-edit `.meta.slang` comment changes and recover a botched run with `git checkout HEAD -- <file>`. A companion pitfall: `extras/formatting.sh` needs clang-format literally on `$PATH` **inline in the SAME bash call**, since the shell env resets between separate Bash tool invocations — run `PATH="$HOME/.local/bin:$PATH" ./extras/formatting.sh --cpp -- <file>` rather than relying on an `export` from a prior call, and reinstall the pip wheel each fresh session (`pip install clang-format==17.0.6 --break-system-packages`; binary lands at `~/.local/lib/python3.11/site-packages/clang_format/data/bin/clang-format`) ([clang-format via pip wheel: never point it at .meta.slang; PATH must be inline in the same bash call](../learnings/1784332011128-clang-format-via-pip-wheel-never-point-it-at-meta-.md)).

A sharper trap on the scoped `--cpp` path: when clang-format is absent from `$PATH`, `./extras/formatting.sh --cpp` prints "Formatting cpp files..." and **exits 0 without formatting anything** — a silent false-clean, not the early-abort described above — so a `--cpp` run that "passed" earlier can be a no-op after a container restart drops the ephemeral pip install. Before trusting it, confirm the binary exists (`which clang-format` or `~/.local/bin/clang-format --version`); note also that `--modified` finds nothing once you have committed, so a committed file must be formatted by running clang-format on it directly ([extras/formatting.sh --cpp silently no-ops (exit 0) when clang-format is absent from PATH](../learnings/1784826314203-formatting-sh-silently-no-ops-when-clang-format-is.md)).

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

### Wheel extraction: clang-format 17.0.6 with no apt and no admin approval

clang-format is frequently **absent** in coworker containers, and that absence has repeatedly been handed downstream as "formatting.sh CANNOT run here ⇒ the PR author must run it." **That punt is unnecessary.** The PyPI wheel ships a real prebuilt native binary under `clang_format/data/bin/`, so *extracting* the wheel is sufficient — no `pip install` (which can hit `externally-managed-environment`), no `apt`, no `install_packages`, no admin approval, ~10 seconds:

```bash
pip download clang-format==17.0.6 -d /tmp/cf17 --no-deps -q
cd /tmp/cf17 && python3 -m zipfile -e clang_format-17.0.6-*.whl /workspace/agent/tools-cf17/
chmod +x /workspace/agent/tools-cf17/clang_format/data/bin/clang-format
export PATH="/workspace/agent/tools-cf17/clang_format/data/bin:$PATH"
./extras/formatting.sh --modified --cpp   # → found clang-format 17.0.6, required [17, 18) ✓ exit 0
```

**Pin 17.0.6, not the pip default.** The default `clang-format` on PyPI is 18.1.8, which the script rejects (see above) — extracting the 18.x wheel, reading `clang-format --version`, and reasoning "the docs say 17-18, so 18 qualifies" is exactly the failure mode: **the tool's own `--version` never validates it, only the consumer does.** Note this is a re-derivation of a fact already recorded much earlier ("pip's default clang-format is too NEW; the script rejects both"), which is why the consumer run is the cheap check and the documented range is not.

Operational notes measured in the `slang-fixer` container (2026-08-06):
- `prettier` was **already** on PATH (its unrelated `UNDICI-EHPA` experimental warning on stderr is not a failure). `gersemi` and `shfmt` were absent — irrelevant for a C++-only change, because type flags narrow the requirement checks.
- The extraction persists in `/workspace/agent/` **for the session only** — it does not survive an image rebuild, so re-run the three lines each fresh session. As elsewhere on this page, `export PATH=` does not survive between separate Bash tool calls; prefix inline when in doubt.
- **Bar for using this:** if your change touches `.cpp`/`.h`, you are expected to run the formatter yourself rather than delegating it in the PR body.

([extract the clang-format PyPI wheel — no apt/admin needed](../learnings/1785989277743-clang-format-for-slang-formatting-sh-extract-the-p.md), [CORRECTION: 17.x required, 18.x rejected — verify against the gating script](../learnings/1785992812883-correction-slang-formatting-sh-needs-clang-format-.md))

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

The same trap applies to the user-guide docs (`docs/*/09-reflection.md`, `08-compiling.md`, `README.md`), which use Setext headings, `*` bullets, and `*emphasis*`: the default pnpm prettier (3.9.x) rewrites all of these to ATX `#`, `-` bullets, and `_emphasis_` — 50-130 lines of churn per file. CI's `check-formatting.yml` runs on the whole tree yet stays green on master for these "non-conforming" docs (proven by 3+ merged PRs — #11436, #11280, #10594 — that added to `09-reflection.md`), so markdown conformance is effectively unenforced for them; match the file's existing conventions by eye and trust the merged-PR precedent over any local checker, even the CI-pinned prettier@3.3.3 which also flags them. Only C++ clang-format is truly enforced. ([Slang formatting.sh markdown: never run local prettier on whole doc — version-skew churns pre-existing files](../learnings/1785550531048-slang-formatting-sh-markdown-never-run-local-prett.md))

## Public Headers Must Be ASCII-Only (MSVC C4819); Sweep prelude/ Too

Every file under `include/` must be pure ASCII: MSVC emits **warning C4819** ("character cannot be represented in the current code page") when a consumer compiles an ASCII TU that just `#include`s the header under a non-UTF-8 source charset (`/source-charset:.932`), and under `/WX` that becomes error C2220 — so non-ASCII bytes in doc comments silently break downstream `/WX` builds on CP932/Shift-JIS locales (#12016: 3 U+2014 em-dashes in `include/slang.h`, regressed twice including once via the bot's own PR). Detection without Windows: `grep -rP '[^\x00-\x7F]'` must return empty; C4819 itself needs Windows+MSVC+CP932 to observe, so don't label `reproduced` from Linux. Fix by replacing with the file's own ASCII convention (in slang.h, a spaced ` - ` hyphen). **Two extensions from the shipped #12016 fix:** (1) sweep `prelude/` too, not just `include/` — the shipped preludes install into `include/` and trigger the same C4819 (the fix ended up 3 files incl. `slang-cuda-prelude.h` with em-dashes AND U+2192 `→` arrows — watch for arrows and other Unicode punctuation, not only em-dashes; canonical sweep `grep -rP '[^\x00-\x7F]' include/ prelude/`); (2) scope-widen when the reporter asks to "review all public headers." The Approach-B CI/lint guard (reject non-ASCII in shipped headers) is scoped to `.github/workflows/**` and thus policy-rejected for coworker bots — flag it for maintainer ownership rather than building it ([slang public headers must be ASCII-only (MSVC C4819 under non-UTF-8 charset)](../learnings/1783579004581-slang-public-headers-must-be-ascii-only-msvc-c4819.md), [slang non-ASCII header sweep must include prelude/ and watch arrows — #12016 SHIPPED](../learnings/1783596951560-slang-non-ascii-header-sweep-must-include-prelude-.md)).

## REUSE license lint: submodule notices and the unused-license trap

Slang manages source-file license compliance with **REUSE** (`REUSE.toml` + `LICENSES/` + a `reuse-compliance.yml` CI job running `fsfe/reuse-action`). Two gaps matter for third-party attribution. First, `reuse lint` does NOT recurse into git submodules (they are separate projects), so statically-linked deps under `external/` (`cmark` BSD-2, `lz4` BSD-2, `glslang` BSD-3) are outside Slang's annotation and their required binary-redistribution copyright notices reach neither `LICENSES/` nor the shipped artifact (`LICENSES/` at HEAD has no BSD-2/BSD-3 text at all); check which deps actually ship by grepping `source/*/CMakeLists.txt` for `LINK_WITH_PRIVATE` on the shipped targets, then read each dep's `COPYING`/`LICENSE` for the SPDX type ([REUSE doesn't cover statically-linked submodules — BSD notices missing from shipped artifact](../learnings/1785460293333-slang-third-party-license-attribution-reuse-doesn-.md)). Second, the naive fix of dropping bare `LICENSES/BSD-2-Clause.txt`/`BSD-3-Clause.txt` into the repo turns `reuse lint` RED: REUSE spec 3.3 forbids a license text that no *tracked* file references, and since the CI checkout uses no `submodules:` key the submodule's own SPDX tag can't be that reference (empirically reproduced — `reuse lint` exits 1 with "unused licenses", exit 0 once a tracked carrier file references it) ([bare LICENSES/BSD-*.txt breaks reuse lint (unused-license)](../learnings/1785460805646-slang-12302-bsd-notice-fix-bare-licenses-bsd-txt-b.md), [don't add bare LICENSES/ SPDX texts in a REUSE repo — reuse lint fails on unused licenses](../learnings/1785461480820-don-t-add-bare-licenses-spdx-texts-in-a-reuse-repo.md)). Correct pattern (A1): install each dep's OWN notice file via the CMake install `metadata` component — this satisfies the license's redistribution clause and carries the actual copyright line a bare SPDX *template* lacks, independent of the REUSE `LICENSES/` mechanism; only add SPDX text to `LICENSES/` (A2) if you also annotate a real tracked carrier with the matching id. Note `external/cmark/COPYING` is compound (BSD-2 + embedded MIT sub-notices), so shipping its own file covers all of them where a single template would not; and before recommending any `LICENSES/`-dir edit, verify the unused-license rule — including your own earlier tool-behavior claims — empirically (the `reuse` CLI needs `charset-normalizer`).

## clang -Wformat-security Rejects Argless printf(fmt) — Linux gcc Won't Catch It

A `printf`-family call with a **non-literal** format string and **zero** variadic args (e.g. `reportError("literal\n")` where `reportError(fmt,args...)` forwards to `printf`) is a hard error under clang `-Werror -Wformat-security` — but **gcc/Linux does NOT enforce it**, so a Linux-only local build is green while the macOS/clang CI build fails (Slang examples build `-Werror` on all platforms). Even a compile-time-constant literal passed through a variadic wrapper counts as non-literal at the `printf(fmt)` call site (the wrapper's `fmt` param is a runtime `const char*`). Fix: route through `"%s"` (`reportError("%s", "error: ...\n")`). Verify limitation: a Linux/gcc-only in-container build is structurally blind to clang-only `-Werror` flags (`-Wformat-security`, `-Wreturn-local-addr`), so grep the diff for argless wrapper-`printf` calls even when Linux CI is green — the macOS `build-macos-*-clang-aarch64` job is the real gate (#12009 lost a CI round-trip to exactly this) ([clang -Wformat-security rejects argless printf(fmt) — Linux gcc verify won't catch it](../learnings/1783560312328-clang-wformat-security-rejects-argless-printf-fmt-.md)).

## Contradictions / supersessions

None found. The two "draft PR CI" learnings are complementary (one adds the workflow_dispatch clarification; both are consistent).

## slang-rhi lint gates differ from the slang compiler

When editing **shader-slang/slang-rhi** (not the compiler), its pre-commit/CI gates differ from slang's: **clang-format v20** (not slang's version), an ASCII-only hook, and `-Werror`. Verify against these, not slang's toolchain ([1783022365578-slang-rhi-formatting-lint-gates-differ](../learnings/1783022365578-slang-rhi-formatting-lint-gates-differ-from-the-sl.md)).


## Recent operational learnings (incremental fold 2026-07-17)

**Never run prettier (formatting.sh --md) on the generated capability-atoms doc** — **Context:** slang#12097 — editing a capdef `///` doc comment regenerates `docs/user-guide/a4-02-reference-capability-atoms.md` via `slang-capability-generator`. [Never run prettier (formatting.sh --md) on the generated capability-atoms doc](../learnings/1784101129985-never-run-prettier-formatting-sh-md-on-the-generat.md)

---
**Source learnings (20):**
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
- [formatting.sh --cpp silently no-ops (exit 0) when clang-format absent from PATH](../learnings/1784826314203-formatting-sh-silently-no-ops-when-clang-format-is.md)
- [never run local prettier on whole user-guide docs — version-skew churns pre-existing Setext/emphasis files; only C++ clang-format is enforced](../learnings/1785550531048-slang-formatting-sh-markdown-never-run-local-prett.md)
- [REUSE lint doesn't cover statically-linked submodules — BSD-2/3 copyright notices missing from shipped artifact (#12302)](../learnings/1785460293333-slang-third-party-license-attribution-reuse-doesn-.md)
- [#12302 BSD-notice fix: bare LICENSES/BSD-*.txt breaks reuse lint (unused-license); ship the dep's own COPYING via install metadata](../learnings/1785460805646-slang-12302-bsd-notice-fix-bare-licenses-bsd-txt-b.md)
- [don't add bare LICENSES/ SPDX texts in a REUSE repo — reuse lint fails on unused licenses (empirically verified)](../learnings/1785461480820-don-t-add-bare-licenses-spdx-texts-in-a-reuse-repo.md)
- [CORRECTION: formatting.sh needs clang-format 17.x — 18.x is REJECTED as too new](../learnings/1785992812883-correction-slang-formatting-sh-needs-clang-format-.md) — `require_bin "clang-format" "17" "18"` is `[17, 18)` exclusive; verify a tool version against the script that gates it, not the tool's `--version` or a README range. Carries the corrected wheel-extraction recipe, superseding the 18.1.8 pin in [the original wheel note](../learnings/1785989277743-clang-format-for-slang-formatting-sh-extract-the-p.md).
_Catalog: [[wiki/index.md]]_
