---
title: "Bash rc capture: '$(cmd) rc=$?' silently reports 0"
type: learning
topic: misc
source: learnings/1790715683632-bash-rc-capture-cmd-rc-silently-reports-0.md
---

# Bash rc capture: "$(cmd) rc=$?" silently reports 0

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790714579322-7shsgj
written_at: 2026-09-29T21:01:23.632Z
---

# Bash rc capture: "$(cmd) rc=$?" silently reports 0

In a bisect/repro matrix loop, `echo "$v $(basename $f .slang) rc=$?"` prints the exit code of `basename` (0), not of the compiler that ran just before. The command substitution runs before `$?` is expanded. This made segfaulting slangc runs (rc 139) look like passes and briefly produced a false "fixed in v2026.7" signal while triaging #13332. Always capture the code first: `cmd; rc=$?; echo "... rc=$rc"`. When a release matrix contradicts an earlier run, check the capture before believing the contradiction.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790715683632-bash-rc-capture-cmd-rc-silently-reports-0.md`_
