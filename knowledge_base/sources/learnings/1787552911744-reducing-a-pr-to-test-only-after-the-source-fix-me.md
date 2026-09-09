---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786734534539-5plq0h
written_at: 2026-08-24T06:28:31.744Z
---

# Reducing a PR to test-only after the source fix merged elsewhere: rebase mechanic + FileCheck whitespace trap

**Context:** A merged PR (#12417) turned out to contain — despite an FP-only title — the exact source hunk a sibling PR (#12548) was carrying (`[ForceUnroll]` on BOTH the float and integer `dot` fallbacks). Maintainer directed reducing #12548 to test-only. Two reusable gotchas surfaced.

**1. `git reset --soft origin/master` is the WRONG tool to rebase an old-based branch onto new master.** My branch was based on an old master; current master was hundreds of commits ahead. `git reset --soft origin/master` staged the ENTIRE old→new master delta as "my changes" (100+ files showed as `M`/`D`/`A`). That's because soft-reset moves HEAD but keeps the *index+worktree* at the old tree, so the diff-to-new-master is enormous. Correct recipe for "drop my source change, keep only my test, on current master":
  - Back up the file(s) to keep OUTSIDE the tree (`cp` to /tmp).
  - `git reset --hard origin/master` (worktree now = clean master).
  - `git submodule update --init <submodule>` for any submodule whose pointer master moved (a hard reset to master changes the recorded pointer but not the checked-out submodule working tree → shows as `M external/...`; sync it or you'll almost commit it).
  - Restore the kept file from backup, `git add` it, commit. Verify `git diff origin/master..HEAD --name-only` shows ONLY your intended files.

**2. `CHECK-NOT: for(` is whitespace-sensitive and can be quietly wrong.** A loop-absence check written as `-NOT: for(` (no space) does NOT match `for (` (with space). Slang's CPU/host emitter formats compute-grid loops as `for (z...)` (space) — so a claim like "a whole-output `-NOT: for(` would false-fail on CPP because of grid loops" is FALSE (they don't match the no-space pattern). Two takeaways: (a) don't invent a rationale about pattern-matching without measuring the actual emitted spacing (`grep -c 'for('` vs `grep -c 'for ('`); (b) prefer the whitespace-insensitive form `for{{[[:space:]]*}}(` so a later formatting change can't make the check vacuous — this `{{regex}}` idiom is valid FileCheck and used across shader-slang/slang tests (e.g. tests/autodiff/force-unroll-late-specialization.slang uses `{{[[:alnum:]_]+}}`). Verify it stays non-vacuous: the fixed output must have 0 matches of the space-insensitive pattern before you trust it.

**3. Keep cross-PR / coverage-decision narrative OUT of the test source comment** — it belongs in the PR body. A test's leading comment should state the invariant it guards + non-obvious mechanics (why operands are buffer/tid-derived, why `-NOT` brackets the anchor), not "target X is covered by PR #Y." codex flagged the latter as comment-hygiene must-fix.
