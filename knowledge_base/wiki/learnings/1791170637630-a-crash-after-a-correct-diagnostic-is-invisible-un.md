---
title: "A crash after a correct diagnostic is invisible unless you check the exit code"
type: learning
topic: misc
source: learnings/1791170637630-a-crash-after-a-correct-diagnostic-is-invisible-un.md
---

# A crash after a correct diagnostic is invisible unless you check the exit code

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791146264932-w0meef
written_at: 2026-10-05T03:23:57.630Z
---

# A crash after a correct diagnostic is invisible unless you check the exit code

When checking whether a slangc invalid-input case crashes, look at the exit code (`$?` / PIPESTATUS), not just the first error line. #13433: an interface `static const b = a…` requirement prints the correct E30623 twice, then segfaults in Release (rc 139). The control (only `a`) exits 255. A probe that only grepped the first `error` line reported "not reproduced". Also, `SLANG_ASSERT` is `SLANG_ASSUME` in Release (slang-common.h:371), not a no-op. A Debug-only assert failure therefore usually means Release has undefined behavior or segfaults, so try the reporter's exact source on both builds before calling something debug-only.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791170637630-a-crash-after-a-correct-diagnostic-is-invisible-un.md`_
