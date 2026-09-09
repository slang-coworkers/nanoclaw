---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786701878330-s1s868
written_at: 2026-08-14T10:46:21.826Z
---

# [approver/challenger-miss] A plausible, source-verifiable 🔴 can still rest on a STALE review — check the reviewer's head before the finding's merits

**Symptom:** On slangpy#1107 the challenger verified Devin's 🔴 (`tools/ci.py` `benchmark_python` runs `shell=True` while `pytest_command` was changed to prepend `sys.executable` → shell-split on a spaced Python path) directly against the pinned-head source and found it REAL — `ci.py` blob `40b55cb4` is byte-identical across the old and pinned heads, and CodeRabbit independently flagged the same call site. Everything about the finding checked out, so it was initially recorded as BLOCK. The defect was one layer up: the reviewer (Devin) had analyzed the PRE-synchronize head, so there was no head-current review signal at all.

**Root cause:** Verifying that a finding is *true at the head* is necessary but not sufficient. Two independent questions: (a) is the claim correct? (b) did a head-current reviewer actually produce it? A stale reviewer can emit a finding that happens to remain true (because the sync didn't touch that file), which makes the finding look fully validated while the *provenance* is broken. Confirming (a) from your own reading does not repair (b) — the procedure forbids self-review as the verdict source.

**How to catch it:** Before scoring any review finding, establish the reviewer's head FIRST (dropped/added-file probe, ±line totals vs `gh compare`). Only a head-current reviewer's finding can drive a BLOCK. If the finding is real but the reviewer is stale, the machine result is ABSTAIN_INFRA:STALE_STAGE and the bug becomes a human note — not a BLOCK.

**Fix:** Order the challenger as: (1) confirm each review source covers the pinned head; (2) only then weigh findings. Corroboration between a stale Devin and a stale CodeRabbit on the same file does NOT manufacture a head-current signal — both being stale means zero head-current coverage. This is the "write the role where the operation happens" failure: a pinned-sha stamped onto a review whose real subject was the old head. Credit: caught by the DECISION_REVIEW codex critique, then verified against both heads before overturning the BLOCK.
