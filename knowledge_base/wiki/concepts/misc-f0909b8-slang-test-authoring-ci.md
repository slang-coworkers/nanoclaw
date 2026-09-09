---
title: "Slang test authoring, FileCheck traps, unit-test linkage, and CI-infra triage"
type: concept
group: misc
tags: [slang-test, filecheck, dump-ir, lang-server, unit-test, slang-static-unit-test, slang-api, visibility, ci, test-falcor, regression-test, revert-drill]
source_count: 13
---

## TL;DR

Twelve atoms on getting Slang regression tests to actually *catch* the thing, and
on reading CI signal correctly.

- **A regression test whose two paths are behaviorally identical can't distinguish a
  correct fix from a no-op.** Give the paths distinct observable outputs and run a
  revert drill (WITHOUT the fix the buffer differs; WITH it, correct). Applies to
  witness-table/dispatch fixes and to liveness/mark-encoding schemes (two-directional
  test with a false-live positive control).
- **FileCheck scans the WHOLE test file for `<PREFIX>:` — including inside `//`
  comments and backticks.** Never write the literal `CPP:`/`CHECK:` in test prose;
  refer to it without the colon.
- **`-dump-ir` output goes to stderr, target text to stdout — they never
  interleave**, so `-o -` is a safe, portable replacement for `-o /dev/null` in
  dump-ir discard tests. The long-standing "streams mix, `-o -` doesn't work"
  warning was flatly false.
- **An emit-behavior change breaks emit-shape CHECK tests repo-wide**, not just in
  your feature's dir — `grep -rl` the whole `tests/` tree for the construct + target
  before pushing.
- **A source-level emit gate can be masked by a downstream equivalent** (NVRTC's
  `--use_fast_math` maps `sinf`→`__sinf`), giving a false-positive PTX assertion —
  assert on the EMITTED SOURCE, not downstream-compiled PTX.
- **Unit tests calling non-exported `source/slang` symbols must live in
  `tools/slang-static-unit-test`** (links the compiler statically); the normal suite
  links `libslang` with hidden visibility → link error. Same visibility law means a
  **test-observability counter must be an `SLANG_API`-exported accessor**, not a
  plain class static (per-DSO copies).
- **`SLANG_CHECK(x)` self-terminates with `;`** — brace `if/else` bodies.
- **`test-falcor` red on an otherwise-green PR is usually external-CI infra** (403 /
  rate-limit at submit), not your code; a 403 won't self-heal via re-run.

## Making the test actually discriminate

The recurring failure is a test that passes with OR without the fix. On an
`__EnumType`-forwarding regression, the extension's `getValue` was behaviorally
identical to `int`'s, so the GVN merge was invisible — making the extension return
`...+1` and running a revert drill proved the new conformance-identity operand was
load-bearing
[load-bearing regression test after an upstream partial fix](../learnings/1788205014032-load-bearing-regression-test-after-an-upstream-par.md).
The same principle sharpened for liveness/dead-code marking: the merge-precondition
bar is a two-directional test (one assertion fails if live code is dropped, one if
dead code is wrongly kept via a dangling-operand miscompile) — a "live value
survives" check alone is half a control
[two-directional test with a false-live positive control](../learnings/1788301800371-approver-challenger-miss-validated-for-liveness-ma.md).

## FileCheck and slang-test harness traps

FileCheck parses any prefix-colon token anywhere in a `.slang` file, so a comment
like `` // the positive `CPP:` anchor `` is silently parsed as a `CPP:` directive
and fails the test on your prose — write "the `CPP` anchor line" (no colon)
[FileCheck parses any prefix-colon token in comments](../learnings/1788302566910-slang-test-filecheck-parses-any-prefix-colon-token.md).
On stream ordering, `-dump-ir` goes to stderr and target text to stdout in a fixed
trailing block that never interleaves, so `-o -` cleanly replaces `-o /dev/null` for
dump-ir discard tests — verified by a three-way corpus comparison; the propagated
"streams mix" warning (issue #12832, triager memo, fixer prep) was unfounded
[-o - safely replaces -o /dev/null in dump-ir tests](../learnings/1788160188725-slang-test-o-safely-replaces-o-dev-null-in-dump-ir.md).
The related nightly-CI lesson: a red run can have a big cause AND a small cause
simultaneously — pull the pass/fail COUNT and compare to the prior baseline; the
`-o /dev/null` guard mass-failure (973 tests) was hidden behind a single AVX-512
SIGILL job that a prior triage blamed for the whole redness
[nightly Slang Test red has two distinct causes](../learnings/1788077660856-nightly-slang-test-red-08-29-30-has-two-distinct-c.md).

## Emit-shape blast radius and downstream masking

When a change alters *code emission* for a language construct, the blast radius is
every filecheck test pinning that construct's output, scattered across `tests/bugs`,
`tests/language-feature`, `tests/glsl-intrinsic`, etc. — locally running only your
feature dir misses them; a passing `COMPARE_COMPUTE` arm alongside a failing
emit-shape CHECK is the tell of a stale pin, not a semantic regression
[emit-behavior change breaks emit-shape CHECK tests repo-wide](../learnings/1788265621262-an-emit-behavior-change-breaks-emit-shape-check-te.md).
The dual hazard is a *downstream* equivalent masking a source-level gate: a
`-target ptx` test asserting fast-mode approx ops is a false positive because NVRTC
already adds `--use_fast_math`; assert on emitted source lanes (FAST present /
DEFAULT absent / CPP absent), and to truly isolate the redirect compile with the
gate macro on/off WITHOUT the downstream flag
[downstream --use_fast_math masks a source-level test](../learnings/1788297474702-a-downstream-use-fast-math-can-mask-a-source-level.md).

## Unit-test linkage and visibility

Two atoms from the same visibility law (`-fvisibility=hidden` +
`VISIBILITY_INLINES_HIDDEN`). A test that calls a non-exported out-of-line
`source/slang` symbol fails at link time in the normal `slang-unit-test` (a MODULE
linking `libslang`) — it must live in `tools/slang-static-unit-test` (an EXECUTABLE
linking the compiler statically; auto-globbed, a required CI check on 3 platforms)
[non-exported source/slang symbols need slang-static-unit-test](../learnings/1788242011293-slang-unit-tests-for-non-exported-source-slang-sym.md).
The same law means a test-observability counter (`static std::atomic<int>
s_liveCount`) on a libslang-internal class gets a *separate hidden copy per DSO*, so
the unit-test module reads its own (0) copy and a `>= 1` assert fails in CI even
though the code is correct — use an `SLANG_API`-exported accessor defined in a `.cpp`
compiled into libslang; not every `testsOnly*` hook is exported, so don't cite an
inline same-module hook as precedent. This lesson was recorded twice from the same
PR (#12863)
[test-observability counters need an SLANG_API accessor](../learnings/1788347873226-test-observability-counters-on-libslang-internal-c.md),
[test-observability counters must be SLANG_API-exported, not plain statics](../learnings/1788347896374-test-observability-counters-on-libslang-internal-c.md).
A smaller unit-test-framework trap: `SLANG_CHECK(x)` expands with a trailing `;`, so
an unbraced `if`/`else` body dangles the `else` — brace both branches
[SLANG_CHECK carries a trailing semicolon — brace if/else bodies](../learnings/1788368280378-slang-check-macro-carries-a-trailing-semicolon-bra.md).

## GPU-free test authoring and CI-infra triage

You can author deterministic value-correctness tests for wave/subgroup changes
without a GPU: a `numthreads(N,1,1)` with N ≤ min subgroup size puts all lanes in
one subgroup, a lane-index-only predicate makes every ballot/prefix count
hand-computable, and `COMPARE_COMPUTE(filecheck-buffer=CHECK)` hardcodes the
expected buffer (`nvidia-smi -L` first — the box may have a GPU anyway)
[wave/subgroup correctness tests authorable without a GPU](../learnings/1788198164522-wave-subgroup-value-correctness-tests-can-be-autho.md).
On reading CI, `test-falcor` red on an otherwise-green PR is usually external-CI
infra: it fails at the submission step (403 / rate-limit) so the actual Falcor build
never runs — a rate-limit *may* clear on re-run, a 403 will not; maintainers
admin-merge past a persistent Falcor 403, and backtick-wrapped `Fixes #N` does NOT
auto-close
[test-falcor red is usually external-CI infra, not your code](../learnings/1788257591834-test-falcor-red-on-an-otherwise-green-pr-is-usuall.md).

**Source learnings (13):**

- [Nightly Slang Test red has TWO distinct causes — don't conflate](../learnings/1788077660856-nightly-slang-test-red-08-29-30-has-two-distinct-c.md) — pull the pass/fail COUNT vs the prior baseline; an AVX-512 SIGILL leg hid a 973-test `-o /dev/null` guard mass-failure (#12832).
- [`-o -` safely replaces `-o /dev/null` in -dump-ir tests](../learnings/1788160188725-slang-test-o-safely-replaces-o-dev-null-in-dump-ir.md) — -dump-ir→stderr, target→stdout in a non-interleaving trailing block; the propagated "streams mix" warning was false; verified by a three-way corpus comparison (PR #12846).
- [Wave/subgroup value-correctness tests can be authored deterministically without a GPU](../learnings/1788198164522-wave-subgroup-value-correctness-tests-can-be-autho.md) — numthreads(N≤min subgroup), lane-index predicate, hardcoded CHECK buffer; precedent wave-ballot-verify-functional.slang; nvidia-smi -L first.
- [Load-bearing regression test after an upstream partial fix](../learnings/1788205014032-load-bearing-regression-test-after-an-upstream-par.md) — #12540/#12569; make the two conformance paths behaviorally distinct (+1) so a wrong choice is observable, then prove with a revert drill; build-subagent must run synchronously to block.
- [An emit-behavior change breaks emit-shape CHECK tests repo-wide](../learnings/1788265621262-an-emit-behavior-change-breaks-emit-shape-check-te.md) — #12623; grep the whole tests/ tree for construct+target before pushing; a passing COMPARE_COMPUTE arm next to a failing CHECK = stale pin; bump k_maxSupportedModuleVersion for new IR insts.
- [A downstream --use_fast_math can mask a source-level fast-math test](../learnings/1788297474702-a-downstream-use-fast-math-can-mask-a-source-level.md) — #12619; assert on emitted SOURCE (FAST/DEFAULT/CPP lanes), not downstream PTX; a feature with a downstream equivalent can't be attributed to your layer through it.
- [slang-test FileCheck parses any prefix-colon token in test-file comments as a directive](../learnings/1788302566910-slang-test-filecheck-parses-any-prefix-colon-token.md) — #12875; never write the literal <PREFIX>: in prose (even in `backticks`); refer to it without the colon.
- [Test-observability counters on libslang-internal classes need an SLANG_API accessor](../learnings/1788347873226-test-observability-counters-on-libslang-internal-c.md) — #12863 r2; -fvisibility=hidden → per-DSO copy; use an SLANG_API accessor defined in libslang; not every testsOnly* hook is exported.
- [Test-observability counters must be SLANG_API-exported accessors, not plain class statics](../learnings/1788347896374-test-observability-counters-on-libslang-internal-c.md) — sibling of the above (#12863); a bare class static read cross-DSO always reads 0 → CI false-negative; the exported-singleton inline precedent misleads.
- [Slang unit tests for non-exported source/slang symbols must live in slang-static-unit-test](../learnings/1788242011293-slang-unit-tests-for-non-exported-source-slang-sym.md) — #12861; libslang is -fvisibility=hidden so out-of-line methods are LOCAL; slang-static-unit-test links statically (auto-globbed, required CI on 3 platforms); SLANG_CHECK doesn't abort.
- [SLANG_CHECK macro carries a trailing semicolon — brace if/else bodies](../learnings/1788368280378-slang-check-macro-carries-a-trailing-semicolon-bra.md) — the macro's own `;` plus yours dangles the else; brace both branches; clang-format has no Insert/RemoveBraces so they survive.
- [test-falcor red on an otherwise-green PR is usually external-CI infra, not your code](../learnings/1788257591834-test-falcor-red-on-an-otherwise-green-pr-is-usuall.md) — fails at submit (403/rate-limit); a 403 won't self-heal; maintainers admin-merge past it; backtick `Fixes #N` doesn't auto-close.
- [Two-directional test with a false-live positive control is a merge-precondition](../learnings/1788301800371-approver-challenger-miss-validated-for-liveness-ma.md) — #12607; for liveness/mark-encoding changes, one assertion per direction; a "live value survives" check alone is half a control.
