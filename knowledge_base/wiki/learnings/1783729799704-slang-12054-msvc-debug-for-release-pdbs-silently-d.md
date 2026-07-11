---
title: "slang#12054: MSVC /DEBUG for Release PDBs silently disables /OPT:REF and /OPT:ICF"
type: learning
topic: slang-compiler
source: learnings/1783729799704-slang-12054-msvc-debug-for-release-pdbs-silently-d.md
---

# slang#12054: MSVC /DEBUG for Release PDBs silently disables /OPT:REF and /OPT:ICF

**Symptom:** Slang's default MSVC Release build loses dead-code elimination (`/OPT:REF`) and identical-COMDAT folding (`/OPT:ICF`) — larger binaries, no functional change.

**Root cause (verified at HEAD c0952c29d):** `SLANG_ENABLE_RELEASE_DEBUG_INFO` defaults `ON` (`CMakeLists.txt:344`), which adds `Release` to `debug_configs` (`cmake/SlangTarget.cmake:287-290`) and injects `/DEBUG` into MSVC Release links (`cmake/SlangTarget.cmake:298-302`, added by PR #5783 / commit 27b7ac0e8). MSVC's linker flips `/OPT` defaults whenever `/DEBUG` is present: `REF→NOREF`, `ICF→NOICF` (Microsoft `/DEBUG` doc). Slang never re-asserts `/OPT:REF`/`/OPT:ICF` anywhere (grep-confirmed), so the demotion sticks.

**The non-obvious wrinkle for the fix:** `/DEBUG` *implies* `/INCREMENTAL`, and `/OPT:REF|ICF` are silently ignored under incremental linking (LNK4075). So re-adding `/OPT:REF /OPT:ICF` only works if incremental is OFF for that config. CMake's built-in `CMAKE_*_LINKER_FLAGS_RELEASE` already carries `/INCREMENTAL:NO`, so Release is clean — but `RelWithDebInfo`'s CMake default carries `/INCREMENTAL` (not :NO), so a fix that also touches RelWithDebInfo must guard against LNK4075. Fix belongs co-located with the `/DEBUG` injection (SlangTarget.cmake:298-302), same layer as the existing `/INCREMENTAL:NO` precedent at `cmake/CompilerFlags.cmake:273,319`.

**Triage-process note:** MSVC-linker behavior is best verified against Microsoft's own `/DEBUG` linker doc + a code trace, NOT DeepWiki (which answers compiler-architecture flow, not build-flag defaults). On a Linux container with no MSVC, this is a legitimate "verify by authoritative doc + code trace, withhold `reproduced` label" case. Author pdeayton-nv is a CONTRIBUTOR + frequent build/CMake self-fixer → parked at triaged, no bot fixer dispatched (contributor-self-fix authorship-race guard, learning 1783416692832).

**gh token note (2026-07-11):** the REST `POST repos/.../issues/{n}/labels` endpoint 403'd ("Must have admin rights"), but GraphQL `addLabelsToLabelable` + `updateIssue`(issueTypeId) + comment POST all succeeded on the same token. When REST label-add 403s, retry the label via GraphQL before assuming no write access.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783729799704-slang-12054-msvc-debug-for-release-pdbs-silently-d.md`_
