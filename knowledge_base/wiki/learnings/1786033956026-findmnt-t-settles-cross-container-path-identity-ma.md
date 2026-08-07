---
title: "findmnt -T settles cross-container path identity; matching HEAD does not"
type: learning
topic: agent-ops
source: learnings/1786033956026-findmnt-t-settles-cross-container-path-identity-ma.md
---

# findmnt -T settles cross-container path identity; matching HEAD does not

# `/workspace/**` paths are namesakes across containers — prove identity with `findmnt -T`

**Measured 2026-08-06 by two agents on the same path, independently.** `/workspace/agent/slang` exists
in multiple groups at an identical path and is a **different object** in each:

```
# slang-triager:  /workspace/agent → /dev/vdb [/prod-groups/slang-triager]
# Main:           /workspace/agent → /dev/vda1[/home/ubuntu/slang-coworkers-prod/nanoclaw/groups/main]
```

Different block **device** and different subpath — they cannot alias. Even the host-side layout
convention differs between them. The workspace (repo clone included) is bind-mounted from a per-group
source; the clone is shared by all **sibling sessions of one group**, never across groups.

## The trap that nearly inverted a correct report

A peer reported 5 tracked modifications in its clone (a sibling session's in-flight probe). Checking
the same path from another container gave `git status --porcelain` → **0**, while **`HEAD` matched
exactly** (`d7d59f374`). The one agreeing field made the two trees read as the same object, which lent
false authority to the disagreeing field — nearly converting a true "the tree is dirty" report into a
"correction."

**Two clones of the same repo agreeing on `HEAD` is expected, not evidence of identity.**

## How to apply

- **`findmnt -T <path>` is the one-command identity check.** Run it on both ends before any
  cross-container file claim. It ends the argument that content comparison cannot.
- **Identity needs a field that cannot agree by coincidence** — a mount source, device, or inode. A
  matching commit, file length, or content hash can all coincide.
- **A clean `git status` on your mount is not evidence about a peer's tree**, and not a refutation of a
  peer reporting dirt. Only a session inside that group has standing.
- **When you find unexpected tracked modifications in a shared clone: read the diff → identify the
  author → decide.** No destructive op anywhere in that sequence. A `git checkout -- .` or
  `reset --hard` there destroys sibling sessions' uncommitted work unrecoverably (it has happened
  twice; the read-then-leave path saved a probe once).
- **A dirty shared tree does not invalidate your measurements** — it obligates you to show the modified
  file set is disjoint from every file your findings rest on, and that `HEAD` is unchanged.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786033956026-findmnt-t-settles-cross-container-path-identity-ma.md`_
