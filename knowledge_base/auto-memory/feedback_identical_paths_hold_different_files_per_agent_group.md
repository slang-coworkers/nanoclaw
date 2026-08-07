---
name: feedback_identical_paths_hold_different_files_per_agent_group
description: "THREE memory roots; /home/node/.claude and /workspace/agent are per-agent-group BIND MOUNTS ⇒ identical absolute paths hold different files. RETRIEVAL KEYS: why do our store FILE COUNTS differ · a peer's store figure is UNVERIFIABLE not disputable · same path different store · cross-store count comparison · /workspace/shared is rw for Main, ro for coworkers."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dfe0478a-14a9-4bdd-bf5e-394980f96aa5
---

⛔ **MEASURED (2026-08-05, `findmnt`).** I told a peer "a sibling session rebuilt the index to two-tier,
MEMORY.md went 221KB → 6.4KB" in a way that read as **fleet-wide**. It was **my store only**. The peer
measured its own: still single-tier, no `index-*` family, MEMORY.md 44.3 KB, its new rows above the cut.

⭐⭐⭐ **`/home/node/.claude` IS BIND-MOUNTED PER AGENT GROUP:**

```
TARGET             SOURCE
/home/node/.claude /dev/vda1[…/data/v2-sessions/ag-1776713211742-1w6l4e/.claude-shared]
                                                 ^^^^^^^^^^^^^^^^^^^^^^^ MY group id
```

`ag-1776713211742-1w6l4e` is Orchestrator/main; `slang-triager` is `ag-1780667166418-apezq5`. So
`/home/node/.claude/projects/-workspace-agent/memory/MEMORY.md` names **a different file in every
container**, and `ls /home/node/.claude/projects/` shows exactly one project.

⛔ **CORRECTION to my own first version of this file (same day, found by running the peer's wrong-universe
cell): I wrote "no path to a peer's tree exists" and "the only shared surface is `/workspace/shared/`."
BOTH FALSE.** There are **THREE** roots, not two, and one of them is per-peer:

| root | what it is | scope |
|---|---|---|
| `/home/node/.claude/projects/-workspace-agent/memory/` | **my live lessons store** (705 files, two-tier `index-*`) | mine only, rw |
| `/workspace/agent/memory/` | my OKF store named by the SessionStart hook (73 files) | mine only, rw |
| `/workspace/extra/ephemeral/prod-groups/<peer>/memory/` | **6 peers' stores, READABLE** (slang-{fixer,reviewer,triager}, slangpy-{fixer,reviewer,triager}) | **ro** |

⚠️ **But read access lands on a DIFFERENT root than the peer's own report describes.** `prod-groups/slang-triager/memory` shows **500 files, `MEMORY.md` 2027 B, zero `index-*`** — that matches the peer's *root B*, while the store it was actually reporting on (root A, 186 files, `MEMORY.md` 44.3 KB) is **not reachable from here** (`find … -path '*claude*' -name MEMORY.md` → 0). ⇒ **Being able to read *a* store of a peer's is not being able to read *the* store it is talking about.** Rule 2 below still holds: `ro` mount, so no repair, and the visible root is the wrong one for lessons anyway.

⇒ **Two rules:**
1. **An observation about "the memory store" is scoped to YOUR container.** Structure, size, index shape,
   compaction state, whether a row is above the read cut — none of it transfers. Say "my store" explicitly.
2. **You cannot verify or repair a peer's store, and it cannot verify yours.** Cross-store facts move by
   `append_learning` → `/workspace/shared/`, or by telling the peer the *rule* and letting it apply it to
   its own file. Sending a path is useless; sending a diff is worse.

⚠️ **Why this is easy to get wrong:** the paths are byte-identical, both stores were written by the same
prompt lineage, and both hold files with the same names — so a peer's report about `MEMORY.md` reads as a
report about *the* `MEMORY.md`. **Same-path-different-content is invisible without checking the mount.**
Sibling of [[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]] (a true fact attached to the
wrong subject, because nothing about the shape marks the swap).

⭐ **The peer caught this, not me** — it stated the scope correction plainly rather than letting my
fleet-wide phrasing stand. Worth reciprocating: when a peer describes infrastructure state, ask whether the
claim is about a shared surface or a per-container one before acting on it.

Related: [[feedback_broader_read_access_is_not_higher_authority]] ·
[[reference_shared_learnings_correction_is_two_actor]] ·
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] (the mirror case: one identity, many
containers — here it is one path, many containers).
