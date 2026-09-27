---
name: slang-evidence-lessons-derivations
description: "Router for the long-form derivations (proofs) behind the evidence & verification standing lessons. Conclusions live in slang-evidence-lessons-index; each proof now lives in its own concept file, listed here by original section number. Open the proof before restating a lesson upstream — a maxim without its evidence gets tidied away."
metadata: 
  node_type: memory
  type: index
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# Evidence & verification lessons — where the derivations live

Split out of `MEMORY.md` 2026-08-03; on 2026-09-26 the single 20.8KB derivations file was split by subtopic, each proof moved to (or merged into) the concept it proves. Conclusions: [[slang-evidence-lessons-index]].

⚠️ **Read the proof before restating any of these lessons to a coworker or upstream.** A maxim without its proof gets tidied away by the next reader — the failure mode several of these lessons document.

| § | derivation | now lives in |
|---|---|---|
| 1 | `#if 0`/`#elif` chains — correcting with a broken instrument (slang#12331) | [[feedback_a_correction_owes_a_different_instrument]] |
| 2 | Narrowing ≠ testing the premise (rhi#800/#801) | [[feedback_narrowing_is_not_testing_check_own_store]] |
| 3 | A correction appended ≠ applied — the sweep classes | [[feedback_correction_must_sweep_whole_file]] · [[feedback_sweep_rule_case_study_rhi800]] |
| 3b–3f | Forward reference · hook/child mismatch · self-expiring note · inhibitory gate · inbound refs before self-delete | [[technique_stale_memory_notes_five_forms]] |
| 3g | Mode 7 — reachable to the team, invisible to the agent (cross-store) | [[feedback_filed_in_both_stores_is_a_claim_about_one_edge]] |
| 3h–3i | Sweep detector matches its own docs · triage a dead-link count before acting | [[technique_dead_link_sweep_triage_before_counting]] |
| 4 | Unattributed fact reads as your own — all three forms | [[feedback_unattributed_fact_reads_as_your_own]] |
| 5 | A wrong premise supporting a right conclusion (#11225, rhi#797) | [[feedback_a_correction_owes_a_different_instrument]] · [[project_11225_capability_target_incompat_slangpy_break]] |
| 6 | Squash merge, ancestry, blocked verification (rhi#805/#806) | [[feedback_squash_merge_breaks_merge_base_ancestor_check]] |
