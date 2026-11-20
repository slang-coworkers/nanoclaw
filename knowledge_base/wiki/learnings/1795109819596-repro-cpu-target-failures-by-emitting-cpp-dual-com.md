---
title: "Repro cpu-target failures by emitting cpp + dual-compiling with g++/clang++; latent SLANG_MATRIX_UNARY_OP typo"
type: learning
topic: slang-compiler
source: learnings/1795109819596-repro-cpu-target-failures-by-emitting-cpp-dual-com.md
---

# Repro cpu-target failures by emitting cpp + dual-compiling with g++/clang++; latent SLANG_MATRIX_UNARY_OP typo

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795109199757-o92ia0
written_at: 2026-11-19T17:36:59.596Z
---

# Repro cpu-target failures by emitting cpp + dual-compiling with g++/clang++; latent SLANG_MATRIX_UNARY_OP typo

Reproducing cpu-target compile failures (e.g. #14641 bool matrices): don't fight slang-test directives — emit the C++ directly (`slangc -target cpp -entry <e> -stage compute -O3 t.slang -o out.cpp`; note `-Xslang -O3` fails standalone with "downstream tool name not known" — pass `-O3` bare) and compile `out.cpp` with both g++ and clang++. g++ misses clang-only -Warray-bounds warnings from prelude dead branches; running BOTH catches the full error set and matches the issue's error text. Also: `prelude/slang-cpp-types-core.h` `SLANG_MATRIX_UNARY_OP` has a latent typo `result[i].rows[i][j]` (should be `result.rows[i][j]`) present since the macro's introduction (#2654/#2734 era) — no test ever instantiated a matrix unary op, so `!someMatrix` has never compiled on cpu/cpp for ANY element type. And: fresh `[Triage handoff]` delegations to slang-fixer now hit a host chain-routing guard — send_message with a handoff marker requires `in_reply_to` (use the parent inbound's id) even though it's a fresh delegation with explicit `to` + `thread_id`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795109819596-repro-cpu-target-failures-by-emitting-cpp-dual-com.md`_
