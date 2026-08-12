# Slang import resolution: a .slang-module BEATS .slang source on -I, which silently fakes import-path experiments

Measured on shader-slang/slang while adjudicating a disputed diagnostic-escape finding (#12378). Two agents ran the *same* three-pole experiment and got *opposite* wrong answers from one shared defect.

## The mechanism

When both a `.slang` source file and a precompiled `.slang-module` for the same module name are reachable via `-I`, **the module wins**. Measured with `slangc <consumer> -target cpp -I <moddir> -I <srcdir>`: rc=0 and zero diagnostics, identical to the module-only case, whereas source-only gives rc=255 with the diagnostic.

Also: with no `-I` at all, resolution falls back to **cwd**. A consumer sitting in the same directory as the module (or the source) resolves it without any `-I` flag.

## Why this ruins import-path experiments

Testing "does behaviour X differ between import-as-source and import-as-precompiled-module" requires that each pole load what you think it loads. Both failure directions were observed on one PR:

- **Agent A**: a stale `.slang-module` was reachable on the path during the "source" pole → the module was loaded → A concluded *both* poles escaped, and generalized to "any import path loses the location." False.
- **Agent B**: the consumer was in the same dir as the source → the "precompiled module" pole resolved from cwd instead → B's isolation was fake and pole 3 was silently re-running pole 2. B caught this itself.

## The check that settles it

Make the negative control fire and read it:

```bash
R=/tmp/pole-test; mkdir -p $R/src $R/mods $R/c2 $R/c3   # separate dirs, absolute paths
# consumer copies in c2/ and c3/; ONLY the .slang in src/; ONLY the .slang-module in mods/
slangc $R/c3/consumer.slang -target cpp ... -o /tmp/n.cpp          # NEG CTRL: no -I
#   MUST fail: error[E00001]: cannot open file 'mod_lib.slang'   <= isolation proven
slangc $R/c2/consumer.slang -target cpp ... -I $R/src -o /tmp/p2.cpp   # source pole
slangc $R/c3/consumer.slang -target cpp ... -I $R/mods -o /tmp/p3.cpp  # module pole
```

Until the no-`-I` run produces `E00001`, no pole result means anything. Note `.slang-module` is gitignored (`.gitignore:51`), so a stale one from an earlier build can sit in a working tree invisibly.

## Generalizable

1. **An unproven negative control fails in both directions.** A control that cannot fail is not a control. Two agents, opposite conclusions, one unvalidated instrument.
2. **A correct answer from an unvalidated instrument teaches nothing.** One table was right — by luck of directory layout, not rigor — and would never have been examined without the disagreement.
3. **Applies to any "delivery path" variable**: include paths, module/package caches, `PATH`, symlinked configs, resolution order. The thing you think you varied may not be what changed. State the resolution order you depend on, and prove the negative case breaks.
4. **A fallback that compiles is not a fallback that resolves.** Patching `findFirstUseLoc` in as a location fallback for a deserialized declaration recovers *nothing* — instrumented, both `sourceLoc.isValid()` and `firstUseLoc.isValid()` are 0, because the uses are the module's own locationless insts. The diagnostic fires with an invalid location. "The fallback handles it" needed measuring, not reading.
5. **`diag=` diagnostic tests cannot express a locationless diagnostic** — annotations match by column against a source line. A `.expected` comparison is the only mechanism that can pin one (the pre-fix baseline records `result code = 0` with empty stderr, i.e. the silent escape captured verbatim).
