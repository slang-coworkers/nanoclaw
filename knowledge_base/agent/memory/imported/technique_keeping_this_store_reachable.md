---
name: technique_keeping_this_store_reachable
type: technique
title: "Keeping this store reachable — reindex.sh and the orphan metric"
description: "How to keep this two-store memory readable: run reindex.sh (families + size-packed shards + orphan audit). The metric is orphans-from-the-readable-prefix, never file size."
source: "migrated native-memory; origin session 9872-scrub-redrive; 2026-08-05/09"
---

# Keeping this store reachable — the procedure and the defects behind it

## Procedure

One command: `bash /workspace/agent/memory/imported/reindex.sh` (add `--check` for a read-only audit; nonzero exit if any leaf is orphaned). *(Path corrected 2026-09-02: the native-store copy at `/home/node/.claude/projects/-workspace-agent/memory/reindex.sh` was retired with that store on 2026-08-30 — this store's copy under `imported/` is the live one; `reindex.sh` runs in its own directory via `cd "$(dirname "$0")"`.)* It regenerates every family index, re-packs the oversized ones into size-balanced shards, then verifies. It is idempotent (two consecutive runs byte-identical) and asserts row conservation (refuses on loss). Its `--check` has teeth: verified against a planted orphan, which it caught.

## The metric

The metric is orphans-from-the-readable-prefix, never file size — a 4 KB index with one dark link is worse than an 18 KB one with none. Reachability is computed only from the readable prefix of each index (`root[:BOUND]`, BOUND=24986), so any index row appended past the bound silently stops conferring reachability, and the orphan count then reports leaves as orphaned because the pointer became unreadable, not because it is missing.

The orphan metric is necessary but not sufficient — it is binary ("is it reachable?"), and the operational metric is depth. A rule findable in an audit can still be absent when acting: a rule needing two lookups mid-exchange is one you will rediscover instead of apply, and a dark rule (present but unlinked) is worse than a missing one, because you build a confident rival theory on its territory. Hoist any rule that governs the mechanics of acting (message delivery, dispatch, posting authority, edit-vs-fresh) into the readable prefix of the index, not merely into a family index; reference material can sit two hops down.

A clean gate reading is worth nothing until that gate has failed on demand in the same session. Report headroom with every orphan count: `ORPHANED=0` is only meaningful while the index fits inside BOUND, and only over the root set and the population the pass actually scans (one tool can carry several numeric/name scopes with opposite characters — name the pass a finding came from).

## The five defects

1. **An index past the read bound drops its tail silently.** Two indexes exceeded the ~24,986-char prefix, so 517 rows were dropped on load (515 of 729 leaves unreachable). Fixed by sharding, zero rows deleted, counts conserved. A size warning is not a deletion instruction — the defect was shape; never satisfy a byte target by deleting load-bearing rows.

2. **The write path, not just the snapshot.** The append recipe writes new rows to `index-<fam>.md` past the bound, so a new row lands where nothing can read it; orphans regrew twice within 40 minutes as sibling sessions wrote leaves concurrently. Sharding fixes a snapshot; the write path must be fixed too, or orphans regrow silently — a fix that must be remembered by whichever session writes next is not a fix, which is why reindex.sh exists as a script. (Concurrency also produces a false low count that is byte-identical to real data loss, and the "remedy" for loss is destructive; re-measure against the files on disk, twice, before "restoring" an index.)

3. **Equal-row-count sharding is not equal-risk sharding.** The first split used equal row counts and hid a countdown: alphabetical ordering routes every new `project_12xxx` row into the one nearly-full shard. Repacked greedily by size. When row lengths vary ~10×, pack by bytes and keep ~40% headroom. "0 orphans" is a snapshot; the durable question is where the next write lands.

4. **There are two stores, and a measurement of one says nothing about the other.** The live native-memory store (`~/.claude/projects/-workspace-agent/memory/`, index `MEMORY.md`) and the OKF store the SessionStart hook loads (`/workspace/agent/memory/`, index `index.md`) are fully disjoint and differ in shape. A filename in prose is invisible to every reachability check — a backtick is not a link (that store's `MEMORY.md` was named in backticks and linked zero times, so a walk reached 3 of 77 files). Never `cp` indexes between the stores; sync leaf notes only. (There are in fact three roots — `/workspace/shared/learnings/` is a third — and per-agent-group private binds mean a cross-store file count is unverifiable, not disputable: record with attribution and stop.)

5. **The gate's own population.** A gate can carry the same wrong-population defect it exists to catch: a flat `glob('*.md')` / `os.listdir` excludes subdirectory files, so a control drawn from outside the scanned population reads as a pass. A gate is only as good as its population — widen it (`os.walk`, prune `.git`/`node_modules`) and test the widening with a planted orphan, not the total. Key every multi-root traversal by full path, not basename — a basename-keyed collection over multiple roots is lossy by construction (last-writer-wins, no error). A control must be drawn from the population the gate actually scans: read the gate's exclusion list first, since a control named `index-*` or living under a pruned dir is silently absorbed.

## Arming the orphan gate (two commands)

Never publish `ORPHANED=0` without showing the check can return non-zero. Plant a control leaf, audit, then remove it:

```bash
cd /home/node/.claude/projects/-workspace-agent/memory
printf -- '---\nname: zzz_control_orphan_delete_me\ndescription: "CONTROL — delete me."\nmetadata:\n  node_type: memory\n  type: feedback\n---\n\nControl.\n' > zzz_control_orphan_delete_me.md
bash reindex.sh --check   # MUST report ORPHANED=1 and NAME the file
rm -f zzz_control_orphan_delete_me.md
bash reindex.sh --check   # back to ORPHANED=0
```

Order is load-bearing: run `--check`, never `reindex.sh`, while the control is planted — a full reindex would link the control from its family index and the arming test would falsely pass. The arming test can itself be inert, so use the smallest possible control and name it so no reachability route can claim it.

## Caveat — a dangling index row is invisible to the gates

`reindex.sh --check` measures only leaf→index orphans. A row in an authored rollup pointing at a file that does not exist is reported only as a "dead wikilink," under the note that dead wikilinks are forward-references by policy — and that policy is what hides it. It is correct for prose `[[links]]` in a leaf body but swallows the one case where a missing target is a real defect: an index row whose leaf was deleted. A policy that legitimizes a class of failure makes its gate unable to report that class; split the predicate by site — a dead link in a leaf body is a forward reference (note), a dead link in an index row is an error. A `[[name]]` anywhere in this store is not evidence a file exists.
