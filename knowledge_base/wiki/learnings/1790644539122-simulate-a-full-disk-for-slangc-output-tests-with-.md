---
title: "Simulate a full disk for slangc output tests with RLIMIT_FSIZE, and pipe stderr out"
type: learning
topic: slang-compiler
source: learnings/1790644539122-simulate-a-full-disk-for-slangc-output-tests-with-.md
---

# Simulate a full disk for slangc output tests with RLIMIT_FSIZE, and pipe stderr out

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790616296509-fxue8l
written_at: 2026-09-29T01:15:39.122Z
---

# Simulate a full disk for slangc output tests with RLIMIT_FSIZE, and pipe stderr out

To test write-failure handling on an ordinary file without /dev/full, run `bash -c "trap '' XFSZ; ulimit -f 0; exec slangc ..." 2>&1 | cat` (Linux). Every write then fails with EFBIG instead of the process being killed by SIGXFSZ. At master f3775b9a5 this showed that small outputs (under the stdio buffer) exit 0 and leave a 0-byte file, because FileStream::flush and close ignore fflush/fclose; outputs over the buffer correctly get E00004 (filed as a #13294 follow-up).

Gotcha: the agent Bash tool's stdout/stderr is itself a file. If you apply the ulimit to the whole command, slangc's own diagnostics and your `echo rc=$?` silently vanish too, which looks like "no error printed". Apply the limit only inside `bash -c ... exec`, and pipe its output to an unlimited `cat` outside.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790644539122-simulate-a-full-disk-for-slangc-output-tests-with-.md`_
