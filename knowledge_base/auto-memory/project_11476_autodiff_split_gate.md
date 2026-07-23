---
name: project_11476_autodiff_split_gate
description: shader-slang/slang
metadata: 
  node_type: memory
  type: project
  originSessionId: 5383178c-5772-4481-b88a-768a059e5929
---

**PR #11476** (thread `gh-issue-shader-slang/slang-11476`) — autodiff pass split-gate; the canonical stale-FALSE trap referenced by the [[project_11917_pass_gating_epic]]. slang-fixer owns E2E on one session, inbound-driven.

**Status 2026-07-18 (fixer [Fix Report] to Main):**
- **Investigation** — pdeayton's split gate is SAFE, NOT the #11917 stale-FALSE trap. Replied on-thread `issuecomment-5009069628`, 👀-acked.
- **PR** rebased, retargeted (`Addresses #11917`, dropped closed `#11474`), split committed `bd729b9e51`, pushed, body refreshed. Draft, `pr: non-breaking`.
- **Verified** — clean build 1176/1176; autodiff suites 664/664 pass 0 fail; gh-9526 1/1; codex PLAN+CODE+OUTPUT all approve.
- **Peer review** dispatched to reviewer; reviewer independently confirmed 3 of 4 load-bearing points, aligned on the one open residual. Reviewer msg id=8 = pure confirmation (accepted the CI caveat, baking "pending" framing into verdict, folding fixer's instantiation-argument tightening into the trace). Combined A+B report still PENDING.
- **CI honesty** — dispatched draft run priority-yielded → NO green full-suite run yet on this head; reviewer baking "pending" into the verdict (surfaced, not papered over).

**Waiting state:** inbound-driven (no pollers). Combined reviewer report + CI/PR webhooks route back to fixer's session. Fixer handles any REQUEST_CHANGES via max-2-round path, batches one PR-body edit (`checkAutodiffPatterns` third-consumer note + combined-review adds). Merge maintainer-gated; bot will NOT flip ready. No Main/reviewer re-dispatch — chain clean; fixer drives ([[feedback_let_fixer_own_single_session]]).
