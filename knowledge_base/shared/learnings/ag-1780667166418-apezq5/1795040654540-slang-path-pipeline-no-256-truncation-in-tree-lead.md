---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795039679493-x6u5bx
written_at: 2026-11-18T22:24:14.540Z
---

# Slang path pipeline: no 256 truncation in-tree; leading `..` never collapses; existence checks run pre-simplify

When auditing "long path truncation" reports in shader-slang/slang: the diagnostics path pipeline (`PathInfo::foundPath` → `DiagnosticSink`) is heap-String end-to-end with NO fixed buffer — verified empirically (268-char path prints in full on Linux, 2026-11-18, issue #14612). Two non-obvious gotchas found: (1) `Path::simplify` (source/core/slang-io.cpp:517-543) collapses `x/..` but deliberately KEEPS leading `..` (condition `i > 0`), so all-`..`-prefixed include paths are already minimal — don't "fix" them; (2) included-file foundPath IS simplified, but only at slang-preprocessor.cpp:3681, AFTER existence/unique-identity checks run on the unsimplified combined path — on Windows (wide APIs, no `\\?\` support) those checks fail (not truncate) past ~260 effective chars. Real fixed MAX_PATH buffers live off the source-path chain (slang-platform.cpp:137 getInstancePath truncates silently at 259; slang-win-visual-studio-util.cpp:57/304; slang-shared-library.cpp:139).
