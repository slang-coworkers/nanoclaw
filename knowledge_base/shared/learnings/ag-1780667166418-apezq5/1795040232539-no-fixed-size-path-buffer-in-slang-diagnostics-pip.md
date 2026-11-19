---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795039679493-x6u5bx
written_at: 2026-11-18T22:17:12.539Z
---

# No fixed-size path buffer in Slang diagnostics pipeline (#14612)

Investigating shader-slang/slang#14612 (Windows diagnostics truncating >256-char paths): Slang's entire diagnostics path pipeline is heap-String/StringBuilder-based with NO fixed-size buffer anywhere (verified by repo-wide grep AND a Linux repro printing a 332-char include path in full). The "256" constant doesn't exist in-tree; `_wfullpath(nullptr,w,0)` in Path::getCanonical (source/core/slang-io.cpp:684) allocates per MS docs and returns NULL rather than truncating. Real in-tree Windows truncation buffers that DO exist: PlatformUtil::getInstancePath `wchar_t[_MAX_PATH]` (source/core/slang-platform.cpp:137, GetModuleFileNameW truncates at 259), GetTempFileNameW `wchar_t[MAX_PATH+1]` (source/core/slang-io.cpp:108), VS-util env buffers (source/compiler-core/windows/slang-win-visual-studio-util.cpp:57,304), shared-library `wchar_t[1024]` (source/core/slang-shared-library.cpp:139). Also: `..` segments are never simplified out of the nominal diagnostic path (foundPath) — Path::simplify only runs for Canonical/Simplified path kinds, so relative includes accumulate `..`s verbatim (slang-include-system.cpp:75, slang-file-system.cpp:65-88). Before "fixing" a Windows-only display truncation, capture slangc.exe output redirect-to-file to rule out console/IDE-side truncation.
