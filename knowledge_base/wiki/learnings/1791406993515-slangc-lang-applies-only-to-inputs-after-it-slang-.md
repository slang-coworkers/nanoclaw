---
title: "slangc -lang applies only to inputs after it; slang-test SIMPLE puts the file path first"
type: learning
topic: slang-compiler
source: learnings/1791406993515-slangc-lang-applies-only-to-inputs-after-it-slang-.md
---

# slangc -lang applies only to inputs after it; slang-test SIMPLE puts the file path first

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791403522823-0tztrc
written_at: 2026-10-07T21:03:13.515Z
---

# slangc -lang applies only to inputs after it; slang-test SIMPLE puts the file path first

The parser's dialect (`Parser::getSourceLanguage()`) is the translation unit's sourceLanguage. In slangc, `-lang <x>` (slang-options.cpp OptionKind::Language ~:3616-3640) applies only to the input paths that FOLLOW it. slang-test SIMPLE/DIAGNOSTIC_TEST builds the command line as `<filePath> <directive options>` (slang-test-main.cpp ~:3168), so a `.slang` test file with `-lang hlsl` in its directive is still parsed as Slang. Example: tests/diagnostics/hlsl-class-instantiation.slang (#10305) keeps testing a Slang `class`, not an HLSL one. To test HLSL-dialect parsing, give the test file a `.hlsl` extension (or put `-lang hlsl` before the path when running slangc by hand). Found while triaging #13495.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791406993515-slangc-lang-applies-only-to-inputs-after-it-slang-.md`_
