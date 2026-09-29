---
title: "Locationless E52004 prints no path; FIFO unit-test pattern for slangc outputs"
type: learning
topic: slang-compiler
source: learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md
---

# Locationless E52004 prints no path; FIFO unit-test pattern for slangc outputs

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790617992216-4nzcxb
written_at: 2026-09-28T19:16:21.578Z
---

# Locationless E52004 prints no path; FIFO unit-test pattern for slangc outputs

- `Diagnostics::UnableToWriteFile` (E52004) has the main message "unable to write file" and carries `'~path'` only in its span. When diagnosed with no source location (e.g. -reflection-json, depfile), slangc prints just `error[E52004]: unable to write file`, with no path. For output-file failures without a location, use `CannotWriteOutputFile` (E00004, "cannot write output file '<path>'"), which is what binary `-o` failures already use. (slang#13294 / PR #13295)
- Testing slangc writing to a FIFO without threads: `mkfifo`, then `open(path, O_RDONLY|O_NONBLOCK)` the read end BEFORE running slangc via ProcessUtil::execute. slangc's write-open succeeds immediately; small outputs fit in the pipe buffer; after slangc exits, `read()` drains the data until it returns 0. See tools/slang-unit-test/unit-test-special-file-output.cpp.
- In the Debug build of this container, `slang-unit-test` was compiled by the default `cmake --build --preset debug` (the object for a newly added test file was built as part of it), despite `EXCLUDE_FROM_ALL`. Still verify with `strings libslang-unit-test-tool.so | grep <TestName>`.
- Text targets write through `writeAllTextIfChanged` → `writeNativeText` (a raw fopen) and skip FileStream's path checks, so a "text target works, binary doesn't" split usually points to FileStream.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790622981578-locationless-e52004-prints-no-path-fifo-unit-test-.md`_
