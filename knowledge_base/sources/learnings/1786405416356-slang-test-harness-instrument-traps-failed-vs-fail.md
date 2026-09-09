---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378486888-is6i9e
written_at: 2026-08-10T23:43:36.356Z
---

# slang-test harness instrument traps: FAILED-vs-failed, priority-yield red, and the formatting.sh file-list asymmetry

Five measured traps from shader-slang/slang#12442 (PR #12465). Each returns a *believable* answer in
the state where it is blind, which is what makes them expensive.

## 1. slang-test's failure marker is `FAILED test:` (UPPERCASE)

The pass marker is lowercase `passed test:`. So `grep -c '^failed test:'` matches **neither** and
reports **0 failures on a log with 4**. Caught only because `rc=1` and `60% of tests passed (6/10)`
in the same output contradicted the counter.

```bash
nfail=$(grep -c '^FAILED test:' "$log")   # correct
npass=$(grep -c '^passed test:' "$log")
```

Also present, and easy to miscount: `failed(pending retry) '<name>'` (a retry, not a final verdict)
and `failed(expected) test: '<name>'` (a suppression matching). **A test file yields one cell per
`//TEST` directive** (`x.slang`, `x.slang.1`, `x.slang.2`) plus synthesized `x.slang.N syn (cuda)`
cells — so "the test failed" is ambiguous; always quote the cell name.

## 2. slang-test exits 0 when nothing matched

Gate every run, or a filter typo reads as a pass:

```bash
ran=$(grep -cE '[0-9]+% of tests passed \([0-9]+/[1-9][0-9]*' "$log")
[ "$ran" -eq 0 ] && echo "VOID: nothing ran"
```

Specifically: `slang-test docs/generated/tests/<path>` as a **positional** arg silently runs nothing
(enumeration comes from `-test-dir`, default `tests/`; a positional is only a *prefix filter*). Use
`-test-dir <subdir>` with **no** trailing filter. And `-test-dir` *plus* a trailing path filter also
runs nothing.

## 3. `-explicit-test-order` is mandatory for any ordering experiment

slang-test picks its own order. A drill listing predecessor-then-victim ran the victim **first** and
passed — reading exactly like "does not reproduce". Note **subtests within one file do run in order**,
so a single `.slang` carrying `COMPARE_COMPUTE` then a `-target hlsl` `SIMPLE` directive *can* express
an ordering dependency (measured 2/3 → 3/3 across a fix). I wrongly claimed it could not.

## 4. A red draft-PR CI check is usually a priority yield — report it precisely

`workflow_dispatch` CI on a bot PR yields to human CI:

```
wait-for-human-priority: ##[error]priority-gate-yielded: higher-priority CI is active
```

Only `wait-for-human-priority` + the aggregate `check-ci` fail; everything else is **skipped**.
GitHub's conclusion **is `failure`**, so:

- ✅ "red by design — a priority yield; nothing was built, so it is evidence about neither the code nor the tests"
- ❌ "not a failure" (contradicts the API) · ❌ silence (a maintainer reads ✗ as "tests failed")

**Count the job kinds before describing them.** I wrote "all 37 builds skipped"; measured, it was 37
skipped jobs = **9 build + 28 test/check**. Put the clarification **on the PR**, not only in an
internal report — the ✗ is what a human sees first.

## 5. `formatting.sh`: the mutating path and `--check-only` use different file lists

The mutating path selects files via `git diff` against `HEAD`, so **an already-committed file is
skipped**, while `--check-only` uses `git ls-files` and still checks it. A reflow therefore looks
non-convergent: you run the formatter, it does nothing, check-only still complains. `clang-format -i
<file>` directly settles it.

Also: **a missing tool makes `--check-only` exit 1 with no formatting problem at all** —
`This script needs gersemi, but it isn't in $PATH` and the script exits before formatting anything.
Do not read that as dirty code. Installing all four here:

```bash
python3 -m pip install --user --break-system-packages clang-format==17.0.6 gersemi==0.21.0
curl -sSL -o ~/.local/bin/shfmt https://github.com/mvdan/sh/releases/download/v3.10.0/shfmt_v3.10.0_linux_amd64
chmod +x ~/.local/bin/shfmt; export PATH="$HOME/.local/bin:$PATH"
```

(`clang-format` **17.x only** — the repo docs' "17-18" is wrong. `prettier` is already present.)

## Bonus: two git/CMake traps from the same run

- **`git log --format=%B <sha>` without `-1` walks every ancestor** → produced a 6.7 MB, 160,599-line
  commit message when used to capture a message for `--amend`.
- **`REQUIRED_BY` in `tools/render-test/CMakeLists.txt` is the broken idiom** for depending on
  `slang-unit-test`: `add_subdirectory(render-test)` (`tools/CMakeLists.txt:391`) runs *before*
  `slang-unit-test` is declared (`:393`), so `add_dependencies` fails with "non-existent target". Put
  `REQUIRES render-test` on `slang-unit-test` instead. Verify the edge on the **output node**, not the
  phony: `ninja -t query Debug/lib/libslang-unit-test-tool.so` shows
  `|| Debug/lib/librender-test-tool.so`. (`ninja -n <target> | grep` returns 0 even for a *known-true*
  edge — always run that probe against a known-good target as a positive control first.)
