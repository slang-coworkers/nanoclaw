# GitHub Actions logs echo the run: script — ESC[36;1m lines are source, not output

## The trap

GitHub Actions echoes **every line of a `run:` block** into the job log, wrapped in ANSI `ESC[36;1m` … `ESC[0m`. Those lines are the *script text*, not what the script produced. A keyword grep over a raw log therefore matches strings that only ever existed as **unexecuted `echo` arguments inside an `if` branch that never fired**.

## Concrete near-miss (shader-slang/slang #12347, `check-formatting`, run 31011716368)

Grepping for error text returned:

```
^[[36;1m  echo "Error: downloaded clang-format is not a valid binary"^[[0m
^[[36;1m  echo "Error: downloaded shfmt is not a valid binary"^[[0m
```

That reads as a **dependency-download infra flake → rerun it**. Both lines are the *fallback arms* of a version-check block, echoed as source. The real output four lines later says the opposite:

```
found clang-format 17.0.6, required [17, 18)
found prettier 3.3.3, required at least 3
```

Tools installed fine. The actual failure was a genuine clang-format diff in `tools/slang-internals-test/internals-test-env.cpp`. A rerun could never have gone green, and the "infra flake" label would have pointed the author away from a one-command fix (`./extras/formatting.sh`).

## Why no integrity check catches it

The deceptive text is *inside the log you correctly fetched* — non-empty, `rc=0`, right run id, right job. Provenance is perfect; the **role** of the line is wrong. This is distinct from truncation/expiry/empty-file failure modes that byte-size and exit-code guards do catch.

## How to avoid it

Strip the echo before classifying:

```bash
grep -av $'\033\[36;1m' log.txt | grep -aiE "error|fail"
```

Then confirm the match is a **consequence**, not a declaration: a real failure has a following `##[error]`, a diff, or an exit line. A matched string whose only neighbours are more `echo` statements is script text.

**Cheapest tell: `echo "` inside the matched line means you are reading source, not output.**

## Corollary — count both poles of a PASS/FAIL tally

Same sweep, a different job (`test-compile-regression`) emitted **1732 PASS and 1732 FAIL lines, exactly 1:1**, because the harness prints both per file. The 1:1 ratio pins the defect to the **environment** — the real signature was `PASSING spirv-val [ 0 / 866 ]`, a broken validator on one runner — not to any shader. A raw FAIL count read as breakage would have misattributed it to the code. Grep the *emitted bytes* (note the inner spaces in `[ 0 / 866 ]`) rather than a retyped compact form.
