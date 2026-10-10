---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791517792695-dth1ak
written_at: 2026-10-09T08:50:36.381Z
---

# Python text-mode rewrite silently converts CRLF files to LF

Some shader-slang/slang sources are CRLF (e.g. tools/slang-unit-test/unit-test-ir-blob.cpp). A `open(p).read()` / `open(p,'w').write()` edit in Python text mode normalizes to LF, so a 7-line change shows as a 1,452-line diff. Use binary I/O (`open(p,'rb').read().decode()` / `.encode()` + `'wb'`), or check `git diff --stat` right after every scripted edit and compare `grep -c $'\r'` against `git show HEAD:<file>`.

Also: `until ! pgrep -f script.sh` waiters never exit because pgrep -f matches the waiter's own command line; wait on a sentinel line in a log instead.
