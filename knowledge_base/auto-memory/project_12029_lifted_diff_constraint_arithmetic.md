---
name: project_12029_lifted_diff_constraint_arithmetic
description: "#12029 lifted differentiable constraint arithmetic — COMMENT-state review POSTED, maintainer owns branch"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3e2ae75e-939c-4403-8fd3-4681e7722496
---

shader-slang/slang **#12029** "Allow arithmetic in lifted differentiable constraints" — **maintainer-authored** (saipraveenb25), not a bot `fix/issue-*` branch. **Fixer must NOT push commits to this branch** — author owns it; our role is the review only.

**State (2026-07-09):** `/slang-pr-review` complete. Verdict **APPROVE_WITH_NITS** — 0 bugs, 3 gaps. COMMENT-state review POSTED per Main authorization: [review 4666703945](https://github.com/shader-slang/slang/pull/12029#pullrequestreview-4666703945), state COMMENTED, author nv-slang-bot. Pinned SHA `ac959d7`.

**Fix:** `TryUnifyVals` integer branch now `return true` unconditionally (was `return okay`) so lifted differentiable constraints with arithmetic (`float[3+LatentCount]`) match. Sound at right layer — deepest tracers found no surviving miscompile (witness re-proved downstream).

**Kept nits (led with the first two):**
- **Gap 1** (A+C converged): unscoped `return true` reaches ALL `TryUnifyVals` callers; PR body still describes a witness-scoped `deferDependentIntValProof` flag that does NOT exist in the diff; no negative test proving `N+1`≠`N+2` still rejected.
- **Gap 2:** sole test is GPU-only → add `-cpu` directive (front-end fix, else skipped in GPU-less CI).
- Gap 3 dead-code half DROPPED (already fixed at `ac959d7`); comment-inaccuracy half kept as Minor.

**Process:** branch iterated 4× in ~2h; debounce adopted on inert push #4. Reviewer B (Devin) skipped — no Chrome in container (durable learning). ready-flip/merge operator-gated, untouched.

**Shadow-approval (slang-pr-approver):** ABSTAIN_POLICY / CLAUSE_FAIL:head_provenance @ `ac959d7` — head is a personal fork (saipraveenb25/slang), policy v0-shadow `allow_fork_head=false`, Step-1 short-circuit. Shadow-mode, nothing posted, ledger row written, both critique stages approved. Expected for a maintainer's own-fork PR → human maintainer approves.

**Push #5 (2026-07-10) = PURE REBASE, no re-post.** `ac959d7`→`dc08a39` merge-base moved (60-file master sprawl), but the PR's OWN diff is byte-identical — same sha256 `b62b992e4341`, same 2 files/184 lines. Reviewer correctly did NOT re-run (~$40/30min for identical findings) and did NOT re-pin footer (posted review honestly records `ac959d7`). All 3 nits still open at `dc08a39`; posted [review 4666703945](https://github.com/shader-slang/slang/pull/12029#pullrequestreview-4666703945) unchanged and valid.

**Re-trigger rule:** future push only warrants re-run if PR's own diff sha ≠ `b62b992e4341` (bare rebase won't). Standing re-review authorization holds.

**CHAIN HOLDING (terminal pending author).** Both review + shadow-approval decided; awaiting human maintainer / author action on nits. Substantive author reply or diff-changing push → re-engage via webhook on canonical thread `gh-issue-shader-slang/slang-12029`. See [[feedback_drafts_only_guardrail]], [[feedback_let_fixer_own_single_session]].
