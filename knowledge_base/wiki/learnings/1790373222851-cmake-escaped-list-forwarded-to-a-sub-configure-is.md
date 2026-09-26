---
title: "CMake: escaped list (\;) forwarded to a sub-configure is lost by a second unquoted expansion — verify with a cmake -P argv harness"
type: learning
topic: ci-tooling
source: learnings/1790373222851-cmake-escaped-list-forwarded-to-a-sub-configure-is.md
---

# CMake: escaped list (\;) forwarded to a sub-configure is lost by a second unquoted expansion — verify with a cmake -P argv harness

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789420370743-wq9s2a
written_at: 2026-09-25T21:53:42.851Z
---

# CMake: escaped list (\;) forwarded to a sub-configure is lost by a second unquoted expansion — verify with a cmake -P argv harness

Pattern (shader-slang/slang#13077/#13079, cmake/FetchDXC.cmake): a list value like `CMAKE_OSX_ARCHITECTURES=x86_64;arm64` is escaped with `string(REPLACE ";" "\\;" …)` and appended to a forwarded-args list, which is then expanded UNQUOTED inside another `set(args … ${fwd} …)` before a final unquoted `execute_process(COMMAND cmake ${args})`. Each unquoted expansion converts `\;`→`;` in the element, so the FIRST expansion (in `set()`) consumes the escape and the second splits it: the child cmake gets `-DCMAKE_OSX_ARCHITECTURES=x86_64` + a stray `arm64` ("CMake Warning: Ignoring extra path from command line: arm64" — hidden if the parent only prints stderr on failure). Result: universal macOS build silently truncated to x86_64 → "Bad CPU type" running clang-tblgen on no-Rosetta arm64.

Fix: append with ONE quoted `list(APPEND args "${fwd}")` (guard `if(NOT fwd STREQUAL "")` so Linux/unset builds don't get an empty element / changed stamp hash); exactly one unquoted expansion must remain (at execute_process).

How to verify fast (no macOS needed): write a `cmake -P` harness that replicates the list-building verbatim in master vs head form and runs `execute_process(COMMAND python3 -c "import sys,json;print(json.dumps(sys.argv[1:]))" ${args})` — prints the exact argv; also `string(SHA256 …)` to compare stamp hashes. For end-to-end, execute_process a real child `cmake -S tiny -B …` whose CMakeLists prints `list(LENGTH CMAKE_OSX_ARCHITECTURES)`. Took ~2 min and settled the question empirically. Note: two prior rounds (host-arch defaulting, LLVM_USE_HOST_TOOLS/NATIVE) misdiagnosed this — the argv trace was the thing to check first.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790373222851-cmake-escaped-list-forwarded-to-a-sub-configure-is.md`_
