---
title: SlangPy build, CI structure, sanitizers, toolchain gotchas, and cross-repo breaking-change coordination
type: concept
group: slangpy
tags: [slangpy, build, ci, sanitizers, asan, lsan, toolchain, slang-version, cross-repo, breaking-change]
source_count: 15
---

## TL;DR

Operational knowledge for building slangpy from source, reasoning about its CI, and
coordinating breaking changes with slang. Recurring facts:

- **Building headless on rootless Linux is possible in userspace**: `uv python install`
  for `Python.h`; `dpkg-deb -x` the X11 `-dev` debs (GLFW forces X11 even headless);
  build the `slangpy_ext` target directly (the `examples/tinybc` `-Werror=restrict`
  under gcc12 aborts the full build).
- **A stale worktree goes stale in TWO ways**: rebuild `slangpy_ext` AND the
  `slangpy_torch` bridge (a version-hash check), or the native torch path silently
  degrades to a green fallback run.
- **slangpy's compiler pin is `SGL_SLANG_VERSION` (external/CMakeLists.txt), NOT
  slang-rhi's `SLANG_RHI_FETCH_SLANG_VERSION`** — they can disagree; verify the shipped
  version from the build artifact (`slangc -v`, the tarball name), not a grepped
  CMakeLists.
- **Re-run any "separate finding" on the SAME toolchain as the PR head before reporting
  it live** — a crash on a stale checkout's older slang is a toolchain artifact.
- **The CI `unit-test-python` lane is UNSCOPED** — device-parametrized tests (incl.
  `[cpu]`) run there, they are not skipped. Skip logic only fires when
  `SELECTED_DEVICE_TYPES` is a non-empty set excluding the test's type.
- **`sanitizers.yml` (LSan) has never been green on slangpy `main`** since PR #1107 —
  a deterministic `sgl::ref` ownership-cycle leak in `NativeBoundCallRuntime`/reflection
  caches (#1130), distinct from slang's clean sanitizer gate. It has no suppression path;
  the cycle is in the Python cache layer.
- **GPU device tests abort under ASan (SIGABRT) via NVIDIA `RTLD_DEEPBIND`** — a "0 project
  roots" pass on such a box is VACUOUS. Use the CPU backend to exercise the same cycle.
- **The custom `check-ascii-source` pre-commit hook fails on any non-ASCII char** (em-dash,
  arrow) — run the full pre-commit, not just Black.
- **Breaking slang changes need a companion slangpy PR with a documented pin-bump-last
  merge order** — there is a genuine circular cross-repo CI dependency.

## Building slangpy from source: headless, stale worktrees, and version pins

Building at HEAD on a rootless Linux container (no sudo/apt) for a headless GPU repro
(#827) hits several blockers, all solvable in userspace. System `python3.11` has no
`Python.h`, so cmake's `find_package(Python ... Development.Module)` fails — fix with
`uv python install 3.11` (python-build-standalone ships the headers) and a `uv venv`
(note: uv venvs have no `pip` module, so `python -m pip` fails; use `uv pip install
./src/slangpy_torch --no-build-isolation`). GLFW forces X11 on Linux (no Null platform),
and `sgl`→`slangpy_ext` links it unconditionally, so even a headless build needs X11
*dev* headers — `curl` the bookworm `-dev` debs, `dpkg-deb -x` into a prefix, repoint the
extracted `libX*.so` symlinks, and point cmake at the prefix. `examples/tinybc` fails to
compile under gcc12 with a spurious `-Werror=restrict`, aborting the full build — build
the target directly (`cmake --build ... --target slangpy_ext`). The extension emits into
the source `slangpy/` dir (import via `PYTHONPATH`), and the repro must use
`spy.create_device(...)` not raw `spy.Device(...)` (only `create_device` injects the
`slangpy/slang` include path)
[building slangpy headless on rootless Linux](../learnings/1787079385346-building-slangpy-headless-on-a-rootless-linux-box-.md).

Resuming an old worktree and moving the branch forward stales the prebuilt native
artifacts in TWO independent ways — fix both or the torch path silently degrades. (1)
`slangpy_ext.*.so` stale → `import slangpy` fails (e.g. `cannot import name
'PipelineCompilationMode'`); fix with `cmake --preset linux-gcc` (incremental) then build
the `slangpy_ext` target directly (the default all-target hits the tinybc abort). (2) the
`slangpy_torch` bridge stale → import succeeds but
`get_torch_bridge_fallback_reason()` returns `"incompatible"` (a version-hash check
between the bridge and the rebuilt ext, not a code bug); fix with `python tools/ci.py
install-slangpy-torch`. If you only rebuild the ext and skip the bridge you get a green
fallback run and a false sense the native path works — the `torch_bridge_mode` fixture
exposes it as native-mode failures
[resuming a stale worktree: rebuild ext AND the torch bridge](../learnings/1787101717889-resuming-a-stale-slangpy-worktree-rebuild-slangpy-.md).

slangpy pins its Slang compiler via `external/CMakeLists.txt` `SGL_SLANG_VERSION` (drives
the prebuilt download URL), NOT via slang-rhi's `SLANG_RHI_FETCH_SLANG_VERSION` — and the
two can DISAGREE (at one HEAD `SGL_SLANG_VERSION="2026.12"` but the submodule's
`SLANG_RHI_FETCH_SLANG_VERSION="2026.12.2"`). Verify which version actually shipped from
the build artifact (the downloaded tarball name, `slangc -v`, the stdlib dir,
`CMakeCache.txt`), not the CMakeLists you happened to grep. The failure this caused: a
digest reported "2026.12.2" from slang-rhi's CMakeLists, published on #827 without
re-deriving, and invented a "stock Slang changed 2026.12→2026.12.2" mechanism to explain
a no-crash — the pin never moved (both runs at 2026.12) and agreement (the fixer echoed
2026.12.2 too) is not corroboration
[compiler pin is SGL_SLANG_VERSION, not slang-rhi's fetch var](../learnings/1787102175005-slangpy-s-compiler-pin-is-sgl-slang-version-not-sl.md).

That version-pin subtlety is exactly why a "separate finding" must be re-run on the SAME
toolchain as the PR head before being reported live. Validating slangpy PR #1137, a
coworker hit a SIGSEGV in a full pytest run and filed it as a distinct CPU-marshalling
defect (#1138) recommending escalation to slang — but a faithful rebuild at the PR head
could NOT reproduce it. The crash was on a **stale checkout** (68 commits behind: slang
2026.4.1) and was already fixed by the 2026.4.1 → 2026.12.2 bump. Rules: re-run on the
PR-head toolchain (especially slang version) before reporting live; a crash SITE is not a
crash CAUSE (a full-suite-only crash implicates test-state/teardown, not the isolated
path — always ask isolated-vs-suite, deterministic-vs-flaky, which toolchain); and
confirm before cross-repo escalation
[verify a separate finding on the PR-head toolchain (stale-slang ghost)](../learnings/1788483820552-verify-a-separate-finding-on-the-pr-head-toolchain.md).

## CI structure: what actually runs, retries, crash capture, and the ASCII hook

Do not assume `tools/ci.py` scopes the unit-test lane by device type — it does not.
`unit_test_python` runs `pytest_command("slangpy/tests", "-vra")` with NO `--device-types`
flag; the per-platform `device_types = [...]` block belongs to `benchmark_python`, easy to
conflate (and conflating it flags a bogus "no CI coverage" gap). Skip logic
(`plugin.py` `pytest_runtest_setup` + `helpers.should_skip_test_for_device`) skips a device
test ONLY when `SELECTED_DEVICE_TYPES` is a non-empty set excluding the test's type; with no
`--device-types`, it stays `None` → nothing is skipped. So a test parametrized
`[DeviceType.cpu]` DOES run in the standard "Unit Tests (Python)" lane on every OS runner.
The meta-lesson: prove the run reached the code — trace the exact CI command to the exact
function, don't infer lane behavior from a nearby-but-unrelated code block
[the unit-test-python lane is UNSCOPED](../learnings/1788481761267-slangpy-ci-unit-test-python-lane-is-unscoped-devic.md).

slangpy#829 (add retry logic to slangpy's own CI pytest, imitating the two-stage retry
slang's old `test-slangpy` job had) is fully unblocked (both gating deps merged). The
pattern to imitate: first `pytest -n auto` (parallel), then on failure re-run only the
failed set sequentially `pytest -n 0 --lf` — the sequential rerun escapes GPU-device
contention under xdist, which an INLINE `pytest-rerunfailures --reruns` does NOT achieve
(it stays in the same parallel session, so the plugin is the wrong tool). Single chokepoint:
every python test run routes through `tools/ci.py`, so one try/except edit covers 7 call
sites. False-green trap: a `--lf` rerun that selects zero tests exits 0 and masks a real
failure — the fix must verify `.pytest_cache` persists between the two invocations and
propagate the rerun's exit code
[#829 CI retry followup unblocked](../learnings/1787226229979-slangpy-829-ci-retry-followup-unblocked.md).

"Instrumentation is compiled in" and "an upload step exists" are two separate facts from
"the handler is armed on this code path." In slangpy CI, `sgl_tests` is built with crashpad
and there's an "Upload Crashpad Reports" step — but the handler is only armed at RUNTIME on
the Python side (`crashpad.start_handler()` in the pytest session hook); the C++ `main()`
never calls it and installs no `set_terminate`/signal handler. So the post-`run()` teardown
flake (#1062) writes no minidump; the uploaded `.crashpad/reports/` is empty. An empty
capture-artifact reads like "no crash happened" but can equally mean "capture was never armed
here" — confirm the handler is actually started on the path that failed before citing an
empty artifact as diagnostic
[crash-capture compiled-in is not crash-capture armed](../learnings/1786995924373-crash-capture-compiled-in-is-not-crash-capture-arm.md).

Before pushing slangpy code, run the FULL `pre-commit run --files <changed>`, not just
`black --check`. The project has a custom **`check-ascii-source`** hook that fails on any
non-ASCII character in `.cpp/.hpp/.h/.c/.py/.slang/.slangh` files — LLM-authored comments
routinely contain Unicode em-dashes (`—`) and arrows (`→`), Black passes them, and CI goes
red. The hook auto-fixes: `python tools/check_ascii_hook.py <files>` rewrites mapped chars
in place (em/en dash → `-`, `→` → `->`, `≤` → `<=`, smart quotes, NBSP, strips zero-width/BOM);
its `REPLACEMENTS` map is the source of truth, and an unmapped non-ASCII char fails without a
fix
[SlangPy CI forbids non-ASCII in source](../learnings/1787559507647-slangpy-ci-forbids-non-ascii-in-source-run-the-ful.md).

## Sanitizers: the LSan leak that has never been green, and the ASan DEEPBIND wall

slangpy's scheduled `sanitizers.yml` (cron `0 4 * * *`) fails **every** run on `main` since
it was introduced by PR #1107 (2026-08-15) — 17+ consecutive failures across 6 SHAs, so it
is deterministic, not a flake. The root cause is a real `sgl::ref` ownership-cycle leak (2
direct roots, identical run-over-run) on the Linux `asan-ubsan` leg's "Check LeakSanitizer
Reports" step (`tools/filter-lsan-reports.py`, which gates only on
SlangPy/slang-rhi-attributed roots). Leak site: `std::vector<ref<NativeBoundVariableRuntime>>`
in `NativeBoundCallRuntime::set_args`. Tracking issue #1130. It is NOT a regression from a
green baseline (never green) and NOT the flaky-test-retry items #829/#1123. Log gotchas:
GitHub purges raw job logs in ~2-3 days (pull from the newest failing run); `gh api .../logs`
needs `--allow-escape-sequences`; and `workflow_dispatch` runs can be on non-main branches
(check `git merge-base --is-ancestor <sha> origin/main`)
[sanitizers.yml nightly has never been green on main](../learnings/1788164752775-slangpy-sanitizers-yml-nightly-has-never-been-gree.md).

Triaging #1130 surfaced three reusable facts. (1) There is NO LSan suppression mechanism in
slangpy — `tools/asan-suppressions.txt` holds only ASan interceptor entries, and
`filter-lsan-reports.py` reads no suppressions file (it attributes by path/symbol match and
exits 1 on any project-attributed direct root), so "suppress the leak" is not a config edit;
combined with the maintainer's fix-first stance, suppression is disfavored. (2) A C++-only
ownership trace can WRONGLY conclude "no cycle / benign retention" — the real cycle is not in
the C++ `m_args` DAG but in the Python module-attribute / instance-method / reflection caches
(the `ref<refl::Type>` edge into the Layout⇄Type/Function graph); the tell it's a real cycle
is the maintainer's fix using weak references and tests named `..._does_not_create_ownership_cycle`.
(3) The gate only runs on Linux and only on schedule/workflow_dispatch (no `pull_request`), so
the leak-gate never runs on PRs. Also: an existing fix branch may exist off-PR (two green
dispatch SHAs traced to `dev/skallweit/weak-ref`) — check `git branch --contains` before
assuming net-new work
[LSan leak has no suppression path; cycle is in the Python cache layer](../learnings/1788165513318-slangpy-sanitizers-yml-lsan-leak-has-no-suppressio.md).

A "leak-gate failing N nights" report must be checked against BOTH slang and slangpy before
escalating — they have separate sanitizer workflows and very different health: slang's nightly
LeakSanitizer is 15+/15+ green, while slangpy's has failed 17/17 consecutive scheduled runs
since 2026-08-15 across 6 SHAs (deterministic). It's tracked as #1130, a continuation of
#1113's Layout⇄Type/Function lifetime work, with a fix held for maintainer coordination. If you
see a stale-sounding count, recompute from `actions/workflows/{id}/runs?event=schedule` rather
than trusting the reported number (an earlier hand-off cited "11th night" when the true count
that day was 17)
[LeakSanitizer never green 17 nights — don't confuse with slang's clean gate](../learnings/1788204898899-slangpy-leaksanitizer-has-never-been-green-17-nigh.md).

Verifying the #1130 fix locally hits an ASan wall. Running slangpy/sgl GPU device tests under
ASan on an NVIDIA box aborts with SIGABRT at device creation, before any test code runs: the
NVIDIA driver/Vulkan-loader dlopens internal libs with `RTLD_DEEPBIND`, ASan's dlopen
interceptor rejects DEEPBIND and calls `Die()`, and `abort_on_error=1` makes it SIGABRT (LLVM
through 22.x exposes no `handle_deepbind` flag). So "0 project roots" from
`filter-lsan-reports.py` in that state is VACUOUS — the leak-producing GPU tests never ran.
Workaround: use the CPU backend (`spy.Device(type=cpu)`) — the functional-API cache cycle and
`m_args` are backend-independent, so a CPU device exercises the same Python ownership cycle
without dlopening the driver (validates the fix MECHANISM, not the exact GPU byte-counts). Also:
Debian bookworm clang-14 ships no compiler-rt sanitizer runtime — download a self-contained LLVM
release tarball and PATH-prepend it (the asan runtime is at the per-target
`<llvm>/lib/clang/22/lib/x86_64-unknown-linux-gnu/libclang_rt.asan.so`)
[GPU device tests abort under ASan (RTLD_DEEPBIND)](../learnings/1788168405905-slangpy-sgl-gpu-device-tests-abort-under-asan-on-n.md).

## Cross-repo coordination: shipping a companion PR for a breaking slang change

When a slang PR is a breaking change (e.g. slang#12840 retyping the matrix layout param
`int` → `MatrixLayoutMode`), it triggers a red "SlangPy Tests" check, and fixing it means a
companion slangpy PR with a genuine circular cross-repo CI dependency you must document, not
just "make green." The "SlangPy Tests" status is posted by slangpy's `ci-latest-slang.yml`
(via `repository_dispatch` from slang), and its `build-pr` job checks out slangpy's DEFAULT
branch — so it only greens once the fix is merged to slangpy `main`, it does NOT build your PR
branch. Meanwhile slangpy's own `ci.yml` builds against the downloaded pinned release
`SGL_SLANG_VERSION`, so if the breaking symbol isn't in that release your retyped PR fails
slangpy's own CI → deadlock. Break the cycle with one manual gate-override in order: (1)
validate locally via `-DSGL_LOCAL_SLANG=ON` against the slang PR; (2) merge the slang PR past
its red "SlangPy Tests" (a known coordinated break); (3) cut a Slang release containing it;
(4) land the slangpy PR WITH a `SGL_SLANG_VERSION` pin bump — never to a not-yet-existent
release (the CMake download 404s). A checkout-mode gotcha: `branch` mode can't reach a fork-only
PR branch; `pr` mode (`git fetch origin pull/<n>/head`) resolves any PR, so the reliable
pre-merge validation is a local `SGL_LOCAL_SLANG` build. Post a "red as expected — see Merge
order" comment so the shepherd isn't misled
[companion PR for a breaking slang change: CI merge-order](../learnings/1788461805098-slangpy-companion-pr-for-a-slang-breaking-change-c.md).

**Production update — the `SLANGPY_CHERRY_PICK_PR` mechanism (how slang#12840→#12986 ↔ slangpy#1135 actually resolved).** In production the break is coordinated automatically, not by "merge the slang PR past its red SlangPy Tests" — a cherry-pick driven from the slang side keeps that check GREEN. A **fork** Slang PR can't run the secret-gated cherry-pick CI (`SLANGPY_DISPATCH_TOKEN`/`SLANG_STATUS_TOKEN`), so a breaking change is **recreated as a same-repo Slang PR** (12840 fork → 12986 same-repo) — don't assume a closed slang PR was rejected; check `gh pr view <n> --json state,mergedAt` for a same-repo successor (`mergedAt:null` + `state:CLOSED` = closed unmerged). A maintainer then sets `SLANGPY_CHERRY_PICK_PR: "1135"` in slang `master`'s `.github/workflows/ci-slangpy-trigger-test.yml`, so every slang PR's "SlangPy Tests" dispatch passes `slangpy_cherry_pick_pr` and slangpy's `ci-latest-slang.yml` merges the companion PR into slangpy *before* building against master-Slang — keeping all slang PR CI green through the breaking window AND continuously proving the companion green (that IS the execution proof: verify the slang PR's own "SlangPy Tests" status = success). Consequences: (a) the slang-side breaking PR can **merge to master BEFORE** the slangpy companion merges (the enum/type then lives on slang master but in no release yet); (b) the companion just waits on the **release gate** — slangpy `ci.yml` builds against the pinned `SGL_SLANG_VERSION` release tarball, so the companion's own CI stays red until a Slang release containing the change is cut AND the companion bumps `SGL_SLANG_VERSION` to it, then merge; (c) **post-merge cleanup, easy to forget:** revert `SLANGPY_CHERRY_PICK_PR` back to `""` on slang master (the workflow carries an in-file "REVERT … AS SOON AS #<pr> HAS MERGED" comment), else slang CI keeps cherry-picking a merged PR. Validation shortcut once the change is on slang master: run slangpy `ci-latest-slang` `workflow_dispatch` from the companion branch with the default `slang_branch=master` (branch checkout reaches master once merged — the fork-only-branch limitation is gone) ([the SLANGPY_CHERRY_PICK_PR production pattern](../learnings/1789073598653-slang-slangpy-coordinated-breaking-change-the-slan.md)).

Reviewing the downstream `.slang` retypes for such a change (slangpy#1135 ↔ slang#12840) took
~5 tool calls. Completeness scan: `git grep -n 'matrix<' -- '*.slang'` — distinguish the
4-param form `matrix<T,R,C,L>` (binds the layout param → affected) from the 3-param
`matrix<T,R,C>` form (default layout, no `int` generic → unaffected, needs no change); in #1135
only 2 of ~20 matrix sites were 4-param. Correspondence: confirm the downstream retype
byte-for-byte mirrors what the slang PR does to its own core-module extensions (the enum being
`:int`-backed with unchanged values means zero behavioral/codegen change — a pure type-check-time
fix). The failure mode is declaration-time (`int`→enum has no implicit conversion → fails to
unify at module parse/check, `E30019`), and since `staticarray.slang` is `__include`d by
`slangpy.slang` it compiles on every module load (a break there fails ~every test; no dedicated
pytest feasible). The merge-gate trap is the same coordination gate: such a PR cannot land until
`SGL_SLANG_VERSION` points at a release containing the enum — draft + pin-bump-last, a
coordination gate not a code defect
[reviewing SlangPy .slang downstream retypes for a breaking change](../learnings/1788461914259-reviewing-slangpy-slang-downstream-retypes-for-a-b.md).

**Source learnings (15):**

- [Building SlangPy headless on a rootless Linux box (#827 repro)](../learnings/1787079385346-building-slangpy-headless-on-a-rootless-linux-box-.md) — uv Python for headers, dpkg-deb X11 -dev debs, build slangpy_ext directly, create_device not raw Device.
- [Resuming a stale slangpy worktree: rebuild slangpy_ext AND the torch bridge together](../learnings/1787101717889-resuming-a-stale-slangpy-worktree-rebuild-slangpy-.md) — the torch bridge is a version-hash check; skipping it gives a false-green fallback run.
- [SlangPy's compiler pin is SGL_SLANG_VERSION, not slang-rhi's fetch var](../learnings/1787102175005-slangpy-s-compiler-pin-is-sgl-slang-version-not-sl.md) — they can disagree; verify the shipped version from the build artifact, not a grepped CMakeLists.
- [Verify a "separate finding" on the PR-head toolchain before reporting/escalating](../learnings/1788483820552-verify-a-separate-finding-on-the-pr-head-toolchain.md) — a crash on a stale checkout's older slang is a toolchain artifact; a crash site ≠ a crash cause.
- [SlangPy CI unit-test-python lane is UNSCOPED — device-parametrized tests run there](../learnings/1788481761267-slangpy-ci-unit-test-python-lane-is-unscoped-devic.md) — the device_types block belongs to benchmarks; trace the exact CI command to the exact function.
- [slangpy #829 CI retry followup unblocked](../learnings/1787226229979-slangpy-829-ci-retry-followup-unblocked.md) — parallel then `-n 0 --lf` sequential rerun (not the inline rerun plugin); guard the zero-selected false-green.
- [Crash-capture compiled-in is not crash-capture armed (sgl_tests)](../learnings/1786995924373-crash-capture-compiled-in-is-not-crash-capture-arm.md) — the handler is armed only on the Python side; an empty capture artifact ≠ "no crash happened."
- [SlangPy CI forbids non-ASCII in source — run the full pre-commit, not just Black](../learnings/1787559507647-slangpy-ci-forbids-non-ascii-in-source-run-the-ful.md) — the check-ascii-source hook auto-fixes em-dashes/arrows; a green `black --check` is not "formatting done."
- [slangpy sanitizers.yml nightly has never been green on main (LSan leak in NativeBoundCallRuntime)](../learnings/1788164752775-slangpy-sanitizers-yml-nightly-has-never-been-gree.md) — deterministic sgl::ref cycle leak (#1130); log-fetch gotchas; workflow_dispatch runs can be off-main.
- [slangpy LSan leak has no suppression path; the cycle is in the Python cache layer](../learnings/1788165513318-slangpy-sanitizers-yml-lsan-leak-has-no-suppressio.md) — filter reads no suppressions; follow ref<refl::Type> up into reflection/Python caches; the gate never runs on PRs.
- [slangpy LeakSanitizer has never been green (17 nights) — don't confuse with slang's clean gate](../learnings/1788204898899-slangpy-leaksanitizer-has-never-been-green-17-nigh.md) — check both repos before escalating; recompute the night count from the schedule runs API.
- [slangpy/sgl GPU device tests abort under ASan on NVIDIA driver (RTLD_DEEPBIND)](../learnings/1788168405905-slangpy-sgl-gpu-device-tests-abort-under-asan-on-n.md) — SIGABRT at device creation makes "0 project roots" vacuous; use the CPU backend to exercise the same cycle.
- [SlangPy companion PR for a Slang breaking change: CI merge-order & checkout-mode gotcha](../learnings/1788461805098-slangpy-companion-pr-for-a-slang-breaking-change-c.md) — circular cross-repo CI dependency; validate via SGL_LOCAL_SLANG; pin-bump-last merge order.
- [Reviewing SlangPy .slang downstream retypes for a breaking Slang core-module change](../learnings/1788461914259-reviewing-slangpy-slang-downstream-retypes-for-a-b.md) — distinguish 4-param vs 3-param matrix sites; declaration-time E30019 unify failure; pin-bump-last coordination gate.
- [the `SLANGPY_CHERRY_PICK_PR` production pattern: fork→same-repo recreation, maintainer sets the cherry-pick var so slang CI stays green while the breaking PR merges before the companion; companion waits on the release gate; revert the var post-merge.](../learnings/1789073598653-slang-slangpy-coordinated-breaking-change-the-slan.md)
