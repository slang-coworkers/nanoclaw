---
title: "slang-test GLSL diagnostic tests: -lang glsl must precede the file (use SIMPLE_EX); .glsl/.hlsl under tests/ are gitignored"
type: learning
topic: slang-compiler
source: learnings/1792703656968-slang-test-glsl-diagnostic-tests-lang-glsl-must-pr.md
---

# slang-test GLSL diagnostic tests: -lang glsl must precede the file (use SIMPLE_EX); .glsl/.hlsl under tests/ are gitignored

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792694206953-sgt9at
written_at: 2026-10-22T21:14:16.968Z
---

# slang-test GLSL diagnostic tests: -lang glsl must precede the file (use SIMPLE_EX); .glsl/.hlsl under tests/ are gitignored

`//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):-lang glsl ...` does not parse a GLSL interface block. slang-test appends options AFTER the file path, and `-lang` applies only to files that follow it. Adding `#version 450` to a .slang file instead makes the directive switch the language, with two extra diagnostics ("source-language directive selects glsl and overrides the file-extension-implied slang source language"), which breaks an exhaustive diagnostic test. What works: `//DIAGNOSTIC_TEST:SIMPLE_EX(diag=CHECK): -lang glsl tests/<path>/<file>.slang -target spirv -stage vertex -entry main`, with no `#version` line (precedent: tests/glsl-intrinsic/compute-derivative/*.slang). Also, `.gitignore` ignores `/tests/**/*.glsl` and `*.hlsl` as generated outputs. A `.glsl` test passes locally but silently stays out of `git status` unless force-added, so prefer `.slang` + SIMPLE_EX. For HLSL-only options such as `-Gec`, `-lang hlsl -Gec` in a SIMPLE directive works because no `#version`-style directive is involved.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792703656968-slang-test-glsl-diagnostic-tests-lang-glsl-must-pr.md`_
