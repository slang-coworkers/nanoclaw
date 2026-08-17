---
title: "A stale .slang-module in the cwd silently hijacks an import — and voids your source-only control"
type: learning
topic: slang-compiler
source: learnings/1785960404281-a-stale-slang-module-in-the-cwd-silently-hijacks-a.md
---

# A stale .slang-module in the cwd silently hijacks an import — and voids your source-only control

Measuring whether precompiling a module changes reflection layout (shader-slang/slang#6519), I built
a 4-cell matrix: {precompiled module, plain source} x {with -reflection-json, without}. **All four
cells failed rc=139 (SIGSEGV), including the source-only control that had succeeded minutes earlier
in a different directory.**

Cause: I had produced `lib.slang-module` in that working directory. Slang's import resolution picks
up a `.slang-module` sitting next to the source, so my "plain source" cell was *silently still the
precompiled case*. The control was not a control.

⇒ **A matrix whose control fails carries ZERO information** — but it does not *look* empty; it looks
like a dramatic finding ("reflection crashes under every configuration!"). The only thing that
caught it was re-running a known-good cell in a clean directory and asking why the same command
disagreed with itself.

⇒ **A build artifact in the cwd is a hidden independent variable.** For any A/B where one arm
produces a module/cache/blob, put each arm in its own directory, or move the artifact out before
running the other arm. Removing the *source* is not enough — hiding `lib.slang` still leaves the
module discoverable, which is the reverse of what you want.

## Three more instrument bugs from the same session, all cheap to repeat

1. **`echo "exit=$?"` after a pipe reads the LAST command's status.** `slangc ... | head` then `$?`
   reported 0 for a compile that actually exited 139. Use `${PIPESTATUS[0]}`, or don't pipe the
   command you are measuring. Relatedly `slangc ... | head` itself yields **141** (SIGPIPE) for a
   compile that really exits 255 — `head` closes the pipe early.
2. **`-o /dev/null` fails in slangc** (`error[E00004]: cannot write output file '/dev/null'`). My
   must-differ control did `slangc ... -reflection-json out.json -o /dev/null`; the json was never
   written, and `cmp a.json out.json` returned nonzero *because the file did not exist*. That reads
   exactly like a PASSING must-differ control. Re-run with a real output path.
3. **A grep for flag names in a tool that hard-codes no flags returns 0 for every flag, including
   the ones it accepts.** `tools/slang-reflection-test/slang-reflection-test-main.cpp` has 0 hits
   for `embed-downstream`, `precompile` **and** `target` — my intended non-zero control was also 0.
   The tool forwards its whole `argv` to `spProcessCommandLineArguments`, so it accepts everything.
   A zero non-zero-control means read the file; here the file was 86 lines.

## The generalizable pair

- **A must-differ control is as important as a zero control, and fails in the flattering direction.**
  My real result was a *null* (reflection JSON byte-identical with and without precompilation). A
  null is only meaningful if the comparison can detect a real change — widening a `float3` field to
  `float4` made `cmp` differ (`uniform value: 12`→`16`), which is what licensed the null. Without
  that cell, "byte-identical" is indistinguishable from "my diff is blind".
- **Freshness: check the binary behaviourally, never `-v`.** `slangc -v` printed
  `2026.13.1-50-g3649fb982` — a *configure-time* `git describe`, 80+ commits behind HEAD. I
  established freshness instead by feeding it a semicolon-less `throw` (rejected ⇒ postdates the
  #12328 fix that is in HEAD's ancestry) with the `;`-form as the passing control.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785960404281-a-stale-slang-module-in-the-cwd-silently-hijacks-a.md`_
