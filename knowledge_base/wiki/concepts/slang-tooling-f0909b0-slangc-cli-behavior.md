---
title: "slangc CLI behavior: exit codes, crash semantics, output streams, and option propagation"
type: concept
group: slang-tooling
tags: [slangc, exit-codes, slang-assert, dump-ir, dump-module, warnings-as-errors, semantics, perf, filestream, fifo, output-paths]
source_count: 14
---

## TL;DR

slangc's exit codes, assert behavior, and output-stream layout are all easy to misread, and
several inspection paths silently drop the CLI options you passed.

- **Exit 255 is a normal graceful diagnostic, not a crash.** A real crash is **134** (SIGABRT,
  assert) or **139** (SIGSEGV). A check like `[ $ec -ge 132 ]` wrongly treats 255 as a signal.
- **`SLANG_ASSERT` unset → asserts THROW** (caught as E99997 "compilation aborted due to an
  exception"), not abort. Set `SLANG_ASSERT=system` to force a real SIGABRT.
- **Debug asserts do NOT always catch OOB.** "Segfault is Release-only because List asserts
  bounds in debug" is a plausible-but-wrong claim; a null-deref before any List access
  segfaults (exit 139) even in the debug build. Verify segfault claims by process exit code.
- **`-o /dev/null` fails for BINARY targets on any Linux build since v2025.24, not just
  in-container** — it fails E00004 and exits 255 exactly like an ICE. `FileStream` refuses
  every non-regular path (FIFOs, devices, `/dev/stdout` as a pipe); text targets slip through
  via a raw `fopen`. Write to a real file and record the byte count as a second signal.
- **Other FileStream writers fail quietly on special files:** `-depfile` is silent (exit 0,
  its result is discarded), `-reflection-json` prints a path-less E52004 and exits 0. Small
  outputs on a full disk also exit 0 with a 0-byte file (flush/close errors are ignored).
- **Relaxing that gate means auditing every write-mode caller for `seek`** (the record-replay
  mirror seeks per write and hits a Release-UB assert on a FIFO). `getPathType` FAILS on
  FIFOs rather than returning a non-FILE type, and `/dev/null` is seekable so it never
  reproduces a seek bug.
- **`head -N` on a compiler log can hide the ICE** — Slang prints warnings first. Grep for
  outcome classes (`assert failure|E99997`), don't slice by position.
- **`-dump-ir` writes to stderr, target text to stdout, non-interleaved.** slang-test composes
  FileCheck input as labeled blocks in fixed order, so `-o -` does NOT mix streams — migrating
  `-o /dev/null` → `-o -` is a clean swap.
- **`-dump-module` / `-get-module-info` build an inspection session from an EMPTY SessionDesc**
  — CLI options (e.g. `-experimental-feature`) are dropped; the fix serializes the outer
  linkage's option set into the desc.
- **`-warnings-as-errors` ALWAYS takes an operand** (`all` or `<id>,...`); it does not prevent
  the module write when a warning escalates at the write site.
- **DXC errors on duplicate `(semantic,index)`; Slang silently re-indexes** the collision.
- **Target-mode workloads have NO memory reporting** — the `[MEM]` protocol is driver-only.

## Crash vs. graceful error: read the signal, not a threshold

Before implementing a fix for a reported "crash", confirm it reproduces as an actual signal.
slangc exits **255** on an ordinary graceful diagnostic (a syntax error); 255 is not a
signal. A real crash is **134** (SIGABRT, an assert firing) or **139** (SIGSEGV, a raw null
deref). A buggy check `[ $ec -ge 132 ]` treats 255 as a signal — it isn't, so use exact
codes
[exit 255 is normal](../learnings/1786873188157-slangc-exit-255-is-a-normal-error-not-a-crash-veri.md).
Compounding this, with `SLANG_ASSERT` unset asserts **throw** (caught → E99997 "compilation
aborted due to an exception") rather than abort, so an assert path looks like a graceful error
unless you set `SLANG_ASSERT=system` to force a real SIGABRT. That atom also carries the
matching repro discipline: when a guard `if(x)` implies `x` can be null, enumerate *which*
producer path yields null and test THAT input — on slang#12568 the reviewer's `static
template<typename T>` at EOF returned a non-null error-recovery node, while the genuine null
came from a multi-declarator inner (`static template<typename T> int a, b;`). Don't accept the
first plausible repro. (A git-stash gotcha lives in the same atom: a bare `git stash` with no
local changes does nothing, and a later `git stash pop` may pop an unrelated sibling branch's
stash from the shared clone — recover with `git checkout HEAD -- <file>`.)

The dual trap is over-attributing a crash to Release-only builds. On slang#12482 the PR body
claimed the HLSL/GLSL source-target segfault was "Release-only, because `List::operator[]`
asserts bounds in debug" — **false**, caught by a revert-drill that segfaulted (exit 139) in
the standard debug build. The reasoning was locally true (`List::operator[]` does
`SLANG_ASSERT`, `_DEBUG` is defined, `handleAssert` throws) but the actual crash was a
null-deref before any List access: a `getEntryPointCount()==1` guard read the *requested-index*
count, not the program's actual entry-point count, so `getProgram()->getEntryPoint(0)->getStage()`
dereferenced a null/empty-program EntryPoint
[SLANG_ASSERT does not always catch OOB](../learnings/1786514794799-slang-debug-build-slang-assert-does-not-always-cat.md).
The transferable lessons: never assert "segfault is Release-only, debug asserts catch it"
without running the debug build in the reverted state and checking the *process exit code*
(139 ≠ a clean assertion-fail); and a plausible mechanism can be locally true yet not the
mechanism in play — trace the actual crash frame before writing it into a PR.

## Output paths and log slicing produce confident wrong readings

Two instrument traps each produced a wrong reading during slang#11004. First, `slangc ... -o
/dev/null` fails with `error[E00004]: cannot write output file '/dev/null'` and exits **255**
— an *infrastructure* failure indistinguishable by exit code from a real ICE, which voided a
positive control. Write to a real file and record the byte count as a second signal that
separates "compiled" from "died before writing output" (a minimal fragment shader is a stable
636 bytes)
[-o /dev/null fails, byte-count as second signal](../learnings/1786454371761-slangc-o-dev-null-fails-in-container-and-head-n-on.md).
The failure is not a container quirk: it is the `FileStream` special-file gate described in the
next section, and it hits only binary targets
[FIFOs/devices refused for binary output since v2025.24](../learnings/1790618025182-slangc-refuses-fifos-devices-for-binary-output-sin.md):

```bash
out=/tmp/x.spv; rm -f "$out"
slangc in.slang -target spirv -entry fs -stage fragment -o "$out" >log 2>&1; rc=$?
sz=0; [ -f "$out" ] && sz=$(stat -c %s "$out"); echo "rc=$rc spv_bytes=$sz"
```

Second, **`head -6` on a compiler log can hide the ICE** because Slang prints warnings first —
a `warning[E31159]` occupied the first 7 lines and pushed the `error[E99997] ... assert
failure` past the window, causing a crashing case to be classified "clean diagnostic". `cat`
the full log (single-file repros are tens of lines) or grep outcome classes explicitly
(`grep -qE "assert failure|E99997"`); order-dependent slicing is not a classifier when a log
has multiple severity tiers. The same atom warns never to publish from a catch-all `rc255`
bucket without reading its members (two "asymmetry" cells were the author's own `diffPair`
misuse), that `gh auth status` reporting the App token "invalid" with all-false permissions is
a known non-gate (reads and comment-POSTs still work), and that `$?` after a pipe measures the
last stage, not slangc.

There is, however, a *corrected* premise about output streams worth flagging as a
supersession. `docs/generated/tests/_meta/prompts/_common.md` long claimed that a `-dump-ir` +
`-target <text>` test MUST use `-o /dev/null` because `-o -` would mix target text with the IR
dump and break FileCheck. **That is false.** `-dump-ir` writes to **stderr**, target text to
**stdout**, and slang-test composes the FileCheck input as *non-interleaved* labeled blocks in
a fixed order (`result code` → `standard error = { IR }` → `standard output = { target text }`,
`slang-test-main.cpp:2198-2202`). So with `-o -` the IR block is byte-identical to the
`-o /dev/null` case and target text lands in a separate trailing block — migrating
`-o /dev/null` → `-o -` is a clean swap, and only `CHECK-NOT`/`CHECK-DAG`/`CHECK-COUNT` whose
match region can run past the IR into the now-populated stdout block need a second look
[streams do not mix](../learnings/1788160383724-slang-test-dump-ir-target-o-does-not-mix-streams-s.md).
The meta-rule: verify stream/composition claims against `slang-test-main.cpp` before repeating
harness lore from `_common.md`.

## Special-file and failed-write outputs: the FileStream gate (slang#13294)

Consider `slangc x.slang -target spirv -o /dev/null` next to the same command with
`-target spirv-asm`. The first fails with E00004 and the second succeeds, on any Linux build
since #9217 (v2025.24). `FileStream::_init` (`source/core/slang-stream.cpp:131-139`) calls
`Path::getPathType` on every existing path, and `getPathType` returns `SLANG_FAIL` for anything
that is not `S_ISDIR`/`S_ISREG`. Every FileStream-based writer therefore refuses FIFOs,
`/dev/null` and `/dev/stdout` when it is a pipe: binary `-o` fails with E00004, `-depfile` fails
silently with exit 0, and `-reflection-json` prints E52004 but still exits 0. Text targets
(glsl/hlsl/spirv-asm) avoid the gate. `File::writeAllTextIfChanged` first tries `readAllText`,
which hits the check, and then falls back to a raw `fopen` in `writeNativeText`. So when a text
target works and the binary target does not, suspect FileStream first, and treat any test
result that relies on `-o /dev/null` with care. Old release binaries bisect a CLI regression in
seconds with `gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'`
[FIFOs/devices refused for binary output since v2025.24](../learnings/1790618025182-slangc-refuses-fifos-devices-for-binary-output-sin.md),
[text targets bypass FileStream via writeNativeText](../learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md).

Several of these failures are silent or hard to read. `-depfile` failures of every kind
(missing directory, a directory path) vanish because `slang-end-to-end-request.cpp:1262`
discards the result of `writeDependencyFile`. `Diagnostics::UnableToWriteFile` (E52004) carries
the path only in its span (`'~path'`), so a diagnostic raised with no source location prints
just `error[E52004]: unable to write file`. For a location-less output-file failure, PR #13295
uses `CannotWriteOutputFile` (E00004, "cannot write output file '<path>'"), which binary `-o`
already used. `EndToEndCompileRequest::compile()` also snapshots `m_diagnosticOutput` before the
reflection-json, repro-dump and perf diagnostics, so an API caller with no diagnostic writer
never sees an error emitted after that point unless the snapshot is refreshed. Refreshing it is
safe because `StringBuilder::produceString()` copies without clearing. A full disk shows the
same pattern: `FileStream::flush` and `close` ignore the results of `fflush`/`fclose`, so an
output smaller than the stdio buffer exits 0 and leaves a 0-byte file, while a larger output
correctly gets E00004 (filed as a #13294 follow-up)
[E52004 is path-less without a location](../learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md),
[diagnostic-output snapshot and getPathType on FIFOs](../learnings/1790646938428-relaxing-a-shared-filestream-gate-audit-every-writ.md),
[RLIMIT_FSIZE full-disk simulation](../learnings/1790644539122-simulate-a-full-disk-for-slangc-output-tests-with-.md).

Relaxing `FileStream::_init` so that the write modes (`Create`/`Append`) accept existing FIFOs,
ttys and devices, as PR #13295 does, is a change to a shared gate. Audit every write-mode
caller for `seek`, not only the `Open` callers, and grep all of `source/`. The first audit of
#13295 searched only `source/core`, `source/slang` and `source/compiler-core`, and so it missed
`source/slang-record-replay`. There, `ReplayStream::setMirrorFile` (`replay-stream.cpp:137`)
opens in `Create` mode and `ReplayStream::write` seeks before every write (`:100`). `fseek` on a
FIFO or tty fails with ESPIPE, and `FileStream::seek` then hits `SLANG_ASSERT(rs == 0)`, which
throws in Debug and is `SLANG_ASSUME` (undefined behaviour) in Release. The fix stays local to
that consumer: `setMirrorFile` refuses an existing non-regular path. `/dev/null` is seekable on
Linux, so it never reproduces a seek bug; test with a FIFO or tty, and refuse `/dev/null` as a
mirror because it keeps nothing, not because it cannot seek. Two predicate traps sit next to
this. First, `getPathType` FAILS for FIFOs, devices and sockets instead of succeeding with a
non-FILE type, so "exists and is not a regular file" must be written as
`File::exists(p) && !(SLANG_SUCCEEDED(getPathType(p, &t)) && t == SLANG_PATH_TYPE_FILE)`; a spec
that says "getPathType succeeds and isn't FILE" silently misses FIFOs. Second,
`FileMode::Open` + `FileAccess::Write` maps to `"wb"`, so a policy keyed on mode behaves
differently from one keyed on access
[Create-mode relaxation reaches ReplayStream's seek-per-write mirror](../learnings/1790626903530-filestream-create-mode-relaxations-reach-replaystr.md),
[audit every writer for seeks; getPathType FAILS for FIFOs](../learnings/1790646938428-relaxing-a-shared-filestream-gate-audit-every-writ.md).

Three test techniques make these paths checkable without a GPU or threads. A FIFO output test
runs `mkfifo`, opens the read end with `O_RDONLY|O_NONBLOCK` BEFORE starting slangc through
`ProcessUtil::execute`, and drains it with `read()` until it returns 0 after slangc exits;
slangc's write-open succeeds at once and small outputs fit in the pipe buffer
(`tools/slang-unit-test/unit-test-special-file-output.cpp`). In the container's Debug build the
default `cmake --build --preset debug` compiled `slang-unit-test` despite `EXCLUDE_FROM_ALL`, but
confirm a new test is in the binary with `strings libslang-unit-test-tool.so | grep <TestName>`
[FIFO unit-test pattern](../learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md).
For FIFO *input* from the shell, wrap the writer as `timeout N sh -c 'cat f > fifo'`; a plain
`(cat f > fifo) &` blocks in `open()` forever if slangc never opens the FIFO, and the shell hangs
[FIFO input needs a timeout wrapper](../learnings/1790618025182-slangc-refuses-fifos-devices-for-binary-output-sin.md).
To simulate a full disk on an ordinary file without `/dev/full`, run
`bash -c "trap '' XFSZ; ulimit -f 0; exec slangc ..." 2>&1 | cat`, which makes every write fail
with EFBIG instead of killing the process with SIGXFSZ. Keep the limit inside the
`bash -c ... exec`, and pipe to an unlimited `cat` outside it: the agent Bash tool's own
stdout/stderr is a file, so a limit on the whole command also swallows slangc's diagnostics and
your `echo rc=$?`, which reads as "no error printed"
[RLIMIT_FSIZE full-disk simulation](../learnings/1790644539122-simulate-a-full-disk-for-slangc-output-tests-with-.md).

## Options dropped on inspection paths; option semantics

Two `slangc` inspection handlers build a throwaway session from a **default-constructed empty
`slang::SessionDesc()`**, silently dropping the CLI options you passed. On slang#12692,
`slangc -experimental-feature -dump-module x.slang-module` fails E00104 ("...is an
experimental module...") even with the flag present, because the empty desc yields
`ExperimentalFeature=false` in the new linkage's option set while the parsed flag lives on the
*outer* linkage and was never propagated. The principled fix serializes the outer linkage's
option set (via `CompilerOptionSet::serialize`) into `desc.compilerOptionEntries` in one shared
helper both handlers call
[inspection session drops options](../learnings/1787370746933-slangc-dump-module-get-module-info-inspection-sess.md).
Two gotchas that atom flags: `-get-module-info`'s gate is *latent, not identical* (it reads
only RIFF header chunks and never imports dependencies, so E00104 can't occur there — a shared
helper fixes both at root while keeping only the testable `dump-module` path as the
regression); and propagating the whole option set re-materializes any `-r` ReferenceModule
entries into the inspection linkage (benign duplicate construction). It also notes GPU is
per-container — a `tests/neural (vk)` variant failing is not automatically "no GPU" when the
box has an NVIDIA L40S; confirm a suspected-flaky test fails identically on master first.

On option *semantics*: `-warnings-as-errors` **always takes an operand** (`all` or
`<id>[,<id>...]`) — `slangc -warnings-as-errors foo.slang -o out` is invalid because it
swallows `foo.slang` as the warning-id operand, so verify CLI examples in PR bodies/tests
against the actual parser. And a warning escalated to an error *at the module-write site* does
NOT prevent the write: the sink-error guard runs after codegen but before
`maybeCreateContainer()` emits any write diagnostic, so slangc exits non-zero yet leaves the
`.slang-module` on disk (the `-no-codegen` path is worse — it returns SLANG_OK, exit 0)
[warnings-as-errors operand + module still written](../learnings/1788913047747-slangc-warnings-as-errors-needs-an-operand-module-.md).
The same atom's meta-lesson: when a codex critique returns must-fix on what is really a scope
call, make the case with concrete reasons (scope, ownership, a factual correction) rather than
reflexively complying — codex accepted "document as a known limitation" once given the
rationale.

## Cross-target semantic behavior and profiling

Two facts round out slangc's observable behavior. First, **DXC errors on duplicate semantics
where Slang silently re-indexes.** An unindexed HLSL semantic has implicit index 0
(`TEXCOORD` ≡ `TEXCOORD0`), so two fields on the same `(base,index)` are a genuine duplicate:
DXC/DXIL fails validation and SPIR-V emits an explicit `"output semantic '%0' used more than
once"`, but Slang has no duplicate-user-semantic diagnostic — `fixFieldSemanticsOfFlatStruct`
→ `_returnNonOverlappingAttributeIndex` bumps the colliding field to a free index (`BAR`+`BAR0`
→ `BAR`/`BAR_1` on Metal). If asked whether Slang should error too: it's worth surfacing
(silent re-index masks a likely typo), but a hard error is a breaking change since silent
legalization has shipped and tests rely on it — a warning first is the safe non-breaking step
[DXC errors, Slang re-indexes](../learnings/1788387854199-dxc-errors-on-duplicate-semantics-slang-silently-r.md).
(That atom repeats the `gh auth status` "invalid" App-token non-gate.)

Second, on profiling: the `[MEM] name\tNNNkb` line protocol is emitted **only** by the
compile-perf harness's own native driver (`tools/compile-perf/native/api-driver.cpp:354`),
never from `source/`. slangc's `-report-perf-benchmark` emits only `[*]` ms timers + "Type
Dictionary Size". So **target-mode workloads (which go through the slangc CLI, not the dlopen
api-driver) have no memory reporting at all** — adding a per-component memory metric for them
is net-new compiler-side work, not a tracker change
[compile-perf MEM is driver-only](../learnings/1786631260810-compile-perf-mem-protocol-is-driver-only-target-mo.md).
The tracker side is name-generic (`bench.py` stores arbitrary `name→kb` on a `Kb` suffix), and
`MemoryArena::calcTotalMemoryUsed()`/`calcTotalMemoryAllocated()` exist with zero production
call sites as the used-vs-reserved primitive any arena-component counter would use. That atom
also records that per-linkage loaded modules keep their IR in their own
`IRModule::m_memoryArena` and register in `mapNameToLoadedModules` (only `Core` lands in
`Session::coreModules`), so a walk summing only `coreModules` misses them.

## Default diagnostic output is the rich Rust-style block, not the classic MSVC line

When triaging anything about slangc's command-line diagnostic FORMAT (e.g. #13157 "VS-friendly
`--diagnostic-format`"), do NOT assume the default is the classic MSVC single line. Empirically
verified on top-of-tree (`slangc v2026.13.1-50-g3649fb982`), the *default* output is the **rich
Rust-style block** (`error[E30015]: undefined identifier` / ` --> path:3:5` / a caret-underlined
source line) even with NO `-enable-experimental-rich-diagnostics` flag — rich is selected when
`options.shouldEmitRichDiagnostics()` sets `DiagnosticSink::Flag::AlwaysGenerateRichDiagnostics`
(`slang-compiler-options.cpp:679-681`), dispatched by `diagnoseRichImpl`
(`slang-diagnostic-sink.cpp:628-722`) vs the classic `diagnoseImpl` (`:596/:762`). The classic
single-line formatter still exists as the non-rich path (`formatDiagnostic()`,
`compiler-core/slang-diagnostic-sink.cpp:148`, layout `:156-176`, producing
`path(line): error <id>: message`) with two quirks: the column is emitted only under
`Flag::LanguageServer` (`:159-162`), and the error id is a **bare integer** (`error 30015:`)
where the rich renderer shows bracketed `error[E30015]:`. Consequence for triage/impl: an
MSVC/VS-parseable single line (`path(line, column): error E30015: message`) is a genuinely
DISTINCT third style — closest to the classic path but needing column + an `E`-prefixed id +
routing that BYPASSES the default rich renderer; it is NOT "flip the column flag on the default."
A value-taking CLI option follows the `-diagnostic-color <always|never|auto>` precedent
(`slang-options.cpp:1267`/handler `:2942`), and a new `CompilerOptionName` appends after
`DiagnosticColor=144` in `include/slang.h` (ABI-safe); an opt-in flag means zero golden-file
churn, whereas changing the default to emit column would touch hundreds of `tests/**/*.slang`
expected-output blocks
[slangc default diagnostic output is now the rich Rust-style block, not the classic MSVC line](../learnings/1789662675615-slangc-default-diagnostic-output-is-now-the-rich-r.md).

**Source learnings (14):**
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
