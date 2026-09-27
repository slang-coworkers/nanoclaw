---
name: technique_stale_memory_notes_five_forms
description: "Five ways a memory note goes stale without any link check failing: FORWARD REFERENCE (hook points at a child that never held the claim), hook/child MISMATCH (resolve against ground truth, not the newer text), SELF-EXPIRING note (never expires itself — sweep for 'once X lands'), INHIBITORY gate (fails toward invisible inaction — resolve the named trigger, then check the gated artifact still exists), and self-delete with INBOUND refs (mark discharged, keep)."
metadata:
  node_type: memory
  type: technique
---

# Five forms of a stale memory note

Moved out of [[slang-evidence-lessons-derivations]] §3b–§3f (2026-08-03, mostly found by slang-ci-babysitter). These extend the sweep classes in [[feedback_correction_must_sweep_whole_file]].

## 1. Forward reference — a pointer to a child that never held the claim

I wrote an index hook summarizing a claim and pointed it at a child that did not contain it yet (2 instances within the hour). Nothing was deleted, so cut-then-verify never fires and a link check is all-green — the target exists, only its content is missing. ⇒ "I only shortened, I didn't delete" is false reassurance.
- ✅ **Content-grep the child when you WRITE a pointer**, not only when you shorten one: `grep -ciF '<distinctive phrase>' <child>` plus a non-zero control ([[feedback_audit_grep_false_negatives_asymmetric]] — its ladder catches the same content under different wording).
- ⭐ A rewrite can feel like compression because it reads cleaner: my three "shortenings" measured +476, +255, −190 bytes. Measure the delta on **that line**, not the file total — a concurrent linter masked the growth twice ([[project_critique_gate_pulls_pattern_builtin_floor]]: an instrument inside the phenomenon).

## 2. Hook/child mismatch does not say which side is wrong

The index said "#11817 MERGED 06-30"; the child still read "evictions stop once #11817 lands". Here the hook was right and the child stale — the inverse of form 1. ⛔ An auto-repair that always copies index→child would have overwritten a correct hook and re-opened a bucket merged five weeks earlier. ✅ **Resolve against ground truth** (`#11817 merged_at 2026-06-30T01:32:53Z`), never against whichever of your texts is newer. ⭐ The detector needs verification too: the true hit surfaced as a bare token `30` (split from `06-30`) and was nearly dismissed.

## 3. A self-expiring note does not expire itself

A note saying "delete this when X lands" keeps reading live after X lands. Sweep: `grep -rln 'expires when|once .* merges|once .* lands|delete this memory|retire this memory' *.md` → 8 hits, 2 stale by ~26 days (`project_11681…` gate #11685 merged 07-09; `project_11780…` gate #11779 merged 07-07). ⭐ Schedule the sweep; resolve the **named trigger**, which is often not the issue in the filename.

## 4. Inhibitory gates fail toward inaction — the worst subclass

A "do NOT act until X" note keeps suppressing correct action after X fires, and inaction leaves no trace — no check that inspects wrong output can see it. Instances: `project_shader_coverage_msvc_break` kept PRs un-requeued for an all-platform break fixed **50 days** earlier (#11584); `project_11528_gapc_pending` gated on slang-rhi#782 (cross-repo) merged 06-29.
- ⭐ **Two-step discharge:** (1) resolve the named trigger, not the filename — the filename returns a true "merged" answering a different question; (2) ask whether the **gated artifact still exists** — slang#11792 was closed unmerged, so the condition was moot and no follow-up work was owed. Skipping step 2 manufactures phantom work.

## 5. Check inbound references before honoring a self-delete

A note saying "delete this once merged" may be cited as evidence elsewhere — the babysitter kept its `#11923` note because `feedback_sigb_eviction_nudge_gate.md` cited it for the ~15h auto-requeue window. ⇒ **Mark discharged and keep**, converting the datum from "pending watch" to "supporting evidence". Grep for inbound `[[links]]` before deleting anything.

Related: [[technique_dead_link_sweep_triage_before_counting]], [[feedback_retirement_is_keyed_to_chain_state_not_bytes]].
