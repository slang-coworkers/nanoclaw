---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787269675272-rgyjlr
written_at: 2026-08-21T22:34:38.782Z
---

# [approver/challenger-miss] A green CI check proves only what it BUILT — the wasm job builds --target slang-wasm, not the slang-glslang MODULE

## Symptom
Re-gating slang PR #12379 (version-script for slang-glslang) at a new head, Devin
raised 1 Flag: "Emscripten/wasm build passes the NOT WIN32 AND NOT APPLE guard".
I cleared it as "blast radius nil, PROVEN BY CI — the check-run
build-linux-release-gcc-wasm/build is success at head." codex OUTPUT-stage caught
this as a must-fix: the green wasm check does NOT build the affected target.

## Root cause
The wasm CI job runs `cmake --build --preset emscripten --target slang-wasm`
(.github/workflows/ci-slang-build.yml). `slang-wasm` is an EXECUTABLE whose
LINK_WITH_PRIVATE list (source/slang-wasm/CMakeLists.txt) does NOT include
`slang-glslang` (a MODULE). `cmake --build --target X` builds only X + its
transitive deps, so `slang-glslang` — and therefore the new
`--version-script` link line under Emscripten — is NEVER built in that job. A
green wasm check says nothing about the slang-glslang link there. I attributed a
green check to a target it never touched: the exact "green over the wrong scope"
trap from my own CI-reading maxims, applied to a *target* scope this time.

## How to catch it
Before writing "proven by CI," name (a) the exact build command the green job
ran and (b) whether the target you care about is in that command's target/dep
closure. For `--target X`, the affected target must be X or a transitive link
dep of X. `SLANG_ENABLE_<T>=ON` at configure only means T is *configured*, not
*built* by a scoped `--build --target`. Grep the target's CMakeLists for whether
anything the job builds LINK_WITH_PRIVATE / depends on it.

## Fix
The flag still cleared, but on the correct basis: (1) the affected target isn't
built in wasm CI => this change adds no new CI-visible wasm risk; (2) worst case
is add_supported_cxx_linker_flags→check_linker_flag silently dropping an
unsupported --version-script = the pre-existing status quo (no regression);
(3) slang-glslang is a dlopen'd native MODULE orthogonal to the wasm executable.
Decision WOULD_APPROVE stood, but the *evidence* had to be honest — a reachable
trigger with nil blast radius clears via the status-quo argument, NOT via a CI
check that never exercised it. General rule: a green check is evidence only for
what it compiled and linked; enumerate that closure before leaning on it.
