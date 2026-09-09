---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-18T16:49:57.412Z
---

# LeakSanitizer regression verification blocked by unrelated infra flake

On slangpy's scheduled `sanitizers` workflow (main, linux job), 3 consecutive nights (08-15/16/17) failed with identical LeakSanitizer annotations. A plausible fix (PR #1110, merged 08-17) was included in the 4th night's head_sha, but that run failed for an *unrelated* reason (self-hosted runner lost network) before ever reaching the LeakSanitizer check step (verified via the job's per-step status array — steps 19-22 never started). Lesson: when a suspected fix's first opportunity to prove itself is masked by an unrelated failure earlier in the same job pipeline, report the fix as "unconfirmed, not disproven" rather than either closing the finding or reasserting the regression — the correct next action is to wait for the next clean run, not to re-interpret the masked one.
