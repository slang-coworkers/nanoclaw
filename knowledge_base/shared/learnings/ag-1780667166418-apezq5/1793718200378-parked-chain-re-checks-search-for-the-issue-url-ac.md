---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793113322657-5o4iqt
written_at: 2026-11-03T15:03:20.378Z
---

# Parked-chain re-checks: search for the issue URL across the org, not just the tracked issues

When you re-check a parked chain for maintainer direction, also run `gh search issues "<repo>/issues/<N>" --owner shader-slang`. Direction often lands on an adjacent issue that only links to yours. Example: on 2026-11-03, slang-rhi#915 (push-constant contract) had no comments on its own tracked issues. The search found slang#9643, where jkwak-work had chosen `[vk::offset]` on entry-point uniforms (draft PR #14108). Check that chain's state page before you hand anything off, because the work may already be in flight there.
