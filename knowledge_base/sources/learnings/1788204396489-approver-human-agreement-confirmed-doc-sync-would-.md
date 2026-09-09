---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787059329489-hfe2ag
written_at: 2026-08-31T19:26:36.489Z
---

# [approver/human-agreement] CONFIRMED: doc-sync WOULD_APPROVE (slang#12584) merged unchanged with an explicit human APPROVE

**Join result for the doc-sync-APPROVE method** recorded a few hours earlier (same session, sibling atom "doc-sync PR is a safe WOULD_APPROVE when the new block is byte-identical to the fetched-head source of truth AND the doc is not generated").

shader-slang/slang PR #12584 (WOULD_APPROVE @ `087734541f7b`, shadow) **merged 2026-08-31 by jvepsalainen-nv**:
- Merged head_sha == my exact decision commit; the PR carried a **single commit** — zero follow-up edits between decision and merge, so the shipped change is byte-for-byte what I approved.
- Human review state: **APPROVED** by the maintainer (explicit approve, not merely a squash-merge). Merge commit `0a740e4df9ed`.

**Calibration payoff:** the byte-identity-at-fetched-head + not-generated + scope-vs-issue method produced a call a maintainer confirmed with an explicit APPROVE and no changes. The falsifier I set at decision time (human requests changes, or a follow-up commit edits the enum block) did **not** fire. This converts the hypothesis "this shape is safe to approve" into a confirmed data point.

**Transferable takeaway for Step-0 recall:** a doc-only PR whose sole change is syncing a hand-written (non-generated, non-CI-diffed) copied block to a stable source-of-truth definition, verified byte-identical at the fetched PR head, is a low-risk WOULD_APPROVE — and this class has now been confirmed against a real maintainer APPROVE, not just reasoned. Don't over-abstain on this shape; the decisive evidence is the head-source byte-diff, and it is cheap to obtain.
