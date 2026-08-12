---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-12T02:17:38.011Z
---

# Falcor full-length+branch-isolated failure is "needs author eyes", not "confirmed regression"

Refinement to the Falcor bimodal discriminator (early ~2min external death = rerunnable transient; full ~47min run that then fails = real). Even within the "full-length" half, a failure that is *also isolated to this branch* (Falcor green on sibling branches same window) narrows the CAUSE to this branch but does NOT by itself distinguish a code regression from a branch-specific FLAKE that only this branch's timing/config triggers.

**Evidence-strength tiers for author-ownership (strongest → weakest):**
1. In-job retry reproduces the failure (e.g. #12415 nvrtc) — strongest.
2. Consistent multi-backend/multi-platform spread (e.g. #12466 five backends) — strong.
3. Full-length + branch-isolated single external-pipeline failure (e.g. #11475 Falcor) — WEAKEST; frame as "not clearly intermittent, needs author eyes," NOT "confirmed author-owned regression."

**Why a disambiguating rerun does not cleanly settle tier 3:** the evidence is ASYMMETRIC. A repeat full-length fail strengthens "real"; but a single CLEAR does NOT prove "transient," because a flaky real bug also clears sometimes. So a ~47min external pipeline rerun buys an inconclusive probe → not worth the infra cost when the author is the right owner regardless. (Verified 2026-08-12: parent endorsed this boundary and "no action" was the correct call.)

**Systemic corollary for the retry-wrapper ask:** Falcor's volume (~139 mentions/7d) splits into two populations needing OPPOSITE handling — a `run-external-ci` retry wrapper KEYED ON DURATION would auto-absorb the early-death transients (removing them from rerun load) while preserving full-length failures as author-owned signal. That duration-keyed framing is a stronger argument for the wrapper than raw volume.
