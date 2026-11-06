---
title: "CUDA cross-site __ballot_sync (per-arm exit ballots) returns the union on L40S — ptxas shares one WARPSYNC+VOTE routine"
type: learning
topic: agent-ops
source: learnings/1793941429083-cuda-cross-site-ballot-sync-per-arm-exit-ballots-r.md
---

# CUDA cross-site __ballot_sync (per-arm exit ballots) returns the union on L40S — ptxas shares one WARPSYNC+VOTE routine

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793940183330-hnb4gx
written_at: 2026-11-06T05:03:49.083Z
---

# CUDA cross-site __ballot_sync (per-arm exit ballots) returns the union on L40S — ptxas shares one WARPSYNC+VOTE routine

Found on shader-slang/slang#14377 (2026-11-06, L40S sm_89, driver 595.91.07, nvcc 12.6 / NVRTC via slang-test).

- Slang's CUDA `synthesizeActiveMask` computes the post-merge mask with `__ballot_sync(entryMask, true)` in EACH arm (different program points). On the L40S this returns the full union (e.g. 0xFFFFFFFF) for both arms — reporter's "lanes 0-19 get a 20-lane mask" did NOT reproduce, even under 4M-lane x 20 random stress (segmented sum, early-return mask probe).
- Why (SASS): each diverged `__ballot_sync` is `BRA.DIV` → `CALL.REL.NOINC` into ONE shared `WARPSYNC R; VOTE.ANY` subroutine, so all sites vote at the same PC. Converged case is inline `VOTEU.ANY`. `-G` calls one `CALL.ABS` routine. Same at -O3, -Xptxas -O0/-O1.
- Docs disagree in level: PTX vote.sync (sm_70+) needs same qualifiers+membermask (any instruction); the CUDA C++ Programming Guide §5.4.6.6 (2026-10) says undefined unless threads "call the intrinsic at the same program point with the same mask value". So the pattern works by ptxas implementation, not by C++ contract — a runtime test on one GPU does not prove it; use FileCheck on the generated CUDA as the regression guard.
- Draft PR #14050 (`reuseEntryMaskForRegionsWithOnlyNormalExits`) removes the cross-site ballots for regions with no abnormal exit; regions with break/continue/return still use them.
- Quick variant builds: when a PR changes one .cpp, compile it with the Release line from `ninja -f build-Release.ninja -t commands <lib>` into /tmp and relink libslang-compiler.so into a copied bin/lib dir (fix the libslang.so / libslang-compiler.so symlinks to point at the new lib!) — ~2 min instead of a worktree build. Artifacts: /workspace/agent/scratch-14377/ in slang-triager.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793941429083-cuda-cross-site-ballot-sync-per-arm-exit-ballots-r.md`_
