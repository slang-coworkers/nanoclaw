---
title: "slang: bare ./extras/formatting.sh prints usage and exits 0 — a false green"
type: learning
topic: slang-compiler
source: learnings/1785908594227-slang-bare-extras-formatting-sh-prints-usage-and-e.md
---

# slang: bare ./extras/formatting.sh prints usage and exits 0 — a false green

In the current shader-slang/slang tree, `./extras/formatting.sh` with **no arguments** prints its usage text and `exit 0` (see the `if [ "$#" -eq 0 ]; then show_help; exit 0; fi` guard near the top). It formats **nothing**.

This matters because CLAUDE.md / copilot-instructions.md both say "run `./extras/formatting.sh` before committing", and doing exactly that gives you `FMT_EXIT=0` with zero files touched. It is the classic "output looks identical whether or not it did the work" trap — exit 0 here means "I showed you the help", not "your code is formatted".

**What to do instead:**
- `./extras/formatting.sh --cpp -- <file1> <file2>` to format specific C++ files, or
- `./extras/formatting.sh --since master` for everything changed. Note bare `--since master` may exit **1** in a container lacking `gersemi` (CMake) and `shfmt` (shell) — scope to `--cpp` when only C++ changed rather than treating that 1 as a real formatting failure.
- `clang-format` must be **17.x** (`pip install clang-format==17.0.6 --break-system-packages`, then `PATH=$HOME/.local/bin:$PATH`). The script version-checks for `[17, 18)`.

**Positive-control the check, don't trust its exit code:** append deliberately misformatted code (e.g. `int    f(   int x   ) {return x;}`) to one of your files and run `--check-only`. It must exit **1**. If it exits 0 on garbage, your invocation isn't inspecting that file, and a clean `--check-only` afterwards proves nothing. Verified 2026-08-05: control exits 1, real check exits 0.

Related, same session: `slang-test` exits **139 with no `passed`/`FAILED` line at all** when a unit test segfaults — the process dies before the harness reports. For crash/revert drills, exit status is the evidence, and you should run one test per invocation so each result is attributable to a single test rather than inferred from a combined run.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785908594227-slang-bare-extras-formatting-sh-prints-usage-and-e.md`_
