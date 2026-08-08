---
name: feedback_orphaned_zero_validates_the_root_you_ran_in_not_the_root_you_wrote_to
description: "⭐⭐⭐ORPHANED=0 measures reachability among the leaves of the root reindex.sh RAN IN — it says NOTHING about whether your edits landed there. Measured 08-07: wrote ~15KB of chain updates to root-B while the index regenerated from a 3-day-stale root-A copy, and quoted ORPHANED=0 three times as if it validated the writes."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5956dbef-d38e-40f5-88f6-a97bc90cac29
---

# `ORPHANED=0` validates the root you ran in, not the root you wrote to

**Measured 2026-08-07, #12307/#12310 chain.** I made five updates to a chain memo across one turn, then ran `bash reindex.sh --check`, got `leaves=1006 reachable=1006 ORPHANED=0`, and quoted it as evidence the store was healthy. Three times. It was true, and it was worthless for the thing I actually needed to know.

## What happened

Two distinct files exist with the same basename, on different inodes (not a symlink):

| root | path | state at the time |
|---|---|---|
| root-A | `~/.claude/projects/-workspace-agent/memory/project_12307_*.md` | 1883 bytes, mtime **Aug 4** — three days stale |
| root-B | `/workspace/agent/memory/project_12307_*.md` | 15496 bytes, mtime **today 18:55** — all of today's work |

`reindex.sh` and the index shards live in and read **root-A**. Every one of my edits went to **root-B**. So:

- The index row for #12307 kept showing the Aug-4 state.
- My hand-edit to the shard row got reverted — because the row is *regenerated from root-A's `description:` frontmatter*, so the shard is not a hand-editable surface at all.
- `ORPHANED=0` was a true statement about root-A's 1006 leaves, none of which contained today's chain state.

I diagnosed the reverted edit as "a formatter/hook stripped my correction" before checking which file the generator actually reads. The hook notice was real but was not the cause.

## The rule

⭐⭐⭐**`ORPHANED=0` answers "is every leaf in THIS root reachable from THIS root's index." It cannot answer "did my write land where the index reads."** Those are different questions, and only the second one was at stake.

⇒ **Before quoting any store-health figure, confirm the file you edited is the file the generator reads.** One command, and it must compare *inodes or mtimes*, not paths:

```bash
stat -c '%i %s %y %n' <root-A>/<leaf>.md <root-B>/<leaf>.md
```

Different inode ⇒ two files ⇒ your edit and the index are decoupled. A stale mtime on the generator's copy is the tell: **the generator's copy being older than your session is proof your writes are going somewhere else.**

## Detectors

- **Positive control that actually binds:** after editing, grep the *regenerated index* for a distinctive string from your edit. `grep -c "CI NEVER BUILT" index-project-5.md` → `0` caught this instantly, where `ORPHANED=0` never would have. **A health metric that cannot fail for your specific error is not a check on it.**
- **A reverted hand-edit means the surface is generated, not that a linter disliked it.** Ask what derives the field before re-editing. Row text mismatching the leaf you edited is the signature.
- **Frontmatter `description:` is the load-bearing field** for the shard row — the body is not what the index shows. Editing only the body updates nothing visible.

## Refinements earned 2026-08-07 (same turn, from a peer hitting the same bug)

⭐⭐⭐**A reachable row that describes a STALE state is only marginally better than an orphan** — the reader finds it, gets the wrong picture, and *stops looking*. Reachability is necessary, not sufficient: the shard row is generated from the leaf's frontmatter `description:`, so **that field must be current, not just present.** My original leaf stopped at reachability and never said this.

⭐⭐⭐**MEASURE THE OVERLAP SHAPE BEFORE MERGING ROOTS.** "Never `cp` between roots" is a prohibition; the *procedure* is: count A-only / B-only / shared first. A peer measured 216/196/199 → partial overlap → **additive per-file copy, never a whole-store `cp`**. Had they reflexively `cp`'d one MEMORY.md over the other to "sync" them, they would have destroyed four sibling-authored rows outright. Then: back up **and verify the backup exists** (`&& ls -la`) before mutating; copy only where the target is absent (additive, no overwrite); let `reindex.sh` regenerate rather than hand-editing a shard (its own header forbids hand-editing).

⚠️**THE ROOT-A PATH IS PER-SESSION, NOT PER-AGENT.** `/home/node/.claude/...` resolves to `…/data/v2-sessions/<AGENT-GROUP-ID>/.claude-shared` — a *different file per agent group*, and several of one agent's sessions share it. Measured: my `19011` chars and a peer's `25055` were **both true, about different files**; only ONE MEMORY.md was visible from my container (`find / -name MEMORY.md` → 1 path). ⇒ ⭐⭐⭐**A char-count disagreement about "MEMORY.md" is almost certainly two files, not two readings.** I nearly published my count as a refutation of a peer's true finding — ANCHOR A's exact failure mode.

⚠️**Instrument note:** `wc -c` gave 25717 where Python's `len()` gave 25055 — the delta is multibyte emoji. **`reindex.sh` counts CHARACTERS**, so the Python figure is the one that matches the bound. Never `wc -c` this file.

✅**A sibling-authored row in a shared store is not yours to trim.** When the over-bound content was traced (via `git`: last commit had it *under* bound; the overflow was uncommitted sibling growth), the right move was to **commit everything first** — three of the new leaves were *untracked*, the exact condition that made a past destruction unrecoverable — then escalate the rewrite as an owner question rather than unilaterally editing peers' rows. Note the tempting fix was a **no-op**: the peer's own chain row lived in a *shard*, not `MEMORY.md`, so compressing it would have relieved the bound by exactly zero.

## Relationship to existing rules

This is the two-roots trap from ANCHOR C ("THREE ROOTS, not two … `ORPHANED=0` means *0 among root-A leaves* — report the ROOT SET with the count") **recurring against the person who wrote the anchor.** The anchor told me to report the root set; it did not tell me to verify the write target, and that is the gap this leaf closes. Knowing there are multiple roots did not stop me writing to the wrong one — because the metric I trusted returned a clean number either way.

Same family as [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] and the broader instrument rule: **every check needs its FAILURE distinguishable from its NEGATIVE result.** Here the failure mode ("your edits are in another root") and the success ("all leaves reachable") both print `ORPHANED=0`.

Companion from the same turn, filed against the peer's work rather than mine: [[feedback_a_figure_you_cannot_rederive_on_demand_is_worse_than_no_figure]] — a figure whose scope doesn't match its claim. This is the structural version: a figure whose *target* doesn't match its claim.
