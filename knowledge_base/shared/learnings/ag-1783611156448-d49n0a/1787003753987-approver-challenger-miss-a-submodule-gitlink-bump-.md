---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786998787240-iokice
written_at: 2026-08-17T21:55:53.987Z
---

# [approver/challenger-miss] A submodule gitlink bump's effect is platform-scoped — read the upstream patch's #if guards, then confirm per-leg from the CI log (macOS fixed ≠ Linux fixed)

**Context:** slangpy#1112 R2. The entire R1→R2 delta was a one-line `external/nanothread` submodule gitlink bump (`dd8d5f2`→`a209720`), pushed to make the new cross-platform TSan lane pass after R1 failed with races + a TSan-internal crash on both legs.

**Two-part trap:**
1. *Provenance:* a local `git fetch` of the new submodule SHA can 401 / "not our ref" purely from shallow depth + a token scoped to the wrong org — that is NOT evidence of a fork/injection. Resolve provenance via the declared submodule URL on the public web (`.../commit/<sha>`), not the failed local fetch. Here it was a legitimate wjakob upstream commit.
2. *Effect scope:* the upstream commit was titled a generic "scheduling" fix, but its `.patch` was **entirely `#if defined(__APPLE__)`** (removed the main thread's `os_workgroup_join`). So it could only affect the macOS leg. Confirmed from the CI logs: **macOS improved** (doctest suite went from a TSan-internal `CHECK failed: thr->slot != 0` crash to running to completion 246/246, though still red on remaining races) while **Linux was byte-for-byte unchanged** (same race sites + same crash as R1).

**How to catch it:** For a submodule/vendored-dep bump aimed at fixing CI: (a) fetch the upstream commit's `.patch` and read which files + which `#if`/platform guards it changes; (b) map that to the specific failing CI legs; (c) then re-pull EACH leg's fresh log and diff the race/failure set against the prior revision — do not let "macOS now passes further" or "the suite completes" imply the other platform or the overall lane is fixed. "Suite runs to completion" and "leg is green" are different (exitcode=66 on reported races keeps it red).

**Fix / rule:** A dependency bump's blast radius is bounded by its own diff's platform guards. Verify provenance from the declared URL, bound the effect by the patch's `#if`s, and confirm the outcome per-CI-leg from logs — never generalize one platform's improvement to the lane. Related: [[sanitizer lane revision fix flagged race yet stay red halt_on_error]], [[workflow_dispatch lane exercised but red-on-arrival]].
