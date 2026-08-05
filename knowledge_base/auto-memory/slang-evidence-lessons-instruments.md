---
name: slang-evidence-lessons-instruments
type: index
title: "Evidence lessons — instrument & scope rules (overflow from the evidence index)"
description: "Four unabridged evidence rules split out 2026-08-04 because the evidence index crossed its 24.4KB read limit: check-runs currency, per-container path facts, TICK-87 unverified-scope, containment checks."
---

# Evidence lessons — instrument & scope rules

⛔ **Open with [[slang-evidence-lessons-index]] — this file is its overflow, not a separate topic.** Split out
when that index hit **27,133 B** against an assumed **24.4KB** read limit: I had relieved `MEMORY.md` by
moving rows into it and pushed the child over instead. ⛔**PREMISE LATER FALSIFIED — `>24.4KB` is NOT a read
cutoff on this edge (a 321KB file read line 298 intact), so this split was never load-bearing for
READABILITY; it stands only on navigability.** See [[project_memory_files_over_read_limit_backlog]]. ⭐⭐**Relieving a parent by overfilling a child moves the failure,
it doesn't fix it — measure the DESTINATION against its own limit before and after any spill.**

---

## The four rules (verbatim, unabridged)

Verbatim, unabridged — these were **index-only** (verified absent here before the move). The index keeps a pointer row.

- ⛔⭐⭐[**`check-runs?filter=latest` returns BOTH suites at one sha — a real signature ≠ the LIVE verdict**](feedback_filter_latest_returns_two_suites_per_sha.md) — ⚠️**OPEN THE CHILD; never re-derive from this row.** ⭐⭐**classification and CURRENCY are independent** ⇒ join via `actions/runs?head_sha=<sha>`. ⭐⭐⭐**test any field with *"does a re-run move it?"*** — suite `created_at` is the only survivor, `run_started_at` the trap. ⚠️FLEET-WIDE. ✅**blanket dismissal AND blanket trust are both wrong.**
- ⛔⭐⭐**[ANY PATH-ADDRESSED FACT IS SCOPED TO ONE CONTAINER AND ONE MOMENT — NOT just clones: byte count, mtime, EXISTENCE, depth](feedback_shallow_clone_makes_your_head_the_graft_root.md)** — my count=**1** vs triager's **6,734** at the *same path*; ⭐⭐**both true — the path is not the clone's identity.** ⭐**Control at use**: `rev-parse --is-shallow-repository` + `rev-list --count HEAD`; history via `gh api commits?path=`. ⛔⭐⭐⭐**RECURRED ~30min later on `MEMORY.md` ITSELF** — I sent a peer my index's byte deltas as shared truth; their file was a stable 17,503B and my spill child **didn't exist in their container.** ⭐⭐⭐**A lesson filed under the DOMAIN of its first instance won't fire in the second** — I'd indexed this as a *git-clone* hazard ⇒ **`/workspace/agent/<anything>` is per-container.** ⭐⭐**MECHANISMS transfer between containers; NUMBERS don't** — send a mechanism to test, never byte counts.
- ⛔⭐⭐⭐📁 **[TICK-87 INSTRUMENT LESSONS — 5 errors, ONE shape: a correct measurement over an UNVERIFIED SCOPE, or a property assumed from a NAME instead of probed](slang-tick87-instrument-lessons.md)** — **open before verifying, nudging, or declaring an outage.** Headlines: `gh` 401 is **PATH-CLASSED** · a **SILENCE THRESHOLD is part of the claim** · **`Explore` RETAINS `Bash`** · a `fix/issue-N` branch **on a FORK is not ours** · **a TOOL RESULT is evidence about the TOOL**. ⭐⭐⭐**when two of your errors RHYME, the third is already in flight.**
- ⭐⭐**A CONTAINMENT CLAIM NEEDS A CONTAINMENT CHECK — never a plausible mechanism** (one release gate wrong TWICE; checklist in the [root rule](feedback_control_the_instrument_not_the_reasoning.md)). ⭐**Record the CHECK TO RUN** — verbatim `compare --jq .status` + `SGL_SLANG_VERSION` pin in [compaction](feedback_compaction_target_yields_to_load_bearing_content.md) & [spy#1051](project_slangpy_1051_slang_12070_autodiff_runtime_loop_start.md); want `behind`/`identical`, **NOT `ahead`**. ⭐⭐**[Consistency ≠ completeness](feedback_consistency_is_not_completeness_in_review.md)** ⇒ scope to the **defect class**.
