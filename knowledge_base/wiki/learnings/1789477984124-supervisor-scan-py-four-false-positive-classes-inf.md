---
title: "Supervisor scan.py: four false-positive classes inflate awaiting_us and cause repeat false nudges"
type: learning
topic: agent-ops
source: learnings/1789477984124-supervisor-scan-py-four-false-positive-classes-inf.md
---

# Supervisor scan.py: four false-positive classes inflate awaiting_us and cause repeat false nudges

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-15T13:13:04.124Z
---

# Supervisor scan.py: four false-positive classes inflate awaiting_us and cause repeat false nudges

**Measured Tick 226 (2026-09-15):** all 12 `action='nudge'` chains replied "not blocked — false positive." Only #12918 was a real catch. The `awaiting_us=52` count was almost entirely noise. Four distinct scan.py classification gaps, each of which re-fires every tick until fixed (burning a fixer wake per chain per tick):

1. **Empty/plain maintainer APPROVE counted as "human spoke last, unanswered."** An APPROVE review with no inline comments/questions needs no reply — doubly so under the standing *silence-on-success* operator hold (bot posts route fixer→triager→operator, so we deliberately never reply on GitHub to a clean approval). Hit #13082, #12797, #13024 (empty approve, PR already MERGED), slang-rhi-850, slang-rhi-861. Fix: treat a maintainer APPROVE with no open threads/questions as `awaiting_human`/closed-pending-merge, not `awaiting_us`.

2. **Bot comments counted as human-last.** `coderabbitai[bot]` "review skipped — bot user" and `github-actions`/pr-board-sync comments are explicitly do-not-reply, yet chains whose *only* comments are these were classified `awaiting_us`. Hit #13082, slang-rhi-861, slang-rhi-862. Fix: exclude `[bot]` authors from the human-last discriminator (R4 already says bot comment ≠ human-last).

3. **CODEOWNERS auto-assignment counted as a human comment.** slang-rhi-860 (#868): the only non-bot timeline events were `jhelferty-nv assigned` + `review_requested` at PR-creation time — CODEOWNERS auto-assign, not a comment. Tripped the heuristic. Fix: `assigned`/`review_requested` timeline events are not comments.

4. **slangpy draft PRs not resolved → false `no PR`, triggers the fixer-owned-no-PR-silent nudge.** slangpy-1152→PR #1160 and slangpy-1155→PR #1158 exist (both `report_pr_created` done), but the pull showed `pr=None`. slangpy fixers use head branch `dev/slangpy-fixer/<n>`, NOT `fix/issue-<n>`; the PR-resolution heuristic misses it. Fix: resolve slangpy PRs by `Fixes #<n>` body / `pr_session_mappings`, not only the `fix/issue-` branch convention.

Also confirmed the **one real nudge value**: #12918's substantive reply had gone out as an *edit* to an existing comment (GitHub edits don't notify), so the maintainer was only ever pinged for the initial "on it" — genuinely `awaiting_us` from the human's side. The nudge caught it; the fixer posted a fresh @-mention. So the discriminator isn't worthless — but classes 1–4 give it a ~90% false-positive rate that should be cut in scan.py.

**Mitigation applied this tick:** recorded per-chain `disposition`+`supervisorNote` in supervisor-state.json for the 7 no-PR/held/approved false-positives (+ the discovered slangpy draft-PR artifacts) so at least the state reflects reality; but PR-bearing approval-terminal chains will re-trip until scan.py's human-last discriminator is fixed.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789477984124-supervisor-scan-py-four-false-positive-classes-inf.md`_
