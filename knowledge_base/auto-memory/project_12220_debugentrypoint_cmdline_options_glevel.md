---
name: project-12220-debugentrypoint-cmdline-options-glevel
description: "#12220 SPIR-V DebugEntryPoint cmdline omits options + misreports -g level; P3 metadata; PARKED-at-triaged (pdeayton owns family)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0ae21c89-e125-4e07-9f11-c77bed5e326c
---

# #12220 — SPIR-V DebugEntryPoint command-line string wrong

**Filed** 2026-07-24 by **pdeayton-nv** (member; self-filed, NOT self-assigned). shader-slang/slang.

`NonSemantic.Shader.DebugInfo.100` `DebugEntryPoint` synthesizes a command-line-args OpString that (a) **misreports debug level** (`-g2` for a `-g3` compile) and (b) **drops supplied options** (`-lang`, `-profile`, `-gdwarf`, `-minimum-slang-optimization`, `-line-directive-mode`). Metadata-accuracy only — reporter confirms it does NOT change the options used for the actual compilation.

**Class:** bug / **low / P3** / target-emit (SPIR-V) + shared CompilerOptionSet serializer. Reproduced @HEAD `5281ccc66` (byte-for-byte).

**Two roots (triager-found, verify before fixing):**
1. Hardcoded `sb << " -g2";` at `slang-emit-spirv.cpp:3968` — never reads `getDebugInfoLevel()` (which exists).
2. `writeCommandLineArgs` (`slang-compiler-options.cpp:44-180`) is a switch with **no default** → unlisted option kinds silently skipped. Serializer shared with CPU/LLVM path (`slang-emit-llvm.cpp:726`); module-cache hashing uses separate `buildHash`, so a fix won't disturb digests. Prior art: #6108/PR#6114 touched this same fn.

**Fix (Approach A):** serialize the missing options incl `-g<level>`+`-gdwarf`; delete the emit-site `-g2`.

**State:** TRIAGED + **PARKED-at-triaged** (Main ruling 07-24). Verified 5-bullet posted (comment 5072896209), `reproduced` label + Issue Type=Bug set. NOT dispatched to fixer — pdeayton owns the SPIR-V debug-info family ([[project_12181_debug_info_include_source_flag]], #12202/#12148/#12150/#12219). **Release trigger:** pdeayton says "make a PR" (or asks bot to take it) → hand triager memo to slang-fixer on thread `gh-issue-shader-slang/slang-12220`.

**Fixer briefing memo** ready: `triage-12220.md` (received from triager as `inbox/a2a-1784916080618-5d46vb/triage-12220.md`) — forward to slang-fixer on release.

Related family: [[project_11983_spirv_debugfunction_wrong_cu]], [[project_12150_include_line_cu_scoping]].
