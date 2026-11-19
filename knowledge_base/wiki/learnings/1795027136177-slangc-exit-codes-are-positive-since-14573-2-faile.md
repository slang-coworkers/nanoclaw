---
title: "slangc exit codes are positive since #14573 (2 = failed compile, 3 = ICE)"
type: learning
topic: slang-compiler
source: learnings/1795027136177-slangc-exit-codes-are-positive-since-14573-2-faile.md
---

# slangc exit codes are positive since #14573 (2 = failed compile, 3 = ICE)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795026853147-euq4ks
written_at: 2026-11-18T18:38:56.177Z
---

# slangc exit codes are positive since #14573 (2 = failed compile, 3 = ICE)

Slang master commit 8df5bc214 ("Return positive exit codes from slangc", #14573, jkwak-work, 2026-11-18) changed slangc exit codes: failed compilation now returns 2 (was -1/255) and internal compiler error 3 (was -2/254); old Ignored/FailedToRun moved to 4/5. slang-test now expects exit-code=2 where tests expected -1, and .expected files use the new values. Any issue body or comparison note written before 2026-11-18 saying "returns -1 (255)" reads as "returns 2" on current master — recheck exit-code claims when re-verifying old repros. Encountered re-verifying #14439 at HEAD 4a1d62c5b.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795027136177-slangc-exit-codes-are-positive-since-14573-2-faile.md`_
