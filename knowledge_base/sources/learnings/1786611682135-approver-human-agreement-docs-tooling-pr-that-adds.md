---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786604794139-irjaw8
written_at: 2026-08-13T09:01:22.135Z
---

# [approver/human-agreement] docs-tooling PR that adds a self-guarding lint gate + ships its own positive control → safe to WOULD_APPROVE when the gate is empirically live

**Outcome (calibration):** slang#12521 — WOULD_APPROVE @577d3aafb618 → PR MERGED unchanged by the author at the identical head (single commit, no interval). AGREEMENT.

**Class of change:** a docs/tooling PR in the *compiler repo* that adds a new lint/gate to a Python driver AND edits content to satisfy that gate, mirroring an already-shipped guard (#12511) into a second tree. This shape recurs (generated-docs regenerate.py guards, CI doc-lints).

**What made WOULD_APPROVE the calibrated call — and the probe that carries forward:**
1. **A new gate demands a positive control, not a green CI.** CI passing over a now-clean tree is consistent with BOTH "gate works" and "gate is dead-by-construction" (a check that never fires also passes). I did NOT accept the green — I checked out the head, injected the exact hazard the gate targets (a raw `{{` Liquid opener) into an *unrelated* front-matter'd file, ran the real CI entry point, and confirmed exit 1; revert → exit 0. That empirical trigger is what distinguishes a live gate from a dead one. This is the general form of the standing gate/flag probe applied to a *lint* gate rather than a compiler pass.
2. **A PR that adds a gate must pass its OWN gate.** Verify self-consistency: (a) the whole tree the gate walks passes locally + on CI; (b) the guard's own selftest has a genuine positive control (hazard → MUST error) plus negatives; (c) files that legitimately contain the hazard as *teaching examples* are excluded by the gate's own keying rule — here `_common.md` documents raw `{{` but has no YAML front-matter, and the gate keys on front-matter (what Jekyll itself keys on), so it's skipped and doesn't self-trip. Confirm that exclusion, don't assume it.
3. **Docs-in-compiler-repo is a MERITS decision, not OUT_OF_SCOPE.** The scope predicate is repo-class; a small docs/tooling diff in slang decides on its merits.
4. **Comment-style nits (change-history narration in docstrings) do not gate a positive decision.** They're advisory; the only lever they could move is BLOCK, whose sole trigger is a verified 🔴 correctness bug. The author shipped the narration unchanged and merged — confirming it was correctly below the bar.

**Transfer:** for "adds-a-guard + fixes-content-to-pass-it" PRs, the decisive evidence is a self-run positive control that the guard fires, plus self-consistency (tree passes, selftest has a real positive control, teaching-example files are correctly excluded). With those, and 0 🔴, WOULD_APPROVE tracks the human merge outcome.
