# CORRECTION to my earlier formatting.sh learning — the VERSION GATE is LOUD (exit 1 + message); the silent false-green is the BARE invocation hitting show_help at :47-50

## This corrects an earlier learning of mine — read this one instead

Earlier today I published a note titled *"formatting.sh version gates are half-open — clang-format 18
is REJECTED, and the rejection looks identical to 'nothing to fix'"*. **The half-open gate part is
correct. The "looks identical to nothing to fix" part is WRONG**, and I've now measured both.
`append_learning` is immutable, so this is the correction; prefer it over the earlier note.

## Measured, in the slang worktree at `d7d59f374`

**With clang-format 18.1.8 the gate is LOUD:**
```
$ ./extras/formatting.sh --cpp --check-only; echo "EXIT=$?"
found clang-format 18.1.8, required [17, 18)
clang-format version 18.1.8 is too new. Version less than 18 is required.
EXIT=1
```
Explicit message, non-zero exit. Not silent at all.

**With clang-format 17.0.6 it runs:**
```
found clang-format 17.0.6, required [17, 18)
Formatting cpp files...
EXIT=0
```

**The actual silent false-green is a BARE invocation** (`extras/formatting.sh:47-50`):
```bash
if [ "$#" -eq 0 ]; then
  show_help
  exit 0
fi
```
`./extras/formatting.sh` with no arguments prints help and **exits 0 before any gate or formatting
runs** — and the bare form is what the repo docs instruct. *That* is the failure indistinguishable
from success.

## What I got wrong, and why it matters

I conflated two distinct defects in the same script and attributed the silent-failure property to
the wrong one. Then I generalized from the merged version ("this is the instrument-validity trap
again"), which made a real but *different* lesson support a false mechanism. **A correct-sounding
generalization can be built on a misattributed cause** — and it is harder to catch than a wrong fact,
because the conclusion still rings true.

Concretely: my own run that produced "both files come back clean" printed `exit 1` and a
"too new" message. I did not read them. The instrument was loud; **I was the silent part.**

## Practical rules (unchanged in effect, better grounded)

1. **Always pass an explicit action** — `--check-only`, `--cpp`, `--modified`. Never the bare form.
2. **Treat `exit=0` as meaningful only alongside the stderr version line**
   (`found clang-format 17.0.6, required [17, 18)` + `Formatting cpp files...`). Paste it when
   reporting formatting as done.
3. **Version gates are half-open (max EXCLUSIVE):** `clang-format` **17.x only** (even 18.0.0 is
   rejected); `gersemi` **0.21.x only** (0.22.0 and 0.22.1 rejected).
4. **The 17-vs-18 pin is load-bearing, not cosmetic.** Across 1489 tracked C/C++ files, 9 format
   differently between 17.0.6 and 18.1.8, and the committed tree matches **17.0.6 on all 9, 18.1.8
   on none**. Formatting with 18 would produce real spurious diffs.
5. ⛔ **Never reach for `--no-version-check`** when formatting resists — it bypasses the gate and
   converts a loud local failure into a quiet CI-red.
6. Docs bug: `.github/copilot-instructions.md:21-22` says "17-18" / "0.21-0.22", both reading
   inclusive. Filed upstream as slang#12394. `CLAUDE.md` does **not** state a range — an earlier
   claim of mine that "both files" carry it was an **unmeasured plural**.
