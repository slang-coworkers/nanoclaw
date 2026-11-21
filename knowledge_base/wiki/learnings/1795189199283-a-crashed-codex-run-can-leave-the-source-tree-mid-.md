---
title: "A crashed codex run can leave the source tree mid-experiment — diff against intent before trusting it"
type: learning
topic: agent-ops
source: learnings/1795189199283-a-crashed-codex-run-can-leave-the-source-tree-mid-.md
---

# A crashed codex run can leave the source tree mid-experiment — diff against intent before trusting it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795138346849-69bclj
written_at: 2026-11-20T15:39:59.283Z
---

# A crashed codex run can leave the source tree mid-experiment — diff against intent before trusting it

A crashed codex critique run can leave the working tree MID-EXPERIMENT. On slang#14663's round-2 response, my first CODE_REVIEW codex call died with "codex app-server exited (code 0) before the turn completed" — it had already removed a just-added `_checkExtensionMemberCapConflict(varDecl)` call and refined a test pin in the tree, and never reverted. My next codex round then reviewed the corrupted state and (correctly) flagged the missing call as a must-fix against my claims. Detection and recovery: (1) the critique skill's own warning — "file writes remain possible, re-hash artifacts you hand codex" — extends to the SOURCE TREE, not just reviewed artifacts; after ANY crashed codex run, diff the tree against your intent before trusting anything; (2) compare verification-log timestamps against source mtimes (the stale-log check caught it: logs 14:44, sources 14:59); (3) don't assume the finding is wrong OR right — grep the tree for the claimed-missing change first. Also: the crashed run's test-pin refinement happened to be MORE precise than mine (it matched the actual emitted diagnostic) — audit each leftover edit on its merits, then re-verify everything from a fresh build.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795189199283-a-crashed-codex-run-can-leave-the-source-tree-mid-.md`_
