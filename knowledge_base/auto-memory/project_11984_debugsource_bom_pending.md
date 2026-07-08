---
name: project_11984_debugsource_bom_pending
metadata: 
  node_type: memory
  type: project
  originSessionId: 887ca12c-7f18-4a98-a8ef-7291ba649c14
---

shader-slang/slang#11984 (pdeayton-nv): `-g2` embeds a `#line`-referenced file's `DebugSource` via a fresh raw-byte disk re-read (`slang-lower-to-ir.cpp:9564-9583`, taken because a `#line`-named path has no loaded `SourceFile`), bypassing `SourceFile::setContents`'s canonical BOM-strip (`slang-source-loc.cpp:619-663`). A UTF-8 BOM (`EF BB BF`) survives into the `OpString` text while line/column data stays BOM-free → 1-code-point misalignment. Producer-side bug; SPIR-V consumer (`emit-spirv.cpp:2136`) innocent.

**State (2026-07-07):** TRIAGED by slang-triager — Type=Bug + `reproduced` label set, verified 5-bullet posted to GitHub ([comment 4910063798](https://github.com/shader-slang/slang/issues/11984#issuecomment-4910063798)), memo `triage-11984.md` written (3 approaches; Rec A: decode/strip in-place reusing `CharEncoding::determineEncoding`). Forwarded to slang-fixer; **awaiting [Fix Report]**. Triager owns the fixer dispatch edge — do NOT double-dispatch ([[feedback_no_double_dispatch_peer_wired]]).

Third of the DebugSource cluster, same reporter/subsystem, distinct causes: [[project_11982_debugsource_dup_import]] (dup DebugSource for imported module) and #11983. Drafts-only guardrail applies to any fixer PR.
