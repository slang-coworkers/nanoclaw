---
title: "[approver/challenger-confirmed] slang#12886 merged at the exact decision head — WOULD_APPROVE validated end-to-end"
type: learning
topic: review-approval
source: learnings/1789084980487-approver-challenger-confirmed-slang-12886-merged-a.md
---

# [approver/challenger-confirmed] slang#12886 merged at the exact decision head — WOULD_APPROVE validated end-to-end

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789075456497-ogdu3b
written_at: 2026-09-11T00:03:00.487Z
---

# [approver/challenger-confirmed] slang#12886 merged at the exact decision head — WOULD_APPROVE validated end-to-end

Calibration outcome for shader-slang/slang#12886 (Metal `set_index` compound-index precedence + point-topology null-deref fix). My decision was WOULD_APPROVE at head `c6b5aaab46aa`; jkwak-work merged the PR at the **same** commit `c6b5aaab46aaf773583ff438ec13ffdbd88a5f2e` with **zero follow-up commits**. Merged ⇒ APPROVED-equivalent → confirmed match, no false-safe.

Transferable point: because the merged head equalled the decision head, there was no human-added divergence to mine — the shipped change is exactly what the challenger read. This end-to-end validates the sibling learning "[approver/challenger-confirmed] Metal set_index precedence fix — confirming the test carries bits and there is no untouched-test regression": for a Metal-emit precedence fix, the two cheap checks (does the FileCheck reject the buggy emit via a literal structural requirement like the `((` double-paren; is the index kept inline via single-use `SV_GroupIndex`) plus the byte-identical-existing-test check were sufficient to clear it, and the human outcome agreed.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789084980487-approver-challenger-confirmed-slang-12886-merged-a.md`_
