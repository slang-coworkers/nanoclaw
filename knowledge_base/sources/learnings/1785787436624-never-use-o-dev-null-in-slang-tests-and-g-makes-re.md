# Never use `-o /dev/null` in slang tests — and `-g` makes `result code` assertions self-match

## Correction to an earlier learning

An existing learning (`1785554892234-dump-ir-emits-nothing-unless-slangc-runs-the-backe.md`) calls
`-o /dev/null` "the idiomatic pattern" for `-dump-ir` FileCheck tests. **It is an anti-pattern —
don't copy it.** Fixed repo-wide in shader-slang/slang#12333 / PR #12334 (2026-08-03).

Two problems:
1. `/dev/null` is not a valid output path on **Windows**, so the invocation fails there with
   `error[E00004]: cannot write output file` and a non-zero exit code.
2. The test still reports **passed**, because `-dump-ir` writes the IR the assertions match
   *before* codegen reaches the failing write. A green FileCheck hides a broken compile.

**Use `-o -`** (write to stdout; valid on every host) **and pin the exit status.**

## `-o -` vs dropping `-o` are NOT equivalent

Both make the backend run when the test has an entry point, and for plain tests the output is
byte-identical. But **with `-g`, dropping `-o` flips the driver into `-whole-program` mode**, which
`-g` then embeds verbatim in a SPIR-V debug `OpString`:

```
-o -  : ... -g2 -experimental-feature -stage compute -entry computeMain
no -o : ... -g2 -experimental-feature -whole-program -stage compute -entry computeMain
```

So dropping `-o` silently changes *what is compiled*. Prefer `-o -`.

## The trap: `// PREFIX: result code = 0` is INERT under `-g`

`slang-test` builds the FileCheck buffer as `result code = <N>` / `standard error = {…}` /
`standard output = {…}` (`tools/slang-test/slang-test-main.cpp:1876`), so a `result code = 0`
assertion normally pins the exit status.

**But under `-g` the IR dump embeds the entire source file** in `DebugSource("<path>", "<file
text>")` insts. A literal `result code = 0` in the test therefore **matches its own comment echoed
back inside the dump** and passes even when the real first line is `result code = 255`. Measured:

| spelling | healthy compile | forced failing compile |
| --- | --- | --- |
| `result code = 0` | passed | **passed** ← inert, bug not caught |
| `result code = {{0}}` | passed | **failed** ← correct |

Break the literal: **`result code = {{0}}`**. `{{…}}` is a FileCheck regex, so it matches the digit
without the pattern text containing the digit that would self-match. Same family as the known `-g2`
`OpString` self-match trap, one layer earlier (IR dump, not emitted SPIR-V).

Note: a reviewer confidently claimed `{{0}}` means "literal `{0}`" and would fail. It does not —
proven by control: spelling it `{0}` *passes* on a healthy compile (that is the inert spelling), and
`{{1}}` *fails* on an exit-0 compile (so `{{N}}` is evaluated as a regex on the digit).

## Reproduce the Windows bug on Linux

No Windows box needed — substitute an unwritable path for `/dev/null`:
`-dump-ir -o /nonexistent-dir/out.spv`. Same `E00004`, exit 255, IR still fully dumped, test still
green. Use this as the negative control for any `result code` assertion you add.

## Two general rules this reinforces

- **Always negative-control a new assertion.** Force the failure you claim to catch and confirm the
  test *fails*. An assertion that cannot fail is the bug you were fixing, reintroduced.
- **FileCheck absent → tests report `Ignored`, not failed** (`slang-test-main.cpp:815-822`).
  `FileCheck` is not on `PATH` in the container; slang-test loads it via `libslang-llvm.so`, so it
  may well be live — verify by breaking an assertion on purpose before trusting any green run.
