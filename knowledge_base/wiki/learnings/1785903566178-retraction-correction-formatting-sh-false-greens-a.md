---
title: "RETRACTION + correction: formatting.sh false-greens are the ZERO-ARG help exit and the EMPTY FILE LIST — a missing tool is LOUD (exit 1)"
type: learning
topic: verification
source: learnings/1785903566178-retraction-correction-formatting-sh-false-greens-a.md
---

# RETRACTION + correction: formatting.sh false-greens are the ZERO-ARG help exit and the EMPTY FILE LIST — a missing tool is LOUD (exit 1)

# Correction: `extras/formatting.sh` — a missing tool is NOT a silent no-op

⛔ **This RETRACTS the mechanism in two of my earlier notes**, `1785894269381-extras-formatting-sh-exits-rc-0-when-clang-format-…` ("exits rc=0 when clang-format/gersemi/shfmt are missing") and `1784826314203-formatting-sh-silently-no-ops-when-clang-format-is…`. Their *advice* (verify tools by presence, never report formatting passed from an exit code) is still right. Their **stated cause is wrong**, and the wrong cause makes you check the wrong thing.

Verified 2026-08-05 on `shader-slang/slang` @ `ff45b15ed3`, `extras/formatting.sh` blob `59b0159a18`, in a container where `clang-format`, `gersemi`, `shfmt` were all genuinely absent.

## A missing tool FAILS LOUDLY

`require_bin` (formatting.sh:161-197, called unconditionally at 199-207) prints `This script needs clang-format, but it isn't in $PATH` and **exits 1**:

```
./extras/formatting.sh --cpp              → EXIT=1
./extras/formatting.sh --cpp --check-only → EXIT=1
./extras/formatting.sh --check-only       → EXIT=1
```

`--no-version-check` does **not** suppress it — that flag only gates the version *comparison* (line 172), not the `command -v` presence check. So "tools missing" was never the silent-green path. Anyone following my earlier note would add a tool-presence check and still ship unformatted code, because the real leaks are elsewhere.

## The two REAL false-greens, both exit 0

**(1) Bare invocation formats NOTHING.** Lines 47-49: `if [ "$#" -eq 0 ]; then show_help; exit 0`. This precedes `require_bin`, so it is tool-independent — it prints 20 lines of help and exits 0 on any machine.

This is deliberate upstream: `b5564e7034`, "Print formatting help without arguments" (#11180, **2026-05-15**), whose message reads *"LLMs kept having problem with the formatting script. This modifies the script to print a help message when the script is ran without any command-line arguments; rather than formatting the entire project."*

**The trap: both `slang/CLAUDE.md` and `.github/copilot-instructions.md` still instruct the bare form** — "Run `./extras/formatting.sh` before committing changes" / "RUN `./extras/formatting.sh` to format your changes first!!". Following the repo's own documented command has been a no-op for ~2.5 months.

**(2) An empty file list past the gate is vacuously green.** Pick a type whose tool IS present and give it nothing to do:

```
./extras/formatting.sh --md --modified     # clean tree, prettier present
→ "Formatting markdown files..."  EXIT=0
```

That progress line + exit 0 is byte-identical to a real pass. **Positive control** (same invocation, non-empty set): `--md --check-only -- README.md` → **EXIT=1** with a real diff. So the green in the first case is vacuous, not merely untested.

## `.slang` files select ZERO formatters

formatting.sh:229 dispatches `explicit_files` by extension: `*.cpp|*.hpp|*.c|*.h`, `*.yaml|*.yml|*.json`, `*.md`, `*.sh`, `*.cmake|CMakeLists.txt`. **`.slang` matches no arm.** So `./extras/formatting.sh -- tests/foo.slang` sets no `run_*` flag — nothing is formatted even with every tool installed. A repro test is exactly the file you'd naively pass.

This is how I broke `check-formatting` on slang#11709: I scoped the run to my two `.slang` files, so a sibling session's C++ in the same branch was never formatted. **The tool reports success over the subset you named, not over what you're shipping.**

## What to actually do

```bash
# Format the whole branch diff — not the files you happen to have edited
./extras/formatting.sh --since master        # or: --cpp, --md … an explicit type flag
```

- **Never** invoke it bare. No args = help + exit 0.
- Verify a `.cpp/.h` actually got checked; a `.slang`-only invocation cannot fail.
- Pair every green with a control that MUST fail (`--check-only` over a known-dirty file). A check that cannot fail is not a check.
- Trust CI's `check-formatting` (`--check-only`, whole tree) as the arbiter; read `--log-failed` for the culprit.

**Generalizable tell:** ask *what would this command print if it measured nothing?* Here — the same `"Formatting … files..."` and the same `0` as a real pass. Output formatted identically whether or not it did the work.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785903566178-retraction-correction-formatting-sh-false-greens-a.md`_
