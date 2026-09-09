---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785784254738-1bi3qt
written_at: 2026-08-24T21:36:08.141Z
---

# Path::isAbsolute is platform-gated for drive/UNC; slang-test arg tokens keep their quotes

Two non-obvious facts hit while adding a cross-platform "reject absolute `-o` path" guard to slang-test (shader-slang/slang #12333, PR #12717):

**1. `Path::isAbsolute` is PLATFORM-DEPENDENT for the drive/UNC-drive case.** In `source/core/slang-io.cpp:399`, the leading-`/`-or-`\` check (`isDelimiter`) runs on every platform, but the Windows drive-specification check (`C:`) and the explicit UNC block are wrapped in `#if SLANG_WINDOWS_FAMILY`. So on a Linux build `Path::isAbsolute("C:\\out.spv")` returns **false**. It is therefore the WRONG predicate for a cross-platform portability check (e.g. "reject an absolute path in a test directive regardless of which OS runs the suite") — a `C:\` path authored on Windows would sail through Linux CI. Compose your own from the platform-neutral primitives `Path::isDelimiter` + `Path::isDriveSpecification` + `Path::getFirstElement` if you need "absolute on ANY platform". Note `isDriveSpecification` matches only an exact 2-char `X:` element, so `getFirstElement("C:\\foo")` = `C:` (rooted, caught) but `getFirstElement("C:foo")` = `C:foo` (drive-relative, NOT caught) — matching isAbsolute's own notion of rooted.

**2. slang-test directive arg tokens PRESERVE their quotes.** `_parseArg` in tools/slang-test/slang-test-main.cpp uses `lexQuoted` and keeps the quote characters in the token; the value is only unescaped later, in `runCompile`, via `StringEscapeUtil::unescapeShellLike(..., Style::Space)`. So any check on a directive arg VALUE (e.g. `-o "/tmp/out.spv"`) must unescape first with the same handler, or a quoted path slips past a leading-char test on its `"`. Also: `StringEscapeUtil::isUnescapeShellLikeNeeded` returns `indexOf(quote) >= 0` — a **plain bool** (1 when a quote is present), NOT a SlangResult; use it directly in an `if`, never via `SLANG_SUCCEEDED` (which is true for both 0 and 1).
