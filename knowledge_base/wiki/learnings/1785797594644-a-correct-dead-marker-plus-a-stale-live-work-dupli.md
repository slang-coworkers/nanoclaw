---
title: "A correct DEAD marker plus a stale live-work duplicate is worse than no entry — dedupe by issue number, not just by staleness"
type: learning
topic: misc
source: learnings/1785797594644-a-correct-dead-marker-plus-a-stale-live-work-dupli.md
---

# A correct DEAD marker plus a stale live-work duplicate is worse than no entry — dedupe by issue number, not just by staleness

## The failure mode

When the same issue/PR appears **twice** in a memory index — once correctly marked dead/closed/superseded, and once as a surviving older line still describing it as live work with a proposed approach — the **stale copy silently defeats the correct one**. A fresh context that reads the live-work line has no reason to keep scanning for a contradicting entry, and goes off implementing a design that is already dead.

This is strictly worse than having no entry at all: with no entry you investigate; with a plausible stale entry you execute.

## Concrete (slang fleet index, 2026-08-03)

`#11682` appeared on two lines:
- line 38 — correctly marked **DEAD** (the issue had been closed by someone else's PR **#12201**),
- and a leftover fix-log line still describing it as **live work with a proposed approach**.

The DEAD marker was present, accurate, and **ineffective**, because the duplicate was equally readable and more actionable-sounding. Found only while compacting the index for size — i.e. discovered by accident, not by any check that was looking for it.

## How to apply

- **Dedupe by identifier, not by vibe.** Before trusting or writing an index entry, grep the *number* (`#11682`, `PR 12201`) across the whole index — not just the section you're editing. Two hits on one identifier is a defect until proven otherwise (one may be a legitimate cross-reference; a second *status* line never is).
- **When you mark something dead, delete or fold the old live-work line in the same edit.** Adding a DEAD marker beside a surviving stale entry is a half-fix that reads as a full one.
- **Status is single-valued.** An identifier may appear in several places as context/cross-reference, but exactly one line may assert its *state*. If two lines assert state, they will eventually disagree, and the reader has no way to know which is newer.
- **Compaction is a detection opportunity, not just a size exercise.** Both this duplicate and a previous dead-link sweep surfaced real content defects while shrinking a file. Budget for "what did shrinking this reveal?" rather than treating it as janitorial.
- Note the pairing with the *other* index hazard already recorded: a rule stored **without its precondition** (e.g. "green run is weak evidence" filed without the refactor boundary condition) can license the exact wrong inference. Same family — **a partially-correct memory entry can be net negative**, and only reading it adversarially reveals that.

## The general form

Memory defects are not only *absence* and *staleness*. The dangerous third mode is **coexistence**: correct and stale side by side, where the stale copy is the one that reads as an instruction. Ask of any index: *if two lines about this disagreed, which would a fresh context act on?*

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785797594644-a-correct-dead-marker-plus-a-stale-live-work-dupli.md`_
