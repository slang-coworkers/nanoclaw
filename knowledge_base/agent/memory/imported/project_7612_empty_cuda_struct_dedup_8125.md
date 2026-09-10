---
name: project_7612_empty_cuda_struct_dedup_8125
description: "slang#7612 \"properly handle empty CUDA structs\" — CANONICAL bug;"
metadata: 
  node_type: memory
  type: project
  originSessionId: f63d667f-97d9-4a3c-8519-be1b7008d4c2
---

slang#7612 "Properly handle empty CUDA structs" (label cuda, author sricker-nvidia COLLABORATOR, assignee mkeshavaNV, opened 2025-07-02). Triaged 2026-07-31 @ HEAD c3791ed4e: bug / high / P2 / target-emit (CUDA/CPU C-like) + type-layout.

**Dedup:** #7612 = CANONICAL/original super-bug. **#8125 (opened 2025-08-08) = slangpy-surfaced DUP** — maintainer bmillsNV commented on #8125 "Looks like a dup of #7612." #7612 timeline cross-refs #8125, #10788 (CLOSED), #11657 (CLOSED). Same root cause exactly.

**Root cause (Slang codegen, NOT slangpy — disproves reporter's shader_cursor.cpp stride hypothesis):** a `public` empty struct is retained as a struct member in CPU/CUDA C-like emit. Reflection/type-layout correctly treats empty struct as size 0 (field after it at offset 0), but the C-like EMITTER only skips IRVoidType fields (slang-emit-c-like.cpp:4477), not empty-struct fields → emitted struct places following field 1 byte later. slangpy binds per reflection (offset 0), device reads per emit (offset 8) → mismatch → CUDA_ERROR_ILLEGAL_ADDRESS. `public` is the trigger: non-public empty structs get legalized to void & dropped (slang-ir-legalize-types.cpp:4104/4117 isSimpleType retains kIROp_PublicDecoration); slangpy's separate-module/public-interface flow supplies the public. Repro verified static (offsetof mismatch 0 vs 8).

**Active fix = draft PR #12304** ("Fix #8125: don't retain public empty structs in CPU/CUDA emit", Fixes #8125, author nv-slang-bot, branch fix/issue-8125-v2, base master, HELD draft pending jkwak-work review). jkwak's dictated minimal fix: remove the addPublicDecoration block in addLinkageDecoration (slang-lower-to-ir.cpp:1434-1438) + mechanical else-if→if, so public empty struct legalizes like the already-correct non-public case. CI is the real gate (IRPublicDecoration governs linkage/visibility for all public decls). #12304 does NOT list Fixes #7612.

**Verdict for #7612:** DUP — do NOT produce a separate fix (double-dispatch). No fixer dispatch. Maintainer action at merge: add `Fixes #7612` to #12304 OR close #7612 as dup of #8125 — maintainer call, NEVER auto-close.

REJECTED history: #11657 global removeEmptyStructFields pass (CI-rejected, broke Conditional/Optional payload empties); #10788 copilot isSimpleType direction (CLOSED).

Related: [[feedback_github_writes_operator_authorized]] (gh comment op-gated). Supersedes the bare "#8125 empty-struct CUDA" PARKED note in the index.
