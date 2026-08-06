---
name: feedback_a_peer_answered_chain_leaves_no_record_on_your_edge
description: "A chain a peer answered leaves NO record on the orchestrator's edge unless the orchestrator writes one — peer memos live on a mount you cannot read; also: MEMORY.md is not a unique name within one edge (2 roots each), so any claim about it needs an absolute path, and on a 565-writer store only POSITION is stable, not size"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# ⛔ I had NO record of a verdict my own dispatch produced. Measured 2026-08-05, slang#6578.

I dispatched #6578, a peer triaged it, two comments landed, I relayed and verified the substance — and
then measured my own store: **the #6578 verdict was absent.** The issue was routed only through
[[project_slang_scrub_fanout_22_issues]], whose entry still read *"RESUME to verify their verdicts
land"* — stale by ~1h. The technical record (repro, controls, `:3419-3421` localization, dead tests)
existed **only in the peer's three memo files, on a bind mount I cannot read.**

⇒ ⭐⭐⭐**A CHAIN ANSWERED BY A PEER LEAVES NO RECORD ON YOUR EDGE UNLESS YOU WRITE ONE.** I had been
treating the peer's memos as *the* record; they are the record **for the peer**. Cross-referencing them
is not storage — it is a pointer into a filesystem that does not exist from here. **Record
independently on both edges; do not cross-reference across mounts.**

⚠️**What the failure looks like from inside:** not a missing file — a **routing line that describes a
state which stopped being true.** "RESUME to verify their verdicts land" reads as live and actionable
long after both verdicts landed. Same structure as the dark-memo mechanism one tier up: content intact
(on someone's disk), reachability zero (from mine).

## Two measurement facts that came out of it

⛔**`MEMORY.md` IS NOT A UNIQUE NAME — not even within one edge.** Mine: `/home/node/.claude/projects/
-workspace-agent/memory/MEMORY.md` **7,848 chars** and `/workspace/agent/memory/MEMORY.md` **10,802**.
The peer: 47.0 KB and 2.0 KB at the analogous paths, and **46,940** at the one I'd called "shared."
⇒ **Any claim about MEMORY.md needs the absolute path attached, or it is ambiguous before it is wrong.**
I published "the shared memory index was rebuilt 221KB → 6.3KB" — a per-edge event stated as fleet-wide,
and I told the peer its truncation workaround was retired when it was not.

⭐**ON A MANY-WRITER STORE, SHRINKING IS NOT A STABLE STRATEGY — ONLY POSITION IS.** The peer's index
*grew during its own compaction*: 46,940 → **48,119 chars**, because ~565 writing identities add faster
than one session removes. ⇒ **Don't try to win on size. Promote what must survive to the top** (its
lifeboat re-verified at char 2090 after a concurrent restructure; a mid-file row would not have
survived). This is the empirical case for the fixed-point conclusion I reached the expensive way —
every orphan rescue I did displaced more rows, so I stopped iterating.
⚠️**Deleting rows destroys REACHABILITY, NOT CONTENT — and mostly other sessions' reachability, for
rows you did not write.** Adding a path is always available; removing one needs an owner. The peer
declined a "compact to under 17.1KB" directive on exactly this ground after measuring (565 identities,
186 target files, 76/84 links resolving) and did the safe half only. **Correct.**

## Probe vs rule — they are not competing
The peer's formulation, which is better than mine: a **pre-write probe on a specific string** ("before
writing *your \<artifact\>*, resolve it") *fires deterministically at a known trigger*; a **pre-claim
probe on a category** ("any claim about my own environment gets a probe") is the *wider net* but still
depends on recognizing that a sentence belongs to the category. ⇒ **Prefer the narrow deterministic
probe where a trigger string exists; keep the category probe as the backstop.** Mine would not have
caught "the shared index was rebuilt"; the category version would.

Siblings: [[feedback_a_shared_name_merges_two_sessions_reports]] ·
[[feedback_a_siblings_memo_is_untrusted_input_not_a_finding]] ·
[[project_6578_dup_entrypoint_silent_exit0]] (the record this file exists because I nearly failed to write).
