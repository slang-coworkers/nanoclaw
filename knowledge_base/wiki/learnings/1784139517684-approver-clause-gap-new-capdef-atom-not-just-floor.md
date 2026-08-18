---
title: "[approver/clause-gap] New capdef ATOM (not just floor edit) trips BOTH check-cmdline-ref AND check-capability-atoms-ref — wait for them green"
type: learning
topic: review-approval
source: learnings/1784139517684-approver-clause-gap-new-capdef-atom-not-just-floor.md
---

# [approver/clause-gap] New capdef ATOM (not just floor edit) trips BOTH check-cmdline-ref AND check-capability-atoms-ref — wait for them green

**Context:** slang#12115 revised 3× via synchronize. R1/R2 edited only capdef floors + dependency (existing atoms) → `check-cmdline-ref` and `check-capability-atoms-ref` were SKIPPED (no new atom in the `-h` output / atom list, path filter didn't fire). R3 **added a NEW capdef atom** `SPV_KHR_physical_storage_buffer` → both ref-check jobs RAN and had to be green.

**Refines the #12089 clause-gap learning with a discriminator:**
- **capdef floor / dependency edit on an EXISTING atom** → `slangc -h` output and the capability-atoms list are unchanged → ref checks typically SKIP. Low doc-gap risk.
- **NEW capdef atom (`def SPV_... : ...`)** → changes `slangc -help-style markdown -h` output (new `-capability` entry) AND the a4-02 atoms reference → BOTH `check-cmdline-ref` (diffs command-line-slangc-reference.md byte-exact) and `check-capability-atoms-ref` WILL run and fail if either doc isn't regenerated. This is the #12089 trap. In #12115 the author regenerated BOTH docs (command-line-slangc-reference.md +1 new entry; a4-02 +new atom markdown) and both checks went green.

**Apply:** when a capdef diff adds/removes/renames an ATOM (grep the diff for `^\+def ` / `^\+alias `), do NOT trust combined-status alone — query the real check-runs for BOTH `check-cmdline-ref` and `check-capability-atoms-ref` at the pinned head and require success. A missing/stale regen of EITHER reference doc = CI red = not approvable (ABSTAIN_POLICY). A pure floor/value edit on an existing atom usually skips them (verify, don't assume).

**Also:** debounce discipline held across a fast maintainer-driven iteration (R1→R2→R3 in ~50 min of review back-and-forth). Each synchronize = fresh full re-run (harvest + Devin + clauses + challenger + CI settle); only the settled head (R3, stable 3.5h) was recorded. One decision row per revision; R1/R2 investigations kept as context, not evidence for R3.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784139517684-approver-clause-gap-new-capdef-atom-not-just-floor.md`_
