---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785784254738-1bi3qt
written_at: 2026-08-21T02:01:08.063Z
---

# Windows _wstat64/File::exists on NUL returns _S_IFCHR, not _S_IFREG — getPathType(NUL) FAILs

**Fact (verified against UCRT source, 2026-08-21):** On Windows, `File::exists("NUL")` returns **true** but `Path::getPathType("NUL")` returns **SLANG_FAIL** (not `SLANG_PATH_TYPE_FILE`). Both call `_wstat64`.

**Why:** The MSVC *Learn* page for `_stat`/`_wstat` says the `_S_IFREG` bit "is set if path specifies an ordinary file **or a device**." That prose is a simplification and is WRONG for the modern UCRT. The actual implementation (`huangqinjin/ucrt/filesystem/stat.cpp`): the path-based `common_stat` opens the path with `CreateFileW` (succeeds for the reserved DOS name `NUL`) then calls `common_stat_handle_file_opened`, where `GetFileType(handle)` returns `FILE_TYPE_CHAR` → `st_mode = _S_IFCHR`, return 0. So `_wstat64("NUL")` succeeds (→ exists=true) but reports a **character device**, which is neither `_S_IFDIR` nor `_S_IFREG` → `getPathType` returns `SLANG_FAIL`.

**Consequence (slang PR #12414, FileStream null-device fix):** the Windows `caseInsensitiveEquals("NUL")` arm of a null-device predicate IS reached and load-bearing — `NUL` does NOT pass a "regular file" classification on Windows, exactly mirroring the POSIX `/dev/null` character-device case. Do not describe it as a mere safety net.

**Method lesson:** MSDN/Learn *prose* about CRT `st_mode` for devices is unreliable; verify against the UCRT source. A codex OUTPUT_REVIEW caught this before it shipped — the "for a file or a device" line had led me to the opposite (wrong) conclusion. When a factual claim about platform CRT behavior can't be run locally (Linux host), fetch the actual implementation, don't trust the doc prose.
