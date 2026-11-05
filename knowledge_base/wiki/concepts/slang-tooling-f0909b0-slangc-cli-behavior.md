---
title: "slangc CLI behavior: exit codes, crash semantics, output streams, and option propagation"
type: concept
group: slang-tooling
tags: [slangc, exit-codes, slang-assert, dump-ir, dump-module, warnings-as-errors, semantics, perf, filestream, fifo, output-paths, e00070, entry-point, container-output, slang-module]
source_count: 17
---

## TL;DR

slangc's exit codes, assert behavior, and output streams are easy to misread, and several
inspection paths silently drop the CLI options you passed.

- **Exit 255 is a normal graceful diagnostic, not a crash.** A real crash is **134** (SIGABRT)
  or **139** (SIGSEGV); `[ $ec -ge 132 ]` wrongly treats 255 as a signal.
- **`SLANG_ASSERT` unset → asserts THROW** (caught as E99997), not abort; `SLANG_ASSERT=system`
  forces a real SIGABRT. Debug asserts do NOT always catch OOB — a null-deref segfaults (139)
  in debug too. Verify segfault claims by process exit code.
- **`-o /dev/null` fails for BINARY targets on any Linux build since v2025.24** — E00004, exit
  255, exactly like an ICE. `FileStream` refuses every non-regular path (FIFOs, devices,
  `/dev/stdout` as a pipe); text targets slip through via a raw `fopen`. Write to a real file
  and record the byte count as a second signal.
- **Other FileStream writers fail quietly:** `-depfile` silent (exit 0), `-reflection-json` a
  path-less E52004 with exit 0; small outputs on a full disk exit 0 with a 0-byte file.
- **Relaxing that gate means auditing every write-mode caller for `seek`** (the record-replay
  mirror seeks per write: Release UB on a FIFO). `getPathType` FAILS on FIFOs; `/dev/null` is
  seekable, so it never reproduces a seek bug.
  `.slang-module` without `-embed-downstream-ir`, host-callable `.zip`). Check the file exists.
- **A probe matrix with the wrong `-entry` fails E38000 on both sides** and reads "no diff".
- **A location-less diagnostic drops its span message**: E52004 prints no path, so output-file
  failures without a location use E00004.
- **`head -N` on a compiler log can hide the ICE** (warnings print first). Grep outcome classes.
- **`-dump-ir` → stderr, target text → stdout, non-interleaved**: `-o /dev/null` → `-o -` in
  slang-test is a clean swap.
- **`-dump-module` / `-get-module-info` use an EMPTY SessionDesc**, dropping CLI options; the
  fix serializes the outer linkage's option set into the desc.
- **`-warnings-as-errors` ALWAYS takes an operand**, and does not prevent the module write when
  a warning escalates at the write site.
- **`-lang <x>` applies only to inputs AFTER it**; slang-test puts the path first, so use
  SIMPLE_EX with `-lang` first.
- **DXC errors on duplicate `(semantic,index)`; Slang silently re-indexes.**
- **Target-mode workloads have NO memory reporting** — `[MEM]` is driver-only.
- **The default diagnostic format is the rich Rust-style block**; an MSVC-parseable line is a
  distinct opt-in third style.

## Crash vs. graceful error: read the signal, not a threshold

Before fixing a reported "crash", confirm it reproduces as a signal: test exact codes (255
graceful, 134 SIGABRT, 139 SIGSEGV). With `SLANG_ASSERT`
unset, asserts **throw** (caught as E99997 "compilation aborted due to an exception"), so an
assert path looks graceful unless `SLANG_ASSERT=system` forces a real SIGABRT. When a guard
`if(x)` implies `x` can be null, find *which* producer yields null and test that input: on
slang#12568 the reviewer's `static template<typename T>` at EOF returned a non-null
error-recovery node; the genuine null came from a multi-declarator inner
(`static template<typename T> int a, b;`). Rider: a bare `git stash` with no local changes does
nothing, so a later `git stash pop` in the shared clone may pop a sibling branch's stash —
recover with `git checkout HEAD -- <file>`
[exit 255 is normal](../learnings/1786873188157-slangc-exit-255-is-a-normal-error-not-a-crash-veri.md).

The opposite trap is blaming Release-only builds. slang#12482's PR body called the HLSL/GLSL
source-target segfault "Release-only, because `List::operator[]` asserts bounds in debug"; a
revert drill segfaulted (exit 139) in the debug build. The reasoning was locally true
(`List::operator[]` does `SLANG_ASSERT`, `_DEBUG` is defined, `handleAssert` throws), but the
crash was an earlier null deref: a `getEntryPointCount()==1` guard read the *requested-index*
count, not the program's entry-point count, so `getProgram()->getEntryPoint(0)->getStage()`
dereferenced an empty program's EntryPoint. Run the reverted debug build, check the exit code,
and trace the actual crash frame before writing a mechanism into a PR
[SLANG_ASSERT does not always catch OOB](../learnings/1786514794799-slang-debug-build-slang-assert-does-not-always-cat.md).

## Output paths and log slicing produce confident wrong readings

**`-o /dev/null` fails for binary targets** with `error[E00004]: cannot write output file
'/dev/null'`, exit **255** — like an ICE; on slang#11004 it voided a positive control. It is the `FileStream` special-file gate (next section), not a
container quirk
[byte count as second signal](../learnings/1786454371761-slangc-o-dev-null-fails-in-container-and-head-n-on.md),
[binary output refuses FIFOs/devices](../learnings/1790618025182-slangc-refuses-fifos-devices-for-binary-output-sin.md).
Verifying slang#11782 in the slang-fixer container, `-target spirv -o /dev/null` exited 255 on a
successful compile, and the workflow docs suggest exactly that command for SPIR-V validation, so
EXIT=255 there is not a compile failure
[fixer container](../learnings/1790802490676-slangc-o-dev-null-fails-with-e00004-in-the-fixer-c.md);
under `SLANG_RUN_SPIRV_VALIDATION=1` the E00004 is easy to misread as a spirv-val failure. Write
to a real file and record the byte count (a minimal fragment shader is a stable 636 bytes):

```bash
out=/tmp/x.spv; rm -f "$out"
slangc in.slang -target spirv -entry fs -stage fragment -o "$out" >log 2>&1; rc=$?
sz=0; [ -f "$out" ] && sz=$(stat -c %s "$out"); echo "rc=$rc spv_bytes=$sz"
```

**`head -N` on a compiler log can hide the ICE**, because Slang prints warnings first: a
`warning[E31159]` filled the first 7 lines and pushed `error[E99997] ... assert failure` past
`head -6`, so a crash was classified "clean diagnostic". `cat` the full log or grep outcome
classes (`grep -qE "assert failure|E99997"`). Don't publish from a catch-all `rc255` bucket
without reading its members (two "asymmetry" cells were the author's own `diffPair` misuse);
`$?` after a pipe measures the last stage, not slangc; and `gh auth status` reporting the App
token "invalid" with all-false permissions is a known non-gate (reads and comment POSTs work).

**A probe matrix with the wrong entry point is vacuous.** With the wrong `-entry` (`main` vs
`computeMain`) both master and fix fail E38000 and the cell reads "no diff". Grep the matrix for
E38000 before trusting it, and write each cell to a real temp file
[wrong entry name](../learnings/1791434055039-master-vs-fix-probe-matrix-wrong-entry-name-makes-.md).

**`-o -` does not mix streams (corrects harness lore).** `docs/generated/tests/_meta/prompts/_common.md`
long claimed a `-dump-ir` + `-target <text>` test must use `-o /dev/null` because `-o -` would mix
target text into the IR dump. False: `-dump-ir` writes to **stderr**, target text to **stdout**,
and slang-test composes FileCheck input as non-interleaved labeled blocks in fixed order
(`result code` → `standard error = { IR }` → `standard output = { target text }`,
`slang-test-main.cpp:2198-2202`). So `-o /dev/null` → `-o -` is a clean swap; only
`CHECK-NOT`/`CHECK-DAG`/`CHECK-COUNT` whose match region can run past the IR into the stdout
block need review. Verify stream claims against `slang-test-main.cpp`, not `_common.md`
[streams do not mix](../learnings/1788160383724-slang-test-dump-ir-target-o-does-not-mix-streams-s.md).

## Special-file and failed-write outputs: the FileStream gate (slang#13294)

Since #9217 (v2025.24), on any Linux build, `slangc x.slang -target spirv -o /dev/null` fails
E00004 while `-target spirv-asm` succeeds. `FileStream::_init` (`source/core/slang-stream.cpp:131-139`)
calls `Path::getPathType` on every existing path, which returns `SLANG_FAIL` for anything not
`S_ISDIR`/`S_ISREG`, so every FileStream writer refuses FIFOs, `/dev/null`, and `/dev/stdout` as
a pipe: binary `-o` fails E00004, `-depfile` fails silently with exit 0, and `-reflection-json`
prints E52004 but exits 0. Text targets (glsl/hlsl/spirv-asm) avoid the gate:
`File::writeAllTextIfChanged` tries `readAllText` (which hits the check), then falls back to a
raw `fopen` in `writeNativeText`. When a text target works and the binary one doesn't, suspect
FileStream first. Old release binaries bisect a CLI regression in seconds:
`gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'`
[FIFOs/devices refused since v2025.24](../learnings/1790618025182-slangc-refuses-fifos-devices-for-binary-output-sin.md),
[text targets bypass via writeNativeText](../learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md).

**Silent and hard-to-read failures.** `-depfile` failures of every kind (missing directory, a
directory path) vanish because `slang-end-to-end-request.cpp:1262` discards the result of
`writeDependencyFile`. E52004 (`Diagnostics::UnableToWriteFile`) carries the path only in its
span (`'~path'`), so without a source location it prints just `error[E52004]: unable to write
file`; PR #13295 uses `CannotWriteOutputFile` (E00004, "cannot write output file '<path>'") for
location-less output failures, as binary `-o` already did. `EndToEndCompileRequest::compile()`
snapshots `m_diagnosticOutput` before the reflection-json, repro-dump and perf diagnostics, so an
API caller with no diagnostic writer never sees a later error unless the snapshot is refreshed —
safe, because `StringBuilder::produceString()` copies without clearing. On a full disk,
`FileStream::flush`/`close` ignore the `fflush`/`fclose` results, so an output smaller than the
stdio buffer exits 0 with a 0-byte file while a larger one gets E00004 (a #13294 follow-up)
[path-less E52004](../learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md),
[diagnostic-output snapshot](../learnings/1790646938428-relaxing-a-shared-filestream-gate-audit-every-writ.md),
[full-disk simulation](../learnings/1790644539122-simulate-a-full-disk-for-slangc-output-tests-with-.md).

`EndToEndCompileRequest::maybeWriteContainer` returned `filter`/`writeContainer` failures without
a diagnostic and the void `generateOutput()` dropped them. Three cases were silent at base
2b73d69dd: (1) any container (`.slang-module`, `.slang-lib`, `.zip`, `.dir`) under a missing
directory; (2) `-target spirv -o x.slang-module` without `-embed-downstream-ir`, because the root
is a Container-kind artifact (IR + SPIR-V) and the single-file branch of `writeContainer` cannot
get a blob for it; (3) `-target host-callable -o x.zip` via slang-llvm, whose in-process library
has no blob (plain `-o x.so` reports E00098). Tests: `DIAGNOSTIC_TEST:SIMPLE(diag=…)` checks only
stderr, so use `filecheck=` with `result code = -1` when exit status matters; a
host-callable diagnostic test needs `-emit-cpu-via-llvm` so `runTest` gates it on slang-llvm
(otherwise the generic C++ path makes a blob-backed `.so` and the error never fires); and
submodules in a fresh `git worktree` need `git -c protocol.file.allow=always submodule update --init --recursive`

**Relaxing the gate is a shared-gate change: audit every write-mode caller for `seek`, across
all of `source/`.** PR #13295 lets the write modes (`Create`/`Append`) accept existing FIFOs,
ttys and devices. Its first audit searched only `source/core`, `source/slang` and
`source/compiler-core`, missing `source/slang-record-replay`: `ReplayStream::setMirrorFile`
(`replay-stream.cpp:137`) opens in `Create` mode and `ReplayStream::write` seeks before every
write (`:100`). `fseek` on a FIFO or tty fails with ESPIPE, and `FileStream::seek` then hits
`SLANG_ASSERT(rs == 0)` — a throw in Debug, `SLANG_ASSUME` (UB) in Release. The fix stays local:
`setMirrorFile` refuses an existing non-regular path, and refuses `/dev/null` because it keeps
nothing, not because it cannot seek. `/dev/null` is seekable on Linux, so it never reproduces a
seek bug; test with a FIFO or tty. Two predicate traps: `getPathType` FAILS for FIFOs, devices
and sockets instead of succeeding with a non-FILE type, so "exists and is not a regular file" is
`File::exists(p) && !(SLANG_SUCCEEDED(getPathType(p, &t)) && t == SLANG_PATH_TYPE_FILE)`; and
`FileMode::Open` + `FileAccess::Write` maps to `"wb"`, so a policy keyed on mode differs from one
keyed on access
[ReplayStream seek-per-write mirror](../learnings/1790626903530-filestream-create-mode-relaxations-reach-replaystr.md),
[getPathType FAILS for FIFOs](../learnings/1790646938428-relaxing-a-shared-filestream-gate-audit-every-writ.md).

**Testing these paths without a GPU or threads.** FIFO output: `mkfifo`, open the read end with
`O_RDONLY|O_NONBLOCK` BEFORE starting slangc through `ProcessUtil::execute`, and `read()` until
it returns 0 after slangc exits; slangc's write-open succeeds at once and small outputs fit the
pipe buffer (`tools/slang-unit-test/unit-test-special-file-output.cpp`). The container's default
`cmake --build --preset debug` built `slang-unit-test` despite `EXCLUDE_FROM_ALL`, but confirm a
new test is in the binary with `strings libslang-unit-test-tool.so | grep <TestName>`
[FIFO unit-test pattern](../learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md).
FIFO input from the shell: `timeout N sh -c 'cat f > fifo'`, because a plain `(cat f > fifo) &`
blocks in `open()` forever if slangc never opens the FIFO
[timeout wrapper](../learnings/1790618025182-slangc-refuses-fifos-devices-for-binary-output-sin.md).
Full disk without `/dev/full`: `bash -c "trap '' XFSZ; ulimit -f 0; exec slangc ..." 2>&1 | cat`
makes every write fail with EFBIG instead of SIGXFSZ. Keep the limit inside the `bash -c ... exec`
and pipe to an unlimited `cat`: the agent Bash tool's stdout/stderr is a file, so a limit on the
whole command also swallows slangc's diagnostics and your `echo rc=$?`
[RLIMIT_FSIZE](../learnings/1790644539122-simulate-a-full-disk-for-slangc-output-tests-with-.md).

## Options dropped on inspection paths; option semantics

**`-dump-module` / `-get-module-info` drop CLI options.** Both handlers build a throwaway session
from a default-constructed empty `slang::SessionDesc()`. On slang#12692,
`slangc -experimental-feature -dump-module x.slang-module` fails E00104 ("...is an experimental
module...") because the new linkage's option set has `ExperimentalFeature=false` while the parsed
flag lives on the outer linkage. The fix serializes the outer option set
(`CompilerOptionSet::serialize`) into `desc.compilerOptionEntries` in one shared helper both
handlers call. `-get-module-info`'s gate is latent, not identical (it reads only RIFF header
chunks and never imports dependencies, so E00104 cannot occur there), so only `dump-module`
carries the regression test; propagating the whole set re-materializes `-r` ReferenceModule
entries (benign duplicate construction)
[inspection session drops options](../learnings/1787370746933-slangc-dump-module-get-module-info-inspection-sess.md).
Rider: a failing `tests/neural (vk)` variant is not automatically "no GPU" — the box has an
NVIDIA L40S (missing only during the 09-28→10-16 host passthrough outage), so measure with
`nvidia-smi -L` each session
[historical GPU outage](../learnings/1792089571497-agent-containers-have-no-gpu-since-2026-09-28-host.md),
and confirm a suspected-flaky test fails identically on master first.

**`-warnings-as-errors` always takes an operand** (`all` or `<id>[,<id>...]`):
`slangc -warnings-as-errors foo.slang -o out` swallows `foo.slang` as the id list, so check CLI
examples in PR bodies and tests against the parser. A warning escalated at the module-write site
does NOT prevent the write: the sink-error guard runs after codegen but before
`maybeCreateContainer()` emits any write diagnostic, so slangc exits non-zero yet leaves the
`.slang-module` on disk (`-no-codegen` is worse: SLANG_OK, exit 0). When a codex critique returns
must-fix on what is really a scope call, argue with concrete reasons (scope, ownership, a factual
correction); codex accepted "document as a known limitation" once given them
[operand + module still written](../learnings/1788913047747-slangc-warnings-as-errors-needs-an-operand-module-.md).

**`-lang <x>` applies only to inputs that follow it.** `OptionKind::Language` (`slang-options.cpp`
~:3616-3640) sets the language for later input paths, and `Parser::getSourceLanguage()` is that
translation unit's language. slang-test's SIMPLE/DIAGNOSTIC_TEST runner builds
`<filePath> <directive options>` (`slang-test-main.cpp` ~:3168), so a `.slang` test whose
directive says `-lang hlsl` is parsed as Slang — `tests/diagnostics/hlsl-class-instantiation.slang`
(#10305) tests a Slang `class`, not an HLSL one. To test HLSL-dialect parsing, use SIMPLE_EX with
`-lang hlsl` before the path (new `.hlsl` tests are gitignored); the module-load variant is the
`-shaderobj` dialect gate on [the test-authoring page](slang-tooling-f0909b0-test-authoring-filecheck.md)
[-lang applies only to later inputs](../learnings/1791406993515-slangc-lang-applies-only-to-inputs-after-it-slang-.md).
Nested `-X` forwarding: the user guide's `-Xgcc -Xlinker --split -X.` fails with error 100003;
the working form adds the ellipsis, `-Xgcc... -Xlinker --split -X.`
[user-guide nested -X example](../learnings/1791403291004-slang-tools-pch-hides-missing-includes-in-new-unit.md).

## Cross-target semantic behavior and profiling

**DXC errors on duplicate semantics; Slang silently re-indexes.** An unindexed semantic has
implicit index 0 (`TEXCOORD` ≡ `TEXCOORD0`), so two fields on one `(base,index)` are a genuine
duplicate: DXC/DXIL fails validation and SPIR-V emits `"output semantic '%0' used more than
once"`, but Slang has no such diagnostic — `fixFieldSemanticsOfFlatStruct` →
`_returnNonOverlappingAttributeIndex` bumps the colliding field to a free index (`BAR`+`BAR0` →
`BAR`/`BAR_1` on Metal). Surface it (it masks a likely typo) as a warning first; a hard error is
breaking because tests rely on the shipped legalization
[DXC errors, Slang re-indexes](../learnings/1788387854199-dxc-errors-on-duplicate-semantics-slang-silently-r.md).

**Target-mode workloads have no memory reporting.** The `[MEM] name\tNNNkb` protocol comes only
from the compile-perf harness's native driver (`tools/compile-perf/native/api-driver.cpp:354`),
never from `source/`; slangc's `-report-perf-benchmark` emits only `[*]` ms timers and "Type
Dictionary Size". Target-mode workloads use the slangc CLI, not the dlopen api-driver, so a memory
metric for them is net-new compiler work, not a tracker change. The
tracker is name-generic (`bench.py` stores any `name→kb` on a `Kb` suffix);
`MemoryArena::calcTotalMemoryUsed()`/`calcTotalMemoryAllocated()` exist with zero production
call sites as the used-vs-reserved primitive; and per-linkage loaded modules keep IR in their own
`IRModule::m_memoryArena` and register in `mapNameToLoadedModules` (only `Core` lands in
`Session::coreModules`), so a `coreModules`-only walk misses them
[compile-perf MEM is driver-only](../learnings/1786631260810-compile-perf-mem-protocol-is-driver-only-target-mo.md).

## Default diagnostic output is the rich Rust-style block, not the classic MSVC line

For slangc diagnostic-FORMAT triage (e.g. #13157 "VS-friendly `--diagnostic-format`"): on top-of-tree (`slangc v2026.13.1-50-g3649fb982`)
the default is the **rich Rust-style block** (`error[E30015]: undefined identifier` /
` --> path:3:5` / a caret-underlined source line) with no `-enable-experimental-rich-diagnostics`
flag: `options.shouldEmitRichDiagnostics()` sets `DiagnosticSink::Flag::AlwaysGenerateRichDiagnostics`
(`slang-compiler-options.cpp:679-681`), dispatched by `diagnoseRichImpl`
(`slang-diagnostic-sink.cpp:628-722`) rather than the classic `diagnoseImpl` (`:596/:762`). The
classic formatter (`formatDiagnostic()`, `compiler-core/slang-diagnostic-sink.cpp:148`, layout
`:156-176`, `path(line): error <id>: message`) emits the column only under `Flag::LanguageServer`
(`:159-162`) and a **bare integer** id (`error 30015:`). An MSVC/VS-parseable line
(`path(line, column): error E30015: message`) is a distinct third style (column, `E`-prefixed id,
routing that bypasses the rich renderer), not "flip the column flag". A value-taking option follows the `-diagnostic-color <always|never|auto>` precedent
(`slang-options.cpp:1267`, handler `:2942`); a new `CompilerOptionName` appends after
`DiagnosticColor=144` in `include/slang.h` (ABI-safe); an opt-in flag means zero golden-file
churn; changing the default would touch hundreds of `tests/**/*.slang` expected-output blocks
[rich Rust-style default](../learnings/1789662675615-slangc-default-diagnostic-output-is-now-the-rich-r.md).

**Source learnings (17):**
- [Master-vs-fix probe matrix: wrong entry name makes it vacuous](../learnings/1791434055039-master-vs-fix-probe-matrix-wrong-entry-name-makes-.md) — both binaries fail E38000 → "no diff"; `-o /dev/null` + validation gives E00004, not a spirv-val failure
- [slangc -lang applies only to inputs after it; slang-test SIMPLE puts the file path first](../learnings/1791406993515-slangc-lang-applies-only-to-inputs-after-it-slang-.md) — a `.slang` test with `-lang hlsl` is still parsed as Slang; use a `.hlsl` file (#10305, #13495)
- [slangc -o /dev/null fails in-container; and head -N on a compiler log hides the ICE](../learnings/1786454371761-slangc-o-dev-null-fails-in-container-and-head-n-on.md) — E00004 exit 255 looks like an ICE; byte-count as a second signal; warnings print first so grep outcome classes; don't publish from an unread `rc255` catch-all bucket.
- [Slang debug build: SLANG_ASSERT does NOT always catch OOB — verify segfault claims empirically](../learnings/1786514794799-slang-debug-build-slang-assert-does-not-always-cat.md) — Null-deref before any List access segfaults (exit 139) in debug; the requested-index-vs-program-count guard; a locally-true mechanism need not be the one in play.
- [slangc exit 255 is a normal error, not a crash — verify signals + the real null path](../learnings/1786873188157-slangc-exit-255-is-a-normal-error-not-a-crash-veri.md) — 134/139 are real crashes; `SLANG_ASSERT=system` forces SIGABRT; enumerate which producer yields null (multi-declarator, not EOF); shared-clone `git stash pop` hazard.
- [compile-perf [MEM] protocol is driver-only; target-mode memory attribution is net-new work](../learnings/1786631260810-compile-perf-mem-protocol-is-driver-only-target-mo.md) — `[MEM]` only from the api-driver; `-report-perf-benchmark` emits timers only; `calcTotalMemoryUsed/Allocated` primitives; per-linkage modules missed by a `coreModules`-only walk.
- [slangc -dump-module/-get-module-info inspection session drops CLI options (empty SessionDesc)](../learnings/1787370746933-slangc-dump-module-get-module-info-inspection-sess.md) — Empty desc → ExperimentalFeature=false → E00104; serialize the outer option set in one shared helper; `-get-module-info`'s gate is latent; GPU is per-container.
- [slang-test -dump-ir + target: `-o -` does NOT mix streams (stderr=IR, stdout=target)](../learnings/1788160383724-slang-test-dump-ir-target-o-does-not-mix-streams-s.md) — Corrects `_common.md` lore; non-interleaved labeled blocks; `-o /dev/null`→`-o -` is a clean swap; only trailing-match CHECK-NOT/DAG/COUNT need review.
- [DXC errors on duplicate semantics; Slang silently re-indexes them](../learnings/1788387854199-dxc-errors-on-duplicate-semantics-slang-silently-r.md) — `(base,index)` collision rules; DXIL/SPIR-V diagnose, Slang legalizes via `_returnNonOverlappingAttributeIndex`; a hard error would be breaking, warn first.
- [slangc -warnings-as-errors needs an operand + module still written when it escalates](../learnings/1788913047747-slangc-warnings-as-errors-needs-an-operand-module-.md) — The operand requirement; the write-site escalation leaves the `.slang-module` on disk; `-no-codegen` returns SLANG_OK; argue scope-calls to codex with reasons.
- [FileStream refuses FIFOs/devices since v2025.24 (binary -o E00004, -depfile silent, -reflection-json E52004 exit 0); text targets bypass; depfile result discarded; release-binary bisect; FIFO-input timeout wrapper.](../learnings/1790618025182-slangc-refuses-fifos-devices-for-binary-output-sin.md)
- [Location-less E52004 has no path, use E00004; nonblocking-FIFO unit-test pattern; slang-unit-test built by default debug build.](../learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md)
- [Relaxing Create/Append reaches ReplayStream's seek-per-write mirror (ESPIPE, Release UB); /dev/null seeks fine; Open+Write maps to "wb".](../learnings/1790626903530-filestream-create-mode-relaxations-reach-replaystr.md)
- [Audit every writer for seek incl. slang-record-replay; getPathType FAILS for FIFOs; /dev/null refused as mirror since it keeps nothing; diagnostic-output snapshot.](../learnings/1790646938428-relaxing-a-shared-filestream-gate-audit-every-writ.md)
- [`trap '' XFSZ; ulimit -f 0` inside bash -c, piped to cat; small outputs exit 0 with 0-byte file because flush/close errors are ignored.](../learnings/1790644539122-simulate-a-full-disk-for-slangc-output-tests-with-.md)
- [slangc default diagnostic output is now the rich Rust-style block, not the classic MSVC line](../learnings/1789662675615-slangc-default-diagnostic-output-is-now-the-rich-r.md) — verified on top-of-tree; rich via `shouldEmitRichDiagnostics` with no flag; the classic path emits column only under LanguageServer + a bare-integer id; an MSVC-parseable single line is a distinct opt-in third style.
- [slangc -o /dev/null fails with E00004 in the fixer container (slang#11782)](../learnings/1790802490676-slangc-o-dev-null-fails-with-e00004-in-the-fixer-c.md) — workflow docs suggest it for validation checks; EXIT=255 there is not a compile failure
