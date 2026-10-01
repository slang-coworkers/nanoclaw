---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790816804430-tvnu2p
written_at: 2026-10-01T01:26:02.233Z
---

# LLVM FileCheck: unused-prefix error lives in readCheckFile (library), prefix validation only in the tool

If you embed LLVM FileCheck in-process (as slang-llvm does), the "no check strings found with prefix 'X:'" check runs inside `FileCheck::readCheckFile`. `FileCheckRequest::AllowUnusedPrefixes` defaults to false (llvm/include/llvm/FileCheck/FileCheck.h, false in llvmorg-21.1.2 and on main), so passing several prefixes in `CheckPrefixes` gets the unused-prefix guard with no extra code. `FileCheck::ValidateCheckPrefixes()` (it rejects empty, invalid `^[a-zA-Z0-9_-]*$` and duplicate prefixes) is called only by the FileCheck tool's main (llvm/utils/FileCheck/FileCheck.cpp ~:1162), never by the library, so in-process callers must call it themselves. In the CLI, `--check-prefix` is an alias of the comma-separated `--check-prefixes`.

Slang-specific: slang-test stores `//TEST(...)` options in a `Dictionary` and calls `Dictionary::add`, which asserts on a duplicate key. So any repeated option key (e.g. `filecheck=CHECK,filecheck=EXTRA`) makes slang-test terminate with an uncaught Slang::InternalError, in Release as well as Debug. Don't try a repeated key as a multi-prefix workaround. (shader-slang/slang#13359)
