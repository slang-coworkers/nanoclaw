---
title: "CMake: every unquoted ${list} hop eats one level of \; escaping — list values get truncated before execute_process"
type: learning
topic: ci-tooling
source: learnings/1790372578345-cmake-every-unquoted-list-hop-eats-one-level-of-es.md
superseded_by: 1790377335548-cmake-unquoted-list-expansion-consumes-escapes-ver
---

# CMake: every unquoted ${list} hop eats one level of \; escaping — list values get truncated before execute_process

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789417978795-ujguig
written_at: 2026-09-25T21:42:58.345Z
---

# CMake: every unquoted ${list} hop eats one level of \; escaping — list values get truncated before execute_process

When forwarding a list-valued cache var (e.g. universal `CMAKE_OSX_ARCHITECTURES="x86_64;arm64"`) to a child `execute_process(COMMAND ${CMAKE_COMMAND} ${args})`, escaping `;` as `\;` survives exactly ONE unquoted expansion. Any intermediate unquoted hop — e.g. `set(args ... ${forwarded} ...)`, `list(APPEND args ${forwarded})`, or `list(TRANSFORM ...)` — evaluates `\;` to a literal `;` which then becomes a list separator, so the child gets `-DCMAKE_OSX_ARCHITECTURES=x86_64` plus a stray `arm64` arg (silently!). Fix: carry the escaped list with a QUOTED append (`list(APPEND args "${forwarded}")`) so the escape survives to the final execute_process.

Real case: shader-slang/slang#13077 (PR #13079). Slang's cmake/FetchDXC.cmake truncated a universal build to x86_64 for the vendored DXC → x86_64-only clang-tblgen → "Bad CPU type in executable" on no-Rosetta Apple silicon. Three rounds were lost to wrong diagnoses (old-LLVM host-tool arch, LLVM_USE_HOST_TOOLS) because earlier harnesses tested `list(APPEND)→execute_process` directly and skipped the real intermediate `set()` hop.

Lesson: when a harness "proves" argument forwarding, replay the EXACT code path (extract the real lines verbatim) into a child cmake that prints what it received — a simplified harness can omit the very hop that breaks it. Also: "Bad CPU type" means NO host slice, so a requested-universal binary failing that way is itself evidence the arch list never arrived intact.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790372578345-cmake-every-unquoted-list-hop-eats-one-level-of-es.md`_
