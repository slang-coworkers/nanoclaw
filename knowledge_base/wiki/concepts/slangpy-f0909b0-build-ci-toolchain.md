---
title: SlangPy build, CI structure, sanitizers, toolchain gotchas, and cross-repo breaking-change coordination
type: concept
group: slangpy
tags: [slangpy, build, ci, sanitizers, asan, lsan, toolchain, slang-version, cross-repo, breaking-change]
source_count: 25
---

## TL;DR

Operational knowledge for building slangpy from source, reasoning about its CI, and
coordinating breaking changes with slang. Recurring facts:

- **Headless builds on rootless Linux work in userspace**: `uv python install` for `Python.h`;
  `dpkg-deb -x` the X11 `-dev` debs (GLFW forces X11 even headless); build `--target slangpy_ext`
  (the `examples/tinybc` gcc12 `-Werror=restrict` aborts the full build).
- **Forcing TinyEXR needs BOTH `-DCMAKE_DISABLE_FIND_PACKAGE_OpenEXR=ON` and `-DOpenEXR_FOUND=OFF`**;
  an empty nanobind `RuntimeError()` hints at garbage `what()` bytes.
- **A worktree needs `git -c protocol.file.allow=always submodule update`** and
  `PYTHONPATH=<worktree>` for repro scripts outside it (sys.path[0] is the script dir).
- **A stale worktree goes stale TWO ways**: rebuild `slangpy_ext` AND the `slangpy_torch` bridge
  (version-hash check), or the native torch path silently degrades to a green fallback run.
- **The compiler pin is `SGL_SLANG_VERSION` (external/CMakeLists.txt), NOT slang-rhi's
  `SLANG_RHI_FETCH_SLANG_VERSION`**; verify from the build artifact, and re-run any "separate
  finding" on the PR-head toolchain first.
- **After a rebase/pin bump, neither `cmake --build` nor a plain `cmake --preset` picks up the new
  slang** (a CACHE STRING frozen in `CMakeCache.txt`). Reconfigure `--fresh` with
  `-DPython_EXECUTABLE=<uv venv python>`. Green CI + red local `undefined identifier` for a
  released symbol is the stale-cache signature.
- **The CI `unit-test-python` lane is UNSCOPED** (device-parametrized tests, incl. `[cpu]`, run).
  Locally, `--device-types <x>` SKIPS every test without a `device_type` parameter.
- **`sanitizers.yml` (LSan) has never been green on slangpy `main`** since PR #1107: a
  deterministic `sgl::ref` cycle leak in `NativeBoundCallRuntime`/reflection caches (#1130), with no
  suppression path; slang's own sanitizer gate is clean.
- **GPU device tests abort under ASan via NVIDIA `RTLD_DEEPBIND`**; a "0 project roots" pass there
  is VACUOUS. Use the CPU backend.
- **The `check-ascii-source` pre-commit hook fails on any non-ASCII char**; run full pre-commit.
- **Breaking slang changes need a companion slangpy PR with pin-bump-last merge order** (a circular
  cross-repo CI dependency; production uses `SLANGPY_CHERRY_PICK_PR`).
- **CPython 3.15 breaks `-Werror` slangpy_ext on Linux** (macro redefined): put `Python.h` first via
  nanobind#1289 or an `nb_python.h` pre-include, AND `"nanobind.h"` first per TU.

## Building slangpy from source: headless, worktrees, stale artifacts

A headless GPU repro (#827) in a rootless Linux container (no sudo/apt) builds in userspace. System `python3.11` has no `Python.h`, so `find_package(Python ... Development.Module)`
fails: use `uv python install 3.11` and a `uv venv` (no `pip` module inside; use
`uv pip install ./src/slangpy_torch --no-build-isolation`). GLFW forces X11 on Linux (no Null
platform) and `sgl`→`slangpy_ext` links it unconditionally, so `curl` the bookworm X11 `-dev` debs,
`dpkg-deb -x` them into a prefix, repoint the extracted `libX*.so` symlinks, and point cmake there.
`examples/tinybc` hits a spurious gcc12 `-Werror=restrict` that aborts the full build, so build
`--target slangpy_ext`. The extension lands in the source `slangpy/` dir (import via `PYTHONPATH`);
a repro must call `spy.create_device(...)`, not raw `spy.Device(...)`, since only `create_device`
injects the `slangpy/slang` include path
[building slangpy headless on rootless Linux](../learnings/1787079385346-building-slangpy-headless-on-a-rootless-linux-box-.md).

More levers, verified on Debian 12
[force TinyEXR + build without system Python headers](../learnings/1790786152988-slangpy-force-tinyexr-build-build-without-system-p.md).
Instead of uv, `dpkg -x` the bookworm `libpython3.11-dev` / `python3.11-dev` / `libpython3.11` debs
(`deb.debian.org/debian/pool/main/p/python3.11/`) into prefix `R`, pass
`-DPython_INCLUDE_DIR=$R/usr/include/python3.11 -DPython_LIBRARY=$R/usr/lib/x86_64-linux-gnu/libpython3.11.so`,
and `export CPATH=$R/usr/include` (for the multiarch `pyconfig.h`). To force bundled TinyEXR,
`-DCMAKE_DISABLE_FIND_PACKAGE_OpenEXR=ON` alone fails configure (`ternary(SGL_HAS_OPENEXR
${OpenEXR_FOUND} ON OFF)` at CMakeLists.txt:373 gets an empty arg); add `-DOpenEXR_FOUND=OFF` and
confirm `#define SGL_HAS_OPENEXR 0` in `config.h`. vcpkg is reusable via
`-DVCPKG_INSTALLED_DIR=<other build>/vcpkg_installed -DVCPKG_MANIFEST_INSTALL=OFF` when
vcpkg.json/triplets/overlays/commit match (slangpy_ext Release then builds in ~40 s at -j60). Under
Python 3.11, `PyErr_SetString` with invalid UTF-8 yields a bare `RuntimeError()`, so an empty
RuntimeError from nanobind suggests the C++ `what()` held garbage (e.g. a use-after-free).

**Worktrees.** In a `git worktree` of `/workspace/agent/slangpy`, even `git submodule update --init
--recursive` fails with `fatal: transport 'file' not allowed` (the shared `.git/config` points
submodule URLs at local paths); pass `git -c protocol.file.allow=always`. To populate offline add
`-c submodule.external/X.url=<main>/.git/modules/external/X submodule update external/X` (nested
nanobind `ext/robin_map` and nanothread `ext/cmake-defaults` need `--init` inside them; `data` is
required because cmrc embeds its fonts). A repro script outside the worktree gets
`ModuleNotFoundError: No module named 'slangpy'` because `sys.path[0]` is the script's dir, not the
cwd; set `PYTHONPATH=<worktree>`. The full build's stubgen imports numpy and `libcst`, which the
venvs lack: set `PYTHONPATH=<worktree>/.venv/lib/python3.11/site-packages` on the first
`cmake --build`, or build only `--target slangpy_ext` (rebuilds `libsgl.so` + `slangpy_ext*.so`,
skips stubgen, ~10 s per one-file change). Test with the venv python in `CMakeCache.txt`'s
`Python_EXECUTABLE`
[worktree submodule file-transport and /tmp repro sys.path](../learnings/1792462385307-slangpy-worktree-build-submodule-file-transport-an.md),
[incremental build without libcst: build only slangpy_ext](../learnings/1792421818732-slangpy-incremental-build-without-libcst-build-onl.md).

**A resumed worktree goes stale in TWO independent ways.** (1) Stale `slangpy_ext.*.so`:
import fails (e.g. `cannot import name 'PipelineCompilationMode'`); rerun
`cmake --preset linux-gcc` and build `slangpy_ext`. (2) Stale `slangpy_torch` bridge: import works
but `get_torch_bridge_fallback_reason()` returns `"incompatible"` (a bridge/ext version-hash check);
run `python tools/ci.py install-slangpy-torch`. Fixing only (1) yields a green fallback run that
hides a broken native path; the `torch_bridge_mode` fixture exposes it as native-mode failures
[resuming a stale worktree: rebuild ext AND the torch bridge](../learnings/1787101717889-resuming-a-stale-slangpy-worktree-rebuild-slangpy-.md).

## The Slang version pin and stale-toolchain ghosts

slangpy pins its compiler via `external/CMakeLists.txt` `SGL_SLANG_VERSION` (the prebuilt download
URL). SGL feeds that slang to slang-rhi (`SLANG_RHI_FETCH_SLANG OFF` +
`SLANG_RHI_SLANG_BINARY_DIR=${SLANG_DIR}`), so slang-rhi's `SLANG_RHI_FETCH_SLANG_VERSION` is not
what builds and can disagree (`2026.12` vs `2026.12.2` at one HEAD); `SGL_LOCAL_SLANG=ON` overrides
again with a local build's header version. Verify the shipped version from the artifact (tarball
name, `slangc -v`, stdlib dir, `CMakeCache.txt`). Grepping the wrong var once put an invented
"2026.12→2026.12.2" mechanism into a published #827 digest; a peer echoing a number is not corroboration
[compiler pin is SGL_SLANG_VERSION, not slang-rhi's fetch var](../learnings/1787102175005-slangpy-s-compiler-pin-is-sgl-slang-version-not-sl.md).

So re-run any "separate finding" on the PR-head toolchain before reporting it. Validating
slangpy#1137, a full-suite SIGSEGV filed as a distinct CPU-marshalling defect (#1138, with a
recommended slang escalation) did not reproduce at the PR head: the checkout was 68 commits behind
(slang 2026.4.1) and the bump to 2026.12.2 had fixed it. A crash SITE is not a CAUSE: ask
isolated-vs-suite (suite-only implicates test state/teardown), deterministic-vs-flaky, and which
toolchain, and confirm before cross-repo escalation
[verify a separate finding on the PR-head toolchain (stale-slang ghost)](../learnings/1788483820552-verify-a-separate-finding-on-the-pr-head-toolchain.md).

Why it recurs: `cmake --preset <p>` freezes `SGL_SLANG_VERSION` into `build/<preset>/CMakeCache.txt`
and FetchContent caches slang under `build/<preset>/_deps/slang*`. `cmake --build` never
reconfigures, and re-running `cmake --preset linux-gcc` doesn't help because the CACHE STRING's old
value (e.g. 2026.19) wins. One reused tree produced two false regressions (slangpy#1136/#1137,
#1138/#1137): `error[E30015]: undefined identifier 'MatrixLayoutMode'` in `staticarray.slang` for a
symbol in the pinned slang (slang#12986, first in v2026.17.1) while the tree still linked cached
2026.5.2; CI was green; `--fresh` cleared it. Rules: after any pin bump or rebase, reconfigure
`cmake --preset <p> --fresh` (or delete `build/**/_deps/` slang); confirm with
`grep SGL_SLANG_VERSION build/<preset>/CMakeCache.txt`; treat an `undefined identifier` for a
released symbol, or a post-rebase crash in slang stdlib (`staticarray.slang`, `core.meta.slang`) or
the CPU target, as stale cache until proven otherwise. `--fresh` drops the cached Python hints and
`/usr/bin/python3` lacks dev headers (`Could NOT find Python (missing: Python_INCLUDE_DIRS
Development.Module)`), so pass `-DPython_EXECUTABLE=<uv venv>/bin/python` (uv CPython under
`/workspace/agent/uv-pythons` ships headers; the cpython-311 `.so` still imports from a
`/usr/bin/python3.11` venv). To confirm a release contains a change, check the symbol at the tag
(`enum X` in `source/slang/core.meta.slang?ref=v<version>`) and/or that
`compare/v<version>...<merge_sha>` is behind/identical
[reused build tree keeps a STALE slang across a rebase](../learnings/1789220844035-slangpy-reused-build-tree-keeps-a-stale-slang-sgl-.md),
[stale CMakeCache `SGL_SLANG_VERSION` → two false regressions](../learnings/1789220982301-stale-cmakecache-sgl-slang-version-incremental-sla.md),
[reconfigure after a Slang version bump needs `--fresh` + a Python hint](../learnings/1792464723018-slangpy-reconfigure-after-slang-version-bump-needs.md).

## Python 3.15: the pyconfig.h macro clash and cp315 wheels

Against CPython 3.15 on Linux (gcc 12, default `-Werror`) every slangpy_ext TU fails with
`pyconfig.h:2067: "_POSIX_C_SOURCE" redefined` / `pyconfig.h:2124: "_XOPEN_SOURCE" redefined`. 3.15
defines `202405L` / `800`; 3.14 used `200809L` / `700`, matching glibc's `features.h` under g++
(`_GNU_SOURCE`), so the redefinition was silent. Any TU including a std header before `Python.h` now
warns. It is Linux-only (Darwin/Windows pyconfig lack these); disabling `-Werror` only hides it. Also seen in open-atmos/PyPartMC#555
([3.15 pyconfig.h breaks -Werror nanobind<2.12 builds](../learnings/1791575026477-python-3-15-pyconfig-h-breaks-werror-builds-of-nan.md)).

The fix puts `Python.h` first and needs both halves. nanobind < 2.12 (incl. slangpy's fork at
`0b719c12`, v2.10.2) includes `<cstddef>` etc. before `nb_python.h` in `nanobind.h`; upstream
wjakob/nanobind#1289 (`890745357b56`, >= 2.12.0) fixes that and cherry-picks cleanly. Some project
TUs also include `<algorithm>`, `<optional>` or `<initializer_list>` before `"nanobind.h"`. A/B:
57/57 TUs fail with either change alone, 0 with both
([3.15 -Werror break: both halves are needed](../learnings/1791583665808-python-3-15-breaks-werror-c-extensions-on-linux-cr.md));
elsewhere the cherry-pick alone cut 32 failures to 3 and reordering those cleared it
([same](../learnings/1791575026477-python-3-15-pyconfig-h-breaks-werror-builds-of-nan.md)).
Without a fork bump (slangpy#1217): add `#include <nanobind/nb_python.h>` before
`#include <nanobind/nanobind.h>` in `src/slangpy_ext/nanobind.h` and move `"nanobind.h"` first in
the offending TUs, giving 0/57 against 3.15rc2 and 3.14.7 headers. Double-processing `nb_python.h`
is harmless (`Python.h` is guarded, its `#undef`s idempotent). CMake's `cmake_pch.hxx` carries
`#pragma GCC system_header`, silencing this under `SGL_ENABLE_PCH=ON`; a hand-written PCH starting
with std headers would re-trigger it. Fast check (~1 min): point the Python `-I` in
`build/linux-gcc/compile_commands.json` at `uv python install 3.15` headers and run all TUs
`-fsyntax-only` in parallel
([pre-include nb_python.h instead of bumping nanobind](../learnings/1791587573830-python-h-before-std-headers-fix-without-bumping-na.md)).

Shipping 3.15 wheels:
- cibuildwheel builds cp315 by default only from 4.2.0 (2026-08); 3.x has no cp315 identifiers. `CIBW_BUILD=cp315-*` does not match `cp315t`; `cibuildwheel --platform <p> --archs <a> --print-build-identifiers` works offline on any host.
- cibuildwheel 4.0 made delvewheel the Windows repair-wheel-command; `CIBW_REPAIR_WHEEL_COMMAND_WINDOWS: ""` restores 3.x behaviour (not read with `ignore_empty`), though delvewheel is still pip-installed. abi3audit runs only on abi3 wheels.
- nanobind 3.x has native 3.15 support but drops Python 3.9.
- PyTorch has no cp315 wheels on PyPI or cu128; cu126/cu130/cu132 have them for torch >= 2.13.

Fork facts (slangpy#1216 triage): a cross-fork PR via REST (`gh api -X POST repos/<up>/pulls -f
head=slang-coworkers:<br>`) fails 422 `fork_collab Fork collab can't be granted by someone without
permission` until you add `-F maintainer_can_modify=false` (slangpy#1218). slang-coworkers/slangpy
has no registered Actions workflows (`dispatches`/`enable` 404), so workflow changes can't be
validated on the fork; ask a maintainer to dispatch upstream
([cibuildwheel 4.x and cross-fork REST PR facts](../learnings/1791583665808-python-3-15-breaks-werror-c-extensions-on-linux-cr.md)).

## CI structure: what actually runs, retries, crash capture, and the ASCII hook

`tools/ci.py`'s `unit_test_python` runs `pytest_command("slangpy/tests", "-vra")` with no
`--device-types`; the per-platform `device_types = [...]` block belongs to `benchmark_python`
(do not conflate them). `plugin.py` `pytest_runtest_setup` +
`helpers.should_skip_test_for_device` skip a device test only when `SELECTED_DEVICE_TYPES` is a
non-empty set excluding its type; unfiltered it is `None`, so `[DeviceType.cpu]` tests run in "Unit
Tests (Python)" on every OS. Trace the CI command to the function
[the unit-test-python lane is UNSCOPED](../learnings/1788481761267-slangpy-ci-unit-test-python-lane-is-unscoped-devic.md).
Locally the reverse bites: a test WITHOUT a `device_type` param counts as non-device and is skipped
whenever `--device-types <x>` is passed. A GPU test making its own device (`spy.App()`,
`DeviceType.automatic`) never runs per-device unless it takes
`@pytest.mark.parametrize("device_type", [<type>])` and checks `helpers.should_skip_test_for_device`;
verify with and without the filter. Linux `helpers.DEFAULT_DEVICE_TYPES` is vulkan + cuda; add cpu
via `--device-types vulkan,cuda,cpu`
[tests without a device_type param are skipped under --device-types](../learnings/1792466654227-slangpy-tests-no-device-type-param-skipped-under-d.md),
[incremental build without libcst](../learnings/1792421818732-slangpy-incremental-build-without-libcst-build-onl.md).

slangpy#829 (CI pytest retry, imitating slang's old `test-slangpy` job) is unblocked (both deps
merged). Pattern: `pytest -n auto`, then rerun failures with `pytest -n 0 --lf` (escapes
xdist GPU-device contention); inline `pytest-rerunfailures --reruns` stays in the parallel session.
All python test runs go through `tools/ci.py`, so one try/except covers 7 call sites. False-green
trap: a `--lf` rerun selecting zero tests exits 0, so verify `.pytest_cache` persists and propagate
the rerun's exit code
[#829 CI retry followup unblocked](../learnings/1787226229979-slangpy-829-ci-retry-followup-unblocked.md).

Crash capture compiled in is not armed: `sgl_tests` builds with crashpad and CI uploads
`.crashpad/reports/`, but the handler starts only on the Python side (`crashpad.start_handler()` in
the pytest session hook); the C++ `main()` never calls it nor installs a
`set_terminate`/signal handler. So the post-`run()` teardown flake (#1062) leaves an empty artifact,
which means "never armed", not "no crash"
[crash-capture compiled-in is not crash-capture armed](../learnings/1786995924373-crash-capture-compiled-in-is-not-crash-capture-arm.md).

Run the FULL `pre-commit run --files <changed>`, not just `black --check`: the custom
**`check-ascii-source`** hook rejects any non-ASCII char in `.cpp/.hpp/.h/.c/.py/.slang/.slangh`, and
LLM comments carry em-dashes and arrows that Black passes. `python tools/check_ascii_hook.py <files>`
rewrites mapped chars in place (dashes → `-`, `→` → `->`, `≤` → `<=`, smart quotes, NBSP; strips
zero-width/BOM); its `REPLACEMENTS` map is the source of truth and unmapped chars just fail
[SlangPy CI forbids non-ASCII in source](../learnings/1787559507647-slangpy-ci-forbids-non-ascii-in-source-run-the-ful.md).

## Sanitizers: the LSan leak that has never been green, and the ASan DEEPBIND wall

slangpy's scheduled `sanitizers.yml` (cron `0 4 * * *`) has failed every `main` run since PR #1107
added it (2026-08-15): 17/17 across 6 SHAs, deterministic. Cause: a real `sgl::ref` ownership-cycle
leak (2 direct roots, identical each run) at the Linux `asan-ubsan` "Check LeakSanitizer Reports"
step (`tools/filter-lsan-reports.py`, gating only SlangPy/slang-rhi-attributed roots); site
`std::vector<ref<NativeBoundVariableRuntime>>` in `NativeBoundCallRuntime::set_args`. Tracked as
#1130 (continuing #1113's Layout⇄Type/Function lifetime work), fix held for maintainer coordination.
Not a regression, not the flaky-retry items #829/#1123. Slang's separate nightly
LeakSanitizer is 15+/15+ green, so check both repos before escalating "leak gate failing N nights",
and recompute N from `actions/workflows/{id}/runs?event=schedule` (a hand-off once said "11th"
when it was 17). Logs purge in ~2-3 days; `gh api .../logs` needs
`--allow-escape-sequences`; `workflow_dispatch` runs may be off-main
(`git merge-base --is-ancestor <sha> origin/main`)
[sanitizers.yml nightly has never been green on main](../learnings/1788164752775-slangpy-sanitizers-yml-nightly-has-never-been-gree.md),
[LeakSanitizer never green 17 nights — don't confuse with slang's clean gate](../learnings/1788204898899-slangpy-leaksanitizer-has-never-been-green-17-nigh.md).

From #1130 triage: (1) no LSan suppression path exists: `tools/asan-suppressions.txt` holds only ASan
interceptor entries and `filter-lsan-reports.py` reads no suppressions (path/symbol attribution,
exit 1 on any project root), and the maintainer is fix-first. (2) A C++-only trace wrongly finds "no
cycle": it lives not in the `m_args` DAG but in the Python module-attribute / instance-method /
reflection caches (the `ref<refl::Type>` edge into Layout⇄Type/Function); the tell is the
maintainer's weak-reference fix with `..._does_not_create_ownership_cycle` tests. (3) The gate runs
only on Linux, only on schedule/workflow_dispatch, never on PRs. A fix branch may exist off-PR (green
dispatch SHAs from `dev/skallweit/weak-ref`); check `git branch --contains`
[LSan leak has no suppression path; cycle is in the Python cache layer](../learnings/1788165513318-slangpy-sanitizers-yml-lsan-leak-has-no-suppressio.md).

Local verification hits an ASan wall: GPU device tests on NVIDIA SIGABRT at device creation because
the driver/Vulkan loader dlopens with `RTLD_DEEPBIND`, ASan's interceptor calls `Die()`, and
`abort_on_error=1` aborts (LLVM through 22.x has no `handle_deepbind`). "0 project roots" there is
VACUOUS. Use `spy.Device(type=cpu)`: the cache cycle and `m_args` are backend-independent, so it
validates the fix mechanism (not GPU byte counts). Bookworm clang-14 ships no compiler-rt sanitizer
runtime; PATH-prepend an LLVM release tarball (runtime at
`<llvm>/lib/clang/22/lib/x86_64-unknown-linux-gnu/libclang_rt.asan.so`)
[GPU device tests abort under ASan (RTLD_DEEPBIND)](../learnings/1788168405905-slangpy-sgl-gpu-device-tests-abort-under-asan-on-n.md).

## Cross-repo coordination: shipping a companion PR for a breaking slang change

A breaking slang PR (e.g. slang#12840 retyping the matrix layout param `int` → `MatrixLayoutMode`)
turns slang's "SlangPy Tests" red and needs a companion slangpy PR with a circular CI dependency.
"SlangPy Tests" comes from slangpy's `ci-latest-slang.yml` (`repository_dispatch` from slang), whose
`build-pr` job checks out slangpy's DEFAULT branch, not your PR; slangpy's own `ci.yml` builds
against the pinned release, so the retype fails there until a release has the symbol. Manual order:
(1) validate locally with `-DSGL_LOCAL_SLANG=ON` against the slang PR; (2) merge the slang PR past
its red check; (3) cut a Slang release; (4) land the slangpy PR WITH the `SGL_SLANG_VERSION` bump,
never to an unreleased version (download 404s). `branch` checkout mode can't reach a fork-only
branch; `pr` mode (`git fetch origin pull/<n>/head`) can, but a local `SGL_LOCAL_SLANG` build is the
reliable pre-merge check. Comment "red as expected — see Merge order"
[companion PR for a breaking slang change: CI merge-order](../learnings/1788461805098-slangpy-companion-pr-for-a-slang-breaking-change-c.md).
The no-GPU checks that make step (1) cheap are on [SlangPy Validation Against an Unreleased Slang PR](slangpy-validation-against-unreleased-slang.md): a `slangc`-only build of the PR head, a `spirv-asm` no-op diff on the pinned compiler, and the warning that the downstream run's `import slangpy` errors are not the full list of breaks.

**Production: `SLANGPY_CHERRY_PICK_PR`** (how slang#12840→#12986 ↔ slangpy#1135 resolved) keeps the
check GREEN. Fork PRs can't run the secret-gated cherry-pick CI
(`SLANGPY_DISPATCH_TOKEN`/`SLANG_STATUS_TOKEN`), so the change is recreated as a same-repo PR (12840
→ 12986); a closed slang PR may have a successor (`gh pr view <n> --json state,mergedAt`;
`mergedAt:null` + `CLOSED` = closed unmerged). A maintainer sets `SLANGPY_CHERRY_PICK_PR: "1135"` in
slang master's `.github/workflows/ci-slangpy-trigger-test.yml`; each dispatch then passes
`slangpy_cherry_pick_pr` and `ci-latest-slang.yml` merges the companion before building against
master-Slang, so the slang PR's own "SlangPy Tests" = success is the execution proof. Consequences:
(a) the slang PR may merge BEFORE the companion (type on master, in no release); (b) its
`ci.yml` stays red until a release has the change and it bumps `SGL_SLANG_VERSION`; (c) after merge,
revert the var to `""` (per the in-file "REVERT … AS SOON AS #<pr> HAS MERGED" comment) or slang CI
keeps cherry-picking. Once on master, validate via slangpy `ci-latest-slang` `workflow_dispatch` from
the companion branch with default `slang_branch=master`
([the SLANGPY_CHERRY_PICK_PR production pattern](../learnings/1789073598653-slang-slangpy-coordinated-breaking-change-the-slan.md)).

Reviewing downstream `.slang` retypes (slangpy#1135), completeness is
`git grep -n 'matrix<' -- '*.slang'`; only 4-param `matrix<T,R,C,L>` binds the layout (3-param
`matrix<T,R,C>` is unaffected; 2 of ~20 sites in #1135). The retype should mirror byte-for-byte the
slang PR's own core-module edits; an `:int`-backed enum with unchanged values means zero codegen
change. The failure is declaration-time (no implicit `int`→enum, so unification fails at check,
`E30019`), and since `slangpy.slang` `__include`s `staticarray.slang`, a break fails ~every test (no
dedicated pytest feasible). The PR can't land until `SGL_SLANG_VERSION` names a release with the
enum: draft + pin-bump-last, a coordination gate, not a defect
[reviewing SlangPy .slang downstream retypes for a breaking change](../learnings/1788461914259-reviewing-slangpy-slang-downstream-retypes-for-a-b.md).

**Source learnings (25):**

- [Python 3.15 pyconfig.h breaks -Werror builds of nanobind<2.12 extensions on Linux (_POSIX_C_SOURCE/_XOPEN_SOURCE redefined)](../learnings/1791575026477-python-3-15-pyconfig-h-breaks-werror-builds-of-nan.md)
- [Python 3.15 breaks -Werror C++ extensions on Linux; cross-fork REST PR needs maintainer_can_modify=false](../learnings/1791583665808-python-3-15-breaks-werror-c-extensions-on-linux-cr.md)
- [Python.h-before-std-headers fix without bumping nanobind: pre-include nb_python.h](../learnings/1791587573830-python-h-before-std-headers-fix-without-bumping-na.md)
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
- [SlangPy reused build tree keeps a STALE slang across a rebase — reconfigure `--fresh`, read SGL_SLANG_VERSION](../learnings/1789220844035-slangpy-reused-build-tree-keeps-a-stale-slang-sgl-.md) — `cmake --build` never re-fetches the cached slang; confirm the effective version from CMakeCache, not slang-rhi's `SLANG_RHI_FETCH_SLANG_VERSION`.
- [Stale CMakeCache SGL_SLANG_VERSION: incremental builds keep the OLD slang after a pin bump/rebase (two false regressions)](../learnings/1789220982301-stale-cmakecache-sgl-slang-version-incremental-sla.md) — a green CI + a red local `undefined identifier` (e.g. MatrixLayoutMode) for a released symbol is the stale-cache signature, not a defect.
- [force TinyEXR (`-DOpenEXR_FOUND=OFF` too), userspace Python.h via `dpkg -x` debs, offline worktree submodules, vcpkg reuse, empty RuntimeError = garbage what()](../learnings/1790786152988-slangpy-force-tinyexr-build-build-without-system-p.md)
- [slangpy incremental build without libcst: build only the slangpy_ext target](../learnings/1792421818732-slangpy-incremental-build-without-libcst-build-onl.md) — full build runs stubgen (libcst); `--target slangpy_ext` ~10 s; Linux DEFAULT_DEVICE_TYPES excludes cpu
- [SlangPy worktree build: submodule file-transport and /tmp repro script sys.path gotchas](../learnings/1792462385307-slangpy-worktree-build-submodule-file-transport-an.md) — `protocol.file.allow=always`; sys.path[0] is the script dir, so `PYTHONPATH=<worktree>`
- [SlangPy reconfigure after Slang version bump needs --fresh (stale SGL_SLANG_VERSION cache)](../learnings/1792464723018-slangpy-reconfigure-after-slang-version-bump-needs.md) — CACHE STRING wins over a plain re-configure; `--fresh` needs `-DPython_EXECUTABLE=<uv venv>`
- [slangpy tests: no device_type param => skipped under --device-types; App() closes its device](../learnings/1792466654227-slangpy-tests-no-device-type-param-skipped-under-d.md) — local `--device-types` silently skips non-parametrized GPU tests; CI runs them
