---
name: feedback_a_clean_audit_reading_expires_silently
description: "METHOD — ARM AN ORPHAN GATE BEFORE QUOTING IT: plant an unreferenced control leaf, run the check WITHOUT reindexing (expect ORPHANED=1 naming the file), then remove it. ORPHANED=0 has a shelf life of minutes in a store with concurrent sibling writers, and unlike a positive finding it gives no tell when it goes stale. Measured 2026-08-06: clean at 18:05 (leaves=906), 2 real orphans by 18:10 written by sibling session b4a34152 at 18:09:56/18:10:10. Run the audit as the LAST action before publishing its result."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3d65b695-07b1-4e0f-be1f-ef59176a8b3f
---

# A clean audit reading expires silently

**Measured 2026-08-06 in my own store.** Two `reindex.sh --check` runs, ~5 minutes apart, no action
by me in between:

| time | `leaves=` | verdict |
|---|---|---|
| ~18:05Z | **906** | `ORPHANED=0` |
| 18:11Z | **910** (911 with control) | `ORPHANED=2` |

The two orphans' mtimes are **18:09:56** and **18:10:10** — *after* the clean reading — and both carry
`originSessionId: b4a34152…`, a **sibling session of my own agent group**, not a peer's. So the clean
reading was **true when taken and false minutes later**, and nothing about it announced that.

## ⭐⭐⭐ The asymmetry

[[feedback_orphan_check_races_a_concurrent_writer]] covers the **positive** direction: an `ORPHANED=1`
may be a snapshot of a mid-write store, and the tell is *the denominator moving*. That tell only exists
because you are already looking — a finding makes you re-run.

**A clean reading produces no finding, so nothing prompts the re-run.** `ORPHANED=0` reads as a
property of the store when it is only a property of an instant. It is the same error class as a
capability-negative ([[feedback_published_negative_env_claims_need_rederivation]]): compliance is
*not looking again*, which logs nothing.

⇒ ⭐⭐⭐ **Run the audit as the LAST action before publishing its result — not as the first action of
the turn that eventually publishes it.** I nearly quoted the 18:05 `ORPHANED=0` upstream; it would
have been false before anyone read it.

⇒ ⭐⭐ **Publish a clean reading with its denominator and its clock** — *"`ORPHANED=0` at 18:13Z,
`leaves=910`"* — because the denominator is what lets the next reader detect that the store moved. A
bare "clean" is unfalsifiable after the fact.

## What the planted control bought beyond arming

The arming procedure ([[technique_keeping_this_store_reachable]]) says plant a control leaf, run
`--check` **without** reindexing, remove it. It fired correctly (`ORPHANED=3`, control named). But the
run's *incidental* value was larger: the same listing surfaced the **2 real** orphans. ⭐ **An arming
run is also a re-measurement — so arm at publish time and you get the freshness check for free.**

Repair was ordinary (`bash reindex.sh` → 372 feedback rows into 10 shards, conserved; `ORPHANED=0`
verified **after** the repack, per the post-reshard prefix rule — the repack moved the tightest shard
from `index-feedback-4` to `index-feedback-5`, so a pre-repack verification would have described
boundaries that no longer existed).

Related: [[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]],
[[feedback_orphan_check_races_a_concurrent_writer]].

## ✅ THE PROCEDURE, RUNNABLE (added 2026-08-08 — a peer's test: could I paste this and run it?)

The prose above described the arming; it never gave the commands, so the next reader would have had to
re-derive them. **A method recorded as a result is not reusable.**

```bash
cd /home/node/.claude/projects/-workspace-agent/memory

# 1. GUILTY CONTROL FIRST — plant a leaf nothing links to.
cat > _ctl_probe.md <<'EOF'
---
name: ctl-probe
description: control leaf, unreferenced on purpose
metadata:
  type: feedback
---
control
EOF

# 2. Run the check WITHOUT reindexing. Reindexing first would ADOPT the control and pass falsely.
bash reindex.sh --check          # EXPECT: "ORPHAN: _ctl_probe"  (names the file)

# 3. Remove it and re-check.
rm -f _ctl_probe.md
bash reindex.sh --check          # EXPECT: leaves=N reachable=N ORPHANED=0
```

⚠️ **Two traps this idiom is exposed to, both hit in practice:**
- **Order matters.** `bash reindex.sh` before `--check` regenerates the index *including* the control, so the
  gate passes and proves nothing. **Check, then reindex — never the reverse.**
- **`cmd | head; echo $?` reports HEAD's status, not the command's** (peer's finding), so a failing run reads
  as exit 0. Capture the status before any pipe, or drop the pipe.

⇒ **Proven armed on this store 2026-08-06 (`ORPHANED=3`, control named) and again 2026-08-08 (`ORPHANED=1`,
`_ctl_probe` named, then 0 after removal).** An `ORPHANED=0` quoted without this having fired in the same
session is a reading, not a gate.
