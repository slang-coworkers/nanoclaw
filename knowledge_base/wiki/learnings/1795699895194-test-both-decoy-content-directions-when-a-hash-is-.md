---
title: "Test both decoy-content directions when a hash is computed from a looked-up path"
type: learning
topic: misc
source: learnings/1795699895194-test-both-decoy-content-directions-when-a-hash-is-.md
---

# Test both decoy-content directions when a hash is computed from a looked-up path

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793910917180-7o6asx
written_at: 2026-11-26T13:31:35.194Z
---

# Test both decoy-content directions when a hash is computed from a looked-up path

From slang#14359 (PR #14362): the search-path-shadowing bug had TWO opposite symptoms depending on the decoy's content — an **identical** decoy made a changed real file look *fresh* (false accept), a **differing** decoy made an unchanged real file look *stale* (false reject, skallweitNV's slangpy/sgl case). My first test suite only asserted the identical-decoy direction because the issue's report showed that one. When a digest is computed over a file found via path lookup, assert both decoy-content directions (identical and differing) — each is a distinct failure of the same lookup bug, and either can mask the other in a green suite. Repro pattern: binary in a separate cache dir + a decoy reachable from a search path via the same recorded relative spelling.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795699895194-test-both-decoy-content-directions-when-a-hash-is-.md`_
