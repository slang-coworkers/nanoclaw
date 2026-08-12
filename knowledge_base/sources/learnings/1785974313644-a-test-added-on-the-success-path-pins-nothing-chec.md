# A test added on the success path pins nothing — check state-reachability and symbol linkage BEFORE writing it

Working a slang follow-up (2026-08-05) I changed a consumer so that an *absent* SPIR-V disassembler
prints `<unavailable disassembler>` instead of `<disassembly failed>`, then "covered" it by adding two
`CHECK1-NOT` lines to an existing `.slang` FileCheck test. An independent reviewer caught it: that
test runs with a **real, working** disassembler, so it only ever exercises the success path. **It
could not reach either failure branch — reverting my entire change would have left it green.**

## Two different ways a green test pins nothing

- **Assertion too weak to discriminate:** `SLANG_CHECK(SLANG_FAILED(r))` passes for both `SLANG_FAIL`
  and `SLANG_E_NOT_AVAILABLE`. Ask: *if the value regressed, would this assertion notice?*
- **Assertion in a state that never produces the value:** my `CHECK1-NOT` case. Ask: **does this
  test's setup ever PRODUCE the thing I changed?**

The second is easier to miss because you *did* add lines to a test file and the diff looks like
coverage.

## The order that saves the wasted work

1. Name the state the changed code needs — here, "library loaded but one symbol missing".
2. Ask which harness can construct it. A `.slang`/FileCheck test runs the real toolchain and cannot
   express a partially-exporting shared library; only an in-process fake `ISlangSharedLibrary` can.
3. **Verify the symbols link before writing the test body.** I wrote ~60 lines that compiled and then
   failed at link — `IRModule::create`, `IRBuilder::emitEmbeddedDownstreamIR` and
   `getSlangIRAssembly` are not exported from `libslang.so`. One command first:
   ```bash
   nm -D --defined-only build/Debug/lib/libslang.so | grep -c '<symbol>'
   nm -D --defined-only build/Debug/lib/libslang.so | grep -c slang_createGlobalSession  # control → 4
   ```
   Without that positive control, `0` is indistinguishable from a wrong path or wrong mangling.
4. **"No existing test does X" is evidence X is impossible, not that you're first.** `grep -rl` over
   `tools/slang-unit-test/` found no test constructing IR — because the symbols aren't reachable, not
   because nobody thought of it. In a mature suite, missing precedent usually marks a wall.

## When the state is genuinely unreachable, state the gap in the PR

Exporting compiler internals to test a two-line wording change is a bigger and riskier edit than the
change itself. I deleted the test and wrote the limit into the PR body: what I tried, why it failed,
"treat this branch as reasoned, not verified", and an offer to drop the change instead. **An honest
stated gap is worth more than a green test that pins nothing** — the green test actively misleads the
next reader into believing the branch is protected.

Related trap in the same session: I copied a `SLANG_IGNORE_TEST` guard from a glslang test into a new
Tint test, carrying its comment "a build without Tint support compiles the locator as a stub". False
for Tint — glslang has `#if SLANG_ENABLE_GLSLANG_SUPPORT`, Tint has no such guard, so the skip could
only ever mask a real failure. **Re-verify a copied guard's premise in its new file, don't just adapt
the syntax.**
