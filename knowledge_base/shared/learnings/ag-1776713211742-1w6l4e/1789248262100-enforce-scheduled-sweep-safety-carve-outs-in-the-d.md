---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788539495823-2zlrcg
written_at: 2026-09-12T21:24:22.100Z
---

# Enforce scheduled-sweep safety carve-outs in the deterministic script gate, not in memory/prompt

A long-running **scheduled** agent task (cron sweep) can act on **stale context**, and safety carve-outs placed in memory or the prompt will silently fail to bind.

**Mechanism:** agent memory (`memory/index.md` + linked concept files) reloads at **session start / compaction — NOT every scheduled fire**. A task running with `new_session:false` (one continuous session reused across fires) never re-reads a carve-out written to memory *after* that session's last compaction. And a hardcoded task `prompt` that just applies generic classification buckets won't cross-check memory or open issues unless explicitly (and reliably) told to.

**Concrete case (2026-09-12):** the Slang CI-babysitter's every-2h sweep (session live since 2026-04-20, `new_session:false`, full-scan at UTC 06/18) rerun the tracked **#13024** spvdb regression twice (06:20Z, 18:12Z) — even though the "#13024 = do-not-rerun" memo had been in memory since **02:25Z**, hours earlier. The stale session never saw it. Result: it **masked a tracked real regression** on those runs AND **burned the per-PR daily rerun cap (3/3)**, which then blocked a *legitimate* runner-eviction rerun on the same PR. (Cap enforcement itself worked — it stopped at 3/3, just on the wrong job.)

**Lessons:**
1. **Enforce safety carve-outs (do-not-rerun / do-not-touch signatures) in the DETERMINISTIC pre-processing SCRIPT gate** — a machine-readable exclusion file (job + test-signature + tracked issue#) the script reads *every* fire and filters *before* any LLM classification. This is robust-by-construction: immune to both stale session memory AND the LLM skipping a cross-check. Do NOT rely on the prompt or agent memory for a hard safety rule.
2. **Tie the exclusion to the tracked-regression lifecycle** (add when the issue is filed, remove when it closes) so it doesn't go stale in the *other* direction (excluding a job whose bug was already fixed).
3. **Cron/sweep tasks should default `new_session:true`** (fresh memory each fire) unless they truly need in-conversation state across fires; keep cross-fire state in files (e.g. a rerun-tracker JSON), which survive fresh sessions.
4. **The fix is invariant to the exact stale mechanism** (stale-memory vs LLM-skip) — don't spend a read of a huge multi-run session transcript to distinguish them when a deterministic script guard fixes both.
