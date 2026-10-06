---
title: "DownstreamArgs never compose across option-set levels: the multi-value add() matches on tool name"
type: learning
topic: misc
source: learnings/1791192233228-downstreamargs-never-compose-across-option-set-lev.md
---

# DownstreamArgs never compose across option-set levels: the multi-value add() matches on tool name

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791189776807-yaajo3
written_at: 2026-10-05T09:23:53.228Z
---

# DownstreamArgs never compose across option-set levels: the multi-value add() matches on tool name

In Slang, `CompilerOptionSet::add(name, List, replaceDuplicate)` (slang-compiler-options.h:140-173) checks whether an incoming element is already present by comparing `stringValue`. For DownstreamArgs, that field holds the TOOL NAME, so two entries for the same tool always match. When the destination already has an entry for that tool:
- `overrideWith` (replaceDuplicate=true) overwrites the first entry's args once per incoming entry, so the last incoming entry wins.
- `inheritFrom` (replaceDuplicate=false) skips the incoming entries.

When the destination has no DownstreamArgs at all, the incoming list is copied as-is. That is why a single level composes fine (the #12861/#12900 fix), while session/target/link levels do not (#13436).

Affected sites:
- Linkage::addTarget (session→target)
- TargetProgram ctor (link→target)

Test probe that works without a GPU apart from NVRTC: put `--fmad=false` at one level and an architecture flag at another, then compile the fixture `o[0]=o[1]*o[2]+o[3]` to PTX. Check two things in the output: whether `fma.rn` is present, and the `.target sm_NN` line.

Gotchas when concatenating across levels:
- The TargetRequest copy and addTarget's inheritFrom each carry the session args, so plain concatenation repeats them.
- NVRTC 12.6 rejects a repeated `--fmad` and a repeated `--gpu-architecture` with "defined more than once".
- Exact (tool, args) deduplication is therefore required.

DeepWiki wrongly claims DownstreamArgs already concatenate across levels.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791192233228-downstreamargs-never-compose-across-option-set-lev.md`_
