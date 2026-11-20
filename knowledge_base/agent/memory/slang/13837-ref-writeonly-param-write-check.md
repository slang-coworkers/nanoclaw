---
type: value
title: "slang#13837 — check that a __ref_writeonly parameter is only written"
description: Fixer chain; fix green at branch f019b7d90; PR creation deadlocked on the 11-17 critique-gate recording-layer outage; parked on operator critique_gate_bypass approval.
---

# slang#13837 — `__ref_writeonly` parameter write-check

- **Issue**: shader-slang/slang#13837 — check that a `__ref_writeonly` parameter is only
  written (E30119 acceptance matrix).
- **Fixer state (13:12Z 11-17 report)**: fix complete and green — branch
  `fix/issue-13837` @ `f019b7d90` (5 commits, 10 files, +235/−21; head commit
  "checker: restrict the write-only receiver rule to __ref_writeonly origins" + pinning test
  `tests/glsl-intrinsic/image/writeonly-image-read.slang`). Suites green per fixer:
  E30119 matrix 100%, ref-param-writeonly 4/4, glsl-intrinsic/image 39/39, 185/185 targeted,
  4070/4070 sweep. PR body (four-section repo-hook shape, 801 chars) approved at fixer-side
  `/workspace/agent/reports/13837-pr-body.md`.
- **Critiques attested by fixer**: PLAN_REVIEW approve (threads 01a1e8a1, re-affirmed
  01a1e962/01a1e988); CODE_REVIEW r1 REQUEST_CHANGES (F1: receiver rule overreached onto GLSL
  writeonly `.Store()`) → fixed in f019b7d90 → r2 approved (01a1e902); OUTPUT_REVIEW
  approve-with-nits, nit applied.
- **Main-verified 13:18Z**: no PR exists for the branch; ahead 5 / behind 4 of master; file
  list matches the fixer's claim exactly.
- **Deadlock (gate infra, not the work)**: deliver gate denies with all three stages
  "missing" because (a) container restarts wipe `workflow-state.json`, (b) the 12:36Z host
  move to a session-scoped state path (`/home/ubuntu/.../sess-.../.claude/workflow-state.json`)
  leaves a dangling symlink inside the fixer container — state neither readable nor writable
  in-container, (c) recorded rounds never carry threadId→stage/verdict mappings in this
  harness. Fixer correctly refuses to edit gate state; the wiki forbids orchestrator-side PR
  creation (breaks the `--body-file` attestation chain and audit trail). Sanctioned exit =
  `critique_gate_bypass` approval row (auto-mints on the third `gh pr create` deny).
- **Fleet context 11-17**: four sibling chains hit the same wall — pending bypass rows
  #14524 (appr-1794920189784-mcc8jb, 12:56Z), #14532 (appr-1794919772993-cfht69, 12:49Z),
  #14536 (appr-1794914545639-n36xs6, 11:22Z), #14539 (appr-1794913668209-8h676m, 11:07Z),
  all reason "missing critique stages". Evidence points to recording-layer false negatives
  (post-429 approved critiques unrecorded), not skipped reviews.
- **Actions 13:2xZ (this session)**: fixer instructed (in_reply_to its 13:12Z report, thread
  `gh-issue-shader-slang/slang-13837`) to check `ncl approvals list` for its row; else retry
  the identical one-step `gh pr create` (attested `--body-file`) up to the third deny so the
  row mints, then PARK — no further retries, no assumption of approval, no gate-state edits.
  Operator alerted on orchestrator-dashboard (new facts only; recommendation: adjudicate rows
  rather than hand-running the create; for #13837: Approve). One-shot re-check task
  `13837-gate-bypass-recheck` armed 16:20Z.
- **13:21Z mint outcome**: fixer executed 3 byte-exact `gh pr create` denials as instructed —
  **NO row auto-minted** (approvals queue unchanged as of 13:3xZ). Fixer parked correctly
  (anticipated this: "needs dashboard-side minting"). Mint mechanics indeterminate from
  outside: sibling sessions (created 04:11/07:12, also spanning the 12:36 move) minted fine
  11:07–12:56 after 3 deny→self-heal→deny cycles; this session has ≥4 denials across ≥2 turns
  with no row. Operator delta sent 13:3xZ.
- **Sibling rows are MOOT**: all four pending rows name chains whose PRs already existed
  when the rows minted (#14532 created 08:03Z < row 12:49Z; #14536 09:09Z < 11:22Z;
  #14539 10:17Z < 11:07Z) — queue cleanup items (spurious second-create denials), not blocked
  chains. **#13837 is the only genuinely blocked chain** (no PR exists).
- **16:20Z one-shot re-check (case 3 — nudge sent)**: no PR, no 13837 row, no operator
  response on the dashboard → ONE nudge to orchestrator-dashboard (id 7) with new facts:
  operator IS adjudicating (rows #14524 & #14539 cleared from the queue; a NEW #14530 row
  minted 16:02Z — minting works for other sessions, confirming the recording failure is
  confined to this fixer session's state path); #13837 still has NO row to adjudicate and is
  the only genuinely blocked chain (~3h parked). Remaining pending rows #14532/#14536 are
  moot (PRs pre-exist). Ask unchanged: hand-mint / state-path fix / direct attested create.
- **Next / resume rule (revised 13:3xZ)**: check `ncl approvals list` for a 13837 row AND
  `gh pr list -R shader-slang/slang --head fix/issue-13837` first. The unblock needs an
  operator action (hand-minted bypass row, state-path fix, or direct run of the byte-exact
  one-step with the fixer container's attested body file). Once the PR exists (however
  created), the fixer does the tail on its next wake: label `pr: non-breaking` (resolve
  exact name live via gh api), dispatch ci.yml on the branch, explanation comment,
  `report_pr_created`, report up. Do not burn more denial retries — the fixer stays parked.
